// Finanse → Oszczędności: budżety na kategorie odnawiane co tydzień albo co miesiąc (tabela budzety, ustawienie w
// finanse_ustawienia), wydatki (tabela wydatki), wypłaty (tabela wyplaty) i suma zaoszczędzona od ostatniej wypłaty
// (widok oszczednosci − wyplaty). Tylko konta z FINANSE_DOSTEP_IDS (dostęp ustawia start.js).
// Okres = wiersze budzety o tym samym tydzien_od (początek) i okres_do (koniec). Pełny okres to pn–nd albo 1.–ostatni dzień
// miesiąca; zmiana ustawienia zamienia bieżący okres na nowy rodzaj od tego samego początku (kwoty przeliczone na dni),
// więc okresy nigdy na siebie nie nachodzą.
// Zapytania: budżety i wydatki tylko oglądanego okresu + po jednym o okresy z oszczędnościami, wypłaty, ustawienie i "Często".
// Rysowanie punktowe: elementy list są kluczowane (kategoria / id wydatku / data) i tylko aktualizowane, a formularz nowego
// wydatku jest stałym HTML-em – pola tekstowe nie tracą fokusu przy zmianie danych.

const navFinanse = document.getElementById("nav-finanse");
const menuRozdzialFinanse = document.getElementById("menu-rozdzial-finanse");

const FIN_LICZBA_KOLOROW = 7;   // paleta --fin-k1..--fin-k7 w finanse.css; kolor kategorii = jej pozycja na liście
const FIN_CZESTO_MAKS = 6;
const FIN_ISKRA = dzisIskra(15, 15, 13); // ta sama czteroramienna gwiazdka co na ekranie Dziś
const FIN_FALA = "M0 6 Q14 0 28 6 T56 6 T84 6 T112 6 T140 6 V12 H0Z";
const FIN_MIESIACE = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

let finDostep = false;
let finUstawienie = "tydzien";  // "tydzien" | "miesiac" – co ile odnawia się budżet (finanse_ustawienia, brak wiersza = tydzień)
let finOkresOd = null;          // "RRRR-MM-DD" – pierwszy dzień oglądanego okresu
let finOkresDo = null;          // "RRRR-MM-DD" – ostatni dzień oglądanego okresu
let finOkresy = [];             // [{ od, koniec, zaoszczedzone }] z widoku oszczednosci, rosnąco po od
let finBudzety = [];            // [{ kategoria, kwota }] oglądanego okresu
let finWydatki = [];            // [{ id, data, kategoria, kwota, opis }] oglądanego okresu
let finSumaOgolna = null;       // suma zaoszczedzone ze wszystkich okresów minus wypłaty
let finOstatniaWyplata = null;  // { data, kwota } najnowszej wypłaty
let finWczytane = false;
let finLadowanie = false;       // trwa wczytywanie oglądanego okresu
let finZapytanieNr = 0;         // chroni przed spóźnioną odpowiedzią po szybkim przełączaniu okresów
let finZmianaOkresuTrwa = false;
let finWyplataTrwa = false;
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
  sumaOgolna: document.getElementById("fin-suma-ogolna"),
  podsumowanieTytul: document.getElementById("fin-podsumowanie-tytul"),
  wyplac: document.getElementById("fin-wyplac"),
  ogolemPrzelacz: document.getElementById("fin-ogolem-przelacz"),
  ogolem: document.getElementById("fin-ogolem"),
  ostatniaWyplata: document.getElementById("fin-ostatnia-wyplata"),
  okresWybor: document.getElementById("fin-okres-wybor")
};

