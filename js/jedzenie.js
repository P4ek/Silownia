// Ekran "Jedzenie" (#widok-jedzenie, tylko konta z JEDZENIE_DOSTEP_IDS): oglądany dzień, cele kcal/makro (jedzenie_cele),
// wykres kalorii z kilku dni, talerz (koło makro + pierścień kalorii), kafle makro, analiza zdjęcia przez AI (Edge Function "analizuj-posilek"), lista posiłków (posilki).

const navJedzenie = document.getElementById("nav-jedzenie");
const jedzDzienLiczba = document.getElementById("jedz-dzien-liczba");
const jedzDzienDzis = document.getElementById("jedz-dzien-dzis");
const jedzDzienTygodnia = document.getElementById("jedz-dzien-tygodnia");
const jedzDzienMiesiac = document.getElementById("jedz-dzien-miesiac");
const btnJedzCele = document.getElementById("jedz-btn-cele");
const btnJedzPoprzedni = document.getElementById("jedz-poprzedni");
const btnJedzNastepny = document.getElementById("jedz-nastepny");
const formJedzCele = document.getElementById("jedz-cele");
const btnJedzCeleZapisz = document.getElementById("jedz-cele-zapisz");
const jedzCelePodpowiedz = document.getElementById("jedz-cele-podpowiedz");
const jedzBrakCelow = document.getElementById("jedz-brak-celow");
const btnJedzBrakCelow = document.getElementById("jedz-brak-celow-btn");
const jedzPodsumowanie = document.getElementById("jedz-podsumowanie");
const jedzWykres = document.getElementById("jedz-wykres");
const jedzKoloSvg = document.getElementById("jedz-kolo-svg");
const jedzKoloEtykieta = document.getElementById("jedz-kolo-etykieta");
const jedzKoloLiczba = document.getElementById("jedz-kolo-liczba");
const jedzKoloOpis = document.getElementById("jedz-kolo-opis");
const jedzKafle = document.getElementById("jedz-kafle");
const jedzAparat = document.getElementById("jedz-aparat");
const inputJedzFoto = document.getElementById("jedz-foto");
const jedzFotoPodglad = document.getElementById("jedz-foto-podglad");
const jedzAparatPusty = document.getElementById("jedz-aparat-pusty");
const jedzAparatSkan = document.getElementById("jedz-aparat-skan");
const btnJedzAnalizuj = document.getElementById("jedz-analizuj");
const jedzTypy = document.getElementById("jedz-typy");
const inputJedzDopisek = document.getElementById("jedz-dopisek");
const jedzLadowanie = document.getElementById("jedz-ladowanie");
const jedzLadowanieTekst = document.getElementById("jedz-ladowanie-tekst");
const jedzLadowaniePostep = document.getElementById("jedz-ladowanie-postep");
const jedzWynikKarta = document.getElementById("jedz-wynik");
const jedzPewnosc = document.getElementById("jedz-pewnosc");
const inputJedzWynikNazwa = document.getElementById("jedz-wynik-nazwa");
const jedzWynikSkladniki = document.getElementById("jedz-wynik-skladniki");
const jedzWynikUwaga = document.getElementById("jedz-wynik-uwaga");
const btnJedzWynikOdrzuc = document.getElementById("jedz-wynik-odrzuc");
const btnJedzWynikZapisz = document.getElementById("jedz-wynik-zapisz");
const jedzListaLicznik = document.getElementById("jedz-lista-licznik");
const jedzLista = document.getElementById("jedz-lista");

// Pola liczbowe: klucz = kolumna w posilki / jedzenie_cele
const JEDZ_POLA = ["kcal", "bialko", "wegle", "tluszcze"];
const JEDZ_MAKRO = [
  { klucz: "bialko", nazwa: "Białko", skrot: "B", kolor: "var(--jedz-bialko)", kcalNaGram: 4 },
  { klucz: "wegle", nazwa: "Węgle", skrot: "W", kolor: "var(--jedz-wegle)", kcalNaGram: 4 },
  { klucz: "tluszcze", nazwa: "Tłuszcz", skrot: "T", kolor: "var(--jedz-tluszcze)", kcalNaGram: 9 }
];
const JEDZ_TYPY = [
  { id: "sniadanie", nazwa: "Śniadanie" },
  { id: "obiad", nazwa: "Obiad" },
  { id: "kolacja", nazwa: "Kolacja" },
  { id: "przekaska", nazwa: "Przekąska" }
];
const JEDZ_DNI_WYKRESU = 7;      // ile słupków kalorii na wykresie
const JEDZ_DNI_WCZYTYWANIA = 30; // ile dni posiłków dociągać jednym zapytaniem
const JEDZ_MAKS_BOK_ZDJECIA = 1280;
const JEDZ_TEKSTY_LADOWANIA = ["Rozpoznaję, co jest na talerzu…", "Szacuję wielkość porcji…", "Liczę kalorie i makro…"];
const JEDZ_KOLO_R_PIERSCIEN = 88;
const JEDZ_KOLO_R_MAKRO = 62;

