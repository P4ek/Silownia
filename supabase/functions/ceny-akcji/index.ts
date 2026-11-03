// Supabase Edge Function: ceny-akcji
// Verify JWT: WYŁĄCZONE - kod sam sprawdza zalogowanego użytkownika (jak analizuj-posliek)
// Notowania z Yahoo Finance (nieoficjalne API wykresów: AAPL = USA, CDR.WA = GPW), kursy walut z NBP (tabela A).
// Krypto z CoinGecko: symbol "CG:<id CoinGecko>:<TICKER>" (np. CG:bitcoin:BTC), cena od razu w PLN, zmiana z 24 h;
// wszystkie monety jednym zapytaniem. Opcjonalny sekret COINGECKO_API_KEY (klucz Demo) podnosi limit zapytań.
// Wspólny cache w tabeli ceny_akcji: cena odświeżana najwyżej co 5 min, kurs waluty co godzinę.
// Wejście: { symbole: ["AAPL", "CDR.WA", "CG:bitcoin:BTC"] }  Wyjście: { ceny: { SYMBOL: {...} }, kursy: { USD: 3.96, PLN: 1 }, nieznane: [...] }
// Wyszukiwanie monet: { szukaj_krypto: "pepe" }  Wyjście: { monety: [{ id, symbol, nazwa, ranga }] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CENA_WAZNA_MS = 5 * 60 * 1000;
const KURS_WAZNY_MS = 60 * 60 * 1000;
const MAKS_SYMBOLI = 40;
const LIMIT_CZASU_MS = 8000;
const WZOR_SYMBOLU = /^[A-Z0-9.\-]{1,15}$/;
const WZOR_KRYPTO = /^CG:[a-z0-9\-]{1,80}:[A-Z0-9]{1,15}$/;
const MAKS_PODPOWIEDZI = 6;
const COINGECKO = "https://api.coingecko.com/api/v3";

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

function zCoinGecko(sciezka: string) {
  const klucz = Deno.env.get("COINGECKO_API_KEY");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LIMIT_CZASU_MS);
  return fetch(COINGECKO + sciezka, {
    signal: ctrl.signal,
    headers: { "Accept": "application/json", ...(klucz ? { "x-cg-demo-api-key": klucz } : {}) },
  }).finally(() => clearTimeout(t));
}

// "cg:Bitcoin:btc" → "CG:bitcoin:BTC"; id CoinGecko małymi literami, ticker wielkimi
function normalizuj(s: unknown): string {
  const t = String(s).trim();
  const m = /^cg:([^:]+):([^:]+)$/i.exec(t);
  return m ? `CG:${m[1].toLowerCase()}:${m[2].toUpperCase()}` : t.toUpperCase();
}

// Wszystkie przeterminowane monety jednym zapytaniem; brak monety w odpowiedzi = nieznana, błąd = zostaje cache
async function odswiezKrypto(symbole: string[], cache: Map<string, Cena>, nieznane: string[]) {
  const teraz = Date.now();
  const doPobrania = symbole.filter((s) => {
    const c = cache.get(s);
    return !c || teraz - new Date(c.pobrano).getTime() > CENA_WAZNA_MS;
  });
  if (!doPobrania.length) return [];
  const ids = [...new Set(doPobrania.map((s) => s.split(":")[1]))];
  try {
    const r = await zCoinGecko(`/coins/markets?vs_currency=pln&ids=${encodeURIComponent(ids.join(","))}&per_page=250`);
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
    const lista = await r.json();
    const wgId = new Map<string, any>((Array.isArray(lista) ? lista : []).map((m: any) => [m.id, m]));
    const nowe: Cena[] = [];
    doPobrania.forEach((s) => {
      const m = wgId.get(s.split(":")[1]);
      if (!m || typeof m.current_price !== "number") {
        if (!cache.has(s)) nieznane.push(s);
        return;
      }
      const c: Cena = {
        symbol: s,
        nazwa: m.name || null,
        waluta: "PLN",
        cena: m.current_price,
        zmiana_proc: typeof m.price_change_percentage_24h === "number" ? m.price_change_percentage_24h : null,
        czas_notowania: m.last_updated || null,
        pobrano: new Date().toISOString(),
      };
      cache.set(s, c);
      nowe.push(c);
    });
    return nowe;
  } catch (e) {
    console.error("CoinGecko", String(e));
    return [];
  }
}

// Podpowiedzi monet do formularza: kolejność CoinGecko (wg kapitalizacji), bez monet bez rangi na końcu listy
async function szukajKrypto(fraza: string) {
  const r = await zCoinGecko(`/search?query=${encodeURIComponent(fraza)}`);
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const monety = ((await r.json())?.coins ?? []) as any[];
  return monety
    .filter((m) => typeof m.id === "string" && /^[a-z0-9\-]{1,80}$/.test(m.id) && /^[A-Za-z0-9]{1,15}$/.test(String(m.symbol)))
    .sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9))
    .slice(0, MAKS_PODPOWIEDZI)
    .map((m) => ({ id: m.id, symbol: String(m.symbol).toUpperCase(), nazwa: m.name, ranga: m.market_cap_rank ?? null }));
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
    if (typeof body.szukaj_krypto === "string") {
      const fraza = body.szukaj_krypto.trim().slice(0, 40);
      return odp({ monety: fraza.length >= 2 ? await szukajKrypto(fraza) : [] });
    }
    const symbole = [...new Set(
      (Array.isArray(body.symbole) ? body.symbole : [])
        .map(normalizuj)
        .filter((s: string) => WZOR_SYMBOLU.test(s) || WZOR_KRYPTO.test(s)),
    )].slice(0, MAKS_SYMBOLI) as string[];
    const krypto = symbole.filter((s) => WZOR_KRYPTO.test(s));
    const gieldowe = symbole.filter((s) => !WZOR_KRYPTO.test(s));
    if (!symbole.length) return odp({ ceny: {}, kursy: { PLN: 1 }, nieznane: [] });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cache = new Map<string, Cena>();
    const { data: zapisane } = await admin.from("ceny_akcji").select("*").in("symbol", symbole);
    (zapisane ?? []).forEach((c: Cena) => cache.set(c.symbol, { ...c, cena: Number(c.cena) }));

    const nieznane: string[] = [];
    const [noweAkcje, noweKrypto] = await Promise.all([
      odswiez(gieldowe, cache, CENA_WAZNA_MS, cenaZYahoo, nieznane),
      odswiezKrypto(krypto, cache, nieznane),
    ]);
    const nowe = [...noweAkcje, ...noweKrypto];

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
