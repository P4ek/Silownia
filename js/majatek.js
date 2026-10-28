// Finanse → Majątek: gotówka (główna kwota) i dwa osobne konta – Inwestycje i Side hustle – których salda NIE wliczają się
// do gotówki. Tabela majatek_ruchy: jeden wiersz = wpłata (+) albo wypłata (−) na koncie; saldo konta = suma jego kwot.
// Tylko konta z FINANSE_DOSTEP_IDS (dostęp ustawia start.js). Dane wczytywane raz, przy pierwszym wejściu na ekran.
// Korzysta z pomocniczych funkcji finanse.js (kwoty, daty, usuwanie w dwóch stuknięciach, listy kluczowane).

const navMajatek = document.getElementById("nav-majatek");

const MAJ_KONTA = {
  gotowka: { nazwa: "Gotówka", dodaj: "Dodaj pieniądze", opis: "Wlicza się do majątku." },
  inwestycje: { nazwa: "Inwestycje", dodaj: "Inwestycje", opis: "Osobno od gotówki – nie zmienia głównej kwoty." },
  side_hustle: { nazwa: "Side hustle", dodaj: "Side hustle", opis: "Osobno od gotówki – nie zmienia głównej kwoty." }
};
const MAJ_NA_STRONIE = { gotowka: 15, inwestycje: 6, side_hustle: 6 };
const MAJ_MIESIACE_W = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];
const MAJ_KLUCZ_OTWARTE = "majatek-otwarte"; // localStorage: które osobne konta są rozwinięte

let majDostep = false;
let majWczytane = false;
let majLadowanie = false;
let majRuchy = [];              // [{ id, konto, data, kwota, opis }] malejąco po dacie
let majPokazane = Object.assign({}, MAJ_NA_STRONIE);
let majOknoKonto = "gotowka";
let majKierunek = 1;            // 1 = dodaję, -1 = odejmuję
let majZapisTrwa = false;
let majNowyId = null;           // świeżo dodany wiersz dostaje animację wjazdu

// Akcje (Inwestycje): pozycje z inwestycje_pozycje, ceny z Edge Function ceny-akcji
const MAJ_ODSWIEZANIE_MS = 5 * 60 * 1000; // tyle samo trzyma cache funkcji
let majPozycje = [];            // [{ id, symbol, ilosc }]
let majCeny = {};               // symbol -> { nazwa, waluta, cena, zmiana_proc, pobrano }
let majKursy = { PLN: 1 };      // waluta -> kurs PLN (NBP)
let majCenyStan = "brak";       // "brak" | "laduje" | "ok" | "blad"
let majRynek = "us";            // giełda w formularzu: "us" | "pl" (GPW = sufiks .WA)
let majAkcjeZapisTrwa = false;
let majNowaPozycja = null;

const majEl = {
  gotowka: document.getElementById("maj-gotowka"),
  fakty: document.getElementById("maj-fakty"),
  historiaLicznik: document.getElementById("maj-historia-licznik"),
  okno: document.getElementById("maj-okno"),
  oknoTytul: document.getElementById("maj-okno-tytul"),
  oknoOpis: document.getElementById("maj-okno-opis"),
  kierunek: document.getElementById("maj-kierunek"),
  kwota: document.getElementById("maj-kwota"),
  opis: document.getElementById("maj-opis"),
  data: document.getElementById("maj-data"),
  zapisz: document.getElementById("maj-zapisz")
};

function ustawDostepMajatku(dostep) {
  majDostep = dostep;
  navMajatek.hidden = !dostep;
  if (!dostep) {
    majRuchy = [];
    majPozycje = [];
    majCeny = {};
    majKursy = { PLN: 1 };
    majCenyStan = "brak";
    majWczytane = false;
    if (navMajatek.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
    }
  }
}

// ----- Pomocnicze -----
function majRuchyKonta(konto) {
  return majRuchy.filter(function (r) { return r.konto === konto; });
}

