// Finanse → Oszczędności: tygodniowe budżety na kategorie (tabela budzety), wydatki (tabela wydatki)
// i suma zaoszczędzona od początku (widok oszczednosci, tylko odczyt). Tylko konta z FINANSE_DOSTEP_IDS (dostęp ustawia start.js).
// Zapytania: budżety i wydatki tylko oglądanego tygodnia + po jednym o sumę ogólną, najwcześniejszy tydzień i podpowiedzi "Często".
// Rysowanie punktowe: elementy list są kluczowane (kategoria / id wydatku) i tylko aktualizowane, a formularz nowego wydatku
// jest stałym HTML-em – pola tekstowe nie tracą fokusu przy zmianie danych.

const navFinanse = document.getElementById("nav-finanse");
const menuRozdzialFinanse = document.getElementById("menu-rozdzial-finanse");

const FIN_LICZBA_KOLOROW = 7;   // paleta --fin-k1..--fin-k7 w finanse.css; kolor kategorii = jej pozycja na liście
const FIN_CZESTO_MAKS = 6;
const FIN_ISKRA = dzisIskra(15, 15, 13); // ta sama czteroramienna gwiazdka co na ekranie Dziś
const FIN_FALA = "M0 6 Q14 0 28 6 T56 6 T84 6 T112 6 T140 6 V12 H0Z";

let finDostep = false;
let finTydzienOd = null;        // "RRRR-MM-DD" – poniedziałek oglądanego tygodnia
let finNajwczesniejszy = null;  // najwcześniejszy tydzien_od z budzety (null = brak danych)
let finBudzety = [];            // [{ kategoria, kwota }] oglądanego tygodnia
let finWydatki = [];            // [{ id, data, kategoria, kwota, opis }] oglądanego tygodnia
let finSumaOgolna = null;       // suma zaoszczedzone ze wszystkich tygodni
let finWczytane = false;
let finLadowanie = false;       // trwa wczytywanie oglądanego tygodnia
let finZapytanieNr = 0;         // chroni przed spóźnioną odpowiedzią po szybkim przełączaniu tygodni
let finWybranyDzien = null;     // dzień nowego wydatku (domyślnie dziś)
let finWybranaKat = null;       // kategoria nowego wydatku
let finCzesto = [];             // [{ opis, kategoria }] z 50 ostatnich wydatków
let finNowyWydatekId = null;    // świeżo dodany wiersz dostaje animację wjazdu
let finZapisTrwa = false;

const finEl = {
  zakres: document.getElementById("fin-tydzien-data"),
  poprzedni: document.getElementById("fin-tydzien-poprzedni"),
  nastepny: document.getElementById("fin-tydzien-nastepny"),
  etykieta: document.getElementById("fin-glowna-etykieta"),
  zostalo: document.getElementById("fin-zostalo"),
  budzetLacznie: document.getElementById("fin-budzet-lacznie"),
  dziennie: document.getElementById("fin-dziennie"),
  pasek: document.getElementById("fin-pasek-zuzycie"),
  dni: document.getElementById("fin-dni-gwiazdki"),
  wydaneZ: document.getElementById("fin-wydane-z"),
  fiolki: document.getElementById("fin-fiolki"),
  fiolkiPusto: document.getElementById("fin-fiolki-pusto"),
  panelPrzelacz: document.getElementById("fin-budzety-przelacz"),
  panel: document.getElementById("fin-budzety-panel"),
  panelInfo: document.getElementById("fin-panel-info"),
  panelLista: document.getElementById("fin-budzety-lista"),
  nowyDzien: document.getElementById("fin-nowy-dzien"),
  kwota: document.getElementById("fin-kwota"),
  kategorie: document.getElementById("fin-kategorie"),
  kropla: document.getElementById("fin-kategorie-kropla"),
  opis: document.getElementById("fin-opis"),
  czesto: document.getElementById("fin-czesto"),
  czestoLista: document.getElementById("fin-czesto-lista"),
  zapisz: document.getElementById("fin-zapisz"),
  wydatkiLicznik: document.getElementById("fin-wydatki-licznik"),
  wydatkiLista: document.getElementById("fin-wydatki-lista"),
  wydatkiPusto: document.getElementById("fin-wydatki-pusto"),
  tydzBudzet: document.getElementById("fin-tydz-budzet"),
  tydzWydano: document.getElementById("fin-tydz-wydano"),
  tydzZaoszczedzone: document.getElementById("fin-tydz-zaoszczedzone"),
  sumaOgolna: document.getElementById("fin-suma-ogolna")
};

function ustawDostepFinansow(dostep) {
  finDostep = dostep;
  menuRozdzialFinanse.hidden = !dostep;
  if (!dostep) {
    finTydzienOd = null;
    finNajwczesniejszy = null;
    finBudzety = [];
    finWydatki = [];
    finSumaOgolna = null;
    finCzesto = [];
    finWczytane = false;
    if (navFinanse.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
    }
  }
}

// ----- Pomocnicze -----
function finUid() {
  return sesjaUzytkownika && sesjaUzytkownika.user ? sesjaUzytkownika.user.id : null;
}

