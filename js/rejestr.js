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

  // Karty ćwiczeń dnia
  rejestrKarty.innerHTML = "";
  wpisyDnia.forEach(function (w, i) {
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
    rejestrKarty.appendChild(wjazdKarty(karta, i));
  });
}
rejestrSzukaj.addEventListener("input", renderRejestr);