function majSaldo(konto) {
  return Math.round(finSuma(majRuchyKonta(konto)) * 100) / 100;
}

// Zmiana salda w bieżącym miesiącu
function majWMiesiacu(konto) {
  const poczatek = dzisiaj().slice(0, 8) + "01";
  return finSuma(majRuchyKonta(konto).filter(function (r) { return r.data >= poczatek; }));
}

function majZeZnakiem(n) {
  return (n > 0 ? "+" : "") + finZl(n);
}

function majSortuj() {
  majRuchy.sort(function (a, b) { return a.data === b.data ? b.id - a.id : (a.data < b.data ? 1 : -1); });
}

// ----- Wczytywanie -----
async function majWejscie() {
  if (!majDostep || majWczytane) return;
  majWczytane = true;
  majLadowanie = true;
  renderMajatek();
  const [ruchy, pozycje] = await Promise.all([
    db.from("majatek_ruchy")
      .select("id, konto, data, kwota, opis")
      .eq("user_id", finUid())
      .order("data", { ascending: false })
      .order("id", { ascending: false }),
    db.from("inwestycje_pozycje").select("id, symbol, ilosc").eq("user_id", finUid()).order("symbol")
  ]);
  majLadowanie = false;
  const error = ruchy.error || pozycje.error;
  if (error) {
    console.error(error);
    majWczytane = false;
    pokazToast("Nie udało się wczytać majątku.", "blad");
    renderMajatek();
    return;
  }
  majRuchy = (ruchy.data || []).map(function (r) { return Object.assign({}, r, { kwota: Number(r.kwota) }); });
  majPozycje = (pozycje.data || []).map(function (p) { return Object.assign({}, p, { ilosc: Number(p.ilosc) }); });
  renderMajatek();
  majOdswiezCeny();
}

// ----- Ceny akcji -----
// Pobiera ceny podanych symboli (domyślnie wszystkich pozycji); zwraca odpowiedź funkcji albo null przy błędzie
async function majPobierzCeny(symbole) {
  const { data, error } = await db.functions.invoke("ceny-akcji", { body: { symbole: symbole } });
  if (error || !data || data.error) {
    console.error(error || data);
    return null;
  }
  Object.assign(majCeny, data.ceny || {});
  Object.assign(majKursy, data.kursy || {});
  return data;
}

async function majOdswiezCeny() {
  if (!majPozycje.length || majCenyStan === "laduje") return;
  majCenyStan = "laduje";
  renderMajCenyStan();
  const wynik = await majPobierzCeny(majPozycje.map(function (p) { return p.symbol; }));
  majCenyStan = wynik ? "ok" : "blad";
  renderMajKafel("inwestycje");
  renderMajAkcje();
}

// Wartość pozycji w zł; null, gdy brak ceny albo kursu waluty
function majWartoscPozycji(p) {
  const c = majCeny[p.symbol];
  if (!c || !majKursy[c.waluta]) return null;
  return p.ilosc * c.cena * majKursy[c.waluta];
}

// Suma wartości i dzisiejszej zmiany pozycji z ceną; wyceniona = czy jest choć jedna cena
function majPortfel() {
  let wartosc = 0;
  let dzis = 0;
  let wyceniona = false;
  majPozycje.forEach(function (p) {
    const w = majWartoscPozycji(p);
    if (w === null) return;
    wyceniona = true;
    wartosc += w;
    const zm = majCeny[p.symbol].zmiana_proc;
    if (typeof zm === "number" && zm > -100) dzis += w * zm / (100 + zm);
  });
  return { wartosc: wartosc, dzis: dzis, wyceniona: wyceniona };
}

// "CDR.WA" → "CDR"; giełda z sufiksu
function majTicker(symbol) {
  return symbol.replace(/\.WA$/, "");
}

function majFormatCeny(cena, waluta) {
  return Number(cena).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + waluta;
}