function finBiezacyTydzien() {
  return isoZDaty(poniedzialekTygodnia(new Date()));
}

function finDataZIso(iso) {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

function finPrzesunDni(iso, dni) {
  const d = finDataZIso(iso);
  return isoZDaty(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dni));
}

function finWTygodniu(iso) {
  return !!finTydzienOd && iso >= finTydzienOd && iso <= finPrzesunDni(finTydzienOd, 6);
}

// Kwota z pola: przecinek albo kropka, spacje ignorowane, zaokrąglenie do 2 miejsc; null dla pustej, błędnej lub ujemnej
function finParsujKwote(tekst) {
  const t = String(tekst == null ? "" : tekst).replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

// Kwota do wyświetlenia: bez groszy, gdy pełne złote ("42", "42,50"); zSieznakiem dodaje "−" dla ujemnych
function finKwota(n, zeZnakiem) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const tekst = Math.abs(v).toLocaleString("pl-PL", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return (zeZnakiem && v < 0 ? "−" : "") + tekst;
}

function finZl(n) {
  return finKwota(n, true) + " zł";
}

// Kwota wpisana do pola (przecinek, bez spacji tysięcy)
function finKwotaDoPola(n) {
  return n % 1 ? n.toFixed(2).replace(".", ",") : String(n);
}

function finDzienMies(d) {
  return d.getDate() + " " + MIESIACE_SKROT[d.getMonth()];
}

// "5 – 11 paź", "28 wrz – 4 paź", rok tylko spoza bieżącego
function finZakresTygodnia(od) {
  const p = finDataZIso(od);
  const n = finDataZIso(finPrzesunDni(od, 6));
  const poczatek = p.getMonth() === n.getMonth() ? String(p.getDate()) : finDzienMies(p);
  const rok = n.getFullYear() !== new Date().getFullYear() ? " " + n.getFullYear() : "";
  return poczatek + " – " + finDzienMies(n) + rok;
}

function finSkrotDnia(iso) {
  const d = finDataZIso(iso);
  return DNI_TYGODNIA_ETYKIETY[(d.getDay() + 6) % 7].toLowerCase();
}

function finSuma(lista) {
  return lista.reduce(function (s, x) { return s + (Number(x.kwota) || 0); }, 0);
}

function finWydanoKategorii(kategoria) {
  return finSuma(finWydatki.filter(function (w) { return w.kategoria === kategoria; }));
}

function finKolor(kategoria) {
  const i = finBudzety.findIndex(function (b) { return b.kategoria === kategoria; });
  return i < 0 ? "var(--fin-k-brak)" : "var(--fin-k" + ((i % FIN_LICZBA_KOLOROW) + 1) + ")";
}

function finSortujBudzety() {
  finBudzety.sort(function (a, b) { return a.kategoria.localeCompare(b.kategoria, "pl"); });
}

function finDomyslnyDzien() {
  const dzis = dzisiaj();
  return finWTygodniu(dzis) ? dzis : finPrzesunDni(finTydzienOd, 6);
}

function finPoprawWybor() {
  if (!finWybranyDzien || !finWTygodniu(finWybranyDzien) || finWybranyDzien > dzisiaj()) finWybranyDzien = finDomyslnyDzien();
  const jest = finBudzety.some(function (b) { return b.kategoria === finWybranaKat; });
  if (!jest) finWybranaKat = finBudzety.length ? finBudzety[0].kategoria : null;
}

// Synchronizacja listy elementów kluczowanych (data-klucz): istniejące są tylko aktualizowane, nowe tworzone, zbędne usuwane.
// Elementy przesuwane są tylko przy zmianie kolejności, więc pole z fokusem zostaje na miejscu.
function finSynchronizuj(kontener, klucze, utworz, aktualizuj, poczatek) {
  const istniejace = new Map();
  Array.from(kontener.children).forEach(function (el) {
    if (el.dataset.klucz !== undefined) istniejace.set(el.dataset.klucz, el);
  });
  let poprzedni = poczatek || null;
  klucze.forEach(function (k, i) {
    let el = istniejace.get(k);
    let nowy = false;
    if (el) istniejace.delete(k);
    else {
      el = utworz(k);
      el.dataset.klucz = k;
      nowy = true;
    }
    const ref = poprzedni ? poprzedni.nextElementSibling : kontener.firstElementChild;
    if (el !== ref) kontener.insertBefore(el, ref);
    aktualizuj(el, k, i, nowy);
    poprzedni = el;
  });
  istniejace.forEach(function (el) { el.remove(); });
}

// Usuwanie w dwóch stuknięciach: pierwsze uzbraja przycisk ("Usuń?"), drugie w ciągu 3,5 s usuwa
function finPotwierdzKlik(btn, akcja) {
  if (btn.classList.contains("fin-uzbrojony")) {
    finRozbroj(btn);
    akcja();
    return;
  }
  btn.classList.add("fin-uzbrojony");
  btn.textContent = "Usuń?";
  btn.setAttribute("aria-label", "Potwierdź usunięcie");
  btn._finTimer = setTimeout(function () { finRozbroj(btn); }, 3500);
}

function finRozbroj(btn) {
  clearTimeout(btn._finTimer);
  btn.classList.remove("fin-uzbrojony");
  btn.textContent = "×";
  btn.setAttribute("aria-label", btn.dataset.etykieta || "Usuń");
}

function finPrzyciskUsun(etykieta) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fin-usun";
  btn.dataset.etykieta = etykieta;
  btn.setAttribute("aria-label", etykieta);
  btn.textContent = "×";
  return btn;
}

