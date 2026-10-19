// Ekran "Dziś" (#widok-dzis, ekran startowy): niebo dnia (gwiazdozbiór z dzisiejszych posiłków, treningu, misji i nawyków),
// cztery części dnia, tydzień, cele tygodnia i rada z książek. Bez własnych zapytań do bazy: korzysta z danych,
// które wczytuje start (wpisy, nawyki, nawykiWpisy, plany, role/cele, jedzPosilki/jedzCele, rady*). start.js woła
// dzisDaneGotowe(klucz) po każdym wczytaniu, więc ekran rysuje się od razu jako szkielet i uzupełnia w miarę nadejścia danych.
// Zapis: tylko istniejące funkcje innych ekranów (przelaczNawykDzien, przybijPieczatke, przelaczCel, rozpocznijTreningZPlanu).

const dzisDataEl = document.getElementById("dzis-data");
const dzisPowitanieEl = document.getElementById("dzis-powitanie");
const dzisProcentEl = document.getElementById("dzis-procent");
const dzisGwiazdyLicznikEl = document.getElementById("dzis-gwiazdy-licznik");
const dzisNieboSvg = document.getElementById("dzis-niebo-svg");
const dzisGwiazdyPrzyciski = document.getElementById("dzis-gwiazdy-przyciski");
const dzisPodpowiedzEl = document.getElementById("dzis-podpowiedz");
const dzisTreningEl = document.getElementById("dzis-trening");
const dzisNawykiEl = document.getElementById("dzis-nawyki");
const dzisPosilkiEl = document.getElementById("dzis-posilki");
const dzisMisjaEl = document.getElementById("dzis-misja");
const dzisTydzienEl = document.getElementById("dzis-tydzien-gwiazdy");
const dzisCeleEl = document.getElementById("dzis-cele");
const dzisCeleLicznikEl = document.getElementById("dzis-cele-licznik");
const dzisRadaEl = document.getElementById("dzis-rada");
const dzisRadaLicznikEl = document.getElementById("dzis-rada-licznik");
const dzisRadaTekstEl = document.getElementById("dzis-rada-tekst");
const dzisRadaZrodloEl = document.getElementById("dzis-rada-zrodlo");

// Gwiazdozbiór w polu 342×300 (jak w makiecie); a = gdzie stoi podpis (t – nad, b – pod, r – z prawej)
const DZIS_GWIAZDY_STALE = [
  { id: "sn", k: "posilek", typ: "sniadanie", nazwa: "Śniadanie", x: 46, y: 120, r: 7, a: "b" },
  { id: "ob", k: "posilek", typ: "obiad", nazwa: "Obiad", x: 108, y: 70, r: 7, a: "t" },
  { id: "ko", k: "posilek", typ: "kolacja", nazwa: "Kolacja", x: 160, y: 136, r: 7, a: "r" },
  { id: "tr", k: "trening", nazwa: "Trening", x: 240, y: 46, r: 12, a: "t" },
  { id: "mi", k: "misja", nazwa: "Misja", x: 306, y: 132, r: 10, a: "b" }
];
// Miejsca na nawyki w kolejności łańcucha (każdy kolejny nawyk łączy się z poprzednim)
const DZIS_MIEJSCA_NAWYKOW = [
  { x: 262, y: 226, r: 7, a: "b" },
  { x: 206, y: 176, r: 6, a: "r" },
  { x: 140, y: 250, r: 7, a: "b" },
  { x: 52, y: 214, r: 7, a: "b" }
];
const DZIS_LINIE = [["sn", "ob"], ["ob", "ko"], ["ko", "tr"], ["tr", "mi"], ["mi", "h0"], ["h0", "h1"], ["h1", "ko"], ["h1", "h2"], ["h2", "h3"]];
const DZIS_TYPY_POSILKOW = [["sniadanie", "śniadanie"], ["obiad", "obiad"], ["kolacja", "kolacja"]];
const DZIS_KOLORY_CELOW = ["dzis-k-nawyk", "dzis-k-posilek", "dzis-k-trening", "dzis-k-misja"];
const DZIS_DNI_SKROT = ["nd", "pn", "wt", "śr", "czw", "pt", "sob"];
const DZIS_RADY_NA_DZIEN = 3;
const DZIS_MAKS_CWICZEN = 3;

// Pył gwiezdny: stałe pseudolosowe pozycje (jak w makiecie)
const DZIS_PYL = Array.from({ length: 22 }, function (_, i) {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.678;
  return { x: ((a - Math.floor(a)) * 342).toFixed(1), y: ((b - Math.floor(b)) * 300).toFixed(1), r: (0.6 + (i % 3) * 0.35).toFixed(2), opoznienie: ((i * 0.37) % 3.6).toFixed(2) };
});