function majFormatProc(p) {
  return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

// Liczba sztuk: przecinek albo kropka, do 6 miejsc; null dla pustej, błędnej lub ≤ 0
function majParsujIlosc(tekst) {
  const n = Number(String(tekst || "").replace(/\s/g, "").replace(",", "."));
  return isFinite(n) && n > 0 ? Math.round(n * 1e6) / 1e6 : null;
}

// ----- Rysowanie -----
function renderMajatek() {
  renderMajGotowka();
  Object.keys(MAJ_KONTA).forEach(renderMajListe);
  renderMajKafel("inwestycje");
  renderMajKafel("side_hustle");
  renderMajAkcje();
}

function renderMajGotowka() {
  if (majLadowanie && !majRuchy.length) {
    majEl.gotowka.textContent = "…";
    majEl.fakty.textContent = "";
    return;
  }
  const saldo = majSaldo("gotowka");
  majEl.gotowka.style.setProperty("--maj-znaki", finKwota(saldo, true).length);
  animujLiczbe(majEl.gotowka, saldo, function (n) { return finKwota(n, true); });
  majEl.gotowka.classList.toggle("maj-minus", saldo < 0);

  const ruchy = majRuchyKonta("gotowka");
  const fakty = [];
  if (ruchy.length) {
    const miesiac = majWMiesiacu("gotowka");
    fakty.push({ tekst: "w " + MAJ_MIESIACE_W[new Date().getMonth()], wartosc: majZeZnakiem(miesiac), klasa: majKlasaZnaku(miesiac) });
    const ostatni = ruchy[0];
    fakty.push({ tekst: "ostatnio", wartosc: ostatni.data === dzisiaj() ? "dziś" : finDzienMies(finDataZIso(ostatni.data)) });
  } else {
    fakty.push({ tekst: "Dodaj pierwszą kwotę, żeby zacząć liczyć.", wartosc: "" });
  }
  majRysujFakty(majEl.fakty, fakty);
}

// Pigułki faktów: [{ tekst, wartosc, klasa: "plus" | "minus" | "" }]
function majRysujFakty(kontener, fakty) {
  kontener.replaceChildren.apply(kontener, fakty.map(function (f) {
    const el = document.createElement("span");
    el.className = "maj-fakt" + (f.klasa ? " maj-fakt-" + f.klasa : "");
    el.append(f.tekst + (f.wartosc ? " " : ""));
    if (f.wartosc) {
      const b = document.createElement("strong");
      b.textContent = f.wartosc;
      el.append(b);
    }
    return el;
  }));
}

function majKlasaZnaku(n) {
  return n < 0 ? "minus" : (n > 0 ? "plus" : "");
}

// Saldo konta. Inwestycje z pozycjami: wartość rynkowa akcji (gdy są ceny), a wpłaty, zysk i zmiana dnia w pigułkach.
function renderMajKafel(konto) {
  const kafel = document.getElementById("maj-konto-" + konto);
  const saldoEl = kafel.querySelector("[data-saldo]");
  const miesiacEl = kafel.querySelector("[data-miesiac]");
  if (majLadowanie && !majRuchy.length) {
    saldoEl.textContent = "…";
    miesiacEl.textContent = "";
    return;
  }
  const wplacone = majSaldo(konto);
  const portfel = konto === "inwestycje" ? majPortfel() : null;
  const rynkowa = !!(portfel && portfel.wyceniona);
  const saldo = rynkowa ? Math.round(portfel.wartosc * 100) / 100 : wplacone;
  saldoEl.style.setProperty("--maj-znaki", finKwota(saldo, true).length);
  animujLiczbe(saldoEl, saldo, function (n) { return finKwota(n, true); });
  saldoEl.classList.toggle("maj-minus", saldo < 0);

  const ile = majRuchyKonta(konto).length;
  const miesiac = majWMiesiacu(konto);
  miesiacEl.hidden = rynkowa;
  miesiacEl.textContent = ile
    ? (miesiac ? majZeZnakiem(miesiac) + " w tym miesiącu" : "Bez zmian w tym miesiącu")
    : (konto === "inwestycje" ? "Dodaj akcje albo wpłatę." : "Jeszcze nic tu nie ma.");

  if (konto === "inwestycje") {
    const faktyEl = document.getElementById("maj-inw-fakty");
    faktyEl.hidden = !rynkowa;
    if (rynkowa) {
      const fakty = [{ tekst: "dziś", wartosc: majZeZnakiem(Math.round(portfel.dzis)), klasa: majKlasaZnaku(Math.round(portfel.dzis)) }];
      if (wplacone > 0) {
        const zysk = saldo - wplacone;
        fakty.push({ tekst: "wpłacone", wartosc: finZl(wplacone) });
        fakty.push({ tekst: "zysk", wartosc: majZeZnakiem(Math.round(zysk)) + " (" + majFormatProc(zysk / wplacone * 100) + ")", klasa: majKlasaZnaku(zysk) });
      }
      majRysujFakty(faktyEl, fakty);
    }
  }

  // Kwota na przycisku przełączającym, żeby było widać saldo bez rozwijania
  const przelacz = document.querySelector('.maj-przelacz[data-konto="' + konto + '"]');
  let wartosc = przelacz.querySelector(".maj-przelacz-wartosc");
  if (!wartosc) {
    wartosc = document.createElement("span");
    wartosc.className = "maj-przelacz-wartosc";
    przelacz.append(wartosc);
  }
  wartosc.textContent = ile || rynkowa ? finZl(saldo) : "";
}

// Lista akcji: kluczowana po symbolu, największa wartość u góry
function renderMajAkcje() {
  const lista = document.getElementById("maj-akcje-lista");
  const pozycje = majPozycje.slice().sort(function (a, b) {
    return (majWartoscPozycji(b) || 0) - (majWartoscPozycji(a) || 0) || a.symbol.localeCompare(b.symbol);
  });
  finSynchronizuj(lista, pozycje.map(function (p) { return p.symbol; }), function (symbol) {
    const wiersz = document.createElement("div");
    wiersz.className = "maj-akcja";
    wiersz.innerHTML =
      '<span class="maj-akcja-ticker"></span>' +
      '<span class="maj-akcja-teksty"><span class="maj-akcja-nazwa"></span><span class="maj-akcja-meta"></span></span>' +
      '<span class="maj-akcja-prawa"><span class="maj-akcja-wartosc"></span><span class="maj-akcja-zmiana"></span></span>';
    wiersz.querySelector(".maj-akcja-ticker").textContent = majTicker(symbol);
    const usun = finPrzyciskUsun("Usuń " + majTicker(symbol) + " z akcji");
    usun.addEventListener("click", function () {
      finPotwierdzKlik(usun, function () {
        usun.disabled = true;
        majUsunPozycje(symbol).finally(function () { usun.disabled = false; });
      });
    });
    wiersz.append(usun);
    return wiersz;
  }, function (wiersz, symbol, i, nowy) {
    const p = pozycje[i];
    const c = majCeny[symbol];
    const w = majWartoscPozycji(p);
    const ilosc = p.ilosc.toLocaleString("pl-PL", { maximumFractionDigits: 6 }) + " szt.";
    wiersz.querySelector(".maj-akcja-nazwa").textContent = c && c.nazwa ? c.nazwa : (symbol.endsWith(".WA") ? "GPW" : "USA");
    wiersz.querySelector(".maj-akcja-meta").textContent = c ? ilosc + " × " + majFormatCeny(c.cena, c.waluta) : ilosc;
    wiersz.querySelector(".maj-akcja-wartosc").textContent = w === null ? "–" : finZl(Math.round(w * 100) / 100);
    const zmianaEl = wiersz.querySelector(".maj-akcja-zmiana");
    const zm = c && typeof c.zmiana_proc === "number" ? Number(c.zmiana_proc) : null;
    zmianaEl.textContent = zm === null ? "" : majFormatProc(zm);
    zmianaEl.className = "maj-akcja-zmiana" + (zm > 0 ? " maj-plus" : zm < 0 ? " maj-minus-tekst" : "");
    if (nowy && majNowaPozycja === symbol) {
      finAnimujRaz(wiersz, "maj-wjazd");
      majNowaPozycja = null;
    }
  });
  renderMajCenyStan();
}

// Stan cen pod nagłówkiem "Akcje": godzina ostatniego pobrania, ładowanie albo błąd; stuknięcie odświeża
function renderMajCenyStan() {
  const btn = document.getElementById("maj-ceny-odswiez");
  btn.hidden = !majPozycje.length;
  btn.disabled = majCenyStan === "laduje";
  btn.classList.toggle("maj-ceny-blad", majCenyStan === "blad");
  if (majCenyStan === "laduje") {
    btn.textContent = "Pobieram ceny…";
    return;
  }
  if (majCenyStan === "blad") {
    btn.textContent = "Nie udało się pobrać cen · Ponów";
    return;
  }
  const czasy = majPozycje.map(function (p) { return majCeny[p.symbol] && majCeny[p.symbol].pobrano; }).filter(Boolean).sort();
  const najstarszy = czasy.length ? new Date(czasy[0]) : null;
  btn.textContent = najstarszy
    ? "Ceny z " + najstarszy.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) + " · Odśwież"
    : "Odśwież ceny";
}

