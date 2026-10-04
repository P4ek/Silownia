// Ekran "Rady z książek" (#widok-rady, tylko konto AI_UZYTKOWNIK_ID): półka, misja, pieczątki, PD, gwiazdozbiór.

// ===================== Rady z książek: osobna sekcja (tylko konto AI_UZYTKOWNIK_ID) =====================

const navRady = document.getElementById("nav-rady");
const radyRanga = document.getElementById("rady-ranga");
const radyPd = document.getElementById("rady-pd");
const radyDoPoziomu = document.getElementById("rady-do-poziomu");
const radyOdznaka = document.getElementById("rady-odznaka");
const radyPoziom = document.getElementById("rady-poziom");
const radyPolka = document.getElementById("rady-polka");
const radyPolkaLicznik = document.getElementById("rady-polka-licznik");
const radyAktywna = document.getElementById("rady-aktywna");
const radyMapaLicznik = document.getElementById("rady-mapa-licznik");
const radyMapaOpis = document.getElementById("rady-mapa-opis");
const radyMapa = document.getElementById("rady-mapa");
const RADY_KOMUNIKAT_JEDNA_AKTYWNA = "Ukończ najpierw wybraną zasadę";

// Punkty doświadczenia (PD) — liczone w apce z danych w bazie, bez osobnej tabeli
const RADY_PIECZATKI_WYMAGANE = 3; // ile pieczątek (dni) potrzeba do zaliczenia zasady
const RADY_PD_PIECZATKA = 20;
const RADY_PD_ZASADA = 100;
const RADY_PD_PLANETA = 50;
const RADY_PD_KSIAZKA = 200;
const RADY_PD_NA_POZIOM = 100;
const RADY_ZASAD_NA_PLANETE = 4;
const RADY_RANGI = ["Nowicjusz", "Uczeń", "Czytelnik", "Praktyk", "Mistrz"]; // poziom 6+ = "Mędrzec"

let radyKsiazki = [];  // wiersze z tabeli "ksiazki": { id, tytul, autor }
let radyZasady = [];   // wiersze z tabeli "zasady": { id, ksiazka_id, nazwa, opis, kolejnosc }
let radyPostepWiersze = []; // wiersze z tabeli "zasady_postep": { id, zasada_id, status: "aktywna" | "zaliczona", plan_jesli, plan_to, zaliczona_at }
let radyWpisy = [];    // wiersze z tabeli "zasady_wpisy" (pieczątki): { id, zasada_id, data, zadzialalo }
let radyWybranaKsiazkaId = null;
let radyZasadaWFormularzuId = null; // zasada, dla której jest otwarty formularz planu jeśli–to

// Pozycja w menu i dane widoczne tylko dla konta AI; pozostałym kontom nic się nie wczytuje
function ustawDostepRadZKsiazek(kontoAI) {
  navRady.hidden = !kontoAI;
  if (!kontoAI) {
    radyKsiazki = [];
    radyZasady = [];
    radyPostepWiersze = [];
    radyWpisy = [];
    radyWybranaKsiazkaId = null;
    radyZasadaWFormularzuId = null;
    if (navRady.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
    }
  }
}

function radyPostepZasady(zasadaId) {
  return radyPostepWiersze.find(function (p) { return String(p.zasada_id) === String(zasadaId); }) || null;
}
function radyAktywnyPostep() {
  return radyPostepWiersze.find(function (p) { return p.status === "aktywna"; }) || null;
}
function radyStanZasady(zasadaId) {
  const postep = radyPostepZasady(zasadaId);
  return postep ? postep.status : "dostepna";
}
function radyZasadyKsiazki(ksiazkaId) {
  return radyZasady
    .filter(function (z) { return String(z.ksiazka_id) === String(ksiazkaId); })
    .sort(function (a, b) { return (a.kolejnosc || 0) - (b.kolejnosc || 0); });
}
function radyKsiazka(ksiazkaId) {
  return radyKsiazki.find(function (k) { return String(k.id) === String(ksiazkaId); }) || null;
}
function radyZasada(zasadaId) {
  return radyZasady.find(function (z) { return String(z.id) === String(zasadaId); }) || null;
}
function radyPieczatkiZasady(zasadaId) {
  return radyWpisy.filter(function (w) { return String(w.zasada_id) === String(zasadaId) && w.zadzialalo !== false; });
}
// Odmiana liczebnika: 1 gwiazda, 2–4 (22–24…) gwiazdy, 5+ (i 12–14) gwiazd
function radyOdmiana(n, jeden, kilka, wiele) {
  if (n === 1) return jeden;
  const r10 = n % 10;
  const r100 = n % 100;
  return r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14) ? kilka : wiele;
}
function radyOdmianaPieczatek(n) {
  return radyOdmiana(n, "pieczątka", "pieczątki", "pieczątek");
}
function radyPieczatkaDzis(zasadaId) {
  const dzis = dataSprzedDni(0);
  return radyPieczatkiZasady(zasadaId).some(function (w) { return w.data === dzis; });
}

function rzymska(n) {
  const tabela = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let wynik = "";
  tabela.forEach(function (para) {
    while (n >= para[0]) { wynik += para[1]; n -= para[0]; }
  });
  return wynik;
}
// Numer zasady w obrębie jej książki (wg kolumny "kolejnosc"), liczony od 1
function radyNumerZasady(zasada) {
  return radyZasadyKsiazki(zasada.ksiazka_id).findIndex(function (z) { return String(z.id) === String(zasada.id); }) + 1;
}

