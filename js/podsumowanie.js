// Podsumowanie tygodnia (#podsum): pełnoekranowe relacje jak na Instagramie – paski postępu, stuknięcie w prawo / w lewo,
// przytrzymanie pauzuje, samo przechodzi co PODSUM_SLAJD_MS. Slajdy (pomijane, gdy brak danych): wstęp, trening (objętość
// liczona od zera, zmiana vs poprzedni tydzień, słupki dni), rekordy tygodnia, nawyki (procent i najdłuższa seria),
// medytacja i pieniądze (zapytania przy otwarciu, tylko konta z dostępem), finał – kula tygodnia (js/kula.js) ze średnim
// wynikiem dnia. Otwierane z banera na ekranie Dziś (niedziela od 18:00 i poniedziałek, chowany na dany tydzień w localStorage)
// albo z linku „Podsumowanie” w sekcji Tydzień. Korzysta z danych i funkcji ekranu Dziś (dzisStan, dzisSkladnikiDnia, DZIS_KOLORY).

const PODSUM_SLAJD_MS = 6500;
const PODSUM_PRZYTRZYMANIE_MS = 220;
const PODSUM_KLUCZ_SCHOWANY = "podsum-schowany"; // localStorage: poniedziałek tygodnia, którego baner schowano
const PODSUM_MIESIACE = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const PODSUM_DNI = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];
const PODSUM_DNI_PELNE = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];

const podsumEl = document.getElementById("podsum");
const podsumSlajdyEl = document.getElementById("podsum-slajdy");
const podsumPaskiEl = document.getElementById("podsum-paski");
const podsumBanerEl = document.getElementById("dzis-podsum-baner");
const PODSUM_BEZ_RUCHU = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let podsumSlajdy = [];     // [{ klucz, kolor, html, poPokazaniu }]
let podsumNr = 0;
let podsumTimer = null;
let podsumStartSlajdu = 0;
let podsumPozostalo = PODSUM_SLAJD_MS;
let podsumPauza = false;
let podsumKula = null;
let podsumPoprzedniFokus = null;

// ----- Daty -----
function podsumData(iso) { return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }
function podsumPrzesun(iso, dni) { const d = podsumData(iso); d.setDate(d.getDate() + dni); return isoZDaty(d); }
function podsumZakres(od, doDnia) {
  const a = podsumData(od), b = podsumData(doDnia);
  return a.getMonth() === b.getMonth()
    ? a.getDate() + " – " + b.getDate() + " " + PODSUM_MIESIACE[b.getMonth()]
    : a.getDate() + " " + PODSUM_MIESIACE[a.getMonth()] + " – " + b.getDate() + " " + PODSUM_MIESIACE[b.getMonth()];
}
// Tydzień do pokazania: w poniedziałek poprzedni (pełny), w pozostałe dni bieżący (do dziś)
function podsumTydzien(wymusBiezacy) {
  const dzis = dzisiaj();
  const pon = isoZDaty(poniedzialekTygodnia(new Date()));
  if (!wymusBiezacy && new Date().getDay() === 1) {
    const od = podsumPrzesun(pon, -7);
    return { od: od, koniec: podsumPrzesun(od, 6), dni: 7, biezacy: false };
  }
  const dni = Math.round((podsumData(dzis) - podsumData(pon)) / 864e5) + 1;
  return { od: pon, koniec: podsumPrzesun(pon, 6), doDzis: dzis, dni: dni, biezacy: true };
}
function podsumWTygodniu(t, iso) { return iso >= t.od && iso <= (t.doDzis || t.koniec); }
function podsumDniTygodnia(t) {
  const lista = [];
  for (let i = 0; i < t.dni; i++) lista.push(podsumPrzesun(t.od, i));
  return lista;
}

function podsumEsc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
function podsumLiczba(n) { return Math.round(n).toLocaleString("pl-PL"); }
function podsumDostep(ids) { return !!(sesjaUzytkownika && sesjaUzytkownika.user && ids.includes(sesjaUzytkownika.user.id)); }
function podsumObjetosc(lista) {
  return lista.reduce(function (s, w) { return s + (w.podejscia || []).reduce(function (a, p) { return a + wynikSerii(p); }, 0); }, 0);
}