let jedzDostep = false;
let jedzPosilki = [];           // wiersze z tabeli "posilki" od jedzWczytaneOd do dziś
let jedzWczytaneOd = null;      // najwcześniejsza wczytana data "RRRR-MM-DD"
let jedzWczytywanie = null;     // trwające dociąganie starszych dni (Promise)
let jedzCele = null;            // { kcal, bialko, wegle, tluszcze } albo null, gdy celów brak
let jedzDzien = dzisiaj();      // oglądany dzień "RRRR-MM-DD"
let jedzTyp = jedzDomyslnyTyp();
let jedzZdjecie = null;         // wybrany plik zdjęcia (File)
let jedzZdjecieUrl = null;      // object URL podglądu
let jedzWynik = null;           // szacunek z AI czekający na Zapisz / Odrzuć
let jedzAnalizaTrwa = false;
let jedzTimerLadowania = null;

// Pozycja w menu i dane tylko dla kont z JEDZENIE_DOSTEP_IDS; pozostałym nic się nie wczytuje
function ustawDostepJedzenia(dostep) {
  jedzDostep = dostep;
  navJedzenie.hidden = !dostep;
  if (!dostep) {
    jedzPosilki = [];
    jedzCele = null;
    jedzWczytaneOd = null;
    jedzWynik = null;
    if (navJedzenie.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
    }
  }
}

function jedzDomyslnyTyp() {
  const h = new Date().getHours();
  if (h < 11) return "sniadanie";
  if (h < 16) return "obiad";
  return "kolacja";
}

// ----- Daty -----
function jedzDataZIso(iso) {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}
function jedzPrzesunDzien(iso, dni) {
  const d = jedzDataZIso(iso);
  d.setDate(d.getDate() + dni);
  return isoZDaty(d);
}
function jedzMniejszaData(a, b) { return a < b ? a : b; }

// ----- Liczby -----
function jedzLiczba(v) {
  const n = Number(String(v == null ? "" : v).replace(",", "."));
  return isFinite(n) && n > 0 ? n : 0;
}
function jedzFormat(n) {
  return Math.round(n).toLocaleString("pl-PL");
}
function jedzSumaDnia(iso) {
  const suma = { kcal: 0, bialko: 0, wegle: 0, tluszcze: 0 };
  jedzPosilki.forEach(function (p) {
    if (p.data !== iso) return;
    JEDZ_POLA.forEach(function (k) { suma[k] += jedzLiczba(p[k]); });
  });
  return suma;
}
function jedzPosilkiDnia(iso) {
  return jedzPosilki
    .filter(function (p) { return p.data === iso; })
    .sort(function (a, b) { return String(a.created_at || "").localeCompare(String(b.created_at || "")); });
}

// ----- Wczytywanie -----
async function wczytajJedzenie() {
  if (!jedzDostep) return;
  const od = jedzPrzesunDzien(dzisiaj(), -(JEDZ_DNI_WCZYTYWANIA - 1));
  const [cele, posilki] = await Promise.all([
    db.from("jedzenie_cele").select("kcal, bialko, wegle, tluszcze").eq("user_id", sesjaUzytkownika.user.id).maybeSingle(),
    db.from("posilki").select("*").gte("data", od).order("created_at", { ascending: true })
  ]);
  if (cele.error) console.error(cele.error);
  if (posilki.error) {
    console.error(posilki.error);
    pokazToast("Nie udało się wczytać posiłków", "blad");
  } else {
    jedzPosilki = posilki.data || [];
    jedzWczytaneOd = od;
  }
  jedzCele = jedzCeleZWiersza(cele.data);
  renderJedzenie();
}

function jedzCeleZWiersza(w) {
  if (!w || !(jedzLiczba(w.kcal) > 0)) return null;
  return { kcal: jedzLiczba(w.kcal), bialko: jedzLiczba(w.bialko), wegle: jedzLiczba(w.wegle), tluszcze: jedzLiczba(w.tluszcze) };
}