// Zaliczone zasady, planety (co 4 zasady przez całą książkę, zawsze między zasadami — po ostatniej jest Gwiazda polarna) i ukończenie książki
function radyStatystykiKsiazki(ksiazkaId) {
  const zasady = radyZasadyKsiazki(ksiazkaId);
  const zaliczoneFlagi = zasady.map(function (z) { return radyStanZasady(z.id) === "zaliczona"; });
  const zaliczone = zaliczoneFlagi.filter(Boolean).length;
  let planety = 0;
  let odkrytePlanety = 0;
  for (let k = RADY_ZASAD_NA_PLANETE; k < zasady.length; k += RADY_ZASAD_NA_PLANETE) {
    planety++;
    if (zaliczoneFlagi.slice(0, k).every(Boolean)) odkrytePlanety++;
  }
  return {
    zasady: zasady,
    zaliczoneFlagi: zaliczoneFlagi,
    zaliczone: zaliczone,
    planety: planety,
    odkrytePlanety: odkrytePlanety,
    ukonczona: zasady.length > 0 && zaliczone === zasady.length
  };
}

function radyObliczPD() {
  let pd = radyWpisy.filter(function (w) { return w.zadzialalo !== false; }).length * RADY_PD_PIECZATKA;
  radyKsiazki.forEach(function (k) {
    const s = radyStatystykiKsiazki(k.id);
    pd += s.zaliczone * RADY_PD_ZASADA + s.odkrytePlanety * RADY_PD_PLANETA + (s.ukonczona ? RADY_PD_KSIAZKA : 0);
  });
  return pd;
}
function radyPoziomZPD(pd) {
  return Math.floor(pd / RADY_PD_NA_POZIOM) + 1;
}
function radyRangaPoziomu(poziom) {
  return RADY_RANGI[poziom - 1] || "Mędrzec";
}

// Toast z liczbą zdobytych PD (różnica przed/po zapisie) i ewentualnym awansem
function radyPokazZysk(tekst, pdPrzed) {
  const pdPo = radyObliczPD();
  const zysk = pdPo - pdPrzed;
  let komunikat = tekst + (zysk > 0 ? " +" + zysk + " PD" : "");
  const poziomPo = radyPoziomZPD(pdPo);
  if (poziomPo > radyPoziomZPD(pdPrzed)) komunikat += " · Poziom " + poziomPo + ": " + radyRangaPoziomu(poziomPo) + "!";
  pokazToast(komunikat, "sukces");
}

// Pobranie książek, zasad, postępu i pieczątek — wywoływane przy starcie tylko dla konta AI
async function wczytajRadyZKsiazek() {
  const [ksiazkiRes, zasadyRes, postepRes, wpisyRes] = await Promise.all([
    db.from("ksiazki").select("id, tytul, autor").order("tytul", { ascending: true }),
    db.from("zasady").select("id, ksiazka_id, nazwa, opis, kolejnosc").order("kolejnosc", { ascending: true }),
    db.from("zasady_postep").select("id, zasada_id, status, plan_jesli, plan_to, zaliczona_at"),
    db.from("zasady_wpisy").select("id, zasada_id, data, zadzialalo")
  ]);
  const blad = ksiazkiRes.error || zasadyRes.error || postepRes.error || wpisyRes.error;
  if (blad) {
    console.error(blad);
    pokazToast("Nie udało się pobrać rad z książek: " + blad.message, "blad");
    return;
  }
  radyKsiazki = ksiazkiRes.data || [];
  radyZasady = zasadyRes.data || [];
  radyPostepWiersze = postepRes.data || [];
  radyWpisy = wpisyRes.data || [];
  renderRadyZKsiazek();
}

// Ponowne pobranie postępu i pieczątek — np. gdy baza odrzuci drugą aktywną zasadę ustawioną z innego urządzenia
async function odswiezRadyPostep() {
  const [postepRes, wpisyRes] = await Promise.all([
    db.from("zasady_postep").select("id, zasada_id, status, plan_jesli, plan_to, zaliczona_at"),
    db.from("zasady_wpisy").select("id, zasada_id, data, zadzialalo")
  ]);
  if (postepRes.error || wpisyRes.error) {
    console.error(postepRes.error || wpisyRes.error);
    return;
  }
  radyPostepWiersze = postepRes.data || [];
  radyWpisy = wpisyRes.data || [];
  radyZasadaWFormularzuId = null;
  renderRadyZKsiazek();
}

function renderRadyZKsiazek() {
  // Domyślnie książka z aktywną zasadą, a jeśli jej nie ma — pierwsza z półki
  if (!radyKsiazka(radyWybranaKsiazkaId)) {
    const aktywny = radyAktywnyPostep();
    const zasadaAktywna = aktywny ? radyZasada(aktywny.zasada_id) : null;
    radyWybranaKsiazkaId = zasadaAktywna && radyKsiazka(zasadaAktywna.ksiazka_id)
      ? String(zasadaAktywna.ksiazka_id)
      : (radyKsiazki[0] ? String(radyKsiazki[0].id) : null);
  }
  renderRadyNaglowek();
  renderRadyPolka();
  renderRadyAktywna();
  renderRadyMapa();
}