// Seria nawyku: ile dni z rzędu zrobiony, licząc wstecz od ostatniego dnia tygodnia (albo dziś)
function podsumSeriaNawyku(n, koniec) {
  let seria = 0;
  let d = koniec;
  if (!czyNawykZrobiony(n.id, d) && d === dzisiaj()) d = podsumPrzesun(d, -1); // dzisiejszy jeszcze może się udać
  while (czyNawykZrobiony(n.id, d) && seria < 1000) { seria++; d = podsumPrzesun(d, -1); }
  return seria;
}

// ----- Budowa slajdów -----
function podsumSlajd(klucz, kolor, kicker, srodek, poPokazaniu) {
  return {
    klucz: klucz, kolor: kolor, poPokazaniu: poPokazaniu,
    html: '<section class="podsum-slajd" data-klucz="' + klucz + '" style="--k:' + kolor + '">' +
      '<span class="podsum-kicker">' + kicker + "</span>" + srodek + "</section>"
  };
}

async function podsumZbuduj(t) {
  const slajdy = [];
  const zakres = podsumZakres(t.od, t.koniec);
  const stan = dzisStan();
  const dni = podsumDniTygodnia(t);

  // 1. Wstęp
  slajdy.push(podsumSlajd("wstep", "#7AA2FF", zakres,
    '<h2 class="podsum-tytul">' + (t.biezacy ? "Twój tydzień<br>do tej pory" : "Twój tydzień<br>w skrócie") + "</h2>" +
    '<p class="podsum-opis">Stuknij w prawo, żeby iść dalej. Przytrzymaj, żeby zatrzymać.</p>'));

  // 2. Trening
  const wpisyTyg = wpisy.filter(function (w) { return podsumWTygodniu(t, w.data); });
  if (wpisyTyg.length) {
    const objetosc = podsumObjetosc(wpisyTyg);
    const dniTreningowe = Array.from(new Set(wpisyTyg.map(function (w) { return w.data; })));
    const serie = wpisyTyg.reduce(function (s, w) { return s + (w.podejscia || []).length; }, 0);
    const poprzedniOd = podsumPrzesun(t.od, -7);
    const poprzedniDo = podsumPrzesun(t.od, -7 + t.dni - 1); // ta sama liczba dni, żeby porównanie było uczciwe
    const poprzednia = podsumObjetosc(wpisy.filter(function (w) { return w.data >= poprzedniOd && w.data <= poprzedniDo; }));
    const zmiana = poprzednia > 0 ? Math.round((objetosc / poprzednia - 1) * 100) : null;
    const seriePartii = {};
    wpisyTyg.forEach(function (w) { seriePartii[w.partia] = (seriePartii[w.partia] || 0) + (w.podejscia || []).length; });
    const partia = Object.keys(seriePartii).sort(function (a, b) { return seriePartii[b] - seriePartii[a]; })[0];
    const naDzien = PODSUM_DNI.map(function (_, i) {
      const d = podsumPrzesun(t.od, i);
      return podsumObjetosc(wpisyTyg.filter(function (w) { return w.data === d; }));
    });
    const maks = Math.max.apply(null, naDzien) || 1;
    const slupki = '<div class="podsum-slupki" role="img" aria-label="Objętość treningu w kolejne dni tygodnia">' + naDzien.map(function (v, i) {
      return '<span class="podsum-slupek' + (v === maks && v > 0 ? " maks" : "") + '"><i style="--h:' + Math.max(v > 0 ? 6 : 2, Math.round(v / maks * 100)) + '%;--d:' + i + '"></i><b>' + PODSUM_DNI[i] + "</b></span>";
    }).join("") + "</div>";
    slajdy.push(podsumSlajd("trening", "#7AA2FF", "Trening",
      '<div class="podsum-liczba"><span data-licz="' + Math.round(objetosc) + '">0</span><small>kg</small></div>' +
      '<p class="podsum-opis">' + dniTreningowe.length + " " + odmianaLiczby(dniTreningowe.length, "trening", "treningi", "treningów") + " · " +
      serie + " " + odmianaLiczby(serie, "seria", "serie", "serii") + (partia ? " · najwięcej: " + podsumEsc(partia.toLowerCase()) : "") + "</p>" +
      (zmiana !== null ? '<span class="podsum-chip' + (zmiana > 0 ? " plus" : zmiana < 0 ? " minus" : "") + '">' +
        (zmiana > 0 ? "+" : zmiana < 0 ? "−" : "±") + Math.abs(zmiana) + "% vs poprzedni tydzień</span>" : "") + slupki));
  }

  // 3. Rekordy tygodnia
  const rekordy = obliczRekordy();
  const nowe = Object.keys(rekordy).map(function (k) { return rekordy[k]; })
    .filter(function (r) { return podsumWTygodniu(t, r.data); })
    .sort(function (a, b) { return b.wynik - a.wynik; });
  if (nowe.length) {
    slajdy.push(podsumSlajd("rekordy", "#E8C27A", "Rekordy",
      '<div class="podsum-liczba podsum-liczba-zlota"><span data-licz="' + nowe.length + '">0</span><small>' + odmianaLiczby(nowe.length, "nowy rekord", "nowe rekordy", "nowych rekordów") + "</small></div>" +
      '<ul class="podsum-lista">' + nowe.slice(0, 5).map(function (r, i) {
        return '<li style="--d:' + i + '"><span class="podsum-gwiazdka">' + IKONA_GWIAZDKA_REKORD + "</span><span>" + podsumEsc(r.cwiczenie) +
          "</span><b>" + formatKg(r.ciezar) + " kg × " + r.powtorzenia + "</b></li>";
      }).join("") + "</ul>"));
  }

  // 4. Nawyki
  if (nawyki.length) {
    let zrobione = 0;
    const naNawyk = nawyki.map(function (n) {
      const ile = dni.filter(function (d) { return czyNawykZrobiony(n.id, d); }).length;
      zrobione += ile;
      return { n: n, ile: ile, seria: podsumSeriaNawyku(n, t.doDzis || t.koniec) };
    });
    const proc = Math.round(zrobione / (nawyki.length * dni.length) * 100);
    const najlepszy = naNawyk.slice().sort(function (a, b) { return b.ile - a.ile; })[0];
    const seria = naNawyk.slice().sort(function (a, b) { return b.seria - a.seria; })[0];
    slajdy.push(podsumSlajd("nawyki", "#EADFC8", "Nawyki",
      '<div class="podsum-liczba"><span data-licz="' + proc + '">0</span><small>% wykonanych</small></div>' +
      '<div class="podsum-kafle">' +
      '<div class="podsum-kafel"><span>Najczęściej</span><strong>' + podsumEsc(najlepszy.n.nazwa) + "</strong><em>" + najlepszy.ile + " z " + dni.length + " dni</em></div>" +
      (seria.seria > 1 ? '<div class="podsum-kafel"><span>Najdłuższa seria</span><strong>' + podsumEsc(seria.n.nazwa) + "</strong><em>" + seria.seria + " " + odmianaLiczby(seria.seria, "dzień", "dni", "dni") + " z rzędu</em></div>" : "") +
      "</div>" +
      '<div class="podsum-siatka" role="img" aria-label="Nawyki w kolejne dni tygodnia">' + naNawyk.slice(0, 6).map(function (x, j) {
        return '<div class="podsum-siatka-wiersz"><span>' + podsumEsc(x.n.nazwa) + "</span>" + dni.map(function (d, i) {
          return '<i class="' + (czyNawykZrobiony(x.n.id, d) ? "on" : "") + '" style="--d:' + (j * 2 + i) + '"></i>';
        }).join("") + "</div>";
      }).join("") + "</div>"));
  }

  // 5. Medytacja i 6. pieniądze – zapytania tylko dla kont z dostępem; błąd = slajd pominięty
  const doDnia = t.doDzis || t.koniec;
  const zapytania = [];
  if (podsumDostep(MEDYTACJA_DOSTEP_IDS)) {
    zapytania.push(db.from("medytacje").select("minuty, data").eq("user_id", sesjaUzytkownika.user.id).gte("data", t.od).lte("data", doDnia)
      .then(function (r) { return { medytacje: r.error ? null : r.data || [] }; }));
  }
  if (podsumDostep(FINANSE_DOSTEP_IDS)) {
    zapytania.push(db.from("wydatki").select("kwota, kategoria").eq("user_id", sesjaUzytkownika.user.id).gte("data", t.od).lte("data", doDnia)
      .then(function (r) { return { wydatki: r.error ? null : r.data || [] }; }));
    zapytania.push(db.from("majatek_ruchy").select("kwota, konto, data").eq("user_id", sesjaUzytkownika.user.id)
      .then(function (r) { return { majatek: r.error ? null : r.data || [] }; }));
  }
  const wyniki = Object.assign.apply(null, [{}].concat(await Promise.all(zapytania)));

  if (wyniki.medytacje && wyniki.medytacje.length) {
    const minuty = wyniki.medytacje.reduce(function (s, m) { return s + (Number(m.minuty) || 0); }, 0);
    const dniMed = new Set(wyniki.medytacje.map(function (m) { return m.data; })).size;
    slajdy.push(podsumSlajd("medytacja", "#A68BFF", "Medytacja",
      '<div class="podsum-liczba"><span data-licz="' + Math.round(minuty) + '">0</span><small>min w ciszy</small></div>' +
      '<p class="podsum-opis">' + wyniki.medytacje.length + " " + odmianaLiczby(wyniki.medytacje.length, "sesja", "sesje", "sesji") +
      " w " + dniMed + " " + odmianaLiczby(dniMed, "dzień", "dni", "dni") + "</p>"));
  }

  if (wyniki.wydatki || wyniki.majatek) {
    let html = "";
    const wydatki = wyniki.wydatki || [];
    const suma = wydatki.reduce(function (s, w) { return s + (Number(w.kwota) || 0); }, 0);
    const naKat = {};
    wydatki.forEach(function (w) { naKat[w.kategoria] = (naKat[w.kategoria] || 0) + (Number(w.kwota) || 0); });
    const topKat = Object.keys(naKat).sort(function (a, b) { return naKat[b] - naKat[a]; })[0];
    const gotowka = (wyniki.majatek || []).filter(function (r) { return r.konto === "gotowka"; });
    const zmianaGotowki = gotowka.filter(function (r) { return podsumWTygodniu(t, r.data); }).reduce(function (s, r) { return s + Number(r.kwota); }, 0);
    const saldo = gotowka.reduce(function (s, r) { return s + Number(r.kwota); }, 0);
    if (wydatki.length) {
      html += '<div class="podsum-liczba"><span data-licz="' + Math.round(suma) + '">0</span><small>zł wydane</small></div>' +
        (topKat ? '<p class="podsum-opis">Najwięcej: ' + podsumEsc(topKat) + " · " + podsumLiczba(naKat[topKat]) + " zł</p>" : "");
    }
    if (gotowka.length) {
      html += '<div class="podsum-kafle"><div class="podsum-kafel"><span>Gotówka w tym tygodniu</span><strong class="' +
        (zmianaGotowki > 0 ? "plus" : zmianaGotowki < 0 ? "minus" : "") + '">' + (zmianaGotowki > 0 ? "+" : zmianaGotowki < 0 ? "−" : "") +
        podsumLiczba(Math.abs(zmianaGotowki)) + " zł</strong><em>Razem: " + podsumLiczba(saldo) + " zł</em></div></div>";
    }
    if (html) slajdy.push(podsumSlajd("pieniadze", "#5ED1B0", "Pieniądze", html));
  }

  // 7. Finał: kula tygodnia ze średnim wynikiem dnia (warstwy: średnia każdej kategorii)
  const wynikiDni = dni.map(function (d) { return d === dzisiaj() ? (stan.wynik == null ? null : stan.wynik / 100) : dzisSkladnikiDnia(d, stan); });
  const policzone = wynikiDni.filter(function (w) { return w != null; });
  if (policzone.length) {
    const srednia = policzone.reduce(function (s, w) { return s + w; }, 0) / policzone.length;
    let najlepszy = 0;
    wynikiDni.forEach(function (w, i) { if (w != null && w > (wynikiDni[najlepszy] || 0)) najlepszy = i; });
    const kategorie = [];
    if (dzisGotowe.treningi) kategorie.push({ kolor: DZIS_KOLORY.trening, sr: dni.filter(function (d) { return wpisy.some(function (w) { return w.data === d; }); }).length / dni.length });
    if (nawyki.length) kategorie.push({ kolor: DZIS_KOLORY.nawyk, sr: dni.reduce(function (s, d) { return s + nawyki.filter(function (n) { return czyNawykZrobiony(n.id, d); }).length / nawyki.length; }, 0) / dni.length });
    if (stan.misja) kategorie.push({ kolor: DZIS_KOLORY.misja, sr: dni.filter(function (d) { return radyWpisy.some(function (w) { return w.data === d && w.zadzialalo !== false; }); }).length / dni.length });
    const warstwy = kategorie.map(function (k, i) { return { klucz: "k" + i, kolor: k.kolor, h: k.sr / kategorie.length }; })
      .filter(function (w) { return w.h > 0; });
    const dzienNajlepszy = podsumData(dni[najlepszy]);
    slajdy.push(podsumSlajd("final", "#EADFC8", "Kula tygodnia",
      '<div class="podsum-kula-box"><canvas id="podsum-kula" aria-hidden="true"></canvas></div>' +
      '<div class="podsum-liczba podsum-liczba-mniejsza"><span data-licz="' + Math.round(srednia * 100) + '">0</span><small>% średnio na dzień</small></div>' +
      '<p class="podsum-opis">Najlepszy dzień: ' + PODSUM_DNI_PELNE[(dzienNajlepszy.getDay() + 6) % 7] + " · " + Math.round((wynikiDni[najlepszy] || 0) * 100) + "%</p>",
      function () {
        const canvas = document.getElementById("podsum-kula");
        podsumKula = utworzKule(canvas, null);
        setTimeout(function () {
          podsumKula.ustaw(warstwy);
          if (srednia >= 0.999) podsumKula.ustawZloto(true, 7);
        }, PODSUM_BEZ_RUCHU ? 0 : 450);
      }));
  }
  return slajdy;
}

