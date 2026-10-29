// Ekran "Wykres postępu" (#widok-wykres): nagłówek odpoczynku, mapa ciała, dni odpoczynku, gablota rekordów.

const wykresKicker = document.getElementById("wykres-kicker");
const wykresTytul = document.getElementById("wykres-tytul");
const wykresSzczegoly = document.getElementById("wykres-szczegoly");
const mapaPrzelacznik = document.getElementById("mapa-przelacznik");
const wykresOdpoczynek = document.getElementById("wykres-odpoczynek");
const gablotaTydzien = document.getElementById("gablota-tydzien");
const wykresGablota = document.getElementById("wykres-gablota");
const mapaCiala = document.getElementById("mapa-ciala");
const mapaInfo = document.getElementById("mapa-info");
const mapaLegenda = document.getElementById("mapa-legenda");
// ----- Wykres postępu: nagłówek odpoczynku, mapa ciała, dni odpoczynku, gablota rekordów -----

// Gablota: rekordy (obliczRekordy) ustanowione w ostatnich 30 dniach, najnowsze pierwsze; "TEN TYDZIEŃ: N"
function renderGablotaRekordow() {
  const dzis = dzisiaj();
  const poczatekTygodnia = isoZDaty(poniedzialekTygodnia(new Date()));
  const rekordyWszystkie = obliczRekordy();
  const rekordy = Object.keys(rekordyWszystkie)
    .map(function (cw) { return rekordyWszystkie[cw]; })
    .filter(function (r) { return r.data <= dzis && dniMiedzy(r.data, dzis) < 30; })
    .sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : a.cwiczenie.localeCompare(b.cwiczenie, "pl"); });
  const wTymTygodniu = rekordy.filter(function (r) { return r.data >= poczatekTygodnia; }).length;

  gablotaTydzien.textContent = "Ten tydzień: " + wTymTygodniu;
  wykresGablota.innerHTML = "";
  if (wTymTygodniu === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "gablota-placeholder";
    placeholder.textContent = "Miejsce na rekord tego tygodnia";
    wykresGablota.appendChild(placeholder);
  }
  rekordy.forEach(function (r, i) {
    const karta = document.createElement("article");
    karta.className = "gablota-karta";
    karta.style.setProperty("--kolor-partii", kolorPartiiCSS(r.partia));
    const data = document.createElement("span");
    data.className = "gablota-data";
    data.innerHTML = IKONA_GWIAZDKA_REKORD;
    data.appendChild(document.createTextNode(formatDatyRejestru(r.data)));
    const wynik = document.createElement("span");
    wynik.className = "gablota-wynik";
    wynik.textContent = formatKg(r.ciezar) + " × " + r.powtorzenia;
    const nazwa = document.createElement("span");
    nazwa.className = "gablota-nazwa";
    const kropka = document.createElement("span");
    kropka.className = "wykres-kropka";
    nazwa.append(kropka, document.createTextNode(r.cwiczenie));
    karta.append(data, wynik, nazwa);
    wykresGablota.appendChild(wjazdKarty(karta, i));
  });
}

// Partie od najdłużej odpoczywającej (nigdy nietrenowane na początku)
function partieWgOdpoczynku(stan) {
  return PARTIE.slice().sort(function (a, b) {
    const da = stan[a].dni === null ? Infinity : stan[a].dni;
    const db2 = stan[b].dni === null ? Infinity : stan[b].dni;
    return db2 - da;
  });
}
function opisOdpoczynku(dni) {
  if (dni === null) return "jeszcze ani razu";
  if (dni === 0) return "trenowane dziś";
  return dni + (dni === 1 ? " dzień" : " dni") + " bez treningu";
}

// Nagłówek: 1–2 partie, które najdłużej nie były trenowane (druga, gdy też długo odpoczywa)
function renderWykresNaglowek(stan) {
  const kolejnosc = partieWgOdpoczynku(stan);
  const pierwsza = kolejnosc[0];
  const druga = kolejnosc[1];
  const dniDrugiej = stan[druga].dni;
  const wybrane = (dniDrugiej === null || dniDrugiej >= 4 || dniDrugiej === stan[pierwsza].dni) ? [pierwsza, druga] : [pierwsza];

  wykresKicker.textContent = wybrane.length === 2 ? "Najdłużej odpoczywają – dziś idealne" : "Najdłużej odpoczywa – dziś idealna";
  wykresTytul.textContent = wybrane.join(" i ");
  wykresSzczegoly.innerHTML = "";
  wybrane.forEach(function (partia, i) {
    if (i > 0) wykresSzczegoly.appendChild(document.createTextNode(" · "));
    const nazwa = document.createElement("b");
    nazwa.textContent = partia + ":";
    wykresSzczegoly.append(nazwa, document.createTextNode(" " + opisOdpoczynku(stan[partia].dni)));
  });
}

