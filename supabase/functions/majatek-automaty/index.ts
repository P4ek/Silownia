// Supabase Edge Function: majatek-automaty
// Verify JWT: WYŁĄCZONE - wywoływana co godzinę przez Supabase Cron, nie przez zalogowanego użytkownika.
// Wykonuje stałe ruchy z tabeli majatek_automaty (np. co poniedziałek o 7:00 −200 zł z gotówki na jedzenie):
// dopisuje wiersz do majatek_ruchy i wysyła push. Każda reguła wykonuje się raz na tydzień (kolumna ostatnio),
// a opuszczone wywołanie nadrabia przy następnym, więc usunięcie wpisu w apce nie dodaje go ponownie.
// Reguła z kategoria_wydatkow to budżet: przy wykonaniu rozlicza poprzedni tydzień – niewydana reszta wraca na konto
// („Zostało z: …”), a wydatki ponad budżet są z niego odejmowane („Ponad: …”).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (dane: unknown, status = 200) =>
  new Response(JSON.stringify(dane), { status, headers: { "Content-Type": "application/json" } });

// Dzisiejsza data, dzień tygodnia (ISO, 1 = pn) i godzina w Warszawie
function terazWarszawa() {
  const czesci = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
    }).formatToParts(new Date()).map((c) => [c.type, c.value])
  );
  const data = new Date(Date.UTC(Number(czesci.year), Number(czesci.month) - 1, Number(czesci.day)));
  return { data, dzien: data.getUTCDay() || 7, godzina: Number(czesci.hour) % 24 };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Ostatni dzień reguły, którego godzina już minęła
function ostatniTermin(dzien: number, godzina: number) {
  const t = terazWarszawa();
  let wstecz = (t.dzien - dzien + 7) % 7;
  if (wstecz === 0 && t.godzina < godzina) wstecz = 7;
  return iso(new Date(t.data.getTime() - wstecz * 86400000));
}

const zl = (n: number) => Math.abs(n).toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + " zł";
const KONTA: Record<string, string> = { gotowka: "gotówki", inwestycje: "inwestycji", side_hustle: "side hustle" };

Deno.serve(async () => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: automaty, error } = await supabase.from("majatek_automaty").select("*").eq("aktywny", true);
    if (error) throw error;

    const wykonane = [];
    for (const a of automaty || []) {
      const termin = ostatniTermin(a.dzien_tygodnia, a.godzina);
      if (termin < a.od_daty || (a.ostatnio && a.ostatnio >= termin)) continue;

      // Zajęcie terminu warunkową aktualizacją: dwa równoległe wywołania nie dodadzą wpisu dwa razy
      const { data: zajete } = await supabase.from("majatek_automaty")
        .update({ ostatnio: termin })
        .eq("id", a.id)
        .or(`ostatnio.is.null,ostatnio.lt.${termin}`)
        .select("id");
      if (!zajete || !zajete.length) continue;

      // Budżet z kategorią wydatków: rozliczenie poprzedniego tygodnia, o ile wtedy też był pobrany
      const ruchy = [];
      let rozliczenie = "";
      const poprzedni = iso(new Date(Date.parse(termin) - 7 * 86400000));
      if (a.kategoria_wydatkow && a.kwota < 0 && a.ostatnio === poprzedni) {
        const koniec = iso(new Date(Date.parse(termin) - 86400000));
        const { data: wydatki, error: bladW } = await supabase.from("wydatki").select("kwota")
          .eq("user_id", a.user_id).eq("kategoria", a.kategoria_wydatkow).gte("data", poprzedni).lte("data", koniec);
        if (bladW) {
          await supabase.from("majatek_automaty").update({ ostatnio: a.ostatnio }).eq("id", a.id);
          throw bladW;
        }
        const wydano = (wydatki || []).reduce((s: number, w: { kwota: number }) => s + Number(w.kwota), 0);
        const reszta = Math.round((-a.kwota - wydano) * 100) / 100;
        if (reszta !== 0) {
          const nazwa = a.opis.charAt(0).toLowerCase() + a.opis.slice(1);
          ruchy.push({
            user_id: a.user_id, konto: a.konto, data: koniec, kwota: reszta, automat_id: a.id,
            opis: (reszta > 0 ? "Zostało z: " : "Ponad: ") + nazwa
          });
          rozliczenie = reszta > 0
            ? " Z zeszłego tygodnia zostało " + zl(reszta) + " – wróciło do " + KONTA[a.konto] + "."
            : " W zeszłym tygodniu wydatki przekroczyły budżet o " + zl(reszta) + " – odjęte z " + KONTA[a.konto] + ".";
        }
      }
      ruchy.push({ user_id: a.user_id, konto: a.konto, data: termin, kwota: a.kwota, opis: a.opis, automat_id: a.id });

      const { error: blad } = await supabase.from("majatek_ruchy").insert(ruchy);
      if (blad) {
        await supabase.from("majatek_automaty").update({ ostatnio: a.ostatnio }).eq("id", a.id);
        throw blad;
      }
      wykonane.push(a.id);
      await wyslijPush(supabase, a.user_id, {
        title: a.opis,
        tag: "majatek-automat-" + a.id,
        body: (a.kwota < 0 ? "Odjęto " : "Dodano ") + zl(a.kwota) + (a.kwota < 0 ? " z " : " do ") + KONTA[a.konto] +
          " na ten tydzień." + rozliczenie
      });
    }
    return json({ wykonane });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function wyslijPush(supabase: any, userId: string, tresc: { title: string; tag: string; body: string }) {
  const publiczny = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!publiczny) return;
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, publiczny, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const { data: subskrypcje } = await supabase.from("push_subskrypcje").select("*").eq("user_id", userId);
  for (const sub of subskrypcje || []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(tresc));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subskrypcje").delete().eq("id", sub.id);
      } else {
        console.error("Błąd wysyłki push:", err);
      }
    }
  }
}