// Lista ruchów konta: kluczowana po id, najnowsze u góry, "Pokaż więcej" dokłada kolejną stronę
function renderMajListe(konto) {
  const kontener = konto === "gotowka" ? document.getElementById("maj-historia") : document.getElementById("maj-konto-" + konto);
  const lista = kontener.querySelector("[data-lista]");
  const wiecej = kontener.querySelector("[data-wiecej]");
  const ruchy = majRuchyKonta(konto);
  const widoczne = ruchy.slice(0, majPokazane[konto]);
  wiecej.hidden = ruchy.length <= widoczne.length;

  if (konto === "gotowka") {
    majEl.historiaLicznik.textContent = majLadowanie || !ruchy.length ? "" : ruchy.length + " " + odmianaLiczby(ruchy.length, "wpis", "wpisy", "wpisów");
    let pusto = kontener.querySelector(".maj-pusto");
    if (!majLadowanie && !ruchy.length) {
      if (!pusto) {
        pusto = document.createElement("p");
        pusto.className = "maj-pusto";
        pusto.textContent = "Tu pojawi się każda dodana i odjęta kwota.";
        kontener.prepend(pusto);
      }
    } else if (pusto) pusto.remove();
  }

  finSynchronizuj(lista, widoczne.map(function (r) { return String(r.id); }), function (k) {
    const r = majRuchy.find(function (x) { return String(x.id) === k; });
    const wiersz = document.createElement("div");
    wiersz.className = "maj-ruch" + (r.kwota < 0 ? " maj-ruch-minus" : "");
    const znak = document.createElement("span");
    znak.className = "maj-ruch-znak";
    znak.setAttribute("aria-hidden", "true");
    znak.innerHTML = r.kwota < 0
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
    const teksty = document.createElement("span");
    teksty.className = "maj-ruch-teksty";
    const opis = document.createElement("span");
    opis.className = "maj-ruch-opis";
    opis.textContent = r.opis || (r.kwota < 0 ? "Odjęte" : "Dodane");
    const meta = document.createElement("span");
    meta.className = "maj-ruch-meta";
    meta.textContent = r.data === dzisiaj() ? "dziś" : finSkrotDnia(r.data) + " " + finDzienMies(finDataZIso(r.data));
    teksty.append(opis, meta);
    const kwota = document.createElement("span");
    kwota.className = "maj-ruch-kwota";
    kwota.textContent = (r.kwota < 0 ? "−" : "+") + finKwota(Math.abs(r.kwota));
    const usun = finPrzyciskUsun("Usuń wpis: " + (r.opis || MAJ_KONTA[konto].nazwa) + ", " + finZl(r.kwota));
    usun.addEventListener("click", function () {
      finPotwierdzKlik(usun, function () {
        usun.disabled = true;
        majUsun(r).finally(function () { usun.disabled = false; });
      });
    });
    wiersz.append(znak, teksty, kwota, usun);
    return wiersz;
  }, function (wiersz, k, i, nowy) {
    if (nowy && majNowyId === widoczne[i].id) {
      finAnimujRaz(wiersz, "maj-wjazd");
      majNowyId = null;
    }
  });
}

