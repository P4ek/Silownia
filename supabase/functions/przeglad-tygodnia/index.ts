// Supabase Edge Function: przeglad-tygodnia
// Verify JWT: WYŁĄCZONE - dwa tryby, funkcja sama sprawdza, kto pyta:
//  - apka (nagłówek Authorization z sesją): { tydzien_od } → zapisany przegląd albo nowy, gdy tydzień już się kończy
//    (od niedzieli 18:00 czasu warszawskiego) lub minął;
//  - cron „przeglad tygodnia” co godzinę (body { cron: true }): w niedzielę od 19:00 tworzy brakujące przeglądy
//    bieżącego tygodnia dla UZYTKOWNICY i wysyła push, o innej porze nadrabia brakujący poprzedni tydzień (bez pusha).
//    Każdy przegląd powstaje raz (unikalne user_id + tydzien_od).
// Claude dostaje 8 tygodni danych (treningi, nawyki, medytacja, wydatki, gotówka, cele, misja) i poprzedni przegląd
// z przyjętymi eksperymentami; odpowiada JSON-em wg SCHEMAT, zapisywanym w tabeli przeglady.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import webpush from "npm:web-push@3.6.7";

// Konta z przeglądem – te same co PRZEGLAD_DOSTEP_IDS w js/konfiguracja.js
const UZYTKOWNICY = ["1f1fc4a4-1b87-4ea7-9ddd-785873e98cbc", "7b44bfd8-d20d-45bc-872a-8633deff4798"];
const MODEL = "claude-opus-5-5";
const TYGODNIE = 8;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (dane: unknown, status = 200) =>
  new Response(JSON.stringify(dane), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ----- Daty (czas warszawski, ISO RRRR-MM-DD) -----
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dodajDni = (dzien: string, n: number) => iso(new Date(Date.parse(dzien) + n * 86400000));
const dzienTygodnia = (dzien: string) => new Date(Date.parse(dzien)).getUTCDay() || 7; // ISO: 1 = pn
const poniedzialek = (dzien: string) => dodajDni(dzien, 1 - dzienTygodnia(dzien));
const DNI = ["", "pn", "wt", "śr", "czw", "pt", "sob", "nd"];

function terazWarszawa() {
  const c = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { dzien: `${c.year}-${c.month}-${c.day}`, godzina: Number(c.hour) % 24 };
}

// Przegląd tygodnia można zrobić, gdy tydzień minął albo trwa jego niedziela od 18:00
function tydzienGotowy(od: string) {
  const t = terazWarszawa();
  const niedziela = dodajDni(od, 6);
  return t.dzien > niedziela || (t.dzien === niedziela && t.godzina >= 18);
}

// ----- Dane użytkownika jako zwięzły tekst dla modelu -----
type Seria = { "cieżar"?: number; powtorzenia?: number };
const wynikSerii = (p: Seria) => (Number(p["cieżar"]) || 0) * (Number(p.powtorzenia) || 0);
const kg = (n: number) => Math.round(n).toLocaleString("pl-PL");
const zl = (n: number) => Math.round(n).toLocaleString("pl-PL") + " zł";

async function zbierzDane(sb: SupabaseClient, uid: string, od: string) {
  const start = dodajDni(od, -7 * (TYGODNIE - 1));
  const koniec = dodajDni(od, 6);
  const [tr, nw, nwp, med, wyd, maj, cele, misja, poprz] = await Promise.all([
    sb.from("treningi").select("data, partia, cwiczenie, podejscia").eq("user_id", uid).lte("data", koniec),
    sb.from("nawyki").select("id, nazwa").eq("user_id", uid),
    sb.from("nawyki_wpisy").select("nawyk_id, data").eq("user_id", uid).gte("data", start).lte("data", koniec),
    sb.from("medytacje").select("data, minuty, ocena_przed, ocena_po").eq("user_id", uid).gte("data", start).lte("data", koniec),
    sb.from("wydatki").select("data, kwota, kategoria").eq("user_id", uid).gte("data", start).lte("data", koniec),
    sb.from("majatek_ruchy").select("konto, kwota, data, opis").eq("user_id", uid).lte("data", koniec),
    sb.from("cele_tygodniowe").select("tresc, zrealizowane").eq("user_id", uid).eq("tydzien_start", od),
    sb.from("zasady_wpisy").select("data, zadzialalo").eq("user_id", uid).gte("data", start).lte("data", koniec),
    sb.from("przeglady").select("tresc, przyjete").eq("user_id", uid).eq("tydzien_od", dodajDni(od, -7)).maybeSingle()
  ]);
  const blad = [tr, nw, nwp, med, wyd, maj, cele, misja, poprz].find((r) => r.error);
  if (blad) throw blad.error;

  const treningi = (tr.data || []) as { data: string; partia: string; cwiczenie: string; podejscia: Seria[] }[];
  const nawyki = nw.data || [];
  const wpisyNawykow = nwp.data || [];
  const medytacje = med.data || [];
  const wydatki = wyd.data || [];
  const gotowka = (maj.data || []).filter((r) => r.konto === "gotowka");

  // Dzień po dniu, od najstarszego
  const wiersze: string[] = [];
  const tygodnie: string[] = [];
  let aktywnosc = 0;
  for (let w = 0; w < TYGODNIE; w++) {
    const tOd = dodajDni(start, 7 * w);
    const s = { dniTr: 0, serie: 0, obj: 0, nawyki: 0, medSesje: 0, medMin: 0, medDelta: 0, medOcen: 0, wyd: 0, jedz: 0, misja: 0 };
    for (let d = 0; d < 7; d++) {
      const dzien = dodajDni(tOd, d);
      const trDnia = treningi.filter((t) => t.data === dzien);
      const obj = trDnia.reduce((a, t) => a + (t.podejscia || []).reduce((b, p) => b + wynikSerii(p), 0), 0);
      const serie = trDnia.reduce((a, t) => a + (t.podejscia || []).length, 0);
      const partie = [...new Set(trDnia.map((t) => t.partia))].join("+");
      const nawDnia = new Set(wpisyNawykow.filter((n) => n.data === dzien).map((n) => n.nawyk_id)).size;
      const medDnia = medytacje.filter((m) => m.data === dzien);
      const medMin = medDnia.reduce((a, m) => a + (Number(m.minuty) || 0), 0);
      const nastroj = medDnia.filter((m) => m.ocena_przed && m.ocena_po).map((m) => `${m.ocena_przed}→${m.ocena_po}`).join(",");
      const wydDnia = wydatki.filter((x) => x.data === dzien);
      const wydSuma = wydDnia.reduce((a, x) => a + Number(x.kwota), 0);
      const jedz = wydDnia.filter((x) => x.kategoria === "jedzenie").reduce((a, x) => a + Number(x.kwota), 0);
      const mis = (misja.data || []).some((m) => m.data === dzien && m.zadzialalo !== false);
      if (trDnia.length) { s.dniTr++; s.serie += serie; s.obj += obj; }
      s.nawyki += nawDnia; s.medSesje += medDnia.length; s.medMin += medMin; s.wyd += wydSuma; s.jedz += jedz;
      medDnia.forEach((m) => { if (m.ocena_przed && m.ocena_po) { s.medDelta += m.ocena_po - m.ocena_przed; s.medOcen++; } });
      if (mis) s.misja++;
      if (tOd === od) aktywnosc += trDnia.length + nawDnia + medDnia.length + wydDnia.length;
      wiersze.push([
        `${dzien} ${DNI[d + 1]}`,
        trDnia.length ? `trening ${partie} ${kg(obj)} kg/${serie} serii` : "bez treningu",
        nawyki.length ? `nawyki ${nawDnia}/${nawyki.length}` : "",
        medDnia.length ? `medytacja ${Math.round(medMin)} min${nastroj ? " nastrój " + nastroj : ""}` : "",
        wydDnia.length ? `wydatki ${zl(wydSuma)}${jedz ? " (jedzenie " + zl(jedz) + ")" : ""}` : "",
        mis ? "misja zaliczona" : ""
      ].filter(Boolean).join(" | "));
    }
    tygodnie.push(`${tOd}${tOd === od ? " (OCENIANY)" : ""}: treningi ${s.dniTr}, serie ${s.serie}, objętość ${kg(s.obj)} kg` +
      (nawyki.length ? `, nawyki ${Math.round(s.nawyki / (nawyki.length * 7) * 100)}%` : "") +
      `, medytacja ${s.medSesje} sesji/${Math.round(s.medMin)} min` + (s.medOcen ? ` (śr. zmiana nastroju ${(s.medDelta / s.medOcen).toFixed(1)})` : "") +
      `, wydatki ${zl(s.wyd)} (jedzenie ${zl(s.jedz)}), misja ${s.misja} dni`);
  }

  // Ćwiczenia ocenianego tygodnia: najlepsza seria vs najlepsza wcześniej
  const naj = (lista: typeof treningi) => {
    let best: Seria | null = null;
    lista.forEach((t) => (t.podejscia || []).forEach((p) => { if (!best || wynikSerii(p) > wynikSerii(best)) best = p; }));
    return best as Seria | null;
  };
  const cwiczenia = [...new Set(treningi.filter((t) => t.data >= od).map((t) => t.cwiczenie))].map((c) => {
    const teraz = naj(treningi.filter((t) => t.cwiczenie === c && t.data >= od));
    const przed = naj(treningi.filter((t) => t.cwiczenie === c && t.data < od));
    const opis = (p: Seria | null) => (p ? `${p["cieżar"]} kg × ${p.powtorzenia}` : "brak");
    const rekord = teraz && (!przed || wynikSerii(teraz) > wynikSerii(przed));
    return `${c}: ${opis(teraz)} (wcześniej najlepiej ${opis(przed)})${rekord ? " REKORD" : ""}`;
  });

  const nawykiTyg = nawyki.map((n) => {
    const ile = new Set(wpisyNawykow.filter((w) => w.nawyk_id === n.id && w.data >= od).map((w) => w.data)).size;
    return `${n.nazwa}: ${ile}/7`;
  });
  const saldo = (doDnia: string) => gotowka.filter((r) => r.data <= doDnia).reduce((a, r) => a + Number(r.kwota), 0);

  const poprzedni = poprz.data
    ? (poprz.data.tresc.eksperymenty || []).map((e: { tytul: string; opis: string; miara: string }, i: number) =>
      `- ${e.tytul}: ${e.opis} Miara: ${e.miara} [${(poprz.data!.przyjete || []).includes(i) ? "PRZYJĘTY" : "nieprzyjęty"}]`).join("\n")
    : "";

  const tekst = [
    `Oceniany tydzień: ${od} – ${koniec}.`,
    `\nTYGODNIE (od najstarszego):\n${tygodnie.join("\n")}`,
    `\nDZIEŃ PO DNIU:\n${wiersze.join("\n")}`,
    `\nĆWICZENIA W OCENIANYM TYGODNIU:\n${cwiczenia.join("\n") || "brak treningów"}`,
    nawyki.length ? `\nNAWYKI W OCENIANYM TYGODNIU:\n${nawykiTyg.join("\n")}` : "",
    (cele.data || []).length ? `\nCELE TYGODNIA:\n${(cele.data || []).map((c) => `${c.zrealizowane ? "[x]" : "[ ]"} ${c.tresc}`).join("\n")}` : "",
    gotowka.length ? `\nGOTÓWKA: ${zl(saldo(koniec))} na koniec tygodnia, zmiana w tygodniu ${zl(saldo(koniec) - saldo(dodajDni(od, -1)))}. Co poniedziałek z gotówki schodzi budżet na jedzenie, a niewydana reszta wraca.` : "",
    `\nEKSPERYMENTY Z POPRZEDNIEGO PRZEGLĄDU:\n${poprzedni || "brak poprzedniego przeglądu"}`
  ].filter(Boolean).join("\n");
  return { tekst, aktywnosc };
}

// ----- Claude -----
const SYSTEM = `Piszesz cotygodniowy przegląd życia jednej osoby na podstawie danych z jej aplikacji: treningi siłowe, nawyki, medytacja (z oceną nastroju przed i po, skala 1–5), wydatki, gotówka, cele tygodnia i „misja” (codzienne stosowanie zasady z książki). Przegląd czyta się na telefonie jako krótkie slajdy, więc pisz zwięźle.

Zasady:
- Każdy wniosek wynika z danych i zawiera konkretną liczbę z tych danych. Nie zgaduj niczego, czego w danych nie ma.
- Najcenniejsze są powiązania między dziedzinami i porównania z poprzednimi tygodniami, których sama osoba łatwo nie zauważy. Gdy powiązanie opiera się na kilku tygodniach albo kilku dniach, napisz, że to wstępna obserwacja.
- Brak danych w jakiejś dziedzinie to nie porażka: pomiń ją.
- Pisz po polsku, w drugiej osobie, bezpośrednio i życzliwie, bez moralizowania, emoji i wykrzykników. Unikaj form zależnych od płci (pisz „udało się zrobić”, „masz za sobą”, „wyszło”, a nie „zrobiłeś” czy „zrobiłaś”).
- naglowek: jedno zdanie do 8 słów, najważniejsza rzecz tygodnia.
- podsumowanie: 2 zdania.
- wnioski: dokładnie 3; tytul do 6 słów, tekst 1–2 zdania.
- eksperymenty: dokładnie 2 małe, konkretne zmiany na następny tydzień, które da się sprawdzić w tych samych danych; miara mówi krótko, po czym poznamy wynik.
- poprzednie: ocena każdego eksperymentu z poprzedniego przeglądu na podstawie ocenianego tygodnia; pusta lista, gdy poprzedniego przeglądu nie było. Nieprzyjęty eksperyment oceniaj tylko wtedy, gdy dane i tak na to pozwalają, inaczej werdykt bez_danych.`;

const SCHEMAT = {
  type: "object",
  additionalProperties: false,
  required: ["naglowek", "podsumowanie", "wnioski", "eksperymenty", "poprzednie"],
  properties: {
    naglowek: { type: "string" },
    podsumowanie: { type: "string" },
    wnioski: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dziedzina", "tytul", "tekst"],
        properties: {
          dziedzina: { type: "string", enum: ["trening", "nawyki", "medytacja", "pieniadze", "ogolne"] },
          tytul: { type: "string" },
          tekst: { type: "string" }
        }
      }
    },
    eksperymenty: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tytul", "opis", "miara"],
        properties: { tytul: { type: "string" }, opis: { type: "string" }, miara: { type: "string" } }
      }
    },
    poprzednie: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tytul", "werdykt", "komentarz"],
        properties: {
          tytul: { type: "string" },
          werdykt: { type: "string", enum: ["zadzialalo", "nie_zadzialalo", "bez_danych"] },
          komentarz: { type: "string" }
        }
      }
    }
  }
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