// Jednorazowa animacja (fala, wjazd): klasa zdejmowana po zakończeniu, bez nieskończonych pętli
function finAnimujRaz(el, klasa) {
  el.classList.remove(klasa);
  void el.offsetWidth;
  el.classList.add(klasa);
}

// ----- Wczytywanie -----
// Wejście na ekran: przy pierwszym wejściu bieżący tydzień + najwcześniejszy tydzień + suma ogólna + podpowiedzi
function finWejscie() {
  if (!finDostep || finWczytane) return;
  finWczytane = true;
  finTydzienOd = finBiezacyTydzien();
  finWybranyDzien = dzisiaj();
  finLadowanie = true;
  renderFinanse();
  wczytajNajwczesniejszyTydzien();
  wczytajSumeOszczednosci();
  wczytajCzesteWydatki();
  wczytajTydzienFinansow(finTydzienOd);
}

async function wczytajNajwczesniejszyTydzien() {
  const { data, error } = await db
    .from("budzety")
    .select("tydzien_od")
    .eq("user_id", finUid())
    .order("tydzien_od", { ascending: true })
    .limit(1);
  if (error) {
    console.error(error);
    return;
  }
  const z = data && data[0] ? data[0].tydzien_od : null;
  if (z && (!finNajwczesniejszy || z < finNajwczesniejszy)) finNajwczesniejszy = z;
  renderFinNawigacje();
}

async function wczytajSumeOszczednosci() {
  const { data, error } = await db.from("oszczednosci").select("zaoszczedzone");
  if (error) {
    console.error(error);
    return;
  }
  finSumaOgolna = (data || []).reduce(function (s, r) { return s + (Number(r.zaoszczedzone) || 0); }, 0);
  renderFinSumaOgolna();
}

// "Często": 50 ostatnich wydatków, unikalne opisy (bez wielkości liter), najczęstsze pierwsze
async function wczytajCzesteWydatki() {
  const { data, error } = await db
    .from("wydatki")
    .select("opis, kategoria")
    .eq("user_id", finUid())
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) {
    console.error(error);
    return;
  }
  const poOpisie = new Map();
  (data || []).forEach(function (w, i) {
    const opis = (w.opis || "").trim();
    if (!opis) return;
    const k = opis.toLowerCase();
    const z = poOpisie.get(k);
    if (z) z.ile++;
    else poOpisie.set(k, { opis: opis, kategoria: w.kategoria, ile: 1, nr: i });
  });
  finCzesto = Array.from(poOpisie.values())
    .sort(function (a, b) { return b.ile - a.ile || a.nr - b.nr; })
    .slice(0, FIN_CZESTO_MAKS);
  renderFinCzesto();
}

async function wczytajTydzienFinansow(od) {
  const nr = ++finZapytanieNr;
  const uid = finUid();
  const nd = finPrzesunDni(od, 6);
  const [budz, wyd] = await Promise.all([
    db.from("budzety").select("kategoria, kwota").eq("user_id", uid).eq("tydzien_od", od),
    db.from("wydatki").select("id, data, kategoria, kwota, opis").eq("user_id", uid)
      .gte("data", od).lte("data", nd).order("id", { ascending: true })
  ]);
  if (nr !== finZapytanieNr) return;
  if (budz.error || wyd.error) {
    console.error(budz.error || wyd.error);
    finLadowanie = false;
    renderFinanse();
    pokazToast("Nie udało się wczytać finansów.", "blad");
    return;
  }
  let budzety = budz.data || [];
  if (!budzety.length) {
    budzety = await finSkopiujBudzety(od);
    if (nr !== finZapytanieNr) return;
  }
  finBudzety = budzety;
  finSortujBudzety();
  finWydatki = wyd.data || [];
  finLadowanie = false;
  renderFinanse();
  if (!finBudzety.length) finUstawPanel(true);
}