// Ranga, PD, brakujące PD i odznaka "POZ. X" z pierścieniem postępu do kolejnego poziomu
function renderRadyNaglowek() {
  const pd = radyObliczPD();
  const poziom = radyPoziomZPD(pd);
  const wPoziomie = pd % RADY_PD_NA_POZIOM;
  radyRanga.textContent = radyRangaPoziomu(poziom);
  radyPd.textContent = pd + " PD";
  radyDoPoziomu.textContent = (RADY_PD_NA_POZIOM - wPoziomie) + " PD do poz. " + (poziom + 1);
  radyPoziom.textContent = String(poziom);
  radyOdznaka.style.setProperty("--postep", String(wPoziomie));
  radyOdznaka.setAttribute("aria-label", "Poziom " + poziom + ", " + wPoziomie + " z " + RADY_PD_NA_POZIOM + " PD do następnego");
}

const IKONA_GWIAZDA_4 =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"/></svg>';
const IKONA_PTASZEK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const IKONA_STRZALKA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const RADY_WYSOKOSCI_GRZBIETOW = [176, 162, 184, 168, 156];
// Dekoracyjne, puste grzbiety za placeholderem: [szerokość, wysokość, przezroczystość]
const RADY_GRZBIETY_DUCHY = [[34, 148, 1], [52, 180, 0.75], [40, 136, 0.6], [44, 160, 0.45], [38, 150, 0.3]];

// Półka: grzbiety książek (kliknięcie wybiera książkę) + "Następna książka" + puste grzbiety dla ozdoby
function renderRadyPolka() {
  radyPolka.innerHTML = "";
  const ukonczone = radyKsiazki.filter(function (k) { return radyStatystykiKsiazki(k.id).ukonczona; }).length;
  radyPolkaLicznik.textContent = ukonczone + " / " + radyKsiazki.length;
  radyPolkaLicznik.setAttribute("aria-label", "Ukończone książki: " + ukonczone + " z " + radyKsiazki.length);

  radyKsiazki.forEach(function (k, i) {
    const wybrana = String(k.id) === String(radyWybranaKsiazkaId);
    const ukonczona = radyStatystykiKsiazki(k.id).ukonczona;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rady-grzbiet" + (wybrana ? " wybrana" : "") + (ukonczona ? " ukonczona" : "");
    btn.style.setProperty("--wysokosc", RADY_WYSOKOSCI_GRZBIETOW[i % RADY_WYSOKOSCI_GRZBIETOW.length] + "px");
    btn.setAttribute("aria-pressed", wybrana ? "true" : "false");
    btn.setAttribute("aria-label", k.tytul + (k.autor ? ", " + k.autor : "") + (ukonczona ? " – ukończona" : ""));
    btn.title = k.autor ? k.tytul + " — " + k.autor : k.tytul;
    btn.innerHTML =
      '<span class="rady-grzbiet-okladka">' +
        '<span class="rady-grzbiet-pasy gora"><span></span><span></span></span>' +
        '<span class="rady-grzbiet-tytul"></span>' +
        '<span class="rady-grzbiet-pasy dol">' + (wybrana || ukonczona ? IKONA_GWIAZDA_4 : "") + '<span></span></span>' +
        (wybrana ? '<span class="rady-grzbiet-zakladka"></span>' : "") +
      '</span>';
    btn.querySelector(".rady-grzbiet-tytul").textContent = k.tytul;
    btn.addEventListener("click", function () {
      if (String(k.id) === String(radyWybranaKsiazkaId)) return;
      radyWybranaKsiazkaId = String(k.id);
      renderRadyPolka();
      renderRadyAktywna();
      renderRadyMapa();
    });
    radyPolka.appendChild(btn);
  });

  const nowa = document.createElement("button");
  nowa.type = "button";
  nowa.className = "rady-grzbiet-nowa";
  nowa.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
    "<span>Następna książka</span>";
  nowa.addEventListener("click", function () {
    pokazToast("Nowe książki będzie można dodawać później.", "sukces");
  });
  radyPolka.appendChild(nowa);

  RADY_GRZBIETY_DUCHY.forEach(function (d) {
    const duch = document.createElement("div");
    duch.className = "rady-grzbiet-duch";
    duch.setAttribute("aria-hidden", "true");
    duch.style.width = d[0] + "px";
    duch.style.height = d[1] + "px";
    duch.style.opacity = String(d[2]);
    radyPolka.appendChild(duch);
  });
}

// Górna część biletu: status, wielki numer rzymski w tle, tytuł i treść
function radyBiletGora(status, klasaStatusu, numer, tytul) {
  const gora = document.createElement("div");
  gora.className = "rady-bilet-gora";
  if (numer) {
    const numerEl = document.createElement("span");
    numerEl.className = "rady-bilet-numer";
    numerEl.setAttribute("aria-hidden", "true");
    numerEl.textContent = numer;
    gora.appendChild(numerEl);
  }
  const statusEl = document.createElement("div");
  statusEl.className = "rady-bilet-status" + (klasaStatusu ? " " + klasaStatusu : "");
  statusEl.textContent = status;
  const tytulEl = document.createElement("h3");
  tytulEl.className = "rady-bilet-tytul";
  tytulEl.textContent = tytul;
  gora.append(statusEl, tytulEl);
  return gora;
}
function radyPerforacja() {
  const p = document.createElement("div");
  p.className = "rady-perforacja";
  p.setAttribute("aria-hidden", "true");
  return p;
}
function radyTekstBiletu(tekst) {
  const p = document.createElement("p");
  p.className = "rady-bilet-tekst";
  p.textContent = tekst;
  return p;
}