// "Dni odpoczynku": 7 partii, 1 kreska = 1 dzień (max 7), złote przy 7+ dniach albo nigdy
function renderDniOdpoczynku(stan) {
  wykresOdpoczynek.innerHTML = "";
  partieWgOdpoczynku(stan).forEach(function (partia, i) {
    const dni = stan[partia].dni;
    const zloty = dni === null || dni >= 7;
    const pelne = dni === null ? 7 : Math.min(dni, 7);

    const li = document.createElement("li");
    li.className = zloty ? "zloty" : "";
    li.style.setProperty("--kolor-partii", kolorPartiiCSS(partia));
    const nazwa = document.createElement("span");
    nazwa.className = "wykres-odpoczynek-nazwa";
    const kropka = document.createElement("span");
    kropka.className = "wykres-kropka";
    nazwa.append(kropka, document.createTextNode(partia));
    const kreski = document.createElement("span");
    kreski.className = "wykres-kreski";
    kreski.setAttribute("aria-hidden", "true");
    for (let k = 0; k < 7; k++) {
      const kreska = document.createElement("span");
      if (k < pelne) kreska.className = "pelna";
      kreski.appendChild(kreska);
    }
    const tekst = document.createElement("span");
    tekst.className = "wykres-odpoczynek-dni";
    tekst.textContent = dni === null ? "nigdy" : dni + (dni === 1 ? " dzień" : " dni");
    li.append(nazwa, kreski, tekst);
    wykresOdpoczynek.appendChild(wjazdKarty(li, i));
  });
}