async function zapytajClaude(dane: string) {
  // fallbacks "default": gdy klasyfikator bezpieczeństwa odrzuci prośbę, API samo powtarza ją na zalecanym modelu
  // deno-lint-ignore no-explicit-any
  const parametry: any = {
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMAT } },
    system: SYSTEM,
    messages: [{ role: "user", content: dane }]
  };
  const odp = await anthropic.beta.messages.create(parametry);
  if (odp.stop_reason === "refusal") throw new Error("Model odmówił przygotowania przeglądu.");
  if (odp.stop_reason === "max_tokens") throw new Error("Przegląd przekroczył limit długości.");
  const tekst = odp.content.find((b: { type: string }) => b.type === "text");
  if (!tekst || tekst.type !== "text") throw new Error("Brak treści w odpowiedzi modelu.");
  return { tresc: JSON.parse(tekst.text), model: odp.model as string };
}

// Tworzy (albo zwraca już zapisany) przegląd tygodnia; null, gdy w tygodniu nie było żadnej aktywności
async function przeglad(sb: SupabaseClient, uid: string, od: string) {
  const { data: jest } = await sb.from("przeglady").select("id, tydzien_od, tresc, przyjete").eq("user_id", uid).eq("tydzien_od", od).maybeSingle();
  if (jest) return { przeglad: jest, nowy: false };
  const { tekst, aktywnosc } = await zbierzDane(sb, uid, od);
  if (!aktywnosc) return { przeglad: null, nowy: false };
  const { tresc, model } = await zapytajClaude(tekst);
  // Równoległe wywołanie (apka i cron) mogło zapisać pierwsze – wtedy zostaje tamten wiersz
  await sb.from("przeglady").upsert({ user_id: uid, tydzien_od: od, tresc, model }, { onConflict: "user_id,tydzien_od", ignoreDuplicates: true });
  const { data } = await sb.from("przeglady").select("id, tydzien_od, tresc, przyjete").eq("user_id", uid).eq("tydzien_od", od).single();
  return { przeglad: data, nowy: true };
}