// ----- Okno dodawania -----
function majOtworzOkno(konto) {
  if (!majDostep) return;
  majOknoKonto = konto;
  majUstawKierunek(1);
  majEl.oknoTytul.textContent = MAJ_KONTA[konto].dodaj;
  majEl.oknoOpis.textContent = MAJ_KONTA[konto].opis;
  majEl.kwota.value = "";
  majEl.opis.value = "";
  majEl.data.value = dzisiaj();
  majEl.data.max = dzisiaj();
  majRenderZapisz();
  majEl.okno.showModal();
  majEl.kwota.focus();
}

function majUstawKierunek(k) {
  majKierunek = k;
  majEl.kierunek.querySelectorAll("button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(Number(b.dataset.kierunek) === k));
  });
  majEl.okno.classList.toggle("maj-okno-minus", k < 0);
  majRenderZapisz();
}

function majRenderZapisz() {
  const kwota = finParsujKwote(majEl.kwota.value);
  majEl.zapisz.disabled = majZapisTrwa || !kwota;
  majEl.zapisz.textContent = majZapisTrwa ? "Zapisuję…" : (kwota ? (majKierunek < 0 ? "Odejmij " : "Dodaj ") + finZl(kwota) : "Wpisz kwotę");
}

async function majZapisz() {
  const kwota = finParsujKwote(majEl.kwota.value);
  if (majZapisTrwa || !kwota) return;
  const data = majEl.data.value && majEl.data.value <= dzisiaj() ? majEl.data.value : dzisiaj();
  const wiersz = { konto: majOknoKonto, data: data, kwota: majKierunek * kwota, opis: majEl.opis.value.trim() || null };
  majZapisTrwa = true;
  majRenderZapisz();
  const { data: zapisany, error } = await db.from("majatek_ruchy").insert(wiersz).select("id, konto, data, kwota, opis").single();
  majZapisTrwa = false;
  majRenderZapisz();
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać kwoty.", "blad");
    return;
  }
  majRuchy.push(Object.assign({}, zapisany, { kwota: Number(zapisany.kwota) }));
  majSortuj();
  majNowyId = zapisany.id;
  majEl.okno.close();
  if (majOknoKonto !== "gotowka") majUstawOtwarte(majOknoKonto, true);
  renderMajatek();
  pokazToast((wiersz.kwota < 0 ? "Odjęto " : "Dodano ") + finZl(Math.abs(wiersz.kwota)) + " – " + MAJ_KONTA[majOknoKonto].nazwa.toLowerCase() + ".", "sukces");
}