// Tydzień bez budżetów: kopia z ostatniego wcześniejszego tygodnia, który je ma, zapisana dla tego tygodnia
async function finSkopiujBudzety(od) {
  const uid = finUid();
  const ostatni = await db
    .from("budzety")
    .select("tydzien_od")
    .eq("user_id", uid)
    .lt("tydzien_od", od)
    .order("tydzien_od", { ascending: false })
    .limit(1);
  if (ostatni.error || !ostatni.data || !ostatni.data.length) {
    if (ostatni.error) console.error(ostatni.error);
    return [];
  }
  const zrodlo = await db
    .from("budzety")
    .select("kategoria, kwota")
    .eq("user_id", uid)
    .eq("tydzien_od", ostatni.data[0].tydzien_od);
  if (zrodlo.error || !zrodlo.data || !zrodlo.data.length) {
    if (zrodlo.error) console.error(zrodlo.error);
    return [];
  }
  const wiersze = zrodlo.data.map(function (b) { return { tydzien_od: od, kategoria: b.kategoria, kwota: b.kwota }; });
  const { error } = await db.from("budzety").upsert(wiersze, { onConflict: "user_id,tydzien_od,kategoria" });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się skopiować budżetów z poprzedniego tygodnia.", "blad");
    return [];
  }
  pokazToast("Skopiowano budżety z poprzedniego tygodnia.", "sukces");
  wczytajSumeOszczednosci();
  return zrodlo.data.map(function (b) { return { kategoria: b.kategoria, kwota: b.kwota }; });
}

// ----- Zapis -----
async function finZapiszBudzet(kategoria, kwota) {
  const od = finTydzienOd;
  kategoria = kategoria.trim();
  const { error } = await db
    .from("budzety")
    .upsert({ tydzien_od: od, kategoria: kategoria, kwota: kwota }, { onConflict: "user_id,tydzien_od,kategoria" });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać budżetu.", "blad");
    return false;
  }
  if (od !== finTydzienOd) return true;
  const istniejacy = finBudzety.find(function (b) { return b.kategoria === kategoria; });
  if (istniejacy) istniejacy.kwota = kwota;
  else {
    finBudzety.push({ kategoria: kategoria, kwota: kwota });
    finSortujBudzety();
  }
  if (!finNajwczesniejszy || od < finNajwczesniejszy) finNajwczesniejszy = od;
  renderFinanse();
  wczytajSumeOszczednosci();
  return true;
}

async function finUsunBudzet(kategoria) {
  const od = finTydzienOd;
  const { error } = await db
    .from("budzety")
    .delete()
    .eq("user_id", finUid())
    .eq("tydzien_od", od)
    .eq("kategoria", kategoria);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć kategorii.", "blad");
    return;
  }
  if (od === finTydzienOd) {
    finBudzety = finBudzety.filter(function (b) { return b.kategoria !== kategoria; });
    renderFinanse();
  }
  pokazToast("Usunięto kategorię.", "sukces");
  wczytajSumeOszczednosci();
}

async function finDodajWydatek(data, kwota, kategoria, opis) {
  const { data: wynik, error } = await db
    .from("wydatki")
    .insert({ data: data, kategoria: kategoria.trim(), kwota: kwota, opis: opis || null })
    .select("id, data, kategoria, kwota, opis")
    .single();
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać wydatku.", "blad");
    return false;
  }
  if (finWTygodniu(data)) {
    finWydatki.push(wynik);
    finNowyWydatekId = wynik.id;
    renderFinanse();
  }
  if (opis) finDopiszCzesto(opis, wynik.kategoria);
  pokazToast("Zapisano wydatek.", "sukces");
  wczytajSumeOszczednosci();
  return true;
}

async function finUsunWydatek(w) {
  const { error } = await db.from("wydatki").delete().eq("id", w.id);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć wydatku.", "blad");
    return;
  }
  finWydatki = finWydatki.filter(function (x) { return x.id !== w.id; });
  renderFinanse();
  pokazToast("Usunięto wydatek.", "sukces");
  wczytajSumeOszczednosci();
}

// Nowy opis trafia na początek podpowiedzi lokalnie, bez ponownego zapytania
function finDopiszCzesto(opis, kategoria) {
  const k = opis.toLowerCase();
  if (finCzesto.some(function (c) { return c.opis.toLowerCase() === k; })) return;
  finCzesto = [{ opis: opis, kategoria: kategoria }].concat(finCzesto).slice(0, FIN_CZESTO_MAKS);
  renderFinCzesto();
}

// ----- Rysowanie (punktowe) -----
function renderFinanse() {
  if (!finTydzienOd) return;
  finPoprawWybor();
  renderFinNawigacje();
  renderFinGlowna();
  renderFinFiolki();
  renderFinPanel();
  renderFinKategorie();
  renderFinCzesto();
  renderFinFormularz();
  renderFinWydatki();
  renderFinPodsumowanieTygodnia();
  renderFinSumaOgolna();
}

function renderFinNawigacje() {
  if (!finTydzienOd) return;
  finEl.zakres.textContent = finZakresTygodnia(finTydzienOd);
  const biezacy = finBiezacyTydzien();
  const najwczesniejszy = finNajwczesniejszy && finNajwczesniejszy < biezacy ? finNajwczesniejszy : biezacy;
  finEl.poprzedni.disabled = finTydzienOd <= najwczesniejszy;
  finEl.nastepny.disabled = finTydzienOd >= biezacy;
}

