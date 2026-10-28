// Supabase Edge Function: ceny-akcji
// Verify JWT: WYŁĄCZONE - kod sam sprawdza zalogowanego użytkownika (jak analizuj-posliek)
// Notowania z Yahoo Finance (nieoficjalne API wykresów: AAPL = USA, CDR.WA = GPW), kursy walut z NBP (tabela A).
// Wspólny cache w tabeli ceny_akcji: cena odświeżana najwyżej co 5 min, kurs waluty co godzinę.
// Wejście: { symbole: ["AAPL", "CDR.WA"] }  Wyjście: { ceny: { SYMBOL: {...} }, kursy: { USD: 3.96, PLN: 1 }, nieznane: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CENA_WAZNA_MS = 5 * 60 * 1000;
const KURS_WAZNY_MS = 60 * 60 * 1000;
const MAKS_SYMBOLI = 40;
const LIMIT_CZASU_MS = 8000;
const WZOR_SYMBOLU = /^[A-Z0-9.\-]{1,15}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function odp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Cena = {
  symbol: string;
  nazwa: string | null;
  waluta: string;
  cena: number;
  zmiana_proc: number | null;
  czas_notowania: string | null;
  pobrano: string;
};

async function pobierzZLimitem(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LIMIT_CZASU_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
  } finally {
    clearTimeout(t);
  }
}

// null = brak takiego symbolu; wyjątek = błąd sieci/Yahoo (wtedy zostaje stara cena z cache)
async function cenaZYahoo(symbol: string): Promise<Cena | null> {
  const r = await pobierzZLimitem(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const meta = (await r.json())?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  let waluta = String(meta.currency || "USD");
  let cena = meta.regularMarketPrice;
  // Giełda londyńska podaje ceny w pensach
  if (waluta === "GBp") {
    waluta = "GBP";
    cena = cena / 100;
  }
  const poprzednia = meta.chartPreviousClose ?? meta.previousClose;
  const zmiana = typeof meta.regularMarketChangePercent === "number"
    ? meta.regularMarketChangePercent
    : (typeof poprzednia === "number" && poprzednia > 0 ? (meta.regularMarketPrice / poprzednia - 1) * 100 : null);
  return {
    symbol,
    nazwa: meta.longName || meta.shortName || null,
    waluta,
    cena,
    zmiana_proc: zmiana,
    czas_notowania: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    pobrano: new Date().toISOString(),
  };
}

async function kursZNbp(waluta: string): Promise<Cena | null> {
  const r = await pobierzZLimitem(`https://api.nbp.pl/api/exchangerates/rates/a/${waluta.toLowerCase()}/?format=json`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`NBP ${r.status}`);
  const kurs = (await r.json())?.rates?.[0];
  if (!kurs || typeof kurs.mid !== "number") return null;
  return {
    symbol: `${waluta}PLN`,
    nazwa: `Kurs ${waluta}/PLN (NBP)`,
    waluta: "PLN",
    cena: kurs.mid,
    zmiana_proc: null,
    czas_notowania: new Date(kurs.effectiveDate).toISOString(),
    pobrano: new Date().toISOString(),
  };
}

// Odświeża przeterminowane wpisy; przy błędzie zostaje stary wpis z cache
async function odswiez(
  symbole: string[],
  cache: Map<string, Cena>,
  waznosc: number,
  pobierz: (s: string) => Promise<Cena | null>,
  nieznane: string[],
) {
  const teraz = Date.now();
  const doPobrania = symbole.filter((s) => {
    const c = cache.get(s);
    return !c || teraz - new Date(c.pobrano).getTime() > waznosc;
  });
  const nowe: Cena[] = [];
  await Promise.all(doPobrania.map(async (s) => {
    try {
      const c = await pobierz(s);
      if (c) {
        cache.set(s, c);
        nowe.push(c);
      } else if (!cache.has(s)) nieznane.push(s);
    } catch (e) {
      console.error(s, String(e));
    }
  }));
  return nowe;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const klient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await klient.auth.getUser();
    if (!user) return odp({ error: "Brak zalogowanego użytkownika." }, 401);

    const body = await req.json().catch(() => ({}));
    const symbole = [...new Set(
      (Array.isArray(body.symbole) ? body.symbole : [])
        .map((s: unknown) => String(s).trim().toUpperCase())
        .filter((s: string) => WZOR_SYMBOLU.test(s)),
    )].slice(0, MAKS_SYMBOLI) as string[];
    if (!symbole.length) return odp({ ceny: {}, kursy: { PLN: 1 }, nieznane: [] });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cache = new Map<string, Cena>();
    const { data: zapisane } = await admin.from("ceny_akcji").select("*").in("symbol", symbole);
    (zapisane ?? []).forEach((c: Cena) => cache.set(c.symbol, { ...c, cena: Number(c.cena) }));

    const nieznane: string[] = [];
    const nowe = await odswiez(symbole, cache, CENA_WAZNA_MS, cenaZYahoo, nieznane);

    // Kursy walut, w których notowane są pozycje
    const waluty = [...new Set(symbole.map((s) => cache.get(s)?.waluta).filter((w): w is string => !!w && w !== "PLN"))];
    const symboleKursow = waluty.map((w) => `${w}PLN`);
    if (symboleKursow.length) {
      const { data: kursyZapisane } = await admin.from("ceny_akcji").select("*").in("symbol", symboleKursow);
      (kursyZapisane ?? []).forEach((c: Cena) => cache.set(c.symbol, { ...c, cena: Number(c.cena) }));
      nowe.push(...await odswiez(symboleKursow, cache, KURS_WAZNY_MS, (s) => kursZNbp(s.slice(0, 3)), []));
    }

    if (nowe.length) {
      const { error } = await admin.from("ceny_akcji").upsert(nowe);
      if (error) console.error("Zapis cache:", error.message);
    }

    const ceny: Record<string, Cena> = {};
    symbole.forEach((s) => { if (cache.has(s)) ceny[s] = cache.get(s)!; });
    const kursy: Record<string, number> = { PLN: 1 };
    waluty.forEach((w) => { const k = cache.get(`${w}PLN`); if (k) kursy[w] = k.cena; });

    return odp({ ceny, kursy, nieznane });
  } catch (e) {
    console.error(e);
    return odp({ error: String(e) }, 500);
  }
});
