// Ekran "Rejestr ćwiczeń" (#widok-rejestr): widok jednego dnia treningowego i wyszukiwarka.

const rejestrBox = document.getElementById("rejestr");
const rejestrSzukaj = document.getElementById("rejestr-szukaj");
const rejestrDatalist = document.getElementById("rejestr-cwiczenia-lista");
const rejestrNawigacja = document.getElementById("rejestr-nawigacja");
const btnRejestrPoprzedni = document.getElementById("rejestr-poprzedni");
const btnRejestrNastepny = document.getElementById("rejestr-nastepny");
const rejestrDataTekst = document.getElementById("rejestr-data-tekst");
const inputRejestrData = document.getElementById("rejestr-data");
const rejestrDzien = document.getElementById("rejestr-dzien");
const rejestrObjetosc = document.getElementById("rejestr-objetosc");
const rejestrPigulki = document.getElementById("rejestr-pigulki");
const rejestrRozkladPasek = document.getElementById("rejestr-rozklad-pasek");
const rejestrRozkladLegenda = document.getElementById("rejestr-rozklad-legenda");
const rejestrKarty = document.getElementById("rejestr-karty");
// Odbudowa listy podpowiedzi do wyszukiwarki w rejestrze (wszystkie ćwiczenia z katalogu)
function odbudujDatalistRejestr() {
  rejestrDatalist.innerHTML = "";
  katalog
    .slice()
    .sort(function (a, b) { return a.nazwa.localeCompare(b.nazwa, "pl"); })
    .forEach(function (c) { rejestrDatalist.appendChild(new Option(c.nazwa)); });
}

// ----- Rejestr ćwiczeń: widok jednego dnia treningowego + wyszukiwarka -----
let rejestrWybranaData = null; // dzień pokazywany w Rejestrze (RRRR-MM-DD); null = ostatni dzień z treningiem
// Daty z zapisanym treningiem, od najstarszej
function datyTreningow() {
  return Array.from(new Set(wpisy.map(function (w) { return w.data; }))).sort();
}
// Najbliższy dzień z treningiem (przy remisie wcześniejszy)
function najblizszaDataTreningu(daty, cel) {
  const dzien = function (d) { return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); };
  let najlepsza = daty[0];
  daty.forEach(function (d) {
    if (Math.abs(dzien(d) - dzien(cel)) < Math.abs(dzien(najlepsza) - dzien(cel))) najlepsza = d;
  });
  return najlepsza;
}
function ustawDzienRejestru(d) {
  rejestrWybranaData = d;
  renderRejestr();
}
btnRejestrPoprzedni.addEventListener("click", function () {
  const daty = datyTreningow();
  const i = daty.indexOf(rejestrWybranaData);
  if (i > 0) ustawDzienRejestru(daty[i - 1]);
});
btnRejestrNastepny.addEventListener("click", function () {
  const daty = datyTreningow();
  const i = daty.indexOf(rejestrWybranaData);
  if (i !== -1 && i < daty.length - 1) ustawDzienRejestru(daty[i + 1]);
});
inputRejestrData.addEventListener("click", function () {
  try { if (inputRejestrData.showPicker) inputRejestrData.showPicker(); } catch (e) {}
});
inputRejestrData.addEventListener("change", function () {
  const cel = inputRejestrData.value;
  const daty = datyTreningow();
  if (!cel || daty.length === 0) return;
  if (daty.indexOf(cel) !== -1) {
    ustawDzienRejestru(cel);
    return;
  }
  const najblizsza = najblizszaDataTreningu(daty, cel);
  ustawDzienRejestru(najblizsza);
  pokazToast("W tym dniu nie było treningu - pokazuję najbliższy: " + formatDatyRejestru(najblizsza) + ".", "sukces");
});