// ----- Pokaz -----
function podsumLicz(el) {
  const cel = Number(el.dataset.licz) || 0;
  if (PODSUM_BEZ_RUCHU) { el.textContent = podsumLiczba(cel); return; }
  let t0 = null;
  (function klatka(teraz) {
    if (t0 === null) t0 = teraz;
    const p = Math.min(1, Math.max(0, (teraz - t0 - 250) / 1300));
    el.textContent = podsumLiczba(cel * (1 - Math.pow(1 - p, 4)));
    if (p < 1 && podsumEl.contains(el)) requestAnimationFrame(klatka);
  })(performance.now());
}

function podsumPokaz(nr) {
  podsumNr = Math.max(0, Math.min(podsumSlajdy.length - 1, nr));
  const s = podsumSlajdy[podsumNr];
  podsumSlajdyEl.innerHTML = s.html;
  podsumEl.style.setProperty("--k", s.kolor);
  podsumSlajdyEl.querySelectorAll("[data-licz]").forEach(podsumLicz);
  if (s.poPokazaniu) s.poPokazaniu();
  Array.from(podsumPaskiEl.children).forEach(function (p, i) {
    p.classList.toggle("pelny", i < podsumNr);
    p.classList.toggle("biezacy", i === podsumNr);
    p.querySelector("i").style.animation = "none";
    void p.offsetWidth;
    p.querySelector("i").style.animation = "";
  });
  podsumPozostalo = PODSUM_SLAJD_MS;
  podsumUstawPauze(false);
  podsumUruchomTimer();
}