// ----- Mapa ciała: przód i tył obok siebie, mięśnie przypisane do partii -----
// Lewa połowa sylwetki (viewBox 100 × 222); "lustro" dorysowuje prawą połowę odbiciem względem x = 50.
// Partia null = część ciała bez partii (głowa, przedramiona, kolana…), tylko tło.
const MAPA_MIESNIE = {
  przod: [
    [null, "M45.5 24 L54.5 24 L55.5 31 L44.5 31 Z"],
    [null, "M25.5 84 C23.5 93 23.5 102 25 110 L30 110 C32 102 34 93 34.5 83 C31.5 85.5 28.5 85.5 25.5 84 Z", true],
    [null, "M24.5 112 C23 116 24 121 27.5 122 C31 121 31.5 116 30.5 112 Z", true],
    [null, "M38.5 99 C42 104 46 107 50 108 C54 107 58 104 61.5 99 L62.5 106 C58 110 54 112 50 112 C46 112 42 110 37.5 106 Z"],
    [null, "M37 158 A4.5 4 0 1 0 46 158 A4.5 4 0 1 0 37 158 Z", true],
    [null, "M37 207 C35 210 36 213 40 213.5 L46 213.5 C47 211 46.5 208 45 207 Z", true],
    ["Barki", "M38 33.5 C30.5 33 24.5 37 23 45.5 C22.5 50 23.5 54.5 25.5 57.5 C28 51.5 31.5 46.5 36.5 43 C37.5 40 38 36.5 38 33.5 Z", true],
    ["Klata", "M49.4 35 L40 34.5 C37.5 38 36.5 43 37 49 C39 55.5 44 58.5 49.4 57.5 Z", true],
    ["Biceps", "M25.5 60.5 C24 67 24 74.5 25.5 81.5 C28.5 83.5 32 83 34.5 80 C35.5 72 35.5 64.5 34 57 C31.5 55.5 28 56.5 25.5 60.5 Z", true],
    ["Brzuch", "M42.5 60 C45.5 59 54.5 59 57.5 60 L57.5 94 C56 100 53 103.5 50 103.5 C47 103.5 44 100 42.5 94 Z"],
    ["Brzuch", "M36.5 56.5 C35.5 65 36 77 37.5 89 C38.5 94 40 97 41.5 97.5 L41.5 60.5 C40 59.5 38 58 36.5 56.5 Z", true],
    ["Nogi", "M37.5 103 C34.5 115 33.5 131 35 147 C36.5 152.5 40.5 154.5 45 153 C48 143 49.4 126 49.4 112 C45 110.5 40.5 107 37.5 103 Z", true],
    ["Nogi", "M36.5 163 C35 175 35.5 189 37.5 204 L44.5 204 C46.5 189 47.5 175 46.5 163 C43.5 165 39.5 165 36.5 163 Z", true]
  ],
  tyl: [
    [null, "M45.5 24 L54.5 24 L55.5 31 L44.5 31 Z"],
    [null, "M25.5 84 C23.5 93 23.5 102 25 110 L30 110 C32 102 34 93 34.5 83 C31.5 85.5 28.5 85.5 25.5 84 Z", true],
    [null, "M24.5 112 C23 116 24 121 27.5 122 C31 121 31.5 116 30.5 112 Z", true],
    [null, "M37 158 A4.5 4 0 1 0 46 158 A4.5 4 0 1 0 37 158 Z", true],
    [null, "M38 191 L45.5 189 L44.5 204 L37.5 204 Z", true],
    [null, "M37 207 C35 210 36 213 40 213.5 L46 213.5 C47 211 46.5 208 45 207 Z", true],
    ["Plecy", "M49.4 25 L45 30 C42 32.5 39 33.5 37.5 35 C42 38 46.5 44 49.4 50 Z", true],
    ["Barki", "M38 33.5 C30.5 33 24.5 37 23 45.5 C22.5 50 23.5 54.5 25.5 57.5 C28 51.5 31.5 46.5 36.5 43 C37.5 40 38 36.5 38 33.5 Z", true],
    ["Plecy", "M38.5 40 C35.5 48 35 60 36.5 72 C39 81 44 87 49.4 89 L49.4 54 C46 47 42.5 42.5 38.5 40 Z", true],
    ["Plecy", "M43 89 C45.5 92 48 93.5 50 93.5 C52 93.5 54.5 92 57 89 L58 99 L42 99 Z"],
    ["Triceps", "M25.5 60.5 C24 67 24 74.5 25.5 81.5 C28.5 83.5 32 83 34.5 80 C35.5 72 35.5 64.5 34 57 C31.5 55.5 28 56.5 25.5 60.5 Z", true],
    ["Dupa", "M37.5 100 C35 108 35.5 117 39.5 121.5 C43.5 124.5 47.5 124 49.4 120.5 L49.4 100 Z", true],
    ["Nogi", "M37.5 124 C35 135.5 35 147 36.5 154 C40 156.5 44 156.5 47 154 C49 144 49.4 133.5 49.2 125 C45 126.5 41 126 37.5 124 Z", true],
    ["Nogi", "M36.5 162 C34 170 34.5 181 37.5 189 C40.5 191.5 43.5 191 46 187.5 C47.5 179 47.5 170 45.5 162 C42.5 164 39.5 164 36.5 162 Z", true]
  ]
};
// Rysunki bez partii na wierzchu: podział brzucha na "kostki", kręgosłup
const MAPA_LINIE = { przod: "M50 60 V103 M43 71 H57 M43 82.5 H57", tyl: "M50 31 V97" };

// Dwa tryby. Kolory sprawdzone walidatorem palety (tło karty #15171c): regeneracja – trzy stany (rozróżnialne też
// przy daltonizmie), obciążenie – jedna barwa od ciemnej do jasnej wg liczby serii w ostatnich 7 dniach.
const MAPA_TRYBY = {
  regeneracja: [
    { od: 0, do: 2, kolor: "#d1559e", opis: "regeneruje się (0–2 dni)" },
    { od: 3, do: 6, kolor: "#3f86d9", opis: "gotowa (3–6 dni)" },
    { od: 7, do: Infinity, kolor: "#b3892f", opis: "czeka 7+ dni" }
  ],
  obciazenie: [
    { od: 1, do: 5, kolor: "#9a5528", opis: "1–5" },
    { od: 6, do: 11, kolor: "#c06a30", opis: "6–11" },
    { od: 12, do: 17, kolor: "#e3874a", opis: "12–17" },
    { od: 18, do: Infinity, kolor: "#ffb27e", opis: "18+ serii" }
  ]
};
let mapaTryb = "regeneracja";

