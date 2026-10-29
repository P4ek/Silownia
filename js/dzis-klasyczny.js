// Stary wygląd ekranu "Dziś" (przełącznik "Nowy wygląd" w menu wyłączony, html bez klasy styl-premium): niebo dnia
// – gwiazdozbiór SVG z gwiazdami treningu, posiłków, misji i nawyków – oraz części dnia w wierszach. Funkcje z przyrostkiem
// "Klasyczny" woła renderDzis z dzis.js; stan dnia (dzisStan), dane i akcje są wspólne. Kontenery części dnia (#dzis-trening itd.)
// są te same co w nowym wyglądzie, wynik i podpowiedź starego nieba mają własne id (dzisk-*). Style: css/dzis-klasyczny.css.

const dzisKProcentEl = document.getElementById("dzisk-procent");
const dzisKGwiazdyLicznikEl = document.getElementById("dzisk-gwiazdy-licznik");
const dzisKPodpowiedzEl = document.getElementById("dzisk-podpowiedz");
const dzisNieboSvg = document.getElementById("dzis-niebo-svg");
const dzisGwiazdyPrzyciski = document.getElementById("dzis-gwiazdy-przyciski");
const DZIS_LINIE = [["sn", "ob"], ["ob", "ko"], ["ko", "tr"], ["tr", "mi"], ["mi", "h0"], ["h0", "h1"], ["h1", "ko"], ["h1", "h2"], ["h2", "h3"]];
let dzisNowaGwiazda = null;    // { klucz, czas } – gwiazda zapalona dotknięciem (animacja "born")

// Czy włączony jest nowy wygląd (premium); bez niego ekran Dziś rysuje stare niebo
function dzisPremium() {
  return document.documentElement.classList.contains("styl-premium");
}

function renderDzisNaglowekKlasyczny() {
  const teraz = new Date();
  dzisDataEl.textContent = (DNI_TYGODNIA_PELNE[(teraz.getDay() + 6) % 7] + " · " + teraz.getDate() + " " + MIESIACE_SKROT[teraz.getMonth()]).toUpperCase();
  const h = teraz.getHours();
  dzisPowitanieEl.textContent = h < 5 ? "Dobrej nocy." : h < 12 ? "Dzień dobry." : h < 18 ? "Miłego popołudnia." : h < 22 ? "Dobry wieczór." : "Dobrej nocy.";
}