// Miejsce pod półką: formularz planu (gdy wybieram zasadę) / bilet misji / gwiazdozbiór ukończony / zachęta
function renderRadyAktywna() {
  radyAktywna.innerHTML = "";
  const aktywny = radyAktywnyPostep();
  const zasadaAktywna = aktywny ? radyZasada(aktywny.zasada_id) : null;

  if (!aktywny && radyZasadaWFormularzuId && radyZasada(radyZasadaWFormularzuId)) {
    radyAktywna.appendChild(radyFormularzPlanu(radyZasada(radyZasadaWFormularzuId)));
    return;
  }
  radyZasadaWFormularzuId = null;

  if (aktywny && zasadaAktywna) {
    radyAktywna.appendChild(radyBiletMisji(aktywny, zasadaAktywna));
    return;
  }

  const bilet = document.createElement("section");
  const stat = radyStatystykiKsiazki(radyWybranaKsiazkaId);
  if (stat.ukonczona) {
    bilet.className = "rady-bilet ukonczony";
    const info = radyBiletGora("Gwiazdozbiór ukończony", "zloty", "", (stat.zasady.length === 1 ? "Gwiazda zapalona" : "Wszystkie " + stat.zasady.length + " " + radyOdmiana(stat.zasady.length, "gwiazda", "gwiazdy", "gwiazd") + " zapalone"));
    info.className = "rady-bilet-info";
    info.appendChild(radyTekstBiletu("Ta książka jest już na półce jako ukończona. Wybierz kolejną książkę z półki i zacznij nowy gwiazdozbiór."));
    bilet.appendChild(info);
  } else {
    bilet.className = "rady-bilet";
    const info = radyBiletGora("Brak misji", "wyciszony", "", "Wybierz gwiazdę na mapie");
    info.className = "rady-bilet-info";
    info.appendChild(radyTekstBiletu(stat.zasady.length > 0
      ? "Kliknij dowolną niezaliczoną zasadę w gwiazdozbiorze poniżej i zaplanuj, jak ją zastosujesz: Jeśli… / To…"
      : "Wybierz z półki książkę, która ma zasady."));
    if (stat.zasady.length > 0) {
      const btnMapa = document.createElement("button");
      btnMapa.type = "button";
      btnMapa.className = "rady-btn-dyskretny";
      btnMapa.textContent = "Przejdź do mapy ↓";
      btnMapa.addEventListener("click", function () {
        radyMapa.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      info.appendChild(btnMapa);
    }
    bilet.appendChild(info);
  }
  radyAktywna.appendChild(bilet);
}

// Bilet "Misja w toku": nazwa zasady, plan jeśli–to, pieczątki X/RADY_PIECZATKI_WYMAGANE i przyciski
function radyBiletMisji(aktywny, zasada) {
  const numer = rzymska(radyNumerZasady(zasada));
  const bilet = document.createElement("section");
  bilet.className = "rady-bilet";
  const gora = radyBiletGora("Misja w toku", "", numer, zasada.nazwa);

  const plan = document.createElement("div");
  plan.className = "rady-moj-plan";
  plan.innerHTML = '<span class="rady-kicker">Mój plan</span>';
  [["Jeśli", aktywny.plan_jesli], ["To", aktywny.plan_to]].forEach(function (para) {
    const p = document.createElement("p");
    const s = document.createElement("strong");
    s.textContent = para[0] + "… ";
    p.append(s, document.createTextNode(para[1] || ""));
    plan.appendChild(p);
  });
  gora.appendChild(plan);

  const pieczatki = radyPieczatkiZasady(zasada.id);
  const liczba = Math.min(pieczatki.length, RADY_PIECZATKI_WYMAGANE);
  const dzisPrzybita = radyPieczatkaDzis(zasada.id);
  const komplet = pieczatki.length >= RADY_PIECZATKI_WYMAGANE;

  const dol = document.createElement("div");
  dol.className = "rady-bilet-dol";
  const naglowek = document.createElement("div");
  naglowek.className = "rady-pieczatki-naglowek";
  naglowek.innerHTML =
    '<span class="rady-kicker">Pieczątki · ' + liczba + "/" + RADY_PIECZATKI_WYMAGANE + "</span>" +
    '<span class="rady-nagroda">+' + RADY_PD_ZASADA + " PD</span>";

  const rzad = document.createElement("div");
  rzad.className = "rady-pieczatki";
  rzad.setAttribute("aria-label", "Pieczątki: " + liczba + " z " + RADY_PIECZATKI_WYMAGANE);
  const OBROTY = [-8, 5, -3, 9, -6];
  for (let i = 0; i < RADY_PIECZATKI_WYMAGANE; i++) {
    const p = document.createElement("div");
    if (i < liczba) {
      p.className = "rady-pieczatka przybita";
      p.style.setProperty("--obrot", OBROTY[i % OBROTY.length] + "deg");
      p.innerHTML = IKONA_PTASZEK;
    } else if (i === liczba && !dzisPrzybita) {
      p.className = "rady-pieczatka dzis";
      p.textContent = "DZIŚ";
    } else {
      p.className = "rady-pieczatka";
      p.textContent = String(i + 1);
    }
    rzad.appendChild(p);
  }

  const btnPieczatka = document.createElement("button");
  btnPieczatka.type = "button";
  btnPieczatka.className = "rady-btn-glowny";
  const etykieta = komplet
    ? "Wszystkie pieczątki przybite"
    : dzisPrzybita ? "Dzisiejsza pieczątka przybita — wróć jutro" : "Przybij dzisiejszą pieczątkę";
  btnPieczatka.innerHTML = "<span></span>" + (komplet || dzisPrzybita ? IKONA_PTASZEK : IKONA_STRZALKA);
  btnPieczatka.firstChild.textContent = etykieta;
  btnPieczatka.disabled = komplet || dzisPrzybita;

  const akcje = document.createElement("div");
  akcje.className = "rady-bilet-akcje";
  const btnZaliczona = document.createElement("button");
  btnZaliczona.type = "button";
  btnZaliczona.className = "rady-btn-dyskretny" + (komplet ? " gotowa" : "");
  btnZaliczona.textContent = "Zaliczona";
  btnZaliczona.disabled = !komplet;
  if (!komplet) btnZaliczona.title = "Najpierw zbierz " + RADY_PIECZATKI_WYMAGANE + " " + radyOdmianaPieczatek(RADY_PIECZATKI_WYMAGANE);
  const btnRezygnuje = document.createElement("button");
  btnRezygnuje.type = "button";
  btnRezygnuje.className = "rady-btn-dyskretny";
  btnRezygnuje.textContent = "Rezygnuję";
  akcje.append(btnZaliczona, btnRezygnuje);

  const przyciski = [btnPieczatka, btnZaliczona, btnRezygnuje];
  btnPieczatka.addEventListener("click", function () { przybijPieczatke(aktywny, przyciski); });
  btnZaliczona.addEventListener("click", function () { zaliczZasade(aktywny, przyciski); });
  btnRezygnuje.addEventListener("click", function () { zrezygnujZZasady(aktywny, zasada, przyciski); });

  dol.append(naglowek, rzad, btnPieczatka, akcje);
  bilet.append(gora, radyPerforacja(), dol);
  return bilet;
}

// Formularz planu jeśli–to dla wybranej (dostępnej) zasady — w formie biletu
function radyFormularzPlanu(zasada) {
  const bilet = document.createElement("section");
  bilet.className = "rady-bilet";
  const numer = rzymska(radyNumerZasady(zasada));
  const gora = radyBiletGora("Wybierasz zasadę", "", numer, zasada.nazwa);
  if (zasada.opis) gora.appendChild(radyTekstBiletu(zasada.opis));

  const dol = document.createElement("div");
  dol.className = "rady-bilet-dol";
  const form = document.createElement("form");
  form.className = "rady-plan-form";
  form.innerHTML =
    '<label for="rady-plan-jesli">Jeśli…</label>' +
    '<textarea id="rady-plan-jesli" rows="2" required placeholder="np. jeśli zaczynam odkładać trudne zadanie"></textarea>' +
    '<label for="rady-plan-to">To…</label>' +
    '<textarea id="rady-plan-to" rows="2" required placeholder="np. to robię pierwsze 2 minuty od razu"></textarea>' +
    '<div class="rady-akcje">' +
      '<button type="submit" class="btn-submit">Zapisz plan</button>' +
      '<button type="button" class="btn-rady-drugorzedny">Anuluj</button>' +
    '</div>';
  const poleJesli = form.querySelector("#rady-plan-jesli");
  const poleTo = form.querySelector("#rady-plan-to");
  const btnZapisz = form.querySelector(".btn-submit");

  form.querySelector(".btn-rady-drugorzedny").addEventListener("click", function () {
    radyZasadaWFormularzuId = null;
    renderRadyAktywna();
    renderRadyMapa();
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const planJesli = poleJesli.value.trim();
    const planTo = poleTo.value.trim();
    if (!planJesli || !planTo) {
      pokazToast("Uzupełnij oba pola: „Jeśli…” i „To…”.", "blad");
      return;
    }
    if (radyAktywnyPostep()) {
      pokazToast(RADY_KOMUNIKAT_JEDNA_AKTYWNA, "blad");
      return;
    }

    btnZapisz.disabled = true;
    const { data, error } = await db
      .from("zasady_postep")
      .insert({
        zasada_id: zasada.id,
        user_id: sesjaUzytkownika.user.id,
        status: "aktywna",
        plan_jesli: planJesli,
        plan_to: planTo
      })
      .select();
    btnZapisz.disabled = false;

    if (error) {
      console.error(error);
      // 23505 = naruszenie unikalności (baza pozwala na jedną aktywną zasadę), P0001 = wyjątek z triggera
      if (error.code === "23505" || error.code === "P0001") {
        pokazToast(RADY_KOMUNIKAT_JEDNA_AKTYWNA, "blad");
        odswiezRadyPostep();
      } else {
        pokazToast("Nie udało się zapisać zasady: " + error.message, "blad");
      }
      return;
    }

    radyPostepWiersze.push(data && data[0] ? data[0] : {
      id: Date.now(), zasada_id: zasada.id, status: "aktywna", plan_jesli: planJesli, plan_to: planTo, zaliczona_at: null
    });
    radyZasadaWFormularzuId = null;
    renderRadyZKsiazek();
    pokazToast("Misja rozpoczęta — powodzenia!", "sukces");
  });

  dol.appendChild(form);
  bilet.append(gora, radyPerforacja(), dol);
  return bilet;
}

// Jedna pieczątka dziennie dla aktywnej zasady (wiersz w "zasady_wpisy" z dzisiejszą datą)
async function przybijPieczatke(postep, przyciski) {
  if (radyPieczatkaDzis(postep.zasada_id)) {
    pokazToast("Dzisiejsza pieczątka jest już przybita — wróć jutro.", "blad");
    return;
  }
  if (radyPieczatkiZasady(postep.zasada_id).length >= RADY_PIECZATKI_WYMAGANE) return;

  const pdPrzed = radyObliczPD();
  const dzis = dataSprzedDni(0);
  przyciski.forEach(function (b) { b.disabled = true; });
  const { data, error } = await db
    .from("zasady_wpisy")
    .insert({ zasada_id: postep.zasada_id, user_id: sesjaUzytkownika.user.id, data: dzis, zadzialalo: true })
    .select("id, zasada_id, data, zadzialalo");

  if (error) {
    console.error(error);
    pokazToast("Nie udało się przybić pieczątki: " + error.message, "blad");
    renderRadyAktywna();
    return;
  }
  radyWpisy.push(data && data[0] ? data[0] : { id: Date.now(), zasada_id: postep.zasada_id, data: dzis, zadzialalo: true });
  renderRadyZKsiazek();
  const komplet = radyPieczatkiZasady(postep.zasada_id).length >= RADY_PIECZATKI_WYMAGANE;
  radyPokazZysk(komplet ? "Komplet pieczątek — możesz zaliczyć zasadę!" : "Pieczątka przybita!", pdPrzed);
}

async function zaliczZasade(postep, przyciski) {
  if (radyPieczatkiZasady(postep.zasada_id).length < RADY_PIECZATKI_WYMAGANE) {
    pokazToast("Zbierz najpierw " + RADY_PIECZATKI_WYMAGANE + " " + radyOdmianaPieczatek(RADY_PIECZATKI_WYMAGANE) + ".", "blad");
    return;
  }
  const pdPrzed = radyObliczPD();
  przyciski.forEach(function (b) { b.disabled = true; });
  const zaliczonaAt = new Date().toISOString();
  const { error } = await db
    .from("zasady_postep")
    .update({ status: "zaliczona", zaliczona_at: zaliczonaAt })
    .eq("id", postep.id);

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zaliczyć zasady: " + error.message, "blad");
    renderRadyAktywna();
    return;
  }
  postep.status = "zaliczona";
  postep.zaliczona_at = zaliczonaAt;
  const zasada = radyZasada(postep.zasada_id);
  if (zasada) radyWybranaKsiazkaId = String(zasada.ksiazka_id);
  renderRadyZKsiazek();
  const ukonczona = zasada && radyStatystykiKsiazki(zasada.ksiazka_id).ukonczona;
  radyPokazZysk(ukonczona ? "Gwiazdozbiór ukończony!" : "Zasada zaliczona — gwiazda zapalona!", pdPrzed);
}

async function zrezygnujZZasady(postep, zasada, przyciski) {
  const liczba = radyPieczatkiZasady(zasada.id).length;
  const potwierdzenie = window.confirm(
    'Zrezygnować z zasady „' + zasada.nazwa + '"? Twój plan jeśli–to' +
    (liczba > 0 ? " i " + liczba + " " + radyOdmianaPieczatek(liczba) + " zostaną usunięte." : " zostanie usunięty.")
  );
  if (!potwierdzenie) return;

  przyciski.forEach(function (b) { b.disabled = true; });
  const wpisyRes = await db.from("zasady_wpisy").delete().eq("zasada_id", zasada.id);
  const postepRes = wpisyRes.error ? null : await db.from("zasady_postep").delete().eq("id", postep.id);
  const blad = wpisyRes.error || (postepRes && postepRes.error);

  if (blad) {
    console.error(blad);
    pokazToast("Nie udało się zrezygnować z zasady: " + blad.message, "blad");
    // Pieczątki mogły już zniknąć, a postęp nie — pobierz aktualny stan z bazy
    odswiezRadyPostep();
    return;
  }
  radyWpisy = radyWpisy.filter(function (w) { return String(w.zasada_id) !== String(zasada.id); });
  radyPostepWiersze = radyPostepWiersze.filter(function (p) { return p.id !== postep.id; });
  renderRadyZKsiazek();
}

// Poziome położenia węzłów w % szerokości mapy (zygzak jak w makiecie), pionowe w px
const RADY_X_ZASAD = [28, 64, 77, 44, 23, 38, 74, 55, 18, 51, 79, 59, 26];
const RADY_X_PLANET = [62, 36];

// Gwiazdozbiór zasad wybranej książki: pionowa, zygzakowata konstelacja z planetami i Gwiazdą polarną
function renderRadyMapa() {
  radyMapa.innerHTML = "";
  const stat = radyStatystykiKsiazki(radyWybranaKsiazkaId);
  const n = stat.zasady.length;

  radyMapaLicznik.textContent = stat.zaliczone + " z " + n + (n === 1 ? " gwiazdy" : " gwiazd") +
    (stat.planety > 0 ? " · " + stat.odkrytePlanety + " z " + stat.planety + (stat.planety === 1 ? " planety" : " planet") : "");
  radyMapaOpis.textContent = n > 0
    ? "Każda zaliczona zasada zapala gwiazdę — w dowolnej kolejności. " + (n === 1 ? "Zapal ją" : "Zapal wszystkie " + n) + ", a książka trafi na półkę jako ukończona."
    : "";

  if (radyKsiazki.length === 0 || n === 0) {
    radyMapaLicznik.textContent = "";
    const pusto = document.createElement("div");
    pusto.className = "rady-mapa-pusto";
    pusto.innerHTML = radyKsiazki.length === 0
      ? pustyStanHTML("📚", "Brak książek w bazie.")
      : pustyStanHTML("📚", "Ta książka nie ma jeszcze zasad.");
    radyMapa.appendChild(pusto);
    return;
  }

  const aktywny = radyAktywnyPostep();
  const jestAktywna = !!aktywny;

  // Punkty mapy po kolei: zasady, co 4 zasady planeta, na końcu Gwiazda polarna
  const punkty = [];
  let y = 90;
  stat.zasady.forEach(function (zasada, i) {
    if (i > 0 && i % RADY_ZASAD_NA_PLANETE === 0) {
      const nr = i / RADY_ZASAD_NA_PLANETE;
      y += 18;
      punkty.push({ typ: "planeta", nr: nr, po: i, x: RADY_X_PLANET[(nr - 1) % RADY_X_PLANET.length], y: y, swieci: stat.zaliczoneFlagi.slice(0, i).every(Boolean) });
      y += 120;
    }
    const stan = radyStanZasady(zasada.id);
    if (stan === "aktywna" && i > 0) y += 22;
    punkty.push({ typ: "zasada", zasada: zasada, i: i, stan: stan, x: RADY_X_ZASAD[i % RADY_X_ZASAD.length], y: y, swieci: stan === "zaliczona" });
    y += stan === "aktywna" ? 114 : 92;
  });
  y += 38;
  punkty.push({ typ: "final", x: 50, y: y, swieci: stat.ukonczona });
  const wysokosc = y + 150;
  radyMapa.style.height = wysokosc + "px";

  // Tło: deterministyczne gwiazdy (to samo ułożenie przy każdym renderze), co 9. migocze
  let ziarno = 7;
  function losowa() { ziarno = (ziarno * 16807) % 2147483647; return (ziarno - 1) / 2147483646; }
  const tlo = document.createDocumentFragment();
  const ileGwiazd = Math.round(wysokosc / 16);
  for (let i = 0; i < ileGwiazd; i++) {
    const g = document.createElement("span");
    g.className = "rady-tlo-gwiazda" + (losowa() < 0.15 ? " duza" : "") + (i % 9 === 0 ? " rady-migotanie" : "");
    g.setAttribute("aria-hidden", "true");
    g.style.opacity = (0.12 + losowa() * 0.4).toFixed(2);
    g.style.left = (losowa() * 99.5).toFixed(2) + "%";
    g.style.top = Math.round(losowa() * (wysokosc - 4)) + "px";
    g.style.animationDelay = (losowa() * 3).toFixed(1) + "s";
    tlo.appendChild(g);
  }
  radyMapa.appendChild(tlo);

  // Poświata wokół aktywnej zasady (albo Gwiazdy polarnej po ukończeniu książki)
  const wyrozniony = punkty.find(function (p) { return p.typ === "zasada" && p.stan === "aktywna"; }) ||
    (stat.ukonczona ? punkty[punkty.length - 1] : null);
  if (wyrozniony) {
    const halo = document.createElement("div");
    halo.className = "rady-halo";
    halo.style.left = wyrozniony.x + "%";
    halo.style.top = wyrozniony.y + "px";
    radyMapa.appendChild(halo);
  }

  // Linie: cała trasa przerywana, a jasne odcinki tylko między dwoma sąsiednimi zapalonymi punktami.
  // viewBox w jednostkach "% szerokości × px wysokości"; non-scaling-stroke trzyma grubość linii mimo rozciągania.
  const trasa = punkty.map(function (p, i) { return (i ? "L" : "M") + p.x + " " + p.y; }).join(" ");
  let jasne = "";
  for (let i = 1; i < punkty.length; i++) {
    if (punkty[i - 1].swieci && punkty[i].swieci) {
      jasne += "M" + punkty[i - 1].x + " " + punkty[i - 1].y + " L" + punkty[i].x + " " + punkty[i].y + " ";
    }
  }
  radyMapa.insertAdjacentHTML("beforeend",
    '<svg class="rady-mapa-linie" viewBox="0 0 100 ' + wysokosc + '" preserveAspectRatio="none" style="height:' + wysokosc + 'px" aria-hidden="true">' +
      '<path d="' + trasa + '" fill="none" stroke="oklch(0.26 0.008 245)" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/>' +
      (jasne ? '<path d="' + jasne.trim() + '" fill="none" stroke="#D6D0C0" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke" style="filter: drop-shadow(0 0 4px rgba(214,208,192,0.6))"/>' : "") +
    "</svg>");

  punkty.forEach(function (p) {
    const wezel = document.createElement("div");
    wezel.className = "rady-wezel";
    wezel.style.left = p.x + "%";
    wezel.style.top = p.y + "px";

    if (p.typ === "planeta") {
      wezel.innerHTML =
        '<div class="rady-planeta' + (p.swieci ? " odkryta" : "") + '">' +
          '<svg viewBox="0 0 64 40" fill="none" aria-hidden="true">' +
            '<circle cx="32" cy="20" r="12" fill="currentColor" opacity="' + (p.swieci ? 0.9 : 0.15) + '"/>' +
            '<ellipse cx="32" cy="20" rx="28" ry="7" stroke="currentColor" stroke-width="1.5" transform="rotate(-14 32 20)"/>' +
          "</svg>" +
          '<span class="rady-planeta-podpis">Planeta ' + rzymska(p.nr) +
            (p.swieci ? " · odkryta · +" + RADY_PD_PLANETA + " PD" : " · zalicz " + rzymska(1) + "–" + rzymska(p.po)) +
          "</span>" +
        "</div>";
      radyMapa.appendChild(wezel);
      return;
    }

    if (p.typ === "final") {
      wezel.innerHTML =
        '<div class="rady-final' + (p.swieci ? " ukonczona" : "") + '">' +
          IKONA_GWIAZDA_4 +
          '<span class="rady-final-nazwa">Gwiazda polarna</span>' +
          '<span class="rady-final-podpis">' + (p.swieci ? "Książka ukończona" : "Ukończ książkę") + " · +" + RADY_PD_KSIAZKA + " PD</span>" +
        "</div>";
      radyMapa.appendChild(wezel);
      return;
    }

    const zasada = p.zasada;
    const numer = rzymska(p.i + 1);
    const opisStanu = { zaliczona: "zaliczona", aktywna: "aktywna", dostepna: "dostępna" }[p.stan];
    const etykietaAria = "Zasada " + numer + ": " + zasada.nazwa + " — " + opisStanu;
    let klik = null;

    if (p.stan === "zaliczona") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rady-gwiazda";
      btn.setAttribute("aria-label", etykietaAria);
      btn.setAttribute("aria-disabled", "true");
      btn.innerHTML = IKONA_GWIAZDA_4;
      wezel.appendChild(btn);
    } else if (p.stan === "aktywna") {
      const wrap = document.createElement("div");
      wrap.className = "rady-aktywny-wezel";
      wrap.innerHTML = '<span class="rady-orbita zewnetrzna" aria-hidden="true"></span><span class="rady-orbita" aria-hidden="true"></span>';
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rady-aktywny-btn";
      btn.setAttribute("aria-label", etykietaAria);
      btn.textContent = numer;
      klik = function () { kliknietoZasade(zasada, p.stan); };
      btn.addEventListener("click", klik);
      wrap.appendChild(btn);
      wezel.appendChild(wrap);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rady-punkt" + (String(zasada.id) === String(radyZasadaWFormularzuId) ? " w-formularzu" : "");
      btn.setAttribute("aria-label", etykietaAria);
      if (jestAktywna) btn.setAttribute("aria-disabled", "true");
      klik = function () { kliknietoZasade(zasada, p.stan); };
      btn.addEventListener("click", klik);
      wezel.appendChild(btn);
    }
    radyMapa.appendChild(wezel);

    // Podpis po przeciwnej stronie niż bliższa krawędź; długie nazwy się zawijają
    const odstep = p.stan === "aktywna" ? 54 : 30;
    const podpis = document.createElement("div");
    podpis.className = "rady-etykieta-wezla " + p.stan;
    podpis.setAttribute("aria-hidden", "true");
    podpis.style.top = p.y + "px";
    if (p.x > 50) {
      podpis.classList.add("lewa");
      podpis.style.left = "16px";
      podpis.style.right = "calc(" + (100 - p.x) + "% + " + odstep + "px)";
    } else {
      podpis.style.left = "calc(" + p.x + "% + " + odstep + "px)";
      podpis.style.right = "16px";
    }
    const numerEl = document.createElement("span");
    numerEl.className = "rady-wezel-numer";
    numerEl.textContent = (p.stan === "aktywna" ? "TERAZ · " : "") + numer;
    const nazwaEl = document.createElement("span");
    nazwaEl.className = "rady-wezel-nazwa";
    nazwaEl.textContent = zasada.nazwa;
    podpis.append(numerEl, nazwaEl);
    if (klik && !(p.stan === "dostepna" && jestAktywna)) {
      podpis.classList.add("klikalna");
      podpis.addEventListener("click", klik);
    }
    radyMapa.appendChild(podpis);
  });
}

function kliknietoZasade(zasada, stan) {
  if (stan === "zaliczona") return;
  if (stan === "aktywna") {
    radyAktywna.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (radyAktywnyPostep()) {
    pokazToast(RADY_KOMUNIKAT_JEDNA_AKTYWNA, "blad");
    return;
  }
  radyZasadaWFormularzuId = zasada.id;
  renderRadyAktywna();
  renderRadyMapa();
  radyAktywna.scrollIntoView({ behavior: "smooth", block: "start" });
  const poleJesli = document.getElementById("rady-plan-jesli");
  if (poleJesli) poleJesli.focus({ preventScroll: true });
}