// Render "Rejestru ćwiczeń": wyszukiwarka (lista dni z ćwiczeniem) albo widok jednego dnia
function renderRejestr() {
  const szukane = (rejestrSzukaj.value || "").trim().toLowerCase();
  const daty = datyTreningow();
  rejestrBox.innerHTML = "";

  if (daty.length === 0) {
    rejestrNawigacja.hidden = true;
    rejestrDzien.hidden = true;
    rejestrBox.innerHTML = pustyStanHTML("📒", "Brak zapisanych treningów - dodaj pierwszy w „Zapisz trening”.");
    return;
  }

  // Wybrany dzień: domyślnie ostatni z treningiem; gdy zniknął (np. po usunięciu ostatniego wpisu) - najbliższy sąsiedni
  if (!rejestrWybranaData) rejestrWybranaData = daty[daty.length - 1];
  else if (daty.indexOf(rejestrWybranaData) === -1) rejestrWybranaData = najblizszaDataTreningu(daty, rejestrWybranaData);

  if (szukane) {
    rejestrNawigacja.hidden = true;
    rejestrDzien.hidden = true;
    renderRejestrWyniki(szukane);
    return;
  }
  rejestrNawigacja.hidden = false;
  rejestrDzien.hidden = false;
  renderRejestrDzien(daty);
}