async function majUsun(r) {
  const { error } = await db.from("majatek_ruchy").delete().eq("id", r.id).eq("user_id", finUid());
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć wpisu.", "blad");
    return;
  }
  majRuchy = majRuchy.filter(function (x) { return x.id !== r.id; });
  renderMajatek();
  pokazToast("Usunięto wpis.", "sukces");
}

// ----- Akcje: dodanie (albo zmiana liczby sztuk) i usunięcie -----
// Symbol sprawdzany w ceny-akcji przed zapisem: nieznany ticker nie trafia do bazy
async function majDodajPozycje() {
  const poleTicker = document.getElementById("maj-akcje-ticker");
  const poleIlosc = document.getElementById("maj-akcje-ilosc");
  const ticker = poleTicker.value.trim().toUpperCase().replace(/\.WA$/, "");
  const ilosc = majParsujIlosc(poleIlosc.value);
  if (majAkcjeZapisTrwa) return;
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    pokazToast("Wpisz ticker, np. " + (majRynek === "pl" ? "CDR" : "AAPL") + ".", "blad");
    poleTicker.focus();
    return;
  }
  if (ilosc === null) {
    pokazToast("Podaj liczbę sztuk większą od zera.", "blad");
    poleIlosc.focus();
    return;
  }
  const symbol = majRynek === "pl" ? ticker + ".WA" : ticker;
  majAkcjeZapisTrwa = true;
  majRenderAkcjeForm();
  const ceny = await majPobierzCeny([symbol]);
  if (!ceny || !ceny.ceny || !ceny.ceny[symbol]) {
    majAkcjeZapisTrwa = false;
    majRenderAkcjeForm();
    pokazToast(ceny
      ? "Nie znaleziono " + ticker + (majRynek === "pl" ? " na GPW." : " w USA. Spółka z GPW? Wybierz GPW.")
      : "Nie udało się sprawdzić tickera. Spróbuj za chwilę.", "blad");
    return;
  }
  const { data, error } = await db.from("inwestycje_pozycje")
    .upsert({ symbol: symbol, ilosc: ilosc }, { onConflict: "user_id,symbol" })
    .select("id, symbol, ilosc").single();
  majAkcjeZapisTrwa = false;
  majRenderAkcjeForm();
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać akcji.", "blad");
    return;
  }
  const byla = majPozycje.some(function (p) { return p.symbol === symbol; });
  majPozycje = majPozycje.filter(function (p) { return p.symbol !== symbol; })
    .concat([Object.assign({}, data, { ilosc: Number(data.ilosc) })]);
  if (!byla) majNowaPozycja = symbol;
  if (majCenyStan !== "laduje") majCenyStan = "ok";
  poleTicker.value = "";
  poleIlosc.value = "";
  renderMajKafel("inwestycje");
  renderMajAkcje();
  pokazToast((byla ? "Zmieniono liczbę sztuk " : "Dodano ") + ticker + ".", "sukces");
}