(function zbudujMapeCiala() {
  const ns = "http://www.w3.org/2000/svg";
  ["przod", "tyl"].forEach(function (strona) {
    const figura = document.createElement("figure");
    figura.className = "mapa-sylwetka";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 100 222");
    svg.setAttribute("aria-label", strona === "przod" ? "Sylwetka z przodu" : "Sylwetka z tyłu");
    const glowa = document.createElementNS(ns, "ellipse");
    glowa.setAttribute("class", "mapa-cialo");
    glowa.setAttribute("cx", "50"); glowa.setAttribute("cy", "14.5"); glowa.setAttribute("rx", "8.5"); glowa.setAttribute("ry", "10.5");
    svg.appendChild(glowa);
    MAPA_MIESNIE[strona].forEach(function (m) {
      (m[2] ? [false, true] : [false]).forEach(function (odbicie) {
        const el = document.createElementNS(ns, "path");
        el.setAttribute("d", m[1]);
        if (odbicie) el.setAttribute("transform", "matrix(-1 0 0 1 100 0)");
        if (m[0]) {
          el.setAttribute("class", "mapa-partia");
          el.setAttribute("data-partia", m[0]);
          // Jeden przystanek klawiatury na partię i stronę: lustrzana połowa tylko do stuknięcia
          if (!odbicie) {
            el.setAttribute("tabindex", "0");
            el.setAttribute("role", "button");
          }
        } else {
          el.setAttribute("class", "mapa-cialo");
        }
        svg.appendChild(el);
      });
    });
    const linie = document.createElementNS(ns, "path");
    linie.setAttribute("class", "mapa-linia");
    linie.setAttribute("d", MAPA_LINIE[strona]);
    svg.appendChild(linie);
    const podpis = document.createElement("figcaption");
    podpis.textContent = strona === "przod" ? "Przód" : "Tył";
    figura.append(svg, podpis);
    mapaCiala.appendChild(figura);
  });
})();

mapaPrzelacznik.addEventListener("click", function (e) {
  const btn = e.target.closest("button[data-tryb-mapy]");
  if (!btn) return;
  mapaTryb = btn.dataset.trybMapy;
  mapaPrzelacznik.querySelectorAll("button").forEach(function (b) {
    b.setAttribute("aria-pressed", b === btn ? "true" : "false");
  });
  renderMapaCiala();
});

// Karta "Mapa ciała": dni od ostatniego treningu każdej partii, liczone z wczytanych wpisów
let mapaWybranaPartia = null;

// Różnica w pełnych dniach między dwiema datami "RRRR-MM-DD"
function dniMiedzy(odStr, doStr) {
  const od = odStr.split("-").map(Number);
  const dd = doStr.split("-").map(Number);
  return Math.round((Date.UTC(dd[0], dd[1] - 1, dd[2]) - Date.UTC(od[0], od[1] - 1, od[2])) / 86400000);
}

// { partia: { dni: liczba dni od ostatniego treningu albo null, treningi30: liczba dni treningowych w ostatnich 30 dniach,
//   serie7: liczba serii (podejść) w ostatnich 7 dniach, z dzisiaj } }
function obliczStanPartii() {
  const dzis = dzisiaj();
  const ostatnia = {};
  const dni30 = {};
  const serie7 = {};
  wpisy.forEach(function (w) {
    if (!w.data || !w.partia || w.data > dzis) return;
    if (!ostatnia[w.partia] || w.data > ostatnia[w.partia]) ostatnia[w.partia] = w.data;
    const temu = dniMiedzy(w.data, dzis);
    if (temu < 30) {
      (dni30[w.partia] = dni30[w.partia] || {})[w.data] = true;
    }
    if (temu < 7) serie7[w.partia] = (serie7[w.partia] || 0) + (w.podejscia || []).length;
  });
  const stan = {};
  PARTIE.forEach(function (p) {
    stan[p] = {
      dni: ostatnia[p] ? dniMiedzy(ostatnia[p], dzis) : null,
      treningi30: dni30[p] ? Object.keys(dni30[p]).length : 0,
      serie7: serie7[p] || 0
    };
  });
  return stan;
}