function renderFinGlowna() {
  const budzet = finSuma(finBudzety);
  const wydano = finSuma(finWydatki);
  const zostalo = budzet - wydano;
  const biezacy = finTydzienOd === finBiezacyTydzien();
  const dzis = dzisiaj();

  finEl.etykieta.textContent = biezacy ? "Zostało na tydzień" : "Zaoszczędzone";
  finEl.zostalo.textContent = finLadowanie ? "…" : finKwota(zostalo, true);
  finEl.zostalo.classList.toggle("fin-minus", !finLadowanie && zostalo < 0);
  finEl.budzetLacznie.textContent = finKwota(budzet);

  // Kwota dzienna: zostało / dni do końca tygodnia (z dzisiejszym); tylko bieżący tydzień
  finEl.dziennie.hidden = !biezacy || finLadowanie || budzet <= 0;
  if (biezacy && budzet > 0) {
    const dniZostalo = 7 - ((finDataZIso(dzis).getDay() + 6) % 7);
    finEl.dziennie.textContent = zostalo < 0 ? "limit przekroczony" : finKwota(zostalo / dniZostalo) + " zł / dzień";
    finEl.dziennie.classList.toggle("fin-minus", zostalo < 0);
  }

  const proc = budzet > 0 ? Math.min(100, (wydano / budzet) * 100) : (wydano > 0 ? 100 : 0);
  finEl.pasek.style.width = (finLadowanie ? 0 : proc) + "%";
  finEl.pasek.classList.toggle("fin-minus-tlo", zostalo < 0);

  // Gwiazdki dni: świeci, gdy wydatki dnia ≤ budżet tygodnia / 7; przyszłe dni puste i nieklikalne
  const limit = budzet / 7;
  Array.from(finEl.dni.children).forEach(function (btn, i) {
    const data = finPrzesunDni(finTydzienOd, i);
    const przyszly = data > dzis;
    const wydanoDnia = finSuma(finWydatki.filter(function (w) { return w.data === data; }));
    const oceniany = !przyszly && !finLadowanie && budzet > 0;
    const ok = oceniany && wydanoDnia <= limit + 0.005;
    btn.disabled = przyszly;
    btn.classList.toggle("on", ok);
    btn.classList.toggle("ponad", oceniany && !ok);
    btn.classList.toggle("dzis", data === dzis);
    btn.setAttribute("aria-pressed", String(data === finWybranyDzien));
    btn.querySelector(".fin-dzien-skrot").textContent = data === dzis ? "dziś" : finSkrotDnia(data);
    const d = finDataZIso(data);
    btn.setAttribute("aria-label", DNI_TYGODNIA_PELNE[i] + " " + finDzienMies(d) +
      (przyszly ? "" : ": wydano " + finZl(wydanoDnia) + (oceniany ? (ok ? ", w limicie" : ", ponad limit") : "")));
  });
}

function renderFinFiolki() {
  const wydano = finSuma(finWydatki);
  const budzet = finSuma(finBudzety);
  finEl.wydaneZ.textContent = finLadowanie ? "" : finKwota(wydano) + " z " + finKwota(budzet) + " zł wydane";

  finEl.fiolkiPusto.hidden = finLadowanie || finBudzety.length > 0;
  finEl.fiolkiPusto.textContent = "Brak budżetów w tym tygodniu. Dodaj pierwszą kategorię w panelu niżej.";

  finSynchronizuj(finEl.fiolki, finBudzety.map(function (b) { return b.kategoria; }), function () {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fin-fiolka";
    btn.innerHTML =
      '<span class="fin-rurka"><span class="fin-plyn">' +
      '<svg class="fin-fala" viewBox="0 0 140 12" preserveAspectRatio="none" aria-hidden="true"><path d="' + FIN_FALA + '"/></svg>' +
      '<svg class="fin-fala fin-fala-2" viewBox="0 0 140 12" preserveAspectRatio="none" aria-hidden="true"><path d="' + FIN_FALA + '"/></svg>' +
      '</span><span class="fin-fiolka-wartosc"></span></span><span class="fin-fiolka-nazwa"></span>';
    btn.addEventListener("click", function () { finWybierzKategorie(btn.dataset.klucz); });
    btn.addEventListener("animationend", function () { btn.classList.remove("fin-faluje"); });
    return btn;
  }, function (btn, kat, i, nowy) {
    const b = finBudzety[i];
    const limit = Number(b.kwota) || 0;
    const wyd = finWydanoKategorii(kat);
    const zostalo = limit - wyd;
    const ponad = zostalo < 0;
    const reszta = limit > 0 ? Math.max(0, zostalo / limit) : 0;
    const poziom = Math.max(ponad ? 10 : 6, Math.round(reszta * 100));

    btn.style.setProperty("--k", finKolor(kat));
    btn.classList.toggle("fin-przekroczone", ponad);
    btn.setAttribute("aria-pressed", String(kat === finWybranaKat));
    btn.setAttribute("aria-label", kat + ": zostało " + finZl(zostalo) + " z " + finZl(limit));
    btn.querySelector(".fin-plyn").style.height = poziom + "%";
    btn.querySelector(".fin-fiolka-wartosc").textContent = finKwota(Math.round(zostalo), true);
    btn.querySelector(".fin-fiolka-nazwa").textContent = kat;
    if (!nowy && btn.dataset.poziom !== String(poziom)) finAnimujRaz(btn, "fin-faluje");
    btn.dataset.poziom = String(poziom);
  });
}