function renderDzisNieboKlasyczny(stan) {
  dzisKProcentEl.textContent = stan.wynik == null ? "–" : String(stan.wynik);
  dzisKGwiazdyLicznikEl.textContent = stan.gwiazdWszystkich ? stan.gwiazdZapalonych + " z " + stan.gwiazdWszystkich + " " + odmianaLiczby(stan.gwiazdWszystkich, "gwiazdy", "gwiazd", "gwiazd") : "";

  const poId = {};
  stan.gwiazdy.forEach(function (g) { poId[g.id] = g; });
  const linie = DZIS_LINIE.slice();
  if (!poId.mi) linie.push(["tr", "h0"]); // bez misji trening łączy się wprost z nawykami

  let svg =
    '<circle class="dzis-orbita" cx="171" cy="160" r="150"/>' +
    '<circle class="dzis-okrag" cx="171" cy="160" r="104"/>';
  DZIS_PYL.forEach(function (d) {
    svg += '<circle class="dzis-pyl" cx="' + d.x + '" cy="' + d.y + '" r="' + d.r + '" style="animation-delay:' + d.opoznienie + 's"/>';
  });
  linie.forEach(function (l) {
    const A = poId[l[0]], B = poId[l[1]];
    if (!A || !B) return;
    svg += '<line class="dzis-linia' + (A.on && B.on ? " on" : "") + '" x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y + '"/>';
  });

  let przyciski = "";
  const teraz = Date.now();
  stan.gwiazdy.forEach(function (g) {
    let klasaAnimacji = "";
    let styl = "";
    if (g.on) {
      klasaAnimacji = "lit";
      if (dzisNowaGwiazda && dzisNowaGwiazda.klucz === g.klucz && teraz - dzisNowaGwiazda.czas < 700) {
        // Kontynuacja animacji "born" po przerysowaniu (np. gdy zapis skończy się w trakcie animacji)
        const minelo = (teraz - dzisNowaGwiazda.czas) / 1000;
        klasaAnimacji = "born";
        styl = ' style="animation-delay:-' + minelo.toFixed(2) + "s," + (0.7 - minelo).toFixed(2) + 's"';
      }
    }
    const lx = g.a === "r" ? g.x + g.r + 8 : g.x;
    const ly = g.a === "t" ? g.y - g.r - 9 : g.a === "b" ? g.y + g.r + 16 : g.y + 4;
    svg +=
      '<g class="dzis-gw dzis-k-' + g.k + (g.on ? " on" : "") + '">' +
      '<circle class="dzis-gw-halo" cx="' + g.x + '" cy="' + g.y + '" r="' + (g.r * 1.9).toFixed(1) + '"/>' +
      '<path class="dzis-gw-ksztalt ' + klasaAnimacji + '"' + styl + ' d="' + dzisIskra(g.x, g.y, g.on ? g.r * 1.25 : g.r * 0.8) + '"/>' +
      '<text class="dzis-gw-podpis" x="' + lx + '" y="' + ly + '" text-anchor="' + (g.a === "r" ? "start" : "middle") + '">' + dzisEsc(g.nazwa) + "</text></g>";

    const nazwa = g.pelnaNazwa || g.nazwa;
    przyciski +=
      '<button type="button" class="dzis-gw-przycisk" data-gwiazda="' + g.klucz + '" data-dzis-fokus="gw-' + g.klucz + '"' +
      ' style="left:' + (g.x / 342 * 100).toFixed(2) + "%;top:" + (g.y / 300 * 100).toFixed(2) + '%"' +
      ' aria-pressed="' + (g.on ? "true" : "false") + '" aria-label="' + dzisEsc(nazwa + (g.on ? " – zrobione" : " – do zrobienia")) + '"></button>';
  });
  const reszta = stan.nawykiGotowe ? nawyki.length - stan.nawykiNaNiebie : 0;
  if (reszta > 0) {
    svg += '<text class="dzis-gw-reszta" x="336" y="294" text-anchor="end">+' + reszta + " " + odmianaLiczby(reszta, "nawyk", "nawyki", "nawyków") + "</text>";
  }
  dzisNieboSvg.innerHTML = svg;
  dzisGwiazdyPrzyciski.innerHTML = przyciski;

  // Podpowiedź pod niebem: co jeszcze zostało
  if (stan.wynik == null) {
    dzisKPodpowiedzEl.textContent = "Wczytuję Twój dzień…";
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
  dzisKPodpowiedzEl.textContent = zostalo.length
    ? "Dotknij gwiazdy, żeby ją zapalić. Zostało: " + zostalo.join(", ") + "."
    : "Cały gwiazdozbiór zapalony. Dobra robota.";
}

// Wiersz nagłówka części dnia: gwiazdka, tytuł, wartość po prawej
function dzisWierszCzesciKlasyczny(tytul, klasaKoloru, postep, wartosc) {
  const pelna = postep >= 1;
  return '<div class="dzis-czesc-wiersz">' + dzisIkonaGwiazdyKlasyczny(pelna ? 12 : 9, pelna, klasaKoloru, 22) +
    '<span class="dzis-czesc-tytul">' + tytul + "</span>" +
    '<span class="dzis-czesc-wartosc ' + klasaKoloru + (pelna ? " on" : "") + '">' + dzisEsc(wartosc) + "</span></div>";
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
function dzisIkonaGwiazdyKlasyczny(r, wlaczona, klasaKoloru, rozmiar) {
  return '<svg class="dzis-glif ' + klasaKoloru + (wlaczona ? " on" : "") + '" width="' + rozmiar + '" height="' + rozmiar +
    '" viewBox="0 0 30 30" aria-hidden="true"><path d="' + dzisIskra(15, 15, r) + '"/></svg>';
}

function renderDzisTreningKlasyczny(stan) {
  if (!dzisGotowe.treningi || !dzisGotowe.plany) {
    dzisTreningEl.innerHTML = dzisWierszCzesciKlasyczny("Trening", "dzis-k-trening", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
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
    dzisWierszCzesciKlasyczny("Trening", "dzis-k-trening", stan.trenowal ? 1 : 0, wartosc) +
    '<div class="dzis-czesc-tresc"><span class="dzis-opis">' + dzisEsc(opis) + "</span>" + lista +
    '<button type="button" class="dzis-btn dzis-k-trening" id="dzis-btn-trening" data-dzis-fokus="btn-trening">' +
    (stan.trenowal ? "Dopisz ćwiczenie" : "Rozpocznij trening") + "</button></div>";
}

function renderDzisNawykiKlasyczny(stan) {
  if (!stan.nawykiGotowe) {
    dzisNawykiEl.innerHTML = dzisWierszCzesciKlasyczny("Nawyki", "dzis-k-nawyk", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  if (!nawyki.length) {
    dzisNawykiEl.innerHTML = dzisWierszCzesciKlasyczny("Nawyki", "dzis-k-nawyk", 0, "") +
      '<div class="dzis-czesc-tresc"><span class="dzis-opis">Nie masz jeszcze nawyków.</span>' +
      '<button type="button" class="dzis-btn dzis-k-nawyk" data-przejdz="widok-habits">Dodaj nawyk</button></div>';
    return;
  }
  let siatka = '<div class="dzis-nawyki-siatka">';
  nawyki.forEach(function (n) {
    const on = stan.nawykZrobiony(n);
    siatka +=
      '<button type="button" class="dzis-nawyk' + (on ? " on" : "") + '" data-gwiazda="n' + n.id + '" data-dzis-fokus="nawyk-' + n.id + '" aria-pressed="' + on + '">' +
      '<span class="dzis-nawyk-nazwa">' + dzisEsc(n.nazwa) + "</span>" + dzisIkonaGwiazdyKlasyczny(on ? 11 : 8, on, "dzis-k-nawyk", 18) + "</button>";
  });
  siatka += "</div>";
  dzisNawykiEl.innerHTML =
    dzisWierszCzesciKlasyczny("Nawyki", "dzis-k-nawyk", stan.nawykiZrobione / nawyki.length, stan.nawykiZrobione + " z " + nawyki.length) +
    '<div class="dzis-czesc-tresc dzis-czesc-tresc-siatka">' + siatka + "</div>";
}

function renderDzisPosilkiKlasyczny(stan) {
  dzisPosilkiEl.hidden = !stan.posilki;
  if (!stan.posilki) return;
  const p = stan.posilki;
  if (!p.gotowe) {
    dzisPosilkiEl.innerHTML = dzisWierszCzesciKlasyczny("Posiłki", "dzis-k-posilek", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  const typy = DZIS_TYPY_POSILKOW.filter(function (t) { return p.typy[t[0]]; }).length;
  const udzial = p.cel ? Math.min(1, p.suma.kcal / p.cel.kcal) : 0;
  const makro = [["B", p.suma.bialko, " g"], ["W", p.suma.wegle, " g"], ["T", p.suma.tluszcze, " g"]].map(function (m) {
    return '<span class="dzis-makro">' + m[0] + " <strong>" + jedzFormat(m[1]) + m[2] + "</strong></span>";
  }).join("");
  dzisPosilkiEl.innerHTML =
    dzisWierszCzesciKlasyczny("Posiłki", "dzis-k-posilek", typy / DZIS_TYPY_POSILKOW.length, typy + " z " + DZIS_TYPY_POSILKOW.length) +
    '<div class="dzis-czesc-tresc">' +
    '<div class="dzis-kcal"><span class="dzis-kcal-liczba">' + jedzFormat(p.suma.kcal) + "</span>" +
    '<span class="dzis-opis">' + (p.cel ? "z " + jedzFormat(p.cel.kcal) + " kcal" : "kcal dziś") + "</span></div>" +
    (p.cel ? '<span class="dzis-pasek"><span class="dzis-pasek-wypelnienie" style="width:' + Math.round(udzial * 100) + '%"></span></span>' : "") +
    '<div class="dzis-makra">' + makro + "</div>" +
    '<button type="button" class="dzis-btn dzis-k-posilek" data-przejdz="widok-jedzenie">Zrób zdjęcie</button></div>';
}

function renderDzisMisjaKlasyczny(stan) {
  const widoczna = dzisDostepRad();
  dzisMisjaEl.hidden = !widoczna;
  if (!widoczna) return;
  if (!dzisGotowe.rady) {
    dzisMisjaEl.innerHTML = dzisWierszCzesciKlasyczny("Misja", "dzis-k-misja", 0, "") + '<div class="dzis-czesc-tresc"><span class="dzis-opis">Wczytuję…</span></div>';
    return;
  }
  if (!stan.misja) {
    dzisMisjaEl.innerHTML = dzisWierszCzesciKlasyczny("Misja", "dzis-k-misja", 0, "") +
      '<div class="dzis-czesc-tresc"><span class="dzis-opis">Brak aktywnej misji. Wybierz zasadę w Radach z książek.</span>' +
      '<button type="button" class="dzis-btn dzis-k-misja" data-przejdz="widok-rady">Wybierz zasadę</button></div>';
    return;
  }
  const m = stan.misja;
  const nrDnia = m.dzisPrzybita ? m.liczba : m.liczba + 1;
  let pieczatki = '<div class="dzis-pieczatki" role="img" aria-label="Pieczątki: ' + m.liczba + " z " + RADY_PIECZATKI_WYMAGANE + '">';
  for (let i = 0; i < RADY_PIECZATKI_WYMAGANE; i++) {
    pieczatki += dzisIkonaGwiazdyKlasyczny(i === nrDnia - 1 ? 12 : 10, i < m.liczba, "dzis-k-misja", 18);
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
    dzisWierszCzesciKlasyczny("Misja", "dzis-k-misja", m.dzisPrzybita ? 1 : 0, wartosc) +
    '<div class="dzis-czesc-tresc"><span class="dzis-misja-tekst">' + dzisEsc(m.zasada.nazwa) + "</span>" + pieczatki + przycisk + "</div>";
}

// Budżet tygodnia w starym wyglądzie: wiersz części z resztą po prawej
function renderDzisBudzetKlasyczny() {
  const d = dzisBudzetDane();
  dzisBudzetEl.hidden = !d;
  if (!d) return;
  dzisBudzetEl.classList.toggle("dzis-budzet-ponad", d.ponad);
  dzisBudzetEl.innerHTML =
    dzisWierszCzesciKlasyczny(dzisEsc(d.nazwa), "dzis-k-budzet", 0, (d.ponad ? "−" : "") + finZl(Math.abs(d.zostalo)) + (d.ponad ? " ponad" : " zostało")) +
    '<div class="dzis-czesc-tresc">' +
    '<span class="dzis-opis">Wydane ' + finZl(d.wydano) + " z " + finZl(d.budzet) + " · " + d.dni + "</span>" +
    '<span class="dzis-pasek"><span class="dzis-pasek-wypelnienie" style="width:' + Math.round(d.udzial * 100) + '%"></span></span>' +
    '<button type="button" class="dzis-btn dzis-k-budzet" data-przejdz="widok-finanse">Dodaj wydatek</button></div>';
}

function renderDzisTydzienKlasyczny(stan) {
  let html = "";
  for (let i = 6; i >= 0; i--) {
    const data = dataSprzedDni(i);
    const d = new Date(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10));
    const wynik = dzisSkladnikiDnia(data, stan);
    const dzis = i === 0;
    const r = wynik == null ? 4 : 4 + wynik * 10;
    const klasa = dzis ? "dzis" : wynik == null ? "brak" : wynik >= 0.5 ? "jasna" : "ciemna";
    const nazwa = dzis ? "dziś" : DZIS_DNI_SKROT[d.getDay()];
    html +=
      '<span class="dzis-tydzien-dzien ' + klasa + '" role="img" aria-label="' + (dzis ? "Dziś" : DNI_TYGODNIA_PELNE[(d.getDay() + 6) % 7]) + ": " +
      (wynik == null ? "brak danych" : Math.round(wynik * 100) + "%") + '">' +
      '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="' + dzisIskra(15, 15, r) + '"/></svg>' +
      '<span class="dzis-tydzien-nazwa">' + nazwa + "</span></span>";
  }
  dzisTydzienEl.innerHTML = html;
}