// Które dane startowe już dotarły (ustawia start.js); do tego czasu sekcja pokazuje szkielet
const dzisGotowe = { treningi: false, plany: false, nawyki: false, nawykiWpisy: false, cele: false, jedzenie: false, rady: false };
let dzisOczekujace = {};       // klucz gwiazdy -> stan docelowy zapisu w toku (zmiana widoczna od razu, cofana przy błędzie)
let dzisNowaGwiazda = null;    // { klucz, czas } – gwiazda zapalona dotknięciem (animacja "born")
let dzisCeleTygodnia = [];     // cele BIEŻĄCEGO tygodnia (Plan tygodnia może przeglądać inny tydzień)
let dzisRadaIndeks = 0;

function dzisDaneGotowe(klucz) {
  dzisGotowe[klucz] = true;
  renderDzis();
}
function dzisResetDanych() {
  Object.keys(dzisGotowe).forEach(function (k) { dzisGotowe[k] = false; });
  dzisOczekujace = {};
  dzisCeleTygodnia = [];
}

function dzisEsc(tekst) {
  return String(tekst == null ? "" : tekst).replace(/[&<>"']/g, function (z) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z];
  });
}
function dzisSkroc(tekst, maks) {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}
function dzisPrzejdzDo(widok) {
  document.querySelector('.nav-btn[data-widok="' + widok + '"]').click();
}

// Czteroramienna iskra (jak w gwiazdozbiorze rad)
function dzisIskra(x, y, r) {
  const k = r * 0.28;
  const f = function (n) { return +n.toFixed(2); };
  return "M" + x + " " + f(y - r) + "C" + f(x + k * 0.4) + " " + f(y - k) + " " + f(x + k) + " " + f(y - k * 0.4) + " " + f(x + r) + " " + y +
    "C" + f(x + k) + " " + f(y + k * 0.4) + " " + f(x + k * 0.4) + " " + f(y + k) + " " + x + " " + f(y + r) +
    "C" + f(x - k * 0.4) + " " + f(y + k) + " " + f(x - k) + " " + f(y + k * 0.4) + " " + f(x - r) + " " + y +
    "C" + f(x - k) + " " + f(y - k * 0.4) + " " + f(x - k * 0.4) + " " + f(y - k) + " " + x + " " + f(y - r) + "Z";
}
// Talerz z boku (pionowy prostokąt) wyśrodkowany w polu 30×30; wysokość rośnie z r
function dzisTalerz(r) {
  const h = Math.min(28, r * 2.3), w = 8, x = 15 - w / 2, y = 15 - h / 2;
  return "M" + (x + 2) + " " + y + "h" + (w - 4) + "a2 2 0 0 1 2 2v" + (h - 4) + "a2 2 0 0 1-2 2h-" + (w - 4) + "a2 2 0 0 1-2-2v-" + (h - 4) + "a2 2 0 0 1 2-2Z";
}
function dzisIkonaGwiazdy(r, wlaczona, klasaKoloru, rozmiar) {
  return '<svg class="dzis-glif ' + klasaKoloru + (wlaczona ? " on" : "") + '" width="' + rozmiar + '" height="' + rozmiar +
    '" viewBox="0 0 30 30" aria-hidden="true"><path d="' + dzisTalerz(r) + '"/></svg>';
}

// ----- Stan dnia z wczytanych danych -----
function dzisDostepRad() {
  return !navRady.hidden;
}

// Wynik jednego dnia (0–1) ze składników dostępnych dla konta; null, gdy dla dnia nie ma jeszcze żadnych danych
function dzisSkladnikiDnia(data, stan) {
  const skladniki = [];
  if (dzisGotowe.nawyki && dzisGotowe.nawykiWpisy && nawyki.length) {
    const zrobione = nawyki.filter(function (n) { return stan && data === stan.dzis ? stan.nawykZrobiony(n) : czyNawykZrobiony(n.id, data); }).length;
    skladniki.push(zrobione / nawyki.length);
  }
  if (dzisGotowe.treningi) skladniki.push(wpisy.some(function (w) { return w.data === data; }) ? 1 : 0);
  if (jedzDostep && dzisGotowe.jedzenie) {
    if (jedzCele) {
      skladniki.push(Math.min(1, jedzSumaDnia(data).kcal / jedzCele.kcal));
    } else {
      const typy = DZIS_TYPY_POSILKOW.filter(function (t) { return jedzPosilki.some(function (p) { return p.data === data && p.typ === t[0]; }); }).length;
      skladniki.push(typy / DZIS_TYPY_POSILKOW.length);
    }
  }
  if (stan && stan.misja) {
    const przybita = data === stan.dzis
      ? stan.misja.dzisPrzybita
      : radyWpisy.some(function (w) { return w.data === data && w.zadzialalo !== false; });
    skladniki.push(przybita ? 1 : 0);
  }
  if (!skladniki.length) return null;
  return skladniki.reduce(function (a, b) { return a + b; }, 0) / skladniki.length;
}