// Dociąga starsze dni, gdy wykres oglądanego dnia sięga przed wczytany zakres
function jedzZapewnijDane(odIso) {
  if (!jedzWczytaneOd || odIso >= jedzWczytaneOd || jedzWczytywanie) return;
  const noweOd = jedzPrzesunDzien(odIso, -(JEDZ_DNI_WCZYTYWANIA - 1));
  const doIso = jedzPrzesunDzien(jedzWczytaneOd, -1);
  jedzWczytywanie = db.from("posilki").select("*").gte("data", noweOd).lte("data", doIso)
    .order("created_at", { ascending: true })
    .then(function (wynik) {
      jedzWczytywanie = null;
      if (wynik.error) {
        console.error(wynik.error);
        pokazToast("Nie udało się wczytać starszych posiłków", "blad");
        return;
      }
      jedzPosilki = (wynik.data || []).concat(jedzPosilki);
      jedzWczytaneOd = noweOd;
      renderJedzenie();
    });
}

// ----- Render -----
function renderJedzenie() {
  if (!jedzDostep) return;
  const dzis = dzisiaj();
  if (jedzDzien > dzis) jedzDzien = dzis;
  renderJedzNaglowek(dzis);
  renderJedzPodsumowanie(dzis);
  renderJedzTypy();
  renderJedzAparat();
  renderJedzLista();
}