// deno-lint-ignore no-explicit-any
async function wyslijPush(sb: SupabaseClient, uid: string, tresc: any) {
  const publiczny = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!publiczny) return;
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, publiczny, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const { data: subskrypcje } = await sb.from("push_subskrypcje").select("*").eq("user_id", uid);
  for (const sub of subskrypcje || []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(tresc));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await sb.from("push_subskrypcje").delete().eq("id", sub.id);
      else console.error("Błąd wysyłki push:", err);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    if (body.cron) {
      // Niedziela od 19:00: bieżący tydzień z pushem; o innej porze nadrabia brakujący poprzedni tydzień (bez pusha)
      const t = terazWarszawa();
      const niedzielaWieczor = dzienTygodnia(t.dzien) === 7 && t.godzina >= 19;
      const od = niedzielaWieczor ? poniedzialek(t.dzien) : dodajDni(poniedzialek(t.dzien), -7);
      const zrobione = [];
      for (const uid of UZYTKOWNICY) {
        try {
          const wynik = await przeglad(sb, uid, od);
          if (!wynik.nowy || !wynik.przeglad) continue;
          zrobione.push(uid);
          if (niedzielaWieczor) await wyslijPush(sb, uid, { title: "Przegląd tygodnia", tag: "przeglad-" + od, body: wynik.przeglad.tresc.naglowek });
        } catch (e) {
          console.error("Przegląd dla", uid, e);
        }
      }
      return json({ zrobione });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const { data: u } = await sb.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "Brak autoryzacji." }, 401);
    if (!UZYTKOWNICY.includes(uid)) return json({ error: "Brak dostępu do przeglądu." }, 403);
    const od = String(body.tydzien_od || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(od) || dzienTygodnia(od) !== 1) return json({ error: "Zła data tygodnia." }, 400);

    const { data: jest } = await sb.from("przeglady").select("id, tydzien_od, tresc, przyjete").eq("user_id", uid).eq("tydzien_od", od).maybeSingle();
    if (jest) return json({ przeglad: jest });
    if (!tydzienGotowy(od)) return json({ niedostepny: true });
    const wynik = await przeglad(sb, uid, od);
    return json({ przeglad: wynik.przeglad, pusty: !wynik.przeglad });
  } catch (e) {
    console.error(e);
    const tekst = e instanceof Anthropic.APIError ? `Błąd Claude API (${e.status})` : String(e instanceof Error ? e.message : e);
    return json({ error: tekst }, 500);
  }
});