async function majUsunPozycje(symbol) {
  const { error } = await db.from("inwestycje_pozycje").delete().eq("symbol", symbol).eq("user_id", finUid());
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć akcji.", "blad");
    return;
  }
  majPozycje = majPozycje.filter(function (p) { return p.symbol !== symbol; });
  renderMajKafel("inwestycje");
  renderMajAkcje();
  pokazToast("Usunięto " + majTicker(symbol) + ".", "sukces");
}

function majRenderAkcjeForm() {
  const btn = document.getElementById("maj-akcje-dodaj");
  btn.disabled = majAkcjeZapisTrwa;
  btn.textContent = majAkcjeZapisTrwa ? "Sprawdzam…" : "Dodaj";
  document.querySelectorAll("#maj-rynek button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.rynek === majRynek));
  });
  document.getElementById("maj-akcje-ticker").placeholder = "Ticker, np. " + (majRynek === "pl" ? "CDR" : "AAPL");
}

// Ceny odświeżane co 5 min, tylko gdy ekran Majątek jest otwarty i apka widoczna
function majCzyWidoczny() {
  return !document.hidden && document.getElementById("widok-majatek").classList.contains("aktywny");
}

// ----- Osobne konta: rozwijane przyciskami, wybór zapamiętany na urządzeniu -----
function majUstawOtwarte(konto, otwarte) {
  document.getElementById("maj-konto-" + konto).hidden = !otwarte;
  document.querySelector('.maj-przelacz[data-konto="' + konto + '"]').setAttribute("aria-expanded", String(otwarte));
  try {
    const zapis = JSON.parse(localStorage.getItem(MAJ_KLUCZ_OTWARTE) || "{}");
    zapis[konto] = otwarte;
    localStorage.setItem(MAJ_KLUCZ_OTWARTE, JSON.stringify(zapis));
  } catch (e) {}
}