function renderJedzNaglowek(dzis) {
  const d = jedzDataZIso(jedzDzien);
  jedzDzienLiczba.textContent = d.getDate();
  jedzDzienDzis.hidden = jedzDzien !== dzis;
  jedzDzienTygodnia.textContent = DNI_TYGODNIA_PELNE[(d.getDay() + 6) % 7];
  jedzDzienMiesiac.textContent = MIESIACE_DOPELNIACZ[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
  btnJedzNastepny.disabled = jedzDzien >= dzis;
}

function renderJedzPodsumowanie(dzis) {
  jedzBrakCelow.hidden = !!jedzCele || !formJedzCele.hidden;
  jedzPodsumowanie.hidden = !jedzCele;
  if (!jedzCele) return;
  renderJedzWykres(dzis);
  const suma = jedzSumaDnia(jedzDzien);
  renderJedzKolo(suma);
  renderJedzKafle(suma);
}

// Słupki kalorii z JEDZ_DNI_WYKRESU dni wokół oglądanego dnia (bez przyszłości), przerywana linia celu
function renderJedzWykres(dzis) {
  const polowa = Math.floor(JEDZ_DNI_WYKRESU / 2);
  const koniec = jedzMniejszaData(jedzPrzesunDzien(jedzDzien, polowa), dzis);
  const start = jedzPrzesunDzien(koniec, -(JEDZ_DNI_WYKRESU - 1));
  jedzZapewnijDane(start);

  const dni = [];
  for (let i = 0; i < JEDZ_DNI_WYKRESU; i++) {
    const iso = jedzPrzesunDzien(start, i);
    dni.push({ iso: iso, kcal: jedzSumaDnia(iso).kcal });
  }
  const skala = Math.max(jedzCele.kcal * 1.15, ...dni.map(function (d) { return d.kcal; }));

  jedzWykres.innerHTML = "";
  const slupki = document.createElement("div");
  slupki.className = "jedz-wykres-slupki";

  const linia = document.createElement("div");
  linia.className = "jedz-wykres-cel";
  linia.style.setProperty("--ulamek", (jedzCele.kcal / skala).toFixed(3));
  const podpis = document.createElement("span");
  podpis.textContent = "CEL " + jedzFormat(jedzCele.kcal);
  linia.appendChild(podpis);
  slupki.appendChild(linia);

  dni.forEach(function (dzien) {
    const d = jedzDataZIso(dzien.iso);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jedz-wykres-dzien";
    if (dzien.iso === jedzDzien) btn.classList.add("aktywny");
    if (dzien.iso === dzis) btn.classList.add("dzis");
    btn.setAttribute("aria-pressed", dzien.iso === jedzDzien ? "true" : "false");
    btn.setAttribute("aria-label", DNI_TYGODNIA_PELNE[(d.getDay() + 6) % 7] + ", " + d.getDate() + " " +
      MIESIACE_DOPELNIACZ[d.getMonth()] + ": " + jedzFormat(dzien.kcal) + " kcal");

    const slupekWrap = document.createElement("span");
    slupekWrap.className = "jedz-wykres-slupek-wrap";
    const slupek = document.createElement("span");
    slupek.className = "jedz-wykres-slupek" + (dzien.kcal ? "" : " pusty");
    slupek.style.height = dzien.kcal ? Math.max(4, dzien.kcal / skala * 100).toFixed(1) + "%" : "4px";
    slupekWrap.appendChild(slupek);

    const etykieta = document.createElement("span");
    etykieta.className = "jedz-wykres-etykieta";
    etykieta.textContent = d.getDate();

    btn.append(slupekWrap, etykieta);
    btn.addEventListener("click", function () { jedzUstawDzien(dzien.iso); });
    slupki.appendChild(btn);
  });
  jedzWykres.appendChild(slupki);
}

function jedzPunkt(r, kat) {
  const t = (kat - 90) * Math.PI / 180;
  return (95 + r * Math.cos(t)).toFixed(2) + " " + (95 + r * Math.sin(t)).toFixed(2);
}
function jedzLuk(r, kat0, kat1) {
  return "M" + jedzPunkt(r, kat0) + " A" + r + " " + r + " 0 " + (kat1 - kat0 > 180 ? 1 : 0) + " 1 " + jedzPunkt(r, kat1);
}

// Koło: segmenty białko/węgle/tłuszcz w proporcji kalorii z makro, zewnętrzny pierścień = kalorie względem celu
function renderJedzKolo(suma) {
  const obwod = 2 * Math.PI * JEDZ_KOLO_R_PIERSCIEN;
  const postep = Math.min(1, suma.kcal / jedzCele.kcal);
  let svg =
    '<circle cx="95" cy="95" r="' + JEDZ_KOLO_R_PIERSCIEN + '" class="jedz-kolo-tor"/>' +
    (postep > 0 ? '<circle cx="95" cy="95" r="' + JEDZ_KOLO_R_PIERSCIEN + '" class="jedz-kolo-postep" stroke-dasharray="' +
      (obwod * postep).toFixed(1) + " " + obwod.toFixed(1) + '" transform="rotate(-90 95 95)"/>' : "") +
    '<circle cx="95" cy="95" r="72" class="jedz-kolo-tarcza"/>';

  const kcalMakro = JEDZ_MAKRO.map(function (m) { return suma[m.klucz] * m.kcalNaGram; });
  const razem = kcalMakro.reduce(function (a, b) { return a + b; }, 0);
  if (razem > 0) {
    let kat = 0;
    JEDZ_MAKRO.forEach(function (m, i) {
      const rozpietosc = kcalMakro[i] / razem * 360;
      const kat0 = kat + 2, kat1 = kat + rozpietosc - 2;
      kat += rozpietosc;
      if (kat1 - kat0 < 0.5) return;
      svg += '<path d="' + jedzLuk(JEDZ_KOLO_R_MAKRO, kat0, kat1) + '" class="jedz-kolo-makro" stroke="' + m.kolor + '"/>';
    });
  } else {
    svg += '<circle cx="95" cy="95" r="' + JEDZ_KOLO_R_MAKRO + '" class="jedz-kolo-makro-puste"/>';
  }
  jedzKoloSvg.innerHTML = svg;

  const ponad = suma.kcal > jedzCele.kcal;
  jedzKoloEtykieta.textContent = ponad ? "PONAD CEL" : "ZOSTAŁO";
  animujLiczbe(jedzKoloLiczba, Math.round(Math.abs(jedzCele.kcal - suma.kcal)), jedzFormat);
  jedzKoloOpis.textContent = "kcal · zjedzone " + jedzFormat(suma.kcal);
}

function renderJedzKafle(suma) {
  jedzKafle.innerHTML = "";
  JEDZ_MAKRO.forEach(function (m) {
    const cel = jedzCele[m.klucz];
    const kafel = document.createElement("div");
    kafel.className = "jedz-kafel";
    kafel.style.setProperty("--kolor-makro", m.kolor);

    const etykieta = document.createElement("span");
    etykieta.className = "jedz-kafel-etykieta";
    etykieta.innerHTML = '<span class="jedz-kropka" aria-hidden="true"></span>';
    etykieta.append(m.nazwa.toUpperCase());

    const wartosc = document.createElement("div");
    wartosc.className = "jedz-kafel-wartosc";
    const liczba = document.createElement("span");
    liczba.textContent = jedzFormat(suma[m.klucz]);
    const celEl = document.createElement("span");
    celEl.className = "jedz-kafel-cel";
    celEl.textContent = cel ? "/" + jedzFormat(cel) + " g" : " g";
    wartosc.append(liczba, celEl);

    const pasek = document.createElement("div");
    pasek.className = "jedz-kafel-pasek";
    const wypelnienie = document.createElement("span");
    wypelnienie.style.width = (cel ? Math.min(100, suma[m.klucz] / cel * 100) : 0).toFixed(1) + "%";
    pasek.appendChild(wypelnienie);

    kafel.append(etykieta, wartosc, pasek);
    jedzKafle.appendChild(kafel);
  });
}

function renderJedzTypy() {
  jedzTypy.innerHTML = "";
  JEDZ_TYPY.forEach(function (t) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jedz-typ";
    btn.textContent = t.nazwa;
    btn.setAttribute("aria-pressed", t.id === jedzTyp ? "true" : "false");
    btn.addEventListener("click", function () {
      jedzTyp = t.id;
      renderJedzTypy();
    });
    jedzTypy.appendChild(btn);
  });
}