function podsumUruchomTimer() {
  clearTimeout(podsumTimer);
  if (podsumPauza) return;
  podsumStartSlajdu = Date.now();
  podsumTimer = setTimeout(function () {
    if (podsumNr < podsumSlajdy.length - 1) podsumPokaz(podsumNr + 1);
    else podsumPaskiEl.lastElementChild && podsumPaskiEl.lastElementChild.classList.add("pelny");
  }, podsumPozostalo);
}

function podsumUstawPauze(pauza) {
  if (pauza === podsumPauza) return;
  podsumPauza = pauza;
  podsumEl.classList.toggle("pauza", pauza);
  if (pauza) {
    clearTimeout(podsumTimer);
    podsumPozostalo = Math.max(300, podsumPozostalo - (Date.now() - podsumStartSlajdu));
  } else {
    podsumUruchomTimer();
  }
}

async function podsumOtworz(wymusBiezacy) {
  const t = podsumTydzien(wymusBiezacy);
  podsumPoprzedniFokus = document.activeElement;
  podsumEl.hidden = false;
  document.documentElement.classList.add("podsum-otwarte");
  podsumPaskiEl.innerHTML = "";
  podsumSlajdyEl.innerHTML = '<section class="podsum-slajd"><span class="podsum-kicker">' + podsumZakres(t.od, t.koniec) + '</span><p class="podsum-opis">Zbieram Twój tydzień…</p></section>';
  document.getElementById("podsum-zamknij").focus();
  podsumSlajdy = await podsumZbuduj(t);
  if (podsumEl.hidden) return;
  podsumPaskiEl.innerHTML = podsumSlajdy.map(function () { return "<span><i></i></span>"; }).join("");
  podsumPaskiEl.style.setProperty("--czas", PODSUM_SLAJD_MS + "ms");
  podsumPokaz(0);
}