function dzisStan() {
  const dzis = dzisiaj();
  const stan = { dzis: dzis };

  stan.nawykZrobiony = function (n) {
    const klucz = "n" + n.id;
    return klucz in dzisOczekujace ? dzisOczekujace[klucz] : czyNawykZrobiony(n.id, dzis);
  };
  stan.nawykiGotowe = dzisGotowe.nawyki && dzisGotowe.nawykiWpisy;

  stan.wpisyDzis = wpisy.filter(function (w) { return w.data === dzis; });
  stan.trenowal = stan.wpisyDzis.length > 0;
  stan.planDzis = plany.find(function (p) { return p.data === dzis && Array.isArray(p.cwiczenia); }) || null;

  stan.posilki = null;
  if (jedzDostep) {
    stan.posilki = { gotowe: dzisGotowe.jedzenie, typy: {}, suma: jedzSumaDnia(dzis), cel: jedzCele };
    DZIS_TYPY_POSILKOW.forEach(function (t) {
      stan.posilki.typy[t[0]] = jedzPosilki.some(function (p) { return p.data === dzis && p.typ === t[0]; });
    });
  }

  // Misja: aktywna zasada (Rady z książek). Bez aktywnej zasady gwiazda i składnik wyniku nie występują.
  stan.misja = null;
  stan.misjaBrak = false;
  if (dzisDostepRad() && dzisGotowe.rady) {
    const postep = radyAktywnyPostep();
    const zasada = postep ? radyZasada(postep.zasada_id) : null;
    if (postep && zasada) {
      const przybitaZDanych = radyPieczatkaDzis(postep.zasada_id);
      const dzisPrzybita = "mi" in dzisOczekujace || przybitaZDanych;
      const liczba = radyPieczatkiZasady(postep.zasada_id).length + (dzisPrzybita && !przybitaZDanych ? 1 : 0);
      stan.misja = {
        postep: postep, zasada: zasada, dzisPrzybita: dzisPrzybita,
        liczba: Math.min(liczba, RADY_PIECZATKI_WYMAGANE),
        komplet: !dzisPrzybita && liczba >= RADY_PIECZATKI_WYMAGANE
      };
    } else {
      stan.misjaBrak = true;
    }
  }

  // Gwiazdy na niebie (tylko dostępne składniki)
  const gwiazdy = [];
  DZIS_GWIAZDY_STALE.forEach(function (g) {
    if (g.k === "posilek" && !stan.posilki) return;
    if (g.k === "misja" && !stan.misja) return;
    let on = false;
    if (g.k === "posilek") on = stan.posilki.typy[g.typ];
    if (g.k === "trening") on = stan.trenowal;
    if (g.k === "misja") on = stan.misja.dzisPrzybita;
    gwiazdy.push(Object.assign({ klucz: g.id, on: on }, g));
  });
  stan.nawykiNaNiebie = 0;
  if (stan.nawykiGotowe) {
    nawyki.slice(0, DZIS_MIEJSCA_NAWYKOW.length).forEach(function (n, i) {
      gwiazdy.push(Object.assign({
        id: "h" + i, klucz: "n" + n.id, k: "nawyk", nazwa: dzisSkroc(n.nazwa, 14), pelnaNazwa: n.nazwa, nawyk: n, on: stan.nawykZrobiony(n)
      }, DZIS_MIEJSCA_NAWYKOW[i]));
    });
    stan.nawykiNaNiebie = Math.min(nawyki.length, DZIS_MIEJSCA_NAWYKOW.length);
  }
  stan.gwiazdy = gwiazdy;

  // "X z Y gwiazd": wszystkie nawyki się liczą, także te ponad miejsca w gwiazdozbiorze (+N)
  const nawykiZrobione = stan.nawykiGotowe ? nawyki.filter(stan.nawykZrobiony).length : 0;
  const stale = gwiazdy.filter(function (g) { return g.k !== "nawyk"; });
  stan.gwiazdWszystkich = stale.length + (stan.nawykiGotowe ? nawyki.length : 0);
  stan.gwiazdZapalonych = stale.filter(function (g) { return g.on; }).length + nawykiZrobione;
  stan.nawykiZrobione = nawykiZrobione;

  const wynik = dzisSkladnikiDnia(dzis, stan);
  stan.wynik = wynik == null ? null : Math.round(wynik * 100);
  return stan;
}

// Procent dnia dla menu (pusty, dopóki brak danych)
function dzisWynikProcent() {
  const w = dzisStan().wynik;
  return w == null ? "" : w + "%";
}

// ----- Render -----
function renderDzis() {
  const fokus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.dzisFokus : null;
  const stan = dzisStan();

  renderDzisNaglowek();
  renderDzisNiebo(stan);
  renderDzisTrening(stan);
  renderDzisNawyki(stan);
  renderDzisPosilki(stan);
  renderDzisMisja(stan);
  renderDzisTydzien(stan);
  renderDzisCele();
  renderDzisRada();

  if (fokus) {
    const el = document.querySelector('#widok-dzis [data-dzis-fokus="' + fokus + '"]');
    if (el) el.focus();
  }
}

function renderDzisNaglowek() {
  const teraz = new Date();
  const dzienTyg = DNI_TYGODNIA_PELNE[(teraz.getDay() + 6) % 7];
  dzisDataEl.textContent = dzienTyg.charAt(0).toUpperCase() + dzienTyg.slice(1) + ", " + teraz.getDate() + " " + MIESIACE_SKROT[teraz.getMonth()];
  const h = teraz.getHours();
  dzisPowitanieEl.textContent = h < 5 ? "Dobrej nocy." : h < 12 ? "Dzień dobry." : h < 18 ? "Miłego popołudnia." : h < 22 ? "Dobry wieczór." : "Dobrej nocy.";
}