// Lista dni, w których było szukane ćwiczenie: data + serie, najnowsze na górze, złoty znacznik przy rekordzie
function renderRejestrWyniki(szukane) {
  const rekordy = obliczRekordy();
  const trafienia = wpisy
    .filter(function (w) { return w.cwiczenie.toLowerCase().indexOf(szukane) !== -1; })
    .sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });

  if (trafienia.length === 0) {
    rejestrBox.innerHTML = pustyStanHTML("🔍", "Brak wyników dla „" + rejestrSzukaj.value + "\".");
    return;
  }

  const lista = document.createElement("ol");
  lista.className = "rejestr-wyniki-lista";
  trafienia.forEach(function (w, i) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rejestr-wynik";
    btn.setAttribute("aria-label", "Otwórz dzień " + w.data + ": " + w.cwiczenie);

    const data = document.createElement("span");
    data.className = "rejestr-wynik-data";
    data.textContent = formatDatyRejestru(w.data);
    const opis = document.createElement("span");
    opis.className = "rejestr-wynik-opis";
    const nazwa = document.createElement("span");
    nazwa.className = "rejestr-wynik-nazwa";
    nazwa.textContent = w.cwiczenie;
    const serie = document.createElement("span");
    serie.className = "rejestr-wynik-serie";
    serie.textContent = opisSerii(w.podejscia);
    opis.append(nazwa, serie);
    btn.append(data, opis);
    if (czyWpisMaRekord(w, rekordy)) btn.appendChild(tagNowyRekord());

    btn.addEventListener("click", function () {
      rejestrSzukaj.value = "";
      ustawDzienRejestru(w.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    li.appendChild(btn);
    lista.appendChild(wjazdKarty(li, i));
  });
  rejestrBox.appendChild(lista);
}

// Widok dnia: nawigacja, objętość, pigułki, rozkład serii na partie, karty ćwiczeń ze słupkami serii
function renderRejestrDzien(daty) {
  const d = rejestrWybranaData;
  const indeks = daty.indexOf(d);
  btnRejestrPoprzedni.disabled = indeks <= 0;
  btnRejestrNastepny.disabled = indeks >= daty.length - 1;
  rejestrDataTekst.textContent = formatDatyRejestru(d);
  inputRejestrData.value = d;

  const wpisyDnia = wpisy.filter(function (w) { return w.data === d; });
  const rekordy = obliczRekordy();
  let objetosc = 0;
  let liczbaSerii = 0;
  let liczbaRekordow = 0;
  const seriePartii = {};
  wpisyDnia.forEach(function (w) {
    const podejscia = w.podejscia || [];
    podejscia.forEach(function (p) { objetosc += wynikSerii(p); });
    liczbaSerii += podejscia.length;
    seriePartii[w.partia] = (seriePartii[w.partia] || 0) + podejscia.length;
    if (czyWpisMaRekord(w, rekordy)) liczbaRekordow++;
  });

  animujLiczbe(rejestrObjetosc, Math.round(objetosc), function (n) { return n.toLocaleString("pl-PL"); });

  rejestrPigulki.innerHTML = "";
  const pigulka = function (tekst, zlota) {
    const el = document.createElement("span");
    el.className = "rejestr-pigulka" + (zlota ? " zlota" : "");
    el.innerHTML = zlota ? IKONA_GWIAZDKA_REKORD : "";
    el.appendChild(document.createTextNode(tekst));
    rejestrPigulki.appendChild(el);
  };
  pigulka(wpisyDnia.length + " " + odmianaLiczby(wpisyDnia.length, "ćwiczenie", "ćwiczenia", "ćwiczeń"));
  pigulka(liczbaSerii + " " + odmianaLiczby(liczbaSerii, "seria", "serie", "serii"));
  if (liczbaRekordow > 0) pigulka(liczbaRekordow + " " + odmianaLiczby(liczbaRekordow, "rekord", "rekordy", "rekordów"), true);
  const liczbaSuperserii = new Set(wpisyDnia.filter(function (w) { return w.superseria_id; }).map(function (w) { return w.superseria_id; })).size;
  if (liczbaSuperserii > 0) {
    const el = document.createElement("span");
    el.className = "rejestr-pigulka rejestr-pigulka-superseria";
    el.innerHTML = IKONA_WYMIANA;
    el.appendChild(document.createTextNode(liczbaSuperserii + " " + odmianaLiczby(liczbaSuperserii, "superseria", "superserie", "superserii")));
    rejestrPigulki.appendChild(el);
  }

  // Rozkład serii: pasek dzielony proporcjonalnie do liczby serii w partiach + legenda
  rejestrRozkladPasek.innerHTML = "";
  rejestrRozkladLegenda.innerHTML = "";
  const partieDnia = PARTIE.concat(Object.keys(seriePartii).filter(function (p) { return PARTIE.indexOf(p) === -1; }))
    .filter(function (p) { return seriePartii[p]; });
  partieDnia.forEach(function (partia) {
    const kolor = kolorPartiiCSS(partia);
    const odcinek = document.createElement("span");
    odcinek.style.flex = String(seriePartii[partia]);
    odcinek.style.setProperty("--kolor-partii", kolor);
    odcinek.title = partia + ": " + seriePartii[partia];
    rejestrRozkladPasek.appendChild(odcinek);

    const poz = document.createElement("span");
    poz.className = "rejestr-legenda-poz";
    const kropka = document.createElement("span");
    kropka.className = "rejestr-kropka";
    kropka.style.setProperty("--kolor-partii", kolor);
    const liczba = document.createElement("b");
    liczba.textContent = String(seriePartii[partia]);
    poz.append(kropka, document.createTextNode(partia + " "), liczba);
    rejestrRozkladLegenda.appendChild(poz);
  });

  // Karty ćwiczeń dnia; wiersze z tym samym superseria_id w jednej ramce "Superseria" (numer liczy ramkę raz)
  if (sswObserwator) sswObserwator.disconnect();
  rejestrKarty.innerHTML = "";
  const pokazaneSuperserie = new Set();
  let i = 0;
  wpisyDnia.forEach(function (w) {
    if (!w.superseria_id) {
      rejestrKarty.appendChild(wjazdKarty(budujKarteRejestru(w, rekordy, i), i));
      i++;
      return;
    }
    if (pokazaneSuperserie.has(w.superseria_id)) return;
    pokazaneSuperserie.add(w.superseria_id);
    const czlonkowie = wpisyDnia
      .filter(function (x) { return x.superseria_id === w.superseria_id; })
      .sort(function (a, b) { return (a.superseria_poz || 0) - (b.superseria_poz || 0); });
    rejestrKarty.appendChild(wjazdKarty(budujRamkeSuperserii(czlonkowie, rekordy, i), i));
    i++;
  });
}

// ----- Ramka superserii: złota obwódka, nazwy ćwiczeń z ikoną wymiany, rundy (słupki ćwiczeń obok siebie + mostek), objętość -----
const IKONA_WYMIANA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 0 1-2 2H3"/></svg>';
// Obracana obwódka wymaga conic-gradient i @property (animowany kąt); bez tego zostaje statyczna złota
const SSW_OBWODKA_ANIMOWANA = !!(window.CSS && CSS.supports && CSS.supports("background", "conic-gradient(from 1deg, red, blue)") &&
  typeof CSS.registerProperty === "function");
// Iskry (maks. 4): pozycja, opóźnienie, czas, rozmiar
const SSW_ISKRY = [
  { left: 12, delay: 0, czas: 3.2, r: 3 },
  { left: 37, delay: 1.1, czas: 4, r: 2 },
  { left: 63, delay: 2.2, czas: 3.6, r: 4 },
  { left: 88, delay: 0.6, czas: 4.4, r: 2 }
];
// Animacje ramek tylko, gdy są na ekranie (klasa "widoczna"); poza ekranem animation-play-state: paused
const sswObserwator = "IntersectionObserver" in window
  ? new IntersectionObserver(function (wpisyObs) {
      wpisyObs.forEach(function (e) { e.target.classList.toggle("widoczna", e.isIntersecting); });
    })
  : null;

function sswEl(tag, klasa, tekst) {
  const e = document.createElement(tag);
  if (klasa) e.className = klasa;
  if (tekst !== undefined) e.textContent = tekst;
  return e;
}

// Rundy = podejścia ćwiczeń sparowane po indeksie; brakujące podejście jako "–"
function budujRamkeSuperserii(czlonkowie, rekordy, i) {
  const trzy = czlonkowie.length >= 3;
  const liczbaRund = Math.max.apply(null, czlonkowie.map(function (w) { return (w.podejscia || []).length; }).concat([0]));
  const rekordowe = czlonkowie.map(function (w) { return seriaRekordowaWpisu(w, rekordy); });
  const liczbaRekordow = rekordowe.filter(Boolean).length;
  let maks = 0;
  let objetosc = 0;
  czlonkowie.forEach(function (w) {
    (w.podejscia || []).forEach(function (p) {
      objetosc += wynikSerii(p);
      maks = Math.max(maks, wynikSerii(p));
    });
  });

  // Zewnętrzny pojemnik dostaje animację wjazdu (wjazdKarty), .ssw własne animacje
  const pojemnik = sswEl("div", "rejestr-superseria");
  const ramka = sswEl("div", "ssw" + (trzy ? " ssw-3" : "") + (SSW_OBWODKA_ANIMOWANA ? " ssw-animowana" : ""));
  const wnetrze = sswEl("section", "ssw-wnetrze");
  wnetrze.setAttribute("aria-label", "Superseria: " + czlonkowie.map(function (w) { return w.cwiczenie; }).join(", "));

  const iskry = sswEl("div", "ssw-iskry");
  iskry.setAttribute("aria-hidden", "true");
  SSW_ISKRY.forEach(function (s) {
    const iskra = sswEl("span", "spark");
    iskra.style.left = s.left + "%";
    iskra.style.width = iskra.style.height = s.r + "px";
    iskra.style.animationDelay = s.delay + "s";
    iskra.style.animationDuration = s.czas + "s";
    iskry.appendChild(iskra);
  });

  // Nagłówek: numer, "SUPERSERIA", liczba rund, kosz
  const gora = sswEl("div", "ssw-gora");
  const numer = sswEl("span", "ssw-numer", String(i + 1).padStart(2, "0"));
  const opis = sswEl("span", "ssw-opis");
  opis.append(
    sswEl("span", "ssw-etykieta", "Superseria"),
    sswEl("span", "ssw-podpis", liczbaRund + " " + odmianaLiczby(liczbaRund, "runda", "rundy", "rund"))
  );
  const btnUsun = sswEl("button", "rejestr-btn-usun");
  btnUsun.type = "button";
  btnUsun.setAttribute("aria-label", "Usuń całą superserię");
  btnUsun.innerHTML = IKONA_KOSZ_KATALOG;
  btnUsun.addEventListener("click", function () { usunSuperserie(czlonkowie[0].superseria_id, btnUsun); });
  gora.append(numer, opis, btnUsun);

  // Nazwy ćwiczeń z kropką partii, między nimi rdzeń z ikoną wymiany
  const nazwy = sswEl("div", "ssw-nazwy");
  czlonkowie.forEach(function (w, k) {
    if (k > 0) {
      const rdzen = sswEl("span", "core");
      rdzen.innerHTML = IKONA_WYMIANA;
      nazwy.appendChild(rdzen);
    }
    const nazwa = sswEl("span", "ssw-nazwa");
    nazwa.style.setProperty("--kolor-partii", kolorPartiiCSS(w.partia));
    const partia = sswEl("span", "ssw-nazwa-partia");
    partia.append(sswEl("span", "rejestr-kropka"), document.createTextNode(w.partia));
    nazwa.append(partia, sswEl("span", "ssw-nazwa-tekst", w.cwiczenie));
    nazwy.appendChild(nazwa);
  });

  // Rundy: słupki (wysokość ∝ wynikSerii, maksimum z całej superserii), mostek, wyniki, "runda N"
  const rundy = sswEl("div", "ssw-rundy" + (liczbaRund > 4 ? " przewijane" : ""));
  for (let r = 0; r < liczbaRund; r++) {
    const runda = sswEl("div", "ssw-runda");
    const slupki = sswEl("div", "ssw-slupki");
    const wyniki = [];
    const wysokosci = [];
    czlonkowie.forEach(function (w, k) {
      const p = (w.podejscia || [])[r];
      const kolor = kolorPartiiCSS(w.partia);
      const slupek = sswEl("span", "ssw-slupek");
      slupek.style.setProperty("--kolor-partii", kolor);
      const wynik = sswEl("span", "ssw-wynik");
      wynik.style.setProperty("--kolor-partii", kolor);
      if (!p) {
        slupek.classList.add("brak");
        wynik.textContent = "–";
      } else {
        const h = Math.round(16 + 76 * (maks > 0 ? wynikSerii(p) / maks : 0));
        slupek.style.height = h + "px";
        wysokosci.push(h);
        wynik.textContent = formatKg(Number(p["cieżar"]) || 0) + "×" + (Number(p.powtorzenia) || 0);
        if (p === rekordowe[k]) {
          slupek.classList.add("rekord");
          wynik.classList.add("rekord");
          wynik.insertAdjacentHTML("beforeend", IKONA_GWIAZDKA_REKORD);
          wynik.setAttribute("aria-label", wynik.textContent + ", rekord");
        }
      }
      slupki.appendChild(slupek);
      wyniki.push(wynik);
    });
    if (wysokosci.length >= 2) {
      const most = sswEl("i", "bridge");
      most.style.bottom = Math.round(Math.min.apply(null, wysokosci) * 0.75) + "px";
      most.style.setProperty("--kolor-a", kolorPartiiCSS(czlonkowie[0].partia));
      most.style.setProperty("--kolor-b", kolorPartiiCSS(czlonkowie[czlonkowie.length - 1].partia));
      slupki.appendChild(most);
    }
    runda.appendChild(slupki);
    wyniki.forEach(function (w) { runda.appendChild(w); });
    runda.appendChild(sswEl("span", "ssw-runda-nr", "runda " + (r + 1)));
    rundy.appendChild(runda);
  }

  // Stopka: objętość superserii i rekordy
  const stopka = sswEl("div", "ssw-stopka");
  stopka.append(
    sswEl("span", "ssw-stopka-opis", "Objętość superserii · " + liczbaRekordow + " " + odmianaLiczby(liczbaRekordow, "rekord", "rekordy", "rekordów")),
    sswEl("span", "ssw-objetosc", Math.round(objetosc).toLocaleString("pl-PL") + " kg")
  );

  wnetrze.append(iskry, gora, nazwy, rundy, stopka);
  ramka.appendChild(wnetrze);
  pojemnik.appendChild(ramka);
  if (sswObserwator) sswObserwator.observe(ramka);
  else ramka.classList.add("widoczna");
  return pojemnik;
}

// Karta zwykłego ćwiczenia ze słupkami serii
function budujKarteRejestru(w, rekordy, i) {
  const seriaRekordowa = seriaRekordowaWpisu(w, rekordy);
  const kolor = kolorPartiiCSS(w.partia);

  const karta = document.createElement("article");
  karta.className = "rejestr-karta" + (seriaRekordowa ? " rekord" : "");
  karta.style.setProperty("--kolor-partii", kolor);

  const gora = document.createElement("div");
  gora.className = "rejestr-karta-gora";
  const numer = document.createElement("span");
  numer.className = "rejestr-karta-numer";
  numer.textContent = String(i + 1).padStart(2, "0");
  const opis = document.createElement("div");
  opis.className = "rejestr-karta-opis";
  const partia = document.createElement("span");
  partia.className = "rejestr-karta-partia";
  const kropka = document.createElement("span");
  kropka.className = "rejestr-kropka";
  partia.append(kropka, document.createTextNode(w.partia));
  const nazwa = document.createElement("h3");
  nazwa.className = "rejestr-karta-nazwa";
  nazwa.textContent = w.cwiczenie;
  opis.append(partia, nazwa);

  const akcje = document.createElement("div");
  akcje.className = "rejestr-karta-akcje";
  if (seriaRekordowa) {
    const gwiazda = document.createElement("span");
    gwiazda.className = "rejestr-gwiazda";
    gwiazda.setAttribute("role", "img");
    gwiazda.setAttribute("aria-label", "Nowy rekord");
    gwiazda.innerHTML = IKONA_GWIAZDKA_REKORD;
    akcje.appendChild(gwiazda);
  }
  const btnUsun = document.createElement("button");
  btnUsun.type = "button";
  btnUsun.className = "rejestr-btn-usun";
  btnUsun.setAttribute("aria-label", "Usuń wpis „" + w.cwiczenie + "”");
  btnUsun.innerHTML = IKONA_KOSZ_KATALOG;
  btnUsun.addEventListener("click", function () { usunWpis(w, btnUsun); });
  akcje.appendChild(btnUsun);
  gora.append(numer, opis, akcje);

  // Słupki serii: wysokość ∝ ciężar × powtórzenia, seria-rekord na złoto
  const serie = document.createElement("div");
  serie.className = "rejestr-serie";
  const podejscia = w.podejscia || [];
  const maks = Math.max.apply(null, podejscia.map(wynikSerii).concat([0]));
  podejscia.forEach(function (p) {
    const kolumna = document.createElement("div");
    kolumna.className = "rejestr-seria" + (p === seriaRekordowa ? " rekord" : "");
    const podpis = document.createElement("span");
    podpis.className = "rejestr-seria-podpis";
    podpis.textContent = formatKg(Number(p["cieżar"]) || 0) + "×​" + (Number(p.powtorzenia) || 0); // przy wąskich słupkach łamie się tylko po "×"
    const slupek = document.createElement("div");
    slupek.className = "rejestr-seria-slupek";
    slupek.style.height = Math.round(16 + 60 * (maks > 0 ? wynikSerii(p) / maks : 0)) + "px";
    kolumna.append(podpis, slupek);
    serie.appendChild(kolumna);
  });

  karta.append(gora, serie);
  return karta;
}
rejestrSzukaj.addEventListener("input", renderRejestr);