function podsumZamknij() {
  clearTimeout(podsumTimer);
  podsumEl.hidden = true;
  podsumSlajdyEl.innerHTML = "";
  podsumKula = null;
  document.documentElement.classList.remove("podsum-otwarte");
  if (podsumPoprzedniFokus && podsumPoprzedniFokus.focus) podsumPoprzedniFokus.focus();
}

// ----- Baner na ekranie Dziś -----
function podsumRenderBaner() {
  const teraz = new Date();
  const niedzielaWieczor = teraz.getDay() === 0 && teraz.getHours() >= 18;
  const poniedzialek = teraz.getDay() === 1;
  const t = podsumTydzien(false);
  let schowany = null;
  try { schowany = localStorage.getItem(PODSUM_KLUCZ_SCHOWANY); } catch (e) {}
  podsumBanerEl.hidden = !(niedzielaWieczor || poniedzialek) || schowany === t.od || !sesjaUzytkownika;
  if (!podsumBanerEl.hidden) {
    document.getElementById("dzis-podsum-baner-opis").textContent = (poniedzialek ? "Poprzedni tydzień · " : "") + podsumZakres(t.od, t.koniec);
  }
}

// ----- Zdarzenia -----
document.getElementById("dzis-podsum-otworz").addEventListener("click", function () { podsumOtworz(true); });
document.getElementById("dzis-podsum-baner-otworz").addEventListener("click", function () { podsumOtworz(false); });
document.getElementById("dzis-podsum-baner-zamknij").addEventListener("click", function () {
  try { localStorage.setItem(PODSUM_KLUCZ_SCHOWANY, podsumTydzien(false).od); } catch (e) {}
  podsumBanerEl.hidden = true;
});
document.getElementById("podsum-zamknij").addEventListener("click", podsumZamknij);