function renderFinPanel() {
  finEl.panelInfo.textContent = "Zmiany dotyczą tylko tygodnia " + finZakresTygodnia(finTydzienOd) + ".";
  finSynchronizuj(finEl.panelLista, finBudzety.map(function (b) { return b.kategoria; }), function (kat) {
    const wiersz = document.createElement("div");
    wiersz.className = "fin-panel-wiersz";
    const kropka = document.createElement("span");
    kropka.className = "fin-kropka";
    const opis = document.createElement("span");
    opis.className = "fin-panel-opis";
    const nazwa = document.createElement("span");
    nazwa.className = "fin-panel-nazwa";
    nazwa.textContent = kat;
    const wydano = document.createElement("span");
    wydano.className = "fin-panel-wydano";
    opis.append(nazwa, wydano);

    const pole = document.createElement("input");
    pole.type = "text";
    pole.inputMode = "decimal";
    pole.autocomplete = "off";
    pole.className = "fin-panel-kwota";
    pole.setAttribute("aria-label", "Budżet: " + kat);
    pole.addEventListener("keydown", function (e) { if (e.key === "Enter") pole.blur(); });
    pole.addEventListener("change", async function () {
      const b = finBudzety.find(function (x) { return x.kategoria === kat; });
      if (!b) return;
      const kwota = finParsujKwote(pole.value);
      if (kwota === null) {
        pokazToast("Podaj poprawną kwotę (nieujemną).", "blad");
        pole.value = finKwotaDoPola(Number(b.kwota) || 0);
        return;
      }
      if (kwota === Number(b.kwota)) return;
      if (await finZapiszBudzet(kat, kwota)) pokazToast("Zmieniono budżet.", "sukces");
    });
    const zl = document.createElement("span");
    zl.className = "fin-panel-zl";
    zl.textContent = "zł";

    const usun = finPrzyciskUsun("Usuń kategorię " + kat);
    usun.addEventListener("click", function () { finPotwierdzKlik(usun, function () { finUsunBudzet(kat); }); });

    wiersz.append(kropka, opis, pole, zl, usun);
    return wiersz;
  }, function (wiersz, kat, i) {
    const b = finBudzety[i];
    wiersz.style.setProperty("--k", finKolor(kat));
    wiersz.querySelector(".fin-panel-wydano").textContent = "wydano " + finZl(finWydanoKategorii(kat));
    const pole = wiersz.querySelector("input");
    const wartosc = finKwotaDoPola(Number(b.kwota) || 0);
    if (document.activeElement !== pole && pole.dataset.wartosc !== wartosc) pole.value = wartosc;
    pole.dataset.wartosc = wartosc;
  });
}

function finUstawPanel(otwarty) {
  finEl.panel.hidden = !otwarty;
  finEl.panelPrzelacz.setAttribute("aria-expanded", String(otwarty));
}

function renderFinKategorie() {
  finSynchronizuj(finEl.kategorie, finBudzety.map(function (b) { return b.kategoria; }), function (kat) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fin-kat";
    btn.innerHTML = '<span class="fin-kropka" aria-hidden="true"></span><span class="fin-kat-nazwa"></span>';
    btn.querySelector(".fin-kat-nazwa").textContent = kat;
    btn.addEventListener("click", function () { finWybierzKategorie(kat); });
    return btn;
  }, function (btn, kat) {
    btn.style.setProperty("--k", finKolor(kat));
    btn.setAttribute("aria-pressed", String(kat === finWybranaKat));
  }, finEl.kropla);
  finEl.kategorie.classList.toggle("fin-kategorie-pusto", !finBudzety.length);
  finUstawKrople();
}

// Szklana kropla pod wybraną kategorią (pozycja z układu przycisku, płynne przejście w CSS)
function finUstawKrople() {
  const wybrany = finEl.kategorie.querySelector('.fin-kat[aria-pressed="true"]');
  if (!wybrany) {
    finEl.kropla.style.opacity = "0";
    return;
  }
  if (!wybrany.offsetWidth) return; // ekran ukryty – przeliczy ResizeObserver po pokazaniu
  finEl.kropla.style.opacity = "1";
  finEl.kropla.style.transform = "translateX(" + wybrany.offsetLeft + "px)";
  finEl.kropla.style.width = wybrany.offsetWidth + "px";
}

function renderFinCzesto() {
  finEl.czesto.hidden = !finCzesto.length;
  finSynchronizuj(finEl.czestoLista, finCzesto.map(function (c) { return c.opis.toLowerCase(); }), function () {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fin-czesty";
    btn.innerHTML = '<span class="fin-kropka" aria-hidden="true"></span><span class="fin-czesty-nazwa"></span>';
    btn.addEventListener("click", function () {
      const c = finCzesto.find(function (x) { return x.opis.toLowerCase() === btn.dataset.klucz; });
      if (!c) return;
      finEl.opis.value = c.opis;
      if (finBudzety.some(function (b) { return b.kategoria === c.kategoria; })) finWybierzKategorie(c.kategoria);
      else renderFinFormularz();
    });
    return btn;
  }, function (btn, k, i) {
    const c = finCzesto[i];
    btn.querySelector(".fin-czesty-nazwa").textContent = c.opis;
    btn.style.setProperty("--k", finKolor(c.kategoria));
    btn.setAttribute("aria-pressed", String(finEl.opis.value.trim().toLowerCase() === k));
    btn.setAttribute("aria-label", c.opis + " (" + c.kategoria + ")");
  });
}