function renderJedzAparat() {
  jedzFotoPodglad.hidden = !jedzZdjecieUrl;
  if (jedzZdjecieUrl) jedzFotoPodglad.src = jedzZdjecieUrl;
  jedzAparatPusty.hidden = !!jedzZdjecieUrl;
  jedzAparatSkan.hidden = !jedzAnalizaTrwa;
  jedzLadowanie.hidden = !jedzAnalizaTrwa;
  btnJedzAnalizuj.disabled = jedzAnalizaTrwa;
  renderJedzWynik();
}

function jedzNazwaTypu(id) {
  const t = JEDZ_TYPY.find(function (x) { return x.id === id; });
  return t ? t.nazwa : "Posiłek";
}

// Godzina dodania — tylko gdy posiłek był zapisany tego samego dnia, którego dotyczy
function jedzGodzina(p) {
  if (!p.created_at) return "";
  const d = new Date(p.created_at);
  if (isoZDaty(d) !== p.data) return "";
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
}

function renderJedzLista() {
  const lista = jedzPosilkiDnia(jedzDzien);
  jedzListaLicznik.textContent = lista.length + " " + odmianaLiczby(lista.length, "POSIŁEK", "POSIŁKI", "POSIŁKÓW");
  jedzLista.innerHTML = "";

  lista.forEach(function (p, i) {
    const karta = document.createElement("article");
    karta.className = "jedz-posilek";

    const gora = document.createElement("div");
    gora.className = "jedz-posilek-gora";
    gora.innerHTML = '<svg class="jedz-posilek-talerz" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/></svg>';
    const godzina = jedzGodzina(p);
    if (godzina) {
      const g = document.createElement("span");
      g.className = "jedz-posilek-godzina";
      g.textContent = godzina;
      gora.appendChild(g);
    }
    if (p.z_ai) {
      const ai = document.createElement("span");
      ai.className = "jedz-posilek-ai";
      ai.textContent = "AI";
      ai.title = "Oszacowane przez AI";
      gora.appendChild(ai);
    }
    const usun = document.createElement("button");
    usun.type = "button";
    usun.className = "jedz-posilek-usun";
    usun.setAttribute("aria-label", "Usuń posiłek: " + (p.nazwa || ""));
    usun.innerHTML = IKONA_KOSZ_KATALOG;
    usun.addEventListener("click", function () { usunPosilek(p); });
    const kcal = document.createElement("span");
    kcal.className = "jedz-posilek-kcal";
    kcal.textContent = jedzFormat(jedzLiczba(p.kcal));
    gora.append(usun, kcal);

    const dol = document.createElement("div");
    dol.className = "jedz-posilek-dol";
    const typ = document.createElement("span");
    typ.className = "jedz-kicker jedz-posilek-typ";
    typ.textContent = jedzNazwaTypu(p.typ).toUpperCase();
    const nazwa = document.createElement("div");
    nazwa.className = "jedz-posilek-nazwa";
    nazwa.textContent = p.nazwa || "Posiłek";

    const pasek = document.createElement("div");
    pasek.className = "jedz-posilek-pasek";
    const kcalMakro = JEDZ_MAKRO.map(function (m) { return jedzLiczba(p[m.klucz]) * m.kcalNaGram; });
    JEDZ_MAKRO.forEach(function (m, j) {
      const seg = document.createElement("span");
      seg.style.flex = String(Math.max(kcalMakro[j], 0.001));
      seg.style.background = m.kolor;
      pasek.appendChild(seg);
    });

    const makro = document.createElement("span");
    makro.className = "jedz-posilek-makro";
    makro.textContent = JEDZ_MAKRO.map(function (m) { return m.skrot + " " + jedzFormat(jedzLiczba(p[m.klucz])); }).join(" · ");

    dol.append(typ, nazwa, pasek, makro);
    karta.append(gora, dol);
    jedzLista.appendChild(wjazdKarty(karta, i));
  });

  const kolejny = document.createElement("label");
  kolejny.setAttribute("for", "jedz-foto");
  kolejny.className = "jedz-kolejny";
  kolejny.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
    (lista.length ? "Kolejny posiłek" : "Dodaj posiłek");
  jedzLista.appendChild(kolejny);
}