// Próg trybu dla partii (null = bez koloru: w obciążeniu zero serii)
function progMapy(s) {
  const wartosc = mapaTryb === "obciazenie" ? s.serie7 : (s.dni === null ? Infinity : s.dni);
  return MAPA_TRYBY[mapaTryb].find(function (p) { return wartosc >= p.od && wartosc <= p.do; }) || null;
}

function odmianaTreningow(n) {
  if (n === 1) return "trening";
  const r10 = n % 10, r100 = n % 100;
  return (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) ? "treningi" : "treningów";
}

function pokazInfoMapy(stan) {
  if (!mapaWybranaPartia) return;
  const s = stan[mapaWybranaPartia];
  let ostatnio;
  if (s.dni === null) ostatnio = "jeszcze nie trenowana";
  else if (s.dni === 0) ostatnio = "ostatnio: dzisiaj";
  else ostatnio = "ostatnio: " + s.dni + (s.dni === 1 ? " dzień" : " dni") + " temu";

  mapaInfo.innerHTML = "";
  const nazwa = document.createElement("strong");
  nazwa.textContent = mapaWybranaPartia;
  mapaInfo.appendChild(nazwa);
  mapaInfo.appendChild(document.createTextNode(
    " · " + ostatnio + " · " + s.serie7 + " " + odmianaLiczby(s.serie7, "seria", "serie", "serii") + " w 7 dniach · " +
    s.treningi30 + " " + odmianaTreningow(s.treningi30) + " w 30 dniach"
  ));
}

function renderLegendyMapy() {
  mapaLegenda.innerHTML = "";
  if (mapaTryb === "obciazenie") {
    const opis = document.createElement("li");
    opis.className = "mapa-legenda-opis";
    opis.textContent = "Serie w 7 dniach:";
    mapaLegenda.appendChild(opis);
  }
  MAPA_TRYBY[mapaTryb].forEach(function (p) {
    const li = document.createElement("li");
    const probka = document.createElement("span");
    probka.className = "mapa-probka";
    probka.style.background = p.kolor;
    li.append(probka, document.createTextNode(p.opis));
    mapaLegenda.appendChild(li);
  });
}

function renderMapaCiala(stan) {
  stan = stan || obliczStanPartii();
  mapaCiala.classList.toggle("wybrano", !!mapaWybranaPartia);
  mapaCiala.querySelectorAll(".mapa-partia").forEach(function (el) {
    const partia = el.getAttribute("data-partia");
    const s = stan[partia];
    const prog = progMapy(s);
    el.style.fill = prog ? prog.kolor : "";
    el.classList.toggle("zaznaczona", partia === mapaWybranaPartia);
    if (el.hasAttribute("tabindex")) {
      el.setAttribute("aria-label", partia + ": " + (mapaTryb === "obciazenie"
        ? s.serie7 + " " + odmianaLiczby(s.serie7, "seria", "serie", "serii") + " w 7 dniach"
        : (s.dni === null ? "nigdy nie trenowana" : s.dni + (s.dni === 1 ? " dzień" : " dni") + " od treningu")));
    }
  });
  renderLegendyMapy();
  pokazInfoMapy(stan);
}

function wybierzPartieMapy(el) {
  mapaWybranaPartia = el.getAttribute("data-partia");
  renderMapaCiala();
}

// Stuknięcie mięśnia pokazuje szczegóły partii (ponowne stuknięcie tej samej – odznacza)
mapaCiala.addEventListener("click", function (e) {
  const el = e.target.closest(".mapa-partia");
  if (!el) return;
  if (el.getAttribute("data-partia") === mapaWybranaPartia) {
    mapaWybranaPartia = null;
    mapaInfo.textContent = "Dotknij mięśnia, aby zobaczyć szczegóły.";
    renderMapaCiala();
    return;
  }
  wybierzPartieMapy(el);
});
mapaCiala.addEventListener("keydown", function (e) {
  const el = e.target.closest(".mapa-partia");
  if (!el || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  wybierzPartieMapy(el);
});

// Odświeżenie widoku "Wykres postępu" (po wczytaniu, dodaniu i usunięciu treningu)
function renderWykresPostepu() {
  const stan = obliczStanPartii();
  renderWykresNaglowek(stan);
  renderMapaCiala(stan);
  renderDniOdpoczynku(stan);
  renderGablotaRekordow();
}