// ----- Budowa stałych elementów -----
(function majZbudujStale() {
  document.getElementById("maj-gwiazdy-tla").innerHTML = DZIS_PYL.slice(4, 16).map(function (d) {
    return '<circle class="dzis-pyl" cx="' + d.x + '" cy="' + d.y + '" r="' + d.r + '" style="animation-delay:' + d.opoznienie + 's"/>';
  }).join("");
  let zapis = {};
  try { zapis = JSON.parse(localStorage.getItem(MAJ_KLUCZ_OTWARTE) || "{}") || {}; } catch (e) {}
  ["inwestycje", "side_hustle"].forEach(function (konto) {
    document.getElementById("maj-konto-" + konto).hidden = !zapis[konto];
    document.querySelector('.maj-przelacz[data-konto="' + konto + '"]').setAttribute("aria-expanded", String(!!zapis[konto]));
  });
})();

// ----- Zdarzenia -----
navMajatek.addEventListener("click", majWejscie);

document.querySelectorAll("#widok-majatek [data-dodaj-konto]").forEach(function (btn) {
  btn.addEventListener("click", function () { majOtworzOkno(btn.dataset.dodajKonto); });
});

document.querySelectorAll("#widok-majatek .maj-przelacz").forEach(function (btn) {
  btn.addEventListener("click", function () {
    majUstawOtwarte(btn.dataset.konto, btn.getAttribute("aria-expanded") !== "true");
  });
});

document.querySelectorAll("#widok-majatek [data-wiecej]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const konto = btn.closest("[data-konto]").dataset.konto;
    majPokazane[konto] += MAJ_NA_STRONIE[konto];
    renderMajListe(konto);
  });
});

majEl.kierunek.addEventListener("click", function (e) {
  const btn = e.target.closest("button[data-kierunek]");
  if (btn) majUstawKierunek(Number(btn.dataset.kierunek));
});

// Pole kwoty: tylko cyfry i jeden przecinek, maks. 2 miejsca po przecinku (jak w Oszczędnościach)
majEl.kwota.addEventListener("input", function () {
  const surowe = majEl.kwota.value;
  let t = surowe.replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const i = t.indexOf(",");
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/,/g, "").slice(0, 2);
  if (t !== surowe) majEl.kwota.value = t;
  majRenderZapisz();
});

document.getElementById("maj-form").addEventListener("submit", function (e) {
  e.preventDefault();
  majZapisz();
});
document.getElementById("maj-anuluj").addEventListener("click", function () { majEl.okno.close(); });
// Stuknięcie w tło poza oknem zamyka je
majEl.okno.addEventListener("click", function (e) {
  if (e.target === majEl.okno) majEl.okno.close();
});

// ----- Akcje -----
document.getElementById("maj-rynek").addEventListener("click", function (e) {
  const btn = e.target.closest("button[data-rynek]");
  if (!btn) return;
  majRynek = btn.dataset.rynek;
  majRenderAkcjeForm();
});
document.getElementById("maj-akcje-form").addEventListener("submit", function (e) {
  e.preventDefault();
  majDodajPozycje();
});
document.getElementById("maj-akcje-ticker").addEventListener("input", function () {
  const pole = this;
  const t = pole.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (t !== pole.value) pole.value = t;
});
document.getElementById("maj-ceny-odswiez").addEventListener("click", majOdswiezCeny);
setInterval(function () { if (majCzyWidoczny()) majOdswiezCeny(); }, MAJ_ODSWIEZANIE_MS);
// Powrót do apki albo wejście na ekran po dłuższej przerwie: od razu świeże ceny
function majOdswiezJesliStare() {
  if (!majWczytane || !majCzyWidoczny()) return;
  const czasy = majPozycje.map(function (p) { return majCeny[p.symbol] && majCeny[p.symbol].pobrano; });
  const stare = czasy.some(function (c) { return !c || Date.now() - new Date(c).getTime() > MAJ_ODSWIEZANIE_MS; });
  if (stare) majOdswiezCeny();
}
document.addEventListener("visibilitychange", majOdswiezJesliStare);
navMajatek.addEventListener("click", function () { setTimeout(majOdswiezJesliStare, 200); });