// ----- Nawigacja po dniach -----
function jedzUstawDzien(iso) {
  const dzis = dzisiaj();
  jedzDzien = iso > dzis ? dzis : iso;
  renderJedzenie();
}
btnJedzPoprzedni.addEventListener("click", function () { jedzUstawDzien(jedzPrzesunDzien(jedzDzien, -1)); });
btnJedzNastepny.addEventListener("click", function () {
  if (jedzDzien >= dzisiaj()) return;
  jedzUstawDzien(jedzPrzesunDzien(jedzDzien, 1));
});

// ----- Cele -----
function jedzPoleCelu(klucz) { return document.getElementById("jedz-cel-" + klucz); }

function jedzOtworzCele(otworz) {
  formJedzCele.hidden = !otworz;
  btnJedzCele.setAttribute("aria-expanded", otworz ? "true" : "false");
  if (otworz) {
    JEDZ_POLA.forEach(function (k) {
      jedzPoleCelu(k).value = jedzCele && jedzCele[k] ? Math.round(jedzCele[k]) : "";
    });
    renderJedzCelePodpowiedz();
    jedzPoleCelu("kcal").focus();
  }
  jedzBrakCelow.hidden = !!jedzCele || otworz;
}

function renderJedzCelePodpowiedz() {
  const kcal = jedzLiczba(jedzPoleCelu("bialko").value) * 4 + jedzLiczba(jedzPoleCelu("wegle").value) * 4 +
    jedzLiczba(jedzPoleCelu("tluszcze").value) * 9;
  jedzCelePodpowiedz.textContent = "Z makro wychodzi " + jedzFormat(kcal) + " kcal (białko i węgle × 4, tłuszcz × 9).";
}

btnJedzCele.addEventListener("click", function () { jedzOtworzCele(formJedzCele.hidden); });
btnJedzBrakCelow.addEventListener("click", function () { jedzOtworzCele(true); });
formJedzCele.addEventListener("input", renderJedzCelePodpowiedz);

formJedzCele.addEventListener("submit", async function (e) {
  e.preventDefault();
  const cele = {};
  JEDZ_POLA.forEach(function (k) { cele[k] = Math.round(jedzLiczba(jedzPoleCelu(k).value)); });
  if (!cele.kcal) {
    pokazToast("Podaj cel kalorii", "blad");
    jedzPoleCelu("kcal").focus();
    return;
  }
  btnJedzCeleZapisz.disabled = true;
  const { error } = await db.from("jedzenie_cele").upsert(
    Object.assign({ user_id: sesjaUzytkownika.user.id }, cele),
    { onConflict: "user_id" }
  );
  btnJedzCeleZapisz.disabled = false;
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać celów", "blad");
    return;
  }
  jedzCele = cele;
  jedzOtworzCele(false);
  renderJedzenie();
  pokazToast("Zapisano cele", "sukces");
});

// ----- Zdjęcie i analiza AI -----
inputJedzFoto.addEventListener("change", function () {
  const plik = inputJedzFoto.files && inputJedzFoto.files[0];
  inputJedzFoto.value = "";
  if (!plik || jedzAnalizaTrwa) return;
  if (jedzZdjecieUrl) URL.revokeObjectURL(jedzZdjecieUrl);
  jedzZdjecie = plik;
  jedzZdjecieUrl = URL.createObjectURL(plik);
  jedzWynik = null;
  renderJedzAparat();
  jedzAparat.scrollIntoView({ behavior: "smooth", block: "center" });
});