// Sztanga dnia: każda rzecz do zrobienia to para talerzy (lewa strona = lustro prawej). Najcięższe przy zaciskach:
// trening (25, czerwony), misja (20, niebieski), posiłki (10, zielony), nawyki (15, żółty). Zrobione = pełny kolor, reszta = kreda.
const DZIS_SZTANGA_W = 420, DZIS_SZTANGA_H = 240;
const DZIS_TALERZ_RODZAJ = {
  trening: { kolejnosc: 0, w: 22, h: 200 },
  misja: { kolejnosc: 1, w: 20, h: 184 },
  posilek: { kolejnosc: 2, w: 18, h: 164 },
  nawyk: { kolejnosc: 3, w: 16, h: 148 }
};
function renderDzisNiebo(stan) {
  dzisProcentEl.textContent = stan.wynik == null ? "–" : String(stan.wynik);
  dzisGwiazdyLicznikEl.textContent = stan.gwiazdWszystkich ? stan.gwiazdZapalonych + " z " + stan.gwiazdWszystkich + " " + odmianaLiczby(stan.gwiazdWszystkich, "talerza", "talerzy", "talerzy") : "";

  const W = DZIS_SZTANGA_W, H = DZIS_SZTANGA_H, sr = H / 2, cx = W / 2, chwyt = 34, zacisk = 7, odstep = 3;
  const talerze = stan.gwiazdy.slice().sort(function (a, b) {
    return DZIS_TALERZ_RODZAJ[a.k].kolejnosc - DZIS_TALERZ_RODZAJ[b.k].kolejnosc;
  });
  const teraz = Date.now();
  let svg =
    '<rect class="sztanga-gryf" x="6" y="' + (sr - 4) + '" width="' + (W - 12) + '" height="8" rx="2"/>' +
    '<path class="sztanga-radelko" d="M' + (cx - chwyt + 6) + " " + sr + "H" + (cx - 8) + "M" + (cx + 8) + " " + sr + "H" + (cx + chwyt - 6) + '"/>';
  [-1, 1].forEach(function (str) {
    const z = cx + str * chwyt;
    svg += '<rect class="sztanga-zacisk" x="' + (str < 0 ? z - zacisk : z) + '" y="' + (sr - 16) + '" width="' + zacisk + '" height="32" rx="2"/>';
    svg += '<rect class="sztanga-tuleja" x="' + (str < 0 ? 6 : z + zacisk) + '" y="' + (sr - 8) + '" width="' + (cx - chwyt - zacisk - 6) + '" height="16" rx="3"/>';
  });

  let przyciski = "";
  [-1, 1].forEach(function (str) {
    let x = cx + str * (chwyt + zacisk + 4);
    talerze.forEach(function (g, i) {
      const r = DZIS_TALERZ_RODZAJ[g.k];
      const lewy = str < 0 ? x - r.w : x;
      const nowy = g.on && dzisNowaGwiazda && dzisNowaGwiazda.klucz === g.klucz && teraz - dzisNowaGwiazda.czas < 700;
      svg += '<g class="dzis-gw dzis-k-' + g.k + (g.on ? " on" : "") + (nowy ? " born" : "") + (str < 0 ? " lustro" : "") + '">' +
        '<rect class="dzis-talerz" x="' + lewy + '" y="' + (sr - r.h / 2) + '" width="' + r.w + '" height="' + r.h + '" rx="3"/>';
      if (str > 0) {
        const tx = lewy + r.w / 2 + 4, ty = sr + r.h / 2 - 10;
        svg += '<text class="dzis-gw-podpis" transform="translate(' + tx + " " + ty + ') rotate(-90)">' + dzisEsc(dzisSkroc(g.nazwa, 18)) + "</text>";
      }
      svg += "</g>";
      const nazwa = g.pelnaNazwa || g.nazwa;
      const lewyProc = ((lewy + r.w / 2) / W * 100).toFixed(2);
      przyciski +=
        '<button type="button" class="dzis-gw-przycisk' + (str < 0 ? " lustro" : "") + '" data-gwiazda="' + g.klucz + '"' +
        (str < 0 ? ' tabindex="-1" aria-hidden="true"' : ' data-dzis-fokus="gw-' + g.klucz + '"') +
        ' style="left:' + lewyProc + "%;top:50%;height:" + (r.h / H * 100).toFixed(1) + '%"' +
        ' aria-pressed="' + (g.on ? "true" : "false") + '" aria-label="' + dzisEsc(nazwa + (g.on ? " – zrobione" : " – do zrobienia")) + '"></button>';
      x += str * (r.w + odstep);
    });
  });
  const reszta = stan.nawykiGotowe ? nawyki.length - stan.nawykiNaNiebie : 0;
  if (reszta > 0) {
    svg += '<text class="dzis-gw-reszta" x="' + (W - 8) + '" y="' + (H - 4) + '" text-anchor="end">+' + reszta + " " + odmianaLiczby(reszta, "nawyk", "nawyki", "nawyków") + "</text>";
  }
  dzisNieboSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
  dzisNieboSvg.innerHTML = svg;
  dzisGwiazdyPrzyciski.innerHTML = przyciski;

  // Podpowiedź pod niebem: co jeszcze zostało
  if (stan.wynik == null) {
    dzisPodpowiedzEl.textContent = "Wczytuję Twój dzień…";
    return;
  }
  const zostalo = [];
  if (dzisGotowe.treningi && !stan.trenowal) zostalo.push("trening");
  if (stan.misja && !stan.misja.dzisPrzybita) zostalo.push("misja");
  if (stan.posilki && stan.posilki.gotowe) {
    DZIS_TYPY_POSILKOW.forEach(function (t) { if (!stan.posilki.typy[t[0]]) zostalo.push(t[1]); });
  }
  const nawykowZostalo = stan.nawykiGotowe ? nawyki.length - stan.nawykiZrobione : 0;
  if (nawykowZostalo > 0) zostalo.push(nawykowZostalo + " " + odmianaLiczby(nawykowZostalo, "nawyk", "nawyki", "nawyków"));
  dzisPodpowiedzEl.textContent = zostalo.length
    ? "Dotknij talerza, żeby go założyć. Zostało: " + zostalo.join(", ") + "."
    : "Sztanga załadowana do pełna. Dobra robota.";
}

