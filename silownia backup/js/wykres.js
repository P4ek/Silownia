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

// Przełącznik "Przód / Tył" - jedna sylwetka naraz
let mapaStrona = "przod";
mapaPrzelacznik.addEventListener("click", function (e) {
  const btn = e.target.closest("button[data-strona]");
  if (!btn) return;
  mapaStrona = btn.dataset.strona;
  mapaPrzelacznik.querySelectorAll("button").forEach(function (b) {
    b.setAttribute("aria-pressed", b === btn ? "true" : "false");
  });
  mapaCiala.querySelectorAll(".mapa-sylwetka").forEach(function (f) { f.hidden = f.dataset.strona !== mapaStrona; });
});

// Etykiety przy sylwetce: [partia, strona kolumny, położenie w % wysokości sylwetki]
const MAPA_ETYKIETY = {
  przod: [["Barki", "lewe", 22], ["Biceps", "lewe", 33], ["Nogi", "lewe", 72], ["Klata", "prawe", 24], ["Brzuch", "prawe", 41]],
  tyl: [["Barki", "lewe", 22], ["Triceps", "lewe", 33], ["Nogi", "lewe", 72], ["Plecy", "prawe", 31], ["Dupa", "prawe", 52]]
};
function renderEtykietyMapy(stan) {
  mapaCiala.querySelectorAll(".mapa-sylwetka").forEach(function (figura) {
    const kolumny = { lewe: figura.querySelector(".mapa-etykiety.lewe"), prawe: figura.querySelector(".mapa-etykiety.prawe") };
    kolumny.lewe.innerHTML = "";
    kolumny.prawe.innerHTML = "";
    MAPA_ETYKIETY[figura.dataset.strona].forEach(function (poz) {
      const partia = poz[0];
      const dni = stan[partia].dni;
      const etykieta = document.createElement("button");
      etykieta.type = "button";
      etykieta.className = "mapa-etykieta" + (dni === null || dni >= 7 ? " zlota" : "") + (partia === mapaWybranaPartia ? " zaznaczona" : "");
      etykieta.style.setProperty("--y", poz[2] + "%");
      etykieta.dataset.partia = partia;
      etykieta.setAttribute("aria-label", partia + ": " + (dni === null ? "nigdy nie trenowana" : dni + (dni === 1 ? " dzień" : " dni") + " od treningu"));
      const wartosc = document.createElement("b");
      wartosc.textContent = dni === null ? "—" : dni + "d";
      etykieta.append(document.createTextNode(partia), wartosc);
      kolumny[poz[1]].appendChild(etykieta);
    });
  });
}

// Karta "Mapa ciała": dni od ostatniego treningu każdej partii, liczone z wczytanych wpisów
let mapaWybranaPartia = null;

// Różnica w pełnych dniach między dwiema datami "RRRR-MM-DD"
function dniMiedzy(odStr, doStr) {
  const od = odStr.split("-").map(Number);
  const dd = doStr.split("-").map(Number);
  return Math.round((Date.UTC(dd[0], dd[1] - 1, dd[2]) - Date.UTC(od[0], od[1] - 1, od[2])) / 86400000);
}

// { partia: { dni: liczba dni od ostatniego treningu albo null, treningi30: liczba dni treningowych w ostatnich 30 dniach } }
function obliczStanPartii() {
  const dzis = dzisiaj();
  const ostatnia = {};
  const dni30 = {};
  wpisy.forEach(function (w) {
    if (!w.data || !w.partia || w.data > dzis) return;
    if (!ostatnia[w.partia] || w.data > ostatnia[w.partia]) ostatnia[w.partia] = w.data;
    if (dniMiedzy(w.data, dzis) < 30) {
      (dni30[w.partia] = dni30[w.partia] || {})[w.data] = true;
    }
  });
  const stan = {};
  PARTIE.forEach(function (p) {
    stan[p] = {
      dni: ostatnia[p] ? dniMiedzy(ostatnia[p], dzis) : null,
      treningi30: dni30[p] ? Object.keys(dni30[p]).length : 0
    };
  });
  return stan;
}

function poziomMapy(dni) {
  if (dni === null || dni >= 7) return 3;
  if (dni <= 1) return 0;
  if (dni <= 3) return 1;
  return 2;
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
    " · " + ostatnio + " · " + s.treningi30 + " " + odmianaTreningow(s.treningi30) + " w ostatnich 30 dniach"
  ));
}

function renderMapaCiala(stan) {
  stan = stan || obliczStanPartii();
  mapaCiala.querySelectorAll(".mapa-partia").forEach(function (el) {
    const partia = el.getAttribute("data-partia");
    const poziom = poziomMapy(stan[partia].dni);
    el.classList.remove("poziom-0", "poziom-1", "poziom-2", "poziom-3");
    el.classList.add("poziom-" + poziom);
    el.classList.toggle("zaznaczona", partia === mapaWybranaPartia);
  });
  renderEtykietyMapy(stan);
  pokazInfoMapy(stan);
}

function wybierzPartieMapy(el) {
  mapaWybranaPartia = el.getAttribute("data-partia");
  renderMapaCiala();
}

// Kliknięcie partii na sylwetce albo jej etykiety pokazuje szczegóły
mapaCiala.addEventListener("click", function (e) {
  const el = e.target.closest(".mapa-partia, .mapa-etykieta");
  if (el) wybierzPartieMapy(el);
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