// Strefy stuknięcia: krótkie stuknięcie przełącza, przytrzymanie pauzuje (bez przełączania po puszczeniu)
["podsum-wstecz", "podsum-dalej"].forEach(function (id) {
  const strefa = document.getElementById(id);
  let wcisniecie = 0;
  let timerPrzytrzymania = null;
  strefa.addEventListener("pointerdown", function () {
    wcisniecie = Date.now();
    timerPrzytrzymania = setTimeout(function () { podsumUstawPauze(true); }, PODSUM_PRZYTRZYMANIE_MS);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (typ) {
    strefa.addEventListener(typ, function () {
      clearTimeout(timerPrzytrzymania);
      if (podsumPauza && typ !== "pointerleave") podsumUstawPauze(false);
    });
  });
  strefa.addEventListener("click", function () {
    if (Date.now() - wcisniecie > PODSUM_PRZYTRZYMANIE_MS + 40 && wcisniecie) { wcisniecie = 0; return; }
    wcisniecie = 0;
    if (id === "podsum-wstecz") podsumPokaz(podsumNr - 1);
    else if (podsumNr < podsumSlajdy.length - 1) podsumPokaz(podsumNr + 1);
    else podsumZamknij();
  });
});

document.addEventListener("keydown", function (e) {
  if (podsumEl.hidden) return;
  if (e.key === "Escape") podsumZamknij();
  else if (e.key === "ArrowRight") podsumPokaz(podsumNr + 1);
  else if (e.key === "ArrowLeft") podsumPokaz(podsumNr - 1);
});
document.addEventListener("visibilitychange", function () {
  if (!podsumEl.hidden) podsumUstawPauze(document.hidden);
  if (!document.hidden) podsumRenderBaner();
});
setInterval(podsumRenderBaner, 60000);
podsumRenderBaner();