function ustawDostepFinansow(dostep) {
  finDostep = dostep;
  menuRozdzialFinanse.hidden = !dostep;
  if (!dostep) {
    finUstawienie = "tydzien";
    finOkresOd = null;
    finOkresDo = null;
    finOkresy = [];
    finBudzety = [];
    finWydatki = [];
    finSumaOgolna = null;
    finOstatniaWyplata = null;
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

function finDataZIso(iso) {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

function finPrzesunDni(iso, dni) {
  const d = finDataZIso(iso);
  return isoZDaty(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dni));
}

function finWOkresie(iso) {
  return !!finOkresOd && iso >= finOkresOd && iso <= finOkresDo;
}

// Liczba dni od..koniec włącznie (zaokrąglenie znosi zmianę czasu)
function finDni(od, koniec) {
  return Math.round((finDataZIso(koniec) - finDataZIso(od)) / 864e5) + 1;
}

function finKoniecMiesiaca(iso) {
  const d = finDataZIso(iso);
  return isoZDaty(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Rodzaj pełnego okresu: "tydzien" (pn–nd), "miesiac" (1. – ostatni dzień) albo null (okres przy zmianie ustawienia)
function finRodzajOkresu(od, koniec) {
  if (finDataZIso(od).getDay() === 1 && koniec === finPrzesunDni(od, 6)) return "tydzien";
  if (od.slice(8) === "01" && koniec === finKoniecMiesiaca(od)) return "miesiac";
  return null;
}

// Pełny okres wg ustawienia, w którym leży dzień
function finOkresWgUstawienia(dzien) {
  if (finUstawienie === "miesiac") return { od: dzien.slice(0, 8) + "01", koniec: finKoniecMiesiaca(dzien) };
  const od = isoZDaty(poniedzialekTygodnia(finDataZIso(dzien)));
  return { od: od, koniec: finPrzesunDni(od, 6) };
}

// Okres zawierający dzień: zapisany w bazie (ma budżety) albo wyliczony z ustawienia i przycięty do sąsiednich zapisanych
function finOkresZawierajacy(dzien) {
  const zapisany = finOkresy.find(function (o) { return o.od <= dzien && dzien <= o.koniec; });
  if (zapisany) return { od: zapisany.od, koniec: zapisany.koniec };
  const okres = finOkresWgUstawienia(dzien);
  finOkresy.forEach(function (o) {
    if (o.koniec < dzien && o.koniec >= okres.od) okres.od = finPrzesunDni(o.koniec, 1);
    if (o.od > dzien && o.od <= okres.koniec) okres.koniec = finPrzesunDni(o.od, -1);
  });
  return okres;
}

function finCzyBiezacy() {
  const dzis = dzisiaj();
  return !!finOkresOd && finOkresOd <= dzis && dzis <= finOkresDo;
}

// Kwoty budżetów przeniesione z okresu z na okres na: ten sam pełny rodzaj = bez zmian, inaczej proporcjonalnie do dni
function finPrzeliczKwoty(budzety, z, na) {
  const rodzaj = finRodzajOkresu(z.od, z.koniec);
  const bezZmian = rodzaj && rodzaj === finRodzajOkresu(na.od, na.koniec);
  const mnoznik = finDni(na.od, na.koniec) / finDni(z.od, z.koniec);
  return budzety.map(function (b) {
    return { kategoria: b.kategoria, kwota: bezZmian ? Number(b.kwota) : Math.round(Number(b.kwota) * mnoznik) };
  });
}

// "tygodnia" / "miesiąca" / "okresu" itd. dla oglądanego okresu
function finSlowoOkresu(tydzien, miesiac, inny) {
  const rodzaj = finRodzajOkresu(finOkresOd, finOkresDo);
  return rodzaj === "tydzien" ? tydzien : (rodzaj === "miesiac" ? miesiac : inny);
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

// "5 – 11 paź", "28 wrz – 4 paź", pełny miesiąc "październik"; rok tylko spoza bieżącego
function finZakresOkresu(od, koniec) {
  const p = finDataZIso(od);
  const n = finDataZIso(koniec);
  const rok = n.getFullYear() !== new Date().getFullYear() ? " " + n.getFullYear() : "";
  if (finRodzajOkresu(od, koniec) === "miesiac") return FIN_MIESIACE[p.getMonth()] + rok;
  const poczatek = p.getMonth() === n.getMonth() ? String(p.getDate()) : finDzienMies(p);
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
  return finWOkresie(dzis) ? dzis : finOkresDo;
}

function finPoprawWybor() {
  if (!finWybranyDzien || !finWOkresie(finWybranyDzien) || finWybranyDzien > dzisiaj()) finWybranyDzien = finDomyslnyDzien();
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
// Wejście na ekran: przy pierwszym wejściu ustawienie okresu + okresy z sumą + podpowiedzi, potem bieżący okres
async function finWejscie() {
  if (!finDostep || finWczytane) return;
  finWczytane = true;
  finLadowanie = true;
  wczytajCzesteWydatki();
  await Promise.all([wczytajUstawienieOkresu(), wczytajSumeOszczednosci()]);
  if (!finDostep) return;
  finUstawOgladanyOkres(finOkresZawierajacy(dzisiaj()));
  finWybranyDzien = dzisiaj();
  renderFinanse();
  wczytajOkresFinansow(finOkresOd, finOkresDo);
}

function finUstawOgladanyOkres(okres) {
  finOkresOd = okres.od;
  finOkresDo = okres.koniec;
}

async function wczytajUstawienieOkresu() {
  const { data, error } = await db.from("finanse_ustawienia").select("okres").eq("user_id", finUid()).maybeSingle();
  if (error) {
    console.error(error);
    return;
  }
  finUstawienie = data && data.okres === "miesiac" ? "miesiac" : "tydzien";
  renderFinOkresWybor();
}

// Okresy z oszczędnościami (widok oszczednosci, jeden wiersz na okres) i wypłaty → suma od ostatniej wypłaty
async function wczytajSumeOszczednosci() {
  const uid = finUid();
  const [osz, wyp] = await Promise.all([
    db.from("oszczednosci").select("tydzien_od, okres_do, zaoszczedzone").eq("user_id", uid).order("tydzien_od", { ascending: true }),
    db.from("wyplaty").select("data, kwota").eq("user_id", uid).order("data", { ascending: false }).order("id", { ascending: false })
  ]);
  if (osz.error || wyp.error) {
    console.error(osz.error || wyp.error);
    return;
  }
  finOkresy = (osz.data || []).map(function (r) {
    return { od: r.tydzien_od, koniec: r.okres_do, zaoszczedzone: Number(r.zaoszczedzone) || 0 };
  });
  const wyplaty = wyp.data || [];
  finOstatniaWyplata = wyplaty[0] || null;
  finSumaOgolna = finOkresy.reduce(function (s, o) { return s + o.zaoszczedzone; }, 0) - finSuma(wyplaty);
  renderFinNawigacje();
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

async function wczytajOkresFinansow(od, nd) {
  const nr = ++finZapytanieNr;
  const uid = finUid();
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
    budzety = await finSkopiujBudzety(od, nd);
    if (nr !== finZapytanieNr) return;
  }
  finBudzety = budzety;
  finSortujBudzety();
  finWydatki = wyd.data || [];
  finLadowanie = false;
  renderFinanse();
  if (!finBudzety.length) finUstawPanel(true);
}

// Okres bez budżetów: kopia z ostatniego wcześniejszego okresu, który je ma, zapisana dla tego okresu
// (inny rodzaj okresu albo okres przy zmianie ustawienia → kwoty przeliczone na dni)
async function finSkopiujBudzety(od, nd) {
  const wczesniejsze = finOkresy.filter(function (o) { return o.od < od; });
  const okresZrodla = wczesniejsze[wczesniejsze.length - 1];
  if (!okresZrodla) return [];
  const zrodlo = await db
    .from("budzety")
    .select("kategoria, kwota")
    .eq("user_id", finUid())
    .eq("tydzien_od", okresZrodla.od);
  if (zrodlo.error || !zrodlo.data || !zrodlo.data.length) {
    if (zrodlo.error) console.error(zrodlo.error);
    return [];
  }
  const budzety = finPrzeliczKwoty(zrodlo.data, okresZrodla, { od: od, koniec: nd });
  const wiersze = budzety.map(function (b) { return { tydzien_od: od, okres_do: nd, kategoria: b.kategoria, kwota: b.kwota }; });
  const { error } = await db.from("budzety").upsert(wiersze, { onConflict: "user_id,tydzien_od,kategoria" });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się skopiować budżetów z poprzedniego okresu.", "blad");
    return [];
  }
  pokazToast("Skopiowano budżety z poprzedniego okresu.", "sukces");
  wczytajSumeOszczednosci();
  return budzety;
}

// Zmiana co ile odnawia się budżet: zapis ustawienia, a bieżący okres z budżetami zamieniany na nowy rodzaj od tego samego
// początku do końca bieżącego tygodnia/miesiąca (te same kategorie, kwoty przeliczone na dni), więc okresy nie nachodzą na siebie
async function finZmienUstawienieOkresu(nowe) {
  if (finZmianaOkresuTrwa || nowe === finUstawienie || !finOkresOd) return;
  finZmianaOkresuTrwa = true;
  renderFinOkresWybor();
  const uid = finUid();
  const { error } = await db.from("finanse_ustawienia").upsert({ okres: nowe }, { onConflict: "user_id" });
  if (error) {
    console.error(error);
    finZmianaOkresuTrwa = false;
    renderFinOkresWybor();
    pokazToast("Nie udało się zmienić okresu budżetu.", "blad");
    return;
  }
  finUstawienie = nowe;

  const dzis = dzisiaj();
  const biezacy = finOkresZawierajacy(dzis);
  const zapisany = finOkresy.some(function (o) { return o.od === biezacy.od; });
  if (zapisany && finRodzajOkresu(biezacy.od, biezacy.koniec) !== nowe) {
    const nowy = { od: biezacy.od, koniec: finOkresWgUstawienia(dzis).koniec };
    const budz = await db.from("budzety").select("kategoria, kwota").eq("user_id", uid).eq("tydzien_od", biezacy.od);
    const wiersze = budz.error ? [] : finPrzeliczKwoty(budz.data || [], biezacy, nowy).map(function (b) {
      return { tydzien_od: nowy.od, okres_do: nowy.koniec, kategoria: b.kategoria, kwota: b.kwota };
    });
    const zapis = budz.error ? budz : (wiersze.length
      ? await db.from("budzety").upsert(wiersze, { onConflict: "user_id,tydzien_od,kategoria" })
      : { error: null });
    if (zapis.error) {
      console.error(zapis.error);
      pokazToast("Ustawienie zapisane, ale nie udało się przeliczyć bieżących budżetów.", "blad");
    }
  }
  await wczytajSumeOszczednosci();
  finZmianaOkresuTrwa = false;
  renderFinOkresWybor();
  pokazToast(nowe === "miesiac" ? "Budżet odnawia się teraz co miesiąc." : "Budżet odnawia się teraz co tydzień.", "sukces");

  if (finCzyBiezacy()) {
    finUstawOgladanyOkres(finOkresZawierajacy(dzis));
    finBudzety = [];
    finWydatki = [];
    finLadowanie = true;
    renderFinanse();
    wczytajOkresFinansow(finOkresOd, finOkresDo);
  }
}

// ----- Zapis -----
async function finZapiszBudzet(kategoria, kwota) {
  const od = finOkresOd;
  kategoria = kategoria.trim();
  const { error } = await db
    .from("budzety")
    .upsert({ tydzien_od: od, okres_do: finOkresDo, kategoria: kategoria, kwota: kwota }, { onConflict: "user_id,tydzien_od,kategoria" });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać budżetu.", "blad");
    return false;
  }
  if (od !== finOkresOd) return true;
  const istniejacy = finBudzety.find(function (b) { return b.kategoria === kategoria; });
  if (istniejacy) istniejacy.kwota = kwota;
  else {
    finBudzety.push({ kategoria: kategoria, kwota: kwota });
    finSortujBudzety();
  }
  renderFinanse();
  wczytajSumeOszczednosci();
  return true;
}

async function finUsunBudzet(kategoria) {
  const od = finOkresOd;
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
  if (od === finOkresOd) {
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
  if (finWOkresie(data)) {
    finWydatki.push(wynik);
    finNowyWydatekId = wynik.id;
    renderFinanse();
  }
  if (opis) finDopiszCzesto(opis, wynik.kategoria);
  pokazToast("Zapisano wydatek.", "sukces");
  wczytajSumeOszczednosci();
  majWczytajBudzetTygodnia(); // widżet budżetu na ekranie Dziś (majatek.js)
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
  majWczytajBudzetTygodnia();
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
  if (!finOkresOd) return;
  finPoprawWybor();
  renderFinNawigacje();
  renderFinGlowna();
  renderFinFiolki();
  renderFinPanel();
  renderFinKategorie();
  renderFinCzesto();
  renderFinFormularz();
  renderFinWydatki();
  renderFinPodsumowanieOkresu();
  renderFinSumaOgolna();
  renderFinOkresWybor();
}

function renderFinNawigacje() {
  if (!finOkresOd) return;
  finEl.zakres.textContent = finZakresOkresu(finOkresOd, finOkresDo);
  const biezacyOd = finOkresZawierajacy(dzisiaj()).od;
  const najwczesniejszy = finOkresy.length && finOkresy[0].od < biezacyOd ? finOkresy[0].od : biezacyOd;
  const slowo = finUstawienie === "miesiac" ? "okres" : "tydzień";
  finEl.poprzedni.disabled = finOkresOd <= najwczesniejszy;
  finEl.nastepny.disabled = finOkresDo >= dzisiaj();
  finEl.poprzedni.setAttribute("aria-label", "Poprzedni " + slowo);
  finEl.nastepny.setAttribute("aria-label", "Następny " + slowo);
}

function renderFinGlowna() {
  const budzet = finSuma(finBudzety);
  const wydano = finSuma(finWydatki);
  const zostalo = budzet - wydano;
  const biezacy = finCzyBiezacy();
  const dzis = dzisiaj();
  const dni = finDni(finOkresOd, finOkresDo);

  finEl.etykieta.textContent = biezacy ? "Zostało na " + finSlowoOkresu("tydzień", "miesiąc", "ten okres") : "Zaoszczędzone";
  finEl.zostalo.textContent = finLadowanie ? "…" : finKwota(zostalo, true);
  finEl.zostalo.classList.toggle("fin-minus", !finLadowanie && zostalo < 0);
  finEl.budzetLacznie.textContent = finKwota(budzet);

  // Kwota dzienna: zostało / dni do końca okresu (z dzisiejszym); tylko bieżący okres
  finEl.dziennie.hidden = !biezacy || finLadowanie || budzet <= 0;
  if (biezacy && budzet > 0) {
    const dniZostalo = finDni(dzis, finOkresDo);
    finEl.dziennie.textContent = zostalo < 0 ? "limit przekroczony" : finKwota(zostalo / dniZostalo) + " zł / dzień";
    finEl.dziennie.classList.toggle("fin-minus", zostalo < 0);
  }

  const proc = budzet > 0 ? Math.min(100, (wydano / budzet) * 100) : (wydano > 0 ? 100 : 0);
  finEl.pasek.style.width = (finLadowanie ? 0 : proc) + "%";
  finEl.pasek.classList.toggle("fin-minus-tlo", zostalo < 0);

  // Gwiazdki dni (kalendarz: 7 kolumn pn–nd, pierwszy dzień w kolumnie swojego dnia tygodnia):
  // świeci, gdy wydatki dnia ≤ budżet okresu / liczba dni; przyszłe dni puste i nieklikalne
  const limit = budzet / dni;
  const dlugi = dni > 7;
  finEl.dni.classList.toggle("fin-dni-dlugi", dlugi);
  const daty = [];
  for (let i = 0; i < dni; i++) daty.push(finPrzesunDni(finOkresOd, i));
  finSynchronizuj(finEl.dni, daty, finUtworzDzien, function (btn, data, i) {
    const d = finDataZIso(data);
    const dzienTyg = (d.getDay() + 6) % 7;
    const przyszly = data > dzis;
    const wydanoDnia = finSuma(finWydatki.filter(function (w) { return w.data === data; }));
    const oceniany = !przyszly && !finLadowanie && budzet > 0;
    const ok = oceniany && wydanoDnia <= limit + 0.005;
    btn.style.gridColumnStart = i === 0 ? String(dzienTyg + 1) : "";
    btn.disabled = przyszly;
    btn.classList.toggle("on", ok);
    btn.classList.toggle("ponad", oceniany && !ok);
    btn.classList.toggle("dzis", data === dzis);
    btn.setAttribute("aria-pressed", String(data === finWybranyDzien));
    btn.querySelector(".fin-dzien-skrot").textContent = data === dzis ? "dziś" : (dlugi ? String(d.getDate()) : finSkrotDnia(data));
    btn.setAttribute("aria-label", DNI_TYGODNIA_PELNE[dzienTyg] + " " + finDzienMies(d) +
      (przyszly ? "" : ": wydano " + finZl(wydanoDnia) + (oceniany ? (ok ? ", w limicie" : ", ponad limit") : "")));
  });
}

// Przycisk-gwiazdka dnia (stan ustawia renderFinGlowna); data w data-klucz
function finUtworzDzien() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fin-dzien";
  btn.innerHTML = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="' + FIN_ISKRA + '"/></svg><span class="fin-dzien-skrot"></span>';
  btn.addEventListener("click", function () {
    if (!finOkresOd || btn.disabled) return;
    finWybranyDzien = btn.dataset.klucz;
    renderFinGlowna();
    renderFinFormularz();
  });
  return btn;
}

function renderFinFiolki() {
  const wydano = finSuma(finWydatki);
  const budzet = finSuma(finBudzety);
  finEl.wydaneZ.textContent = finLadowanie ? "" : finKwota(wydano) + " z " + finKwota(budzet) + " zł wydane";

  finEl.fiolkiPusto.hidden = finLadowanie || finBudzety.length > 0;
  finEl.fiolkiPusto.textContent = "Brak budżetów " + finSlowoOkresu("w tym tygodniu", "w tym miesiącu", "w tym okresie") +
    ". Dodaj pierwszą kategorię w panelu niżej.";

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
  finEl.panelInfo.textContent = "Zmiany kwot dotyczą tylko " + finSlowoOkresu("tygodnia", "miesiąca", "okresu") + " " +
    finZakresOkresu(finOkresOd, finOkresDo) + ".";
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
  const wTym = finSlowoOkresu("w tym tygodniu", "w tym miesiącu", "w tym okresie");
  finEl.wydatkiLicznik.textContent = finLadowanie ? "" : n + " " + odmianaLiczby(n, "wydatek", "wydatki", "wydatków") + " " + wTym;
  finEl.wydatkiPusto.hidden = finLadowanie || n > 0;
  finEl.wydatkiPusto.textContent = "Brak wydatków " + wTym + ".";

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

function renderFinPodsumowanieOkresu() {
  const budzet = finSuma(finBudzety);
  const wydano = finSuma(finWydatki);
  const zaoszczedzone = budzet - wydano;
  finEl.podsumowanieTytul.textContent = "Podsumowanie " + finSlowoOkresu("tygodnia", "miesiąca", "okresu");
  finEl.tydzBudzet.textContent = finLadowanie ? "…" : finZl(budzet);
  finEl.tydzWydano.textContent = finLadowanie ? "…" : finZl(wydano);
  finEl.tydzZaoszczedzone.textContent = finLadowanie ? "…" : finZl(zaoszczedzone);
  finEl.tydzZaoszczedzone.classList.toggle("fin-minus", !finLadowanie && zaoszczedzone < 0);
}

function renderFinSumaOgolna() {
  finEl.sumaOgolna.textContent = finSumaOgolna === null ? "…" : finKwota(finSumaOgolna, true);
  finEl.sumaOgolna.classList.toggle("fin-minus", finSumaOgolna !== null && finSumaOgolna < 0);
  finEl.ostatniaWyplata.hidden = !finOstatniaWyplata;
  if (finOstatniaWyplata) {
    finEl.ostatniaWyplata.textContent = "Ostatnia wypłata: " + finDzienMies(finDataZIso(finOstatniaWyplata.data)) +
      ", " + finZl(finOstatniaWyplata.kwota) + ".";
  }
  renderFinWyplata();
}

// "Wypłać X zł" – cała suma zaoszczędzona; przy 0 lub minusie nieaktywny
function renderFinWyplata() {
  const btn = finEl.wyplac;
  const kwota = finSumaOgolna === null ? 0 : Math.round(finSumaOgolna * 100) / 100;
  const mozna = kwota > 0 && !finWyplataTrwa;
  btn.disabled = !mozna;
  if (!mozna && btn.classList.contains("fin-uzbrojony")) finRozbrojWyplate();
  if (btn.classList.contains("fin-uzbrojony")) return;
  btn.textContent = finWyplataTrwa ? "Wypłacam…" : (kwota > 0 ? "Wypłać " + finZl(kwota) : "Nic do wypłaty");
}

function finRozbrojWyplate() {
  clearTimeout(finEl.wyplac._finTimer);
  finEl.wyplac.classList.remove("fin-uzbrojony");
}

function renderFinOkresWybor() {
  Array.from(finEl.okresWybor.querySelectorAll("button")).forEach(function (btn) {
    btn.setAttribute("aria-pressed", String(btn.dataset.okres === finUstawienie));
    btn.disabled = finZmianaOkresuTrwa;
  });
}

// ----- Akcje -----
function finWybierzKategorie(kat) {
  finWybranaKat = kat;
  renderFinFiolki();
  renderFinKategorie();
  renderFinFormularz();
}

// Poprzedni / następny okres: ten, w którym leży dzień tuż przed początkiem / po końcu oglądanego
function finZmienOkres(kierunek) {
  if (!finOkresOd) return;
  finUstawOgladanyOkres(finOkresZawierajacy(kierunek < 0 ? finPrzesunDni(finOkresOd, -1) : finPrzesunDni(finOkresDo, 1)));
  finBudzety = [];
  finWydatki = [];
  finWybranyDzien = finDomyslnyDzien();
  finLadowanie = true;
  renderFinanse();
  wczytajOkresFinansow(finOkresOd, finOkresDo);
}

// Wypłata: zapis całej sumy w wyplaty, więc licznik "Łącznie zaoszczędzone" liczy od zera; historia okresów zostaje
async function finWyplac() {
  const kwota = finSumaOgolna === null ? 0 : Math.round(finSumaOgolna * 100) / 100;
  if (finWyplataTrwa || !(kwota > 0)) return;
  finWyplataTrwa = true;
  renderFinWyplata();
  const { error } = await db.from("wyplaty").insert({ data: dzisiaj(), kwota: kwota });
  finWyplataTrwa = false;
  if (error) {
    console.error(error);
    renderFinWyplata();
    pokazToast("Nie udało się zapisać wypłaty.", "blad");
    return;
  }
  finSumaOgolna -= kwota;
  finOstatniaWyplata = { data: dzisiaj(), kwota: kwota };
  renderFinSumaOgolna();
  pokazToast("Wypłacono " + finZl(kwota) + ". Licznik liczy od zera.", "sukces");
  wczytajSumeOszczednosci();
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
})();

// ----- Zdarzenia -----
navFinanse.addEventListener("click", finWejscie);

finEl.poprzedni.addEventListener("click", function () { finZmienOkres(-1); });
finEl.nastepny.addEventListener("click", function () {
  if (finOkresDo && finOkresDo < dzisiaj()) finZmienOkres(1);
});

finEl.panelPrzelacz.addEventListener("click", function () { finUstawPanel(finEl.panel.hidden); });

finEl.okresWybor.addEventListener("click", function (e) {
  const btn = e.target.closest("button[data-okres]");
  if (btn && !btn.disabled) finZmienUstawienieOkresu(btn.dataset.okres);
});

// Wypłata w dwóch stuknięciach: pierwsze pyta "Na pewno?", drugie w ciągu 3,5 s wypłaca
finEl.wyplac.addEventListener("click", function () {
  const btn = finEl.wyplac;
  if (btn.disabled) return;
  if (btn.classList.contains("fin-uzbrojony")) {
    finRozbrojWyplate();
    finWyplac();
    return;
  }
  btn.classList.add("fin-uzbrojony");
  btn.textContent = "Na pewno wypłacić " + finZl(finSumaOgolna) + "?";
  btn._finTimer = setTimeout(function () {
    finRozbrojWyplate();
    renderFinWyplata();
  }, 3500);
});

finEl.ogolemPrzelacz.addEventListener("click", function () {
  const otwarty = finEl.ogolem.hidden;
  finEl.ogolem.hidden = !otwarty;
  finEl.ogolemPrzelacz.setAttribute("aria-expanded", String(otwarty));
});

document.getElementById("fin-budzet-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const poleNazwa = document.getElementById("fin-budzet-nazwa");
  const poleKwota = document.getElementById("fin-budzet-kwota");
  const nazwa = poleNazwa.value.trim();
  const kwota = finParsujKwote(poleKwota.value);
  if (!finOkresOd || finLadowanie) return;
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