function renderFinFormularz() {
  const d = finDataZIso(finWybranyDzien);
  finEl.nowyDzien.textContent = (finWybranyDzien === dzisiaj() ? "dziś" : finSkrotDnia(finWybranyDzien)) + ", " + finDzienMies(d);
  const kwota = finParsujKwote(finEl.kwota.value);
  const gotowy = !!(kwota && finWybranaKat);
  finEl.zapisz.textContent = gotowy
    ? "Zapisz " + finKwota(kwota) + " zł · " + finWybranaKat
    : (!finBudzety.length && !finLadowanie ? "Najpierw dodaj budżet" : "Wpisz kwotę");
  finEl.zapisz.classList.toggle("fin-gotowy", gotowy);
  finEl.zapisz.setAttribute("aria-disabled", String(!gotowy || finZapisTrwa));
  Array.from(finEl.czestoLista.children).forEach(function (btn) {
    btn.setAttribute("aria-pressed", String(finEl.opis.value.trim().toLowerCase() === btn.dataset.klucz));
  });
}

function renderFinWydatki() {
  const lista = finWydatki.slice().sort(function (a, b) {
    return a.data === b.data ? b.id - a.id : (a.data < b.data ? 1 : -1);
  });
  const n = lista.length;
  finEl.wydatkiLicznik.textContent = finLadowanie ? "" : n + " " + odmianaLiczby(n, "wydatek", "wydatki", "wydatków") + " w tym tygodniu";
  finEl.wydatkiPusto.hidden = finLadowanie || n > 0;
  finEl.wydatkiPusto.textContent = "Brak wydatków w tym tygodniu.";

  finSynchronizuj(finEl.wydatkiLista, lista.map(function (w) { return String(w.id); }), function (k) {
    const w = finWydatki.find(function (x) { return String(x.id) === k; });
    const wiersz = document.createElement("div");
    wiersz.className = "fin-wydatek";
    const znaczek = document.createElement("span");
    znaczek.className = "fin-znaczek";
    znaczek.setAttribute("aria-hidden", "true");
    znaczek.textContent = (w.kategoria || "?").charAt(0).toUpperCase();
    const teksty = document.createElement("span");
    teksty.className = "fin-wydatek-teksty";
    const opis = document.createElement("span");
    opis.className = "fin-wydatek-opis";
    opis.textContent = w.opis || w.kategoria;
    const meta = document.createElement("span");
    meta.className = "fin-wydatek-meta";
    meta.textContent = w.kategoria + ", " + (w.data === dzisiaj() ? "dziś" : finSkrotDnia(w.data) + " " + finDzienMies(finDataZIso(w.data)));
    teksty.append(opis, meta);
    const kwota = document.createElement("span");
    kwota.className = "fin-wydatek-kwota";
    kwota.textContent = "−" + finKwota(w.kwota);
    const usun = finPrzyciskUsun("Usuń wydatek: " + (w.opis || w.kategoria) + ", " + finZl(w.kwota));
    usun.addEventListener("click", function () {
      finPotwierdzKlik(usun, function () {
        usun.disabled = true;
        finUsunWydatek(w).finally(function () { usun.disabled = false; });
      });
    });
    wiersz.append(znaczek, teksty, kwota, usun);
    return wiersz;
  }, function (wiersz, k, i, nowy) {
    wiersz.style.setProperty("--k", finKolor(lista[i].kategoria));
    if (nowy && finNowyWydatekId === lista[i].id) {
      finAnimujRaz(wiersz, "fin-wjazd");
      finNowyWydatekId = null;
    }
  });
}

function renderFinPodsumowanieTygodnia() {
  const budzet = finSuma(finBudzety);
  const wydano = finSuma(finWydatki);
  const zaoszczedzone = budzet - wydano;
  finEl.tydzBudzet.textContent = finLadowanie ? "…" : finZl(budzet);
  finEl.tydzWydano.textContent = finLadowanie ? "…" : finZl(wydano);
  finEl.tydzZaoszczedzone.textContent = finLadowanie ? "…" : finZl(zaoszczedzone);
  finEl.tydzZaoszczedzone.classList.toggle("fin-minus", !finLadowanie && zaoszczedzone < 0);
}

function renderFinSumaOgolna() {
  finEl.sumaOgolna.textContent = finSumaOgolna === null ? "…" : finKwota(finSumaOgolna, true);
  finEl.sumaOgolna.classList.toggle("fin-minus", finSumaOgolna !== null && finSumaOgolna < 0);
}