// Zdjęcie -> JPEG (dłuższy bok max JEDZ_MAKS_BOK_ZDJECIA) w base64 bez prefiksu "data:..."
function jedzZdjecieDoBase64(plik) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(plik);
    img.onload = function () {
      URL.revokeObjectURL(url);
      const skala = Math.min(1, JEDZ_MAKS_BOK_ZDJECIA / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * skala);
      canvas.height = Math.round(img.naturalHeight * skala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się odczytać zdjęcia"));
    };
    img.src = url;
  });
}

function jedzStartLadowania() {
  let krok = 0;
  function pokazKrok() {
    const tekst = JEDZ_TEKSTY_LADOWANIA[krok];
    jedzLadowanieTekst.textContent = tekst;
    jedzAparatSkan.querySelector(".jedz-skan-tekst").textContent = tekst.toUpperCase();
    jedzLadowaniePostep.style.width = [30, 65, 92][krok] + "%";
  }
  pokazKrok();
  jedzTimerLadowania = setInterval(function () {
    if (krok < JEDZ_TEKSTY_LADOWANIA.length - 1) { krok++; pokazKrok(); }
  }, 1500);
}
function jedzStopLadowania() {
  clearInterval(jedzTimerLadowania);
  jedzTimerLadowania = null;
}

// Komunikat błędu z Edge Function: status HTTP (403 / 429) albo pole "error" w odpowiedzi
async function jedzTekstBleduAnalizy(error, data) {
  let status = null;
  let komunikat = data && data.error ? data.error : null;
  if (error) {
    const odp = error.context;
    if (odp && typeof odp.status === "number") {
      status = odp.status;
      try {
        const tresc = await odp.clone().json();
        if (tresc && tresc.error) komunikat = tresc.error;
      } catch (e) { /* treść nie jest JSON-em */ }
    }
    if (!komunikat) komunikat = error.message;
  }
  if (status === 403) return "Brak dostępu do analizy posiłków";
  if (status === 429) return "Dzienny limit analiz wykorzystany. Spróbuj jutro albo wpisz wartości ręcznie.";
  return komunikat || "Nie udało się przeanalizować posiłku";
}

btnJedzAnalizuj.addEventListener("click", async function () {
  if (jedzAnalizaTrwa) return;
  const opis = inputJedzDopisek.value.trim();
  if (!jedzZdjecie && !opis) {
    pokazToast("Zrób zdjęcie albo opisz posiłek w dopisku", "blad");
    return;
  }

  jedzAnalizaTrwa = true;
  jedzWynik = null;
  renderJedzAparat();
  jedzStartLadowania();

  let tekstBledu = null;
  let szacunek = null;
  try {
    const obraz = jedzZdjecie ? await jedzZdjecieDoBase64(jedzZdjecie) : null;
    const { data, error } = await db.functions.invoke("analizuj-posilek", { body: { obraz: obraz, opis: opis } });
    if (error || (data && data.error) || !(data && data.szacunek)) {
      tekstBledu = await jedzTekstBleduAnalizy(error, data);
    } else {
      szacunek = data.szacunek;
    }
  } catch (e) {
    console.error(e);
    tekstBledu = e.message || "Nie udało się przeanalizować posiłku";
  }

  jedzStopLadowania();
  jedzAnalizaTrwa = false;
  if (tekstBledu) {
    pokazToast(tekstBledu, "blad");
  } else {
    jedzWynik = {
      nazwa: szacunek.nazwa || "Posiłek",
      skladniki: Array.isArray(szacunek.skladniki) ? szacunek.skladniki : [],
      kcal: Math.round(jedzLiczba(szacunek.kcal)),
      bialko: Math.round(jedzLiczba(szacunek.bialko)),
      wegle: Math.round(jedzLiczba(szacunek.wegle)),
      tluszcze: Math.round(jedzLiczba(szacunek.tluszcze)),
      pewnosc: szacunek.pewnosc,
      uwaga: szacunek.uwaga || "",
      poprawione: false
    };
  }
  renderJedzAparat();
  if (jedzWynik) jedzWynikKarta.scrollIntoView({ behavior: "smooth", block: "center" });
});

// Poziom pewności AI: 3 = wysoka, 2 = średnia, 1 = niska
function jedzPoziomPewnosci(pewnosc) {
  if (typeof pewnosc === "number") return pewnosc >= 0.75 ? 3 : pewnosc >= 0.45 ? 2 : 1;
  const t = String(pewnosc || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t.indexOf("wysok") === 0 || t === "high") return 3;
  if (t.indexOf("sredni") === 0 || t === "medium") return 2;
  return 1;
}
const JEDZ_PEWNOSC_NAZWY = { 1: "niska", 2: "średnia", 3: "wysoka" };