// Wiersz nagłówka części dnia: gwiazdka, tytuł, wartość po prawej
function dzisWierszCzesci(tytul, klasaKoloru, postep, wartosc) {
  const pelna = postep >= 1;
  return '<div class="dzis-czesc-wiersz">' + dzisIkonaGwiazdy(pelna ? 12 : 9, pelna, klasaKoloru, 22) +
    '<span class="dzis-czesc-tytul">' + tytul + "</span>" +
    '<span class="dzis-czesc-wartosc ' + klasaKoloru + (pelna ? " on" : "") + '">' + dzisEsc(wartosc) + "</span></div>";
}

function renderDzisTrening(stan) {
  if (!dzisGotowe.treningi || !dzisGotowe.plany) {
    dzisTreningEl.innerHTML = dzisWierszCzesci("Trening", "dzis-k-trening", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  const plan = stan.planDzis;
  let opis;
  if (stan.trenowal) {
    const serie = stan.wpisyDzis.reduce(function (s, w) { return s + (w.podejscia || []).length; }, 0);
    opis = "Zrobiony: " + stan.wpisyDzis.length + " " + odmianaLiczby(stan.wpisyDzis.length, "ćwiczenie", "ćwiczenia", "ćwiczeń") + ", " +
      serie + " " + odmianaLiczby(serie, "seria", "serie", "serii") + ".";
  } else if (plan) {
    const partie = plan.cwiczenia.map(function (c) { return c.partia; }).filter(function (p, i, t) { return p && t.indexOf(p) === i; });
    opis = plan.nazwa + (partie.length ? ", " + partie.join(", ").toLowerCase() : "") + ". " +
      plan.cwiczenia.length + " " + odmianaLiczby(plan.cwiczenia.length, "ćwiczenie", "ćwiczenia", "ćwiczeń") + ".";
  } else {
    opis = "Brak planu na dziś.";
  }
  let lista = "";
  if (plan && plan.cwiczenia.length) {
    lista = '<div class="dzis-cwiczenia">';
    plan.cwiczenia.slice(0, DZIS_MAKS_CWICZEN).forEach(function (c) {
      lista += '<span class="dzis-cwiczenie">' + dzisEsc(c.cwiczenie) + '<span class="dzis-kropki" aria-hidden="true"></span><span class="dzis-cwiczenie-partia">' + dzisEsc(c.partia) + "</span></span>";
    });
    const reszta = plan.cwiczenia.length - DZIS_MAKS_CWICZEN;
    if (reszta > 0) lista += '<span class="dzis-cwiczenia-reszta">+' + reszta + " " + odmianaLiczby(reszta, "ćwiczenie", "ćwiczenia", "ćwiczeń") + "</span>";
    lista += "</div>";
  }
  const wartosc = stan.trenowal ? "zrobiony" : plan ? "plan na dziś" : "";
  dzisTreningEl.innerHTML =
    dzisWierszCzesci("Trening", "dzis-k-trening", stan.trenowal ? 1 : 0, wartosc) +
    '<div class="dzis-czesc-tresc"><span class="dzis-opis">' + dzisEsc(opis) + "</span>" + lista +
    '<button type="button" class="dzis-btn dzis-k-trening" id="dzis-btn-trening" data-dzis-fokus="btn-trening">' +
    (stan.trenowal ? "Dopisz ćwiczenie" : "Rozpocznij trening") + "</button></div>";
}

function renderDzisNawyki(stan) {
  if (!stan.nawykiGotowe) {
    dzisNawykiEl.innerHTML = dzisWierszCzesci("Nawyki", "dzis-k-nawyk", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  if (!nawyki.length) {
    dzisNawykiEl.innerHTML = dzisWierszCzesci("Nawyki", "dzis-k-nawyk", 0, "") +
      '<div class="dzis-czesc-tresc"><span class="dzis-opis">Nie masz jeszcze nawyków.</span>' +
      '<button type="button" class="dzis-btn dzis-k-nawyk" data-przejdz="widok-habits">Dodaj nawyk</button></div>';
    return;
  }
  let siatka = '<div class="dzis-nawyki-siatka">';
  nawyki.forEach(function (n) {
    const on = stan.nawykZrobiony(n);
    siatka +=
      '<button type="button" class="dzis-nawyk' + (on ? " on" : "") + '" data-gwiazda="n' + n.id + '" data-dzis-fokus="nawyk-' + n.id + '" aria-pressed="' + on + '">' +
      '<span class="dzis-nawyk-nazwa">' + dzisEsc(n.nazwa) + "</span>" + dzisIkonaGwiazdy(on ? 11 : 8, on, "dzis-k-nawyk", 18) + "</button>";
  });
  siatka += "</div>";
  dzisNawykiEl.innerHTML =
    dzisWierszCzesci("Nawyki", "dzis-k-nawyk", stan.nawykiZrobione / nawyki.length, stan.nawykiZrobione + " z " + nawyki.length) +
    '<div class="dzis-czesc-tresc dzis-czesc-tresc-siatka">' + siatka + "</div>";
}

function renderDzisPosilki(stan) {
  dzisPosilkiEl.hidden = !stan.posilki;
  if (!stan.posilki) return;
  const p = stan.posilki;
  if (!p.gotowe) {
    dzisPosilkiEl.innerHTML = dzisWierszCzesci("Posiłki", "dzis-k-posilek", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  const typy = DZIS_TYPY_POSILKOW.filter(function (t) { return p.typy[t[0]]; }).length;
  const udzial = p.cel ? Math.min(1, p.suma.kcal / p.cel.kcal) : 0;
  const makro = [["B", p.suma.bialko, " g"], ["W", p.suma.wegle, " g"], ["T", p.suma.tluszcze, " g"]].map(function (m) {
    return '<span class="dzis-makro">' + m[0] + " <strong>" + jedzFormat(m[1]) + m[2] + "</strong></span>";
  }).join("");
  dzisPosilkiEl.innerHTML =
    dzisWierszCzesci("Posiłki", "dzis-k-posilek", typy / DZIS_TYPY_POSILKOW.length, typy + " z " + DZIS_TYPY_POSILKOW.length) +
    '<div class="dzis-czesc-tresc">' +
    '<div class="dzis-kcal"><span class="dzis-kcal-liczba">' + jedzFormat(p.suma.kcal) + "</span>" +
    '<span class="dzis-opis">' + (p.cel ? "z " + jedzFormat(p.cel.kcal) + " kcal" : "kcal dziś") + "</span></div>" +
    (p.cel ? '<span class="dzis-pasek"><span class="dzis-pasek-wypelnienie" style="width:' + Math.round(udzial * 100) + '%"></span></span>' : "") +
    '<div class="dzis-makra">' + makro + "</div>" +
    '<button type="button" class="dzis-btn dzis-k-posilek" data-przejdz="widok-jedzenie">Zrób zdjęcie</button></div>';
}

function renderDzisMisja(stan) {
  const widoczna = dzisDostepRad();
  dzisMisjaEl.hidden = !widoczna;
  if (!widoczna) return;
  if (!dzisGotowe.rady) {
    dzisMisjaEl.innerHTML = dzisWierszCzesci("Misja", "dzis-k-misja", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  if (!stan.misja) {
    dzisMisjaEl.innerHTML = dzisWierszCzesci("Misja", "dzis-k-misja", 0, "") +
      '<div class="dzis-czesc-tresc"><span class="dzis-opis">Brak aktywnej misji. Wybierz zasadę w Radach z książek.</span>' +
      '<button type="button" class="dzis-btn dzis-k-misja" data-przejdz="widok-rady">Wybierz zasadę</button></div>';
    return;
  }
  const m = stan.misja;
  const nrDnia = m.dzisPrzybita ? m.liczba : m.liczba + 1;
  let pieczatki = '<div class="dzis-pieczatki" role="img" aria-label="Pieczątki: ' + m.liczba + " z " + RADY_PIECZATKI_WYMAGANE + '">';
  for (let i = 0; i < RADY_PIECZATKI_WYMAGANE; i++) {
    pieczatki += dzisIkonaGwiazdy(i === nrDnia - 1 ? 12 : 10, i < m.liczba, "dzis-k-misja", 18);
  }
  pieczatki += "</div>";
  let przycisk;
  if (m.komplet) {
    przycisk = '<button type="button" class="dzis-btn dzis-k-misja" data-przejdz="widok-rady">Zalicz zasadę</button>';
  } else if (m.dzisPrzybita) {
    przycisk = '<button type="button" class="dzis-btn dzis-btn-zrobione" disabled>Dzień ' + nrDnia + " zaliczony</button>";
  } else {
    przycisk = '<button type="button" class="dzis-btn dzis-k-misja" data-gwiazda="mi" data-dzis-fokus="btn-misja">Zalicz dzień ' + nrDnia + "</button>";
  }
  const wartosc = m.komplet ? "komplet" : m.dzisPrzybita ? "dzień " + nrDnia + " ✓" : "dzień " + nrDnia + " z " + RADY_PIECZATKI_WYMAGANE;
  dzisMisjaEl.innerHTML =
    dzisWierszCzesci("Misja", "dzis-k-misja", m.dzisPrzybita ? 1 : 0, wartosc) +
    '<div class="dzis-czesc-tresc"><span class="dzis-misja-tekst">' + dzisEsc(m.zasada.nazwa) + "</span>" + pieczatki + przycisk + "</div>";
}

function renderDzisTydzien(stan) {
  let html = "";
  for (let i = 6; i >= 0; i--) {
    const data = dataSprzedDni(i);
    const d = new Date(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10));
    const wynik = dzisSkladnikiDnia(data, stan);
    const dzis = i === 0;
    const h = wynik == null ? 3 : Math.max(3, Math.round(wynik * 40));
    const klasa = dzis ? "dzis" : wynik == null ? "brak" : wynik >= 0.5 ? "jasna" : "ciemna";
    const nazwa = dzis ? "dziś" : DZIS_DNI_SKROT[d.getDay()];
    html +=
      '<span class="dzis-tydzien-dzien ' + klasa + '" role="img" aria-label="' + (dzis ? "Dziś" : DNI_TYGODNIA_PELNE[(d.getDay() + 6) % 7]) + ": " +
      (wynik == null ? "brak danych" : Math.round(wynik * 100) + "%") + '">' +
      '<svg width="22" height="40" viewBox="0 0 22 40" aria-hidden="true"><rect x="2" y="' + (40 - h) + '" width="18" height="' + h + '" rx="2"/></svg>' +
      '<span class="dzis-tydzien-nazwa">' + nazwa + "</span></span>";
  }
  dzisTydzienEl.innerHTML = html;
}

function renderDzisCele() {
  const biezacyTydzien = isoZDaty(wybranyPoniedzialek) === isoZDaty(poniedzialekTygodnia(new Date()));
  if (dzisGotowe.cele && biezacyTydzien) dzisCeleTygodnia = cele;
  dzisCeleEl.innerHTML = "";
  if (!dzisGotowe.cele) {
    dzisCeleLicznikEl.textContent = "";
    dzisCeleEl.innerHTML = '<span class="dzis-opis">Wczytuję…</span>';
    return;
  }
  const lista = dzisCeleTygodnia;
  const zrobione = lista.filter(function (c) { return c.zrealizowane; }).length;
  dzisCeleLicznikEl.textContent = lista.length ? zrobione + " z " + lista.length + " · " : "";
  if (!lista.length) {
    dzisCeleEl.innerHTML = '<span class="dzis-opis">Brak celów na ten tydzień. Dodaj je w Planie tygodnia.</span>';
    return;
  }
  lista.forEach(function (c) {
    const indeksRoli = role.findIndex(function (r) { return r.id === c.rola_id; });
    const rola = role[indeksRoli];
    let dzien = "cały tydzień";
    if (c.dzien) {
      const d = new Date(+c.dzien.slice(0, 4), +c.dzien.slice(5, 7) - 1, +c.dzien.slice(8, 10));
      dzien = DNI_TYGODNIA_ETYKIETY[(d.getDay() + 6) % 7];
    }
    const wiersz = document.createElement("label");
    wiersz.className = "dzis-cel " + DZIS_KOLORY_CELOW[Math.max(0, indeksRoli) % DZIS_KOLORY_CELOW.length] + (c.zrealizowane ? " zrealizowany" : "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "dzis-cel-checkbox";
    checkbox.checked = !!c.zrealizowane;
    checkbox.dataset.dzisFokus = "cel-" + c.id;
    const pole = document.createElement("span");
    pole.className = "dzis-cel-pole";
    pole.setAttribute("aria-hidden", "true");
    pole.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const tekst = document.createElement("span");
    tekst.className = "dzis-cel-tekst";
    const tytul = document.createElement("span");
    tytul.className = "dzis-cel-tytul";
    tytul.textContent = c.tresc;
    const meta = document.createElement("span");
    meta.className = "dzis-cel-meta";
    meta.textContent = (rola ? rola.nazwa + " · " : "") + dzien;
    tekst.append(tytul, meta);
    const kropka = document.createElement("span");
    kropka.className = "dzis-cel-kropka";
    kropka.setAttribute("aria-hidden", "true");
    wiersz.append(checkbox, pole, tekst, kropka);
    // Ta sama funkcja co checkbox w Planie tygodnia (przy błędzie sama cofa zaznaczenie)
    checkbox.addEventListener("change", async function () {
      try {
        await przelaczCel(c, checkbox, wiersz);
      } finally {
        renderCeleWszystkie();
        renderDzis();
      }
    });
    dzisCeleEl.appendChild(wiersz);
  });
}

// Rada na dziś: do 3 zasad z Rad z książek, inny zestaw każdego dnia
function dzisRadyNaDzis() {
  const zasady = [];
  radyKsiazki.forEach(function (k) {
    radyZasadyKsiazki(k.id).forEach(function (z) { zasady.push({ zasada: z, ksiazka: k }); });
  });
  if (!zasady.length) return [];
  const t = new Date();
  const numerDnia = Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000);
  const ile = Math.min(DZIS_RADY_NA_DZIEN, zasady.length);
  const wynik = [];
  for (let i = 0; i < ile; i++) wynik.push(zasady[(numerDnia * DZIS_RADY_NA_DZIEN + i) % zasady.length]);
  return wynik;
}
function renderDzisRada() {
  const rady = dzisDostepRad() && dzisGotowe.rady ? dzisRadyNaDzis() : [];
  dzisRadaEl.hidden = !rady.length;
  if (!rady.length) return;
  dzisRadaIndeks = dzisRadaIndeks % rady.length;
  const r = rady[dzisRadaIndeks];
  dzisRadaLicznikEl.textContent = "Rada na dziś, " + (dzisRadaIndeks + 1) + " z " + rady.length;
  dzisRadaTekstEl.textContent = r.zasada.nazwa;
  dzisRadaZrodloEl.textContent = r.ksiazka.tytul + ", zasada " + rzymska(radyNumerZasady(r.zasada));
  document.getElementById("dzis-rada-nastepna").hidden = rady.length < 2;
}

// ----- Akcje -----
// Nawyk: zapis/cofnięcie tą samą funkcją co na ekranie Nawyki; zmiana widoczna od razu, przy błędzie wraca (komunikat daje przelaczNawykDzien)
async function dzisPrzelaczNawyk(nawyk, przycisk) {
  const klucz = "n" + nawyk.id;
  if (klucz in dzisOczekujace) return;
  const dzis = dzisiaj();
  const zapal = !czyNawykZrobiony(nawyk.id, dzis);
  dzisOczekujace[klucz] = zapal;
  if (zapal) dzisNowaGwiazda = { klucz: klucz, czas: Date.now() };
  renderDzis();
  try {
    await przelaczNawykDzien(nawyk, dzis, przycisk);
  } finally {
    delete dzisOczekujace[klucz];
    renderDzis();
  }
}

// Misja: dzisiejsza pieczątka tą samą funkcją co w Radach z książek. Cofania pieczątki nie ma w apce, więc zapalona gwiazda nic nie robi.
async function dzisZaliczMisje(przycisk) {
  const postep = radyAktywnyPostep();
  if (!postep || "mi" in dzisOczekujace || radyPieczatkaDzis(postep.zasada_id)) return;
  if (radyPieczatkiZasady(postep.zasada_id).length >= RADY_PIECZATKI_WYMAGANE) {
    dzisPrzejdzDo("widok-rady");
    return;
  }
  dzisOczekujace.mi = true;
  dzisNowaGwiazda = { klucz: "mi", czas: Date.now() };
  renderDzis();
  try {
    await przybijPieczatke(postep, [przycisk]);
  } finally {
    delete dzisOczekujace.mi;
    renderDzis();
  }
}

function dzisKliknietoGwiazde(klucz, przycisk) {
  if (klucz === "tr") return dzisPrzejdzDo("widok-dodaj");
  if (klucz === "sn" || klucz === "ob" || klucz === "ko") return dzisPrzejdzDo("widok-jedzenie");
  if (klucz === "mi") return dzisZaliczMisje(przycisk);
  if (klucz.charAt(0) === "n") {
    const nawyk = nawyki.find(function (n) { return "n" + n.id === klucz; });
    if (nawyk) dzisPrzelaczNawyk(nawyk, przycisk);
  }
}

document.getElementById("widok-dzis").addEventListener("click", function (e) {
  const gwiazda = e.target.closest("[data-gwiazda]");
  if (gwiazda) {
    dzisKliknietoGwiazde(gwiazda.dataset.gwiazda, gwiazda);
    return;
  }
  const przejscie = e.target.closest("[data-przejdz]");
  if (przejscie) {
    dzisPrzejdzDo(przejscie.dataset.przejdz);
    return;
  }
  if (e.target.closest("#dzis-btn-trening")) {
    // Plan na dziś: ten sam start co "Rozpocznij" na karcie planu; bez planu zwykłe Zapisz trening
    const plan = dzisStan().planDzis;
    if (plan && plan.cwiczenia.length && !wpisy.some(function (w) { return w.data === dzisiaj(); })) rozpocznijTreningZPlanu(plan);
    else dzisPrzejdzDo("widok-dodaj");
  }
});
document.getElementById("dzis-cele-plan").addEventListener("click", function () { dzisPrzejdzDo("widok-plan"); });
document.getElementById("dzis-rada-nastepna").addEventListener("click", function () {
  dzisRadaIndeks++;
  renderDzisRada();
});

renderDzis();