// ----- Akcje -----
function finWybierzKategorie(kat) {
  finWybranaKat = kat;
  renderFinFiolki();
  renderFinKategorie();
  renderFinFormularz();
}

function finZmienTydzien(przesuniecie) {
  if (!finTydzienOd) return;
  finTydzienOd = finPrzesunDni(finTydzienOd, przesuniecie);
  finBudzety = [];
  finWydatki = [];
  finWybranyDzien = finDomyslnyDzien();
  finLadowanie = true;
  renderFinanse();
  wczytajTydzienFinansow(finTydzienOd);
}

async function finZapiszWydatek() {
  if (finZapisTrwa) return;
  const kwota = finParsujKwote(finEl.kwota.value);
  if (!finBudzety.length || !finWybranaKat) {
    pokazToast("Najpierw dodaj budżet kategorii.", "blad");
    finUstawPanel(true);
    return;
  }
  if (kwota === null || kwota === 0) {
    pokazToast("Podaj kwotę większą od zera.", "blad");
    finEl.kwota.focus();
    return;
  }
  finZapisTrwa = true;
  renderFinFormularz();
  const ok = await finDodajWydatek(finWybranyDzien, kwota, finWybranaKat, finEl.opis.value.trim());
  finZapisTrwa = false;
  if (ok) {
    finEl.kwota.value = "";
    finEl.opis.value = "";
  }
  renderFinFormularz();
}

// ----- Budowa stałych elementów -----
(function finZbudujStale() {
  // Tło: kilkanaście drobnych gwiazd z pyłu ekranu Dziś (te same pozycje i animacja .dzis-pyl)
  document.getElementById("fin-gwiazdy-tla").innerHTML = DZIS_PYL.slice(0, 14).map(function (d) {
    return '<circle class="dzis-pyl" cx="' + d.x + '" cy="' + d.y + '" r="' + d.r + '" style="animation-delay:' + d.opoznienie + 's"/>';
  }).join("");

  // 7 przycisków-gwiazdek dni (stan ustawia renderFinGlowna)
  for (let i = 0; i < 7; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fin-dzien";
    btn.innerHTML = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="' + FIN_ISKRA + '"/></svg><span class="fin-dzien-skrot"></span>';
    btn.addEventListener("click", function () {
      if (!finTydzienOd || btn.disabled) return;
      finWybranyDzien = finPrzesunDni(finTydzienOd, i);
      renderFinGlowna();
      renderFinFormularz();
    });
    finEl.dni.appendChild(btn);
  }
})();

// ----- Zdarzenia -----
navFinanse.addEventListener("click", finWejscie);

finEl.poprzedni.addEventListener("click", function () { finZmienTydzien(-7); });
finEl.nastepny.addEventListener("click", function () {
  if (finTydzienOd && finTydzienOd < finBiezacyTydzien()) finZmienTydzien(7);
});

finEl.panelPrzelacz.addEventListener("click", function () { finUstawPanel(finEl.panel.hidden); });

document.getElementById("fin-budzet-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const poleNazwa = document.getElementById("fin-budzet-nazwa");
  const poleKwota = document.getElementById("fin-budzet-kwota");
  const nazwa = poleNazwa.value.trim();
  const kwota = finParsujKwote(poleKwota.value);
  if (!finTydzienOd || finLadowanie) return;
  if (!nazwa) {
    pokazToast("Podaj nazwę kategorii.", "blad");
    return;
  }
  if (kwota === null) {
    pokazToast("Podaj poprawną kwotę (nieujemną).", "blad");
    return;
  }
  const istnieje = finBudzety.some(function (b) { return b.kategoria === nazwa; });
  if (await finZapiszBudzet(nazwa, kwota)) {
    poleNazwa.value = "";
    poleKwota.value = "";
    if (!finWybranaKat) finWybierzKategorie(nazwa);
    pokazToast(istnieje ? "Zmieniono budżet kategorii." : "Dodano kategorię.", "sukces");
  }
});

// Pole kwoty: tylko cyfry i jeden przecinek, maks. 2 miejsca po przecinku
finEl.kwota.addEventListener("input", function () {
  const surowe = finEl.kwota.value;
  let t = surowe.replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const i = t.indexOf(",");
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/,/g, "").slice(0, 2);
  if (t !== surowe) finEl.kwota.value = t;
  renderFinFormularz();
});
finEl.opis.addEventListener("input", renderFinFormularz);
[finEl.kwota, finEl.opis].forEach(function (p) {
  p.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      finZapiszWydatek();
    }
  });
});

document.querySelectorAll("#widok-finanse .fin-szybki").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const teraz = finParsujKwote(finEl.kwota.value) || 0;
    finEl.kwota.value = finKwotaDoPola(Math.round((teraz + Number(btn.dataset.dodaj)) * 100) / 100);
    renderFinFormularz();
  });
});

finEl.zapisz.addEventListener("click", finZapiszWydatek);

// Kropla kategorii: przeliczenie po pokazaniu ekranu (display:none → block) i zmianie szerokości
if (window.ResizeObserver) new ResizeObserver(finUstawKrople).observe(finEl.kategorie);