function renderJedzPewnosc() {
  const poziom = jedzWynik.poprawione ? 3 : jedzPoziomPewnosci(jedzWynik.pewnosc);
  jedzPewnosc.className = "jedz-pewnosc " + (jedzWynik.poprawione ? "poprawione" : "poziom-" + poziom);
  jedzPewnosc.innerHTML = '<span class="jedz-pewnosc-kreski" aria-hidden="true">' +
    [1, 2, 3].map(function (i) { return '<span class="' + (i <= poziom ? "pelna" : "") + '"></span>'; }).join("") + "</span>";
  jedzPewnosc.append(jedzWynik.poprawione ? "Poprawione przez Ciebie" : "Pewność AI: " + JEDZ_PEWNOSC_NAZWY[poziom]);
}

function jedzPoleWyniku(klucz) { return document.getElementById("jedz-wynik-" + klucz); }

function renderJedzWynik() {
  jedzWynikKarta.hidden = !jedzWynik || jedzAnalizaTrwa;
  if (!jedzWynik) return;
  renderJedzPewnosc();
  inputJedzWynikNazwa.value = jedzWynik.nazwa;
  JEDZ_POLA.forEach(function (k) { jedzPoleWyniku(k).value = jedzWynik[k]; });

  jedzWynikSkladniki.innerHTML = "";
  jedzWynik.skladniki.forEach(function (s) {
    if (!s || !s.nazwa) return;
    const li = document.createElement("li");
    li.textContent = s.nazwa + (jedzLiczba(s.gramy) ? " · " + jedzFormat(jedzLiczba(s.gramy)) + " g" : "");
    jedzWynikSkladniki.appendChild(li);
  });
  jedzWynikSkladniki.hidden = !jedzWynikSkladniki.children.length;
  jedzWynikUwaga.textContent = jedzWynik.uwaga;
  jedzWynikUwaga.hidden = !jedzWynik.uwaga;
}

// Ręczna poprawka wyniku: zapamiętanie wartości i znacznik "Poprawione przez Ciebie" (bez przebudowy pól, żeby nie gubić kursora)
jedzWynikKarta.addEventListener("input", function (e) {
  if (!jedzWynik) return;
  if (e.target === inputJedzWynikNazwa) jedzWynik.nazwa = inputJedzWynikNazwa.value;
  JEDZ_POLA.forEach(function (k) {
    if (e.target === jedzPoleWyniku(k)) jedzWynik[k] = Math.round(jedzLiczba(e.target.value));
  });
  if (!jedzWynik.poprawione) {
    jedzWynik.poprawione = true;
    renderJedzPewnosc();
  }
});

btnJedzWynikOdrzuc.addEventListener("click", function () {
  jedzWynik = null;
  renderJedzAparat();
});

btnJedzWynikZapisz.addEventListener("click", async function () {
  if (!jedzWynik) return;
  const nazwa = inputJedzWynikNazwa.value.trim() || "Posiłek";
  const wiersz = {
    user_id: sesjaUzytkownika.user.id,
    data: jedzDzien,
    nazwa: nazwa,
    typ: jedzTyp,
    z_ai: true
  };
  JEDZ_POLA.forEach(function (k) { wiersz[k] = Math.round(jedzLiczba(jedzPoleWyniku(k).value)); });

  btnJedzWynikZapisz.disabled = true;
  const { data, error } = await db.from("posilki").insert(wiersz).select().single();
  btnJedzWynikZapisz.disabled = false;
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać posiłku", "blad");
    return;
  }
  jedzPosilki.push(data);
  jedzWynik = null;
  if (jedzZdjecieUrl) URL.revokeObjectURL(jedzZdjecieUrl);
  jedzZdjecie = null;
  jedzZdjecieUrl = null;
  inputJedzDopisek.value = "";
  renderJedzenie();
  pokazToast("Zapisano: " + nazwa, "sukces");
});

async function usunPosilek(p) {
  if (!window.confirm("Usunąć posiłek „" + (p.nazwa || "Posiłek") + "”?")) return;
  const { error } = await db.from("posilki").delete().eq("id", p.id);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć posiłku", "blad");
    return;
  }
  jedzPosilki = jedzPosilki.filter(function (x) { return x.id !== p.id; });
  renderJedzenie();
  pokazToast("Usunięto posiłek", "sukces");
}
