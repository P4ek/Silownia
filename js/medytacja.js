// Ekran "Medytacja" (#widok-medytacja, tylko konta z MEDYTACJA_DOSTEP_IDS): start (czas na nici, ocena "przed"), odliczanie, koniec (ocena "po", notatka).
// Sesja zapisuje się sama, gdy czas minie: wiersz w "medytacje" + odznaczenie nawyku z "medyt" w nazwie; "Zapisz" na końcu tylko aktualizuje ten wiersz.
// Czas liczony z zapisanego czasu końca (Date.now), stan trwającej sesji w localStorage tego urządzenia.
// Przy zablokowanym ekranie apkę trzyma przy życiu element audio z wygenerowanym WAV: cisza na całą sesję + gong na końcu.

const navMedytacja = document.getElementById("nav-medytacja");
const medEl = {
  dzienTyg: document.getElementById("med-dzien-tyg"),
  dataTekst: document.getElementById("med-data-tekst"),
  start: document.getElementById("med-start"),
  trwa: document.getElementById("med-trwa"),
  koniec: document.getElementById("med-koniec"),
  kartaZapis: document.getElementById("med-karta-zapis"),
  kartaZapisTekst: document.getElementById("med-karta-zapis-tekst"),
  kartaZapisBlad: document.getElementById("med-karta-zapis-blad"),
  kartaZapisBtn: document.getElementById("med-karta-zapis-btn"),
  czasLiczba: document.getElementById("med-czas-liczba"),
  nicStart: document.getElementById("med-nic-start"),
  koraliki: document.getElementById("med-koraliki"),
  przed: document.getElementById("med-przed"),
  przedPomin: document.getElementById("med-przed-pomin"),
  zacznij: document.getElementById("med-zacznij"),
  zacznijTekst: document.getElementById("med-zacznij-tekst"),
  bezTimera: document.getElementById("med-bez-timera"),
  trwaOpis: document.getElementById("med-trwa-opis"),
  nicTrwa: document.getElementById("med-nic-trwa"),
  zegar: document.getElementById("med-zegar"),
  postep: document.getElementById("med-postep-wypelnienie"),
  zakoncz: document.getElementById("med-zakoncz"),
  nicKoniec: document.getElementById("med-nic-koniec"),
  koniecMinuty: document.getElementById("med-koniec-minuty"),
  roznica: document.getElementById("med-roznica"),
  po: document.getElementById("med-po"),
  porownanie: document.getElementById("med-porownanie"),
  porownaniePrzed: document.getElementById("med-porownanie-przed"),
  porownaniePo: document.getElementById("med-porownanie-po"),
  notatka: document.getElementById("med-notatka"),
  koniecBlad: document.getElementById("med-koniec-blad"),
  zapisz: document.getElementById("med-zapisz"),
  wlasny: document.getElementById("med-wlasny"),
  wlasnyPole: document.getElementById("med-wlasny-pole"),
  historia: document.getElementById("med-historia"),
  historiaSuma: document.getElementById("med-historia-suma"),
  historiaLista: document.getElementById("med-historia-lista"),
  historiaWiecej: document.getElementById("med-historia-wiecej")
};

const MED_CEL_DOMYSLNY = 7;
const MED_CZASY_STALE = [5, 10, 15, 20];
const MED_SVG_NS = "http://www.w3.org/2000/svg";
const MED_WLASNY_MAKS = 180;
const MED_HISTORIA_PORCJA = 20;

let medDostep = false;
let medCel = MED_CEL_DOMYSLNY;
let medWybrane = MED_CEL_DOMYSLNY;  // minuty wybrane koralikiem
let medWybranoRecznie = false;      // użytkownik kliknął koralik - zmiana celu w bazie go nie nadpisuje
let medPrzed = null;                // ocena "przed" 1-5, null = brak/pominięta
let medPrzedPominieta = false;
// Sesja: { start, koniec (ms; null bez timera), minuty (planowane), przed, data, faktyczne (minuty do zapisu, gdy skończona),
//          id (wiersz w "medytacje" po zapisie), po, notatka }
let medSesja = null;
let medZapisTrwa = false;
let medTimer = null;
let medAudio = null;
let medAudioUrl = null;
let medWakeLock = null;
let medSkala = null; // ostatnio ustawione wygładzenie nici odliczania
let medHistoria = [];          // ukończone sesje z bazy, najnowsze pierwsze
let medHistoriaIle = MED_HISTORIA_PORCJA;

// ===== Pomocnicze =====
function medMinutyTekst(m) {
  return String(Math.round(m * 10) / 10).replace(".", ",");
}
function medKlucz() {
  return "silownia-medytacja-" + (sesjaUzytkownika ? sesjaUzytkownika.user.id : "anon");
}
// Ostatni własny czas (koralik obok stałych) - wygoda tego urządzenia
function medKluczWlasny() {
  return medKlucz() + "-wlasny";
}
function medWlasnyCzas() {
  try {
    const m = Number(localStorage.getItem(medKluczWlasny()));
    return m > 0 && m <= MED_WLASNY_MAKS ? m : null;
  } catch (e) {
    return null;
  }
}
function medZapiszStan() {
  try {
    if (medSesja) localStorage.setItem(medKlucz(), JSON.stringify(medSesja));
    else localStorage.removeItem(medKlucz());
  } catch (e) {}
}
function medCzyTrwa() {
  return !!medSesja && medSesja.faktyczne == null && medSesja.koniec != null && Date.now() < medSesja.koniec;
}
function medSvg(tag, atrybuty) {
  const e = document.createElementNS(MED_SVG_NS, tag);
  Object.keys(atrybuty || {}).forEach(function (k) { e.setAttribute(k, atrybuty[k]); });
  return e;
}

// ===== Nić: fala z kilku punktów (Q + powtarzane T), ruch przez transform =====
// Fala od x0 do x1 na wysokości y, amplituda a, półokres h, przesunięcie fazy (0..2h)
function medFala(x0, x1, y, a, h, faza) {
  let x = x0 - faza;
  let d = "M" + x.toFixed(1) + " " + y.toFixed(1) + " Q" + (x + h / 2).toFixed(1) + " " + (y - 2 * a).toFixed(1) + " " + (x + h).toFixed(1) + " " + y.toFixed(1);
  x += h;
  while (x < x1) {
    x += h;
    d += " T" + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
}

// Nić z maks. trzech ścieżek: poświata (szersza, półprzezroczysta), nić główna, cieńsze pasmo.
// Okres główny P = 130; pasmo ma okres P/2, więc obie pętle płyną bez szwu przy przesunięciu o -P.
const MED_OKRES = 130;
function medRysujNic(kontener, opcje) {
  const szer = 390;
  const wys = opcje.wysokosc;
  const sy = wys / 2;
  const svg = medSvg("svg", { viewBox: "0 0 " + szer + " " + wys, preserveAspectRatio: "none", "aria-hidden": "true" });
  const g = medSvg("g", { class: "med-nic-wygladzanie" });
  g.style.transformOrigin = "0px " + sy + "px";
  const glowna = medFala(0, szer + MED_OKRES, sy, opcje.amplituda, MED_OKRES / 2, 0);
  const pasmo = medFala(0, szer + MED_OKRES, sy, opcje.amplituda * 0.62, MED_OKRES / 4, MED_OKRES / 6);
  [
    { d: glowna, klasa: "med-nic-poswiata", czas: 10 },
    { d: glowna, klasa: "med-nic-glowna", czas: 10 },
    { d: pasmo, klasa: "med-nic-pasmo", czas: 14 }
  ].forEach(function (s) {
    const p = medSvg("path", { d: s.d, class: "med-nic-sciezka " + s.klasa, "vector-effect": "non-scaling-stroke" });
    p.style.animationDuration = s.czas + "s";
    g.appendChild(p);
  });
  svg.appendChild(g);
  kontener.innerHTML = "";
  kontener.appendChild(svg);
  return g;
}

// Mała nić oceny (1 = splątana ... 5 = gładka): trzy pasma w jednej ścieżce
function medNitkaOceny(n, szer, wys) {
  const sy = wys / 2;
  const splatanie = (5 - n) / 4;            // 1 → 1, 5 → 0
  const a = 0.6 + splatanie * wys * 0.3;
  const rozrzut = splatanie * wys * 0.12;
  const h0 = 5 + n * 3;
  let d = "";
  for (let k = 0; k < 3; k++) {
    const h = h0 * (1 + k * 0.35);
    d += medFala(-2, szer + 2, sy + (k - 1) * rozrzut, a * (1 - k * 0.2), h, k * h * 0.7) + " ";
  }
  return d.trim();
}

// Animacje nici i oddechu tylko na ekranie (klasa med-ruch), poza nim animation-play-state: paused
const medObserwator = "IntersectionObserver" in window
  ? new IntersectionObserver(function (wpisyObs) {
      wpisyObs.forEach(function (e) { e.target.classList.toggle("med-ruch", e.isIntersecting); });
    })
  : null;
document.querySelectorAll("#widok-medytacja .med-nic, #widok-medytacja .med-oddech").forEach(function (e) {
  if (medObserwator) medObserwator.observe(e);
  else e.classList.add("med-ruch");
});

const medGNicTrwa = medRysujNic(medEl.nicTrwa, { wysokosc: 300, amplituda: 58 });
medRysujNic(medEl.nicStart, { wysokosc: 90, amplituda: 16 });
medRysujNic(medEl.nicKoniec, { wysokosc: 80, amplituda: 2.5 });

// ===== Widok 1: start =====
function medOpcjeCzasu() {
  const wlasny = medWlasnyCzas();
  return Array.from(new Set([MED_CZASY_STALE[0], medCel].concat(MED_CZASY_STALE.slice(1), wlasny ? [wlasny] : [])))
    .sort(function (a, b) { return a - b; });
}

function renderMedKoraliki() {
  const opcje = medOpcjeCzasu();
  if (opcje.indexOf(medWybrane) === -1) medWybrane = medCel;
  medEl.koraliki.innerHTML = "";
  opcje.forEach(function (m) {
    const wybrany = m === medWybrane;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "med-koralik" + (wybrany ? " wybrany" : "");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", wybrany ? "true" : "false");
    b.setAttribute("aria-label", medMinutyTekst(m) + " " + odmianaLiczby(m, "minuta", "minuty", "minut") + (m === medCel ? " (cel)" : ""));
    const kulka = document.createElement("span");
    kulka.className = "med-koralik-kulka";
    const etykieta = document.createElement("span");
    etykieta.className = "med-koralik-etykieta";
    etykieta.textContent = medMinutyTekst(m);
    b.append(kulka, etykieta);
    b.addEventListener("click", function () {
      medWybrane = m;
      medWybranoRecznie = true;
      renderMedKoraliki();
    });
    medEl.koraliki.appendChild(b);
  });
  // Koralik "+": pole na własny czas
  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "med-koralik med-koralik-plus";
  plus.setAttribute("aria-label", "Własny czas");
  plus.setAttribute("aria-expanded", medEl.wlasny.hidden ? "false" : "true");
  plus.setAttribute("aria-controls", "med-wlasny");
  const kulkaPlus = document.createElement("span");
  kulkaPlus.className = "med-koralik-kulka";
  kulkaPlus.textContent = "+";
  const etykietaPlus = document.createElement("span");
  etykietaPlus.className = "med-koralik-etykieta";
  etykietaPlus.textContent = "inny";
  plus.append(kulkaPlus, etykietaPlus);
  plus.addEventListener("click", function () {
    medEl.wlasny.hidden = !medEl.wlasny.hidden;
    plus.setAttribute("aria-expanded", medEl.wlasny.hidden ? "false" : "true");
    if (!medEl.wlasny.hidden) {
      medEl.wlasnyPole.value = "";
      medEl.wlasnyPole.focus();
    }
  });
  medEl.koraliki.appendChild(plus);
  medEl.czasLiczba.textContent = medMinutyTekst(medWybrane);
  medEl.zacznijTekst.textContent = "Zacznij " + medMinutyTekst(medWybrane) + " min";
}

medEl.wlasny.addEventListener("submit", function (e) {
  e.preventDefault();
  const m = Math.round(Number(String(medEl.wlasnyPole.value).replace(",", ".")));
  if (!(m >= 1 && m <= MED_WLASNY_MAKS)) {
    pokazToast("Podaj czas od 1 do " + MED_WLASNY_MAKS + " minut.", "blad");
    return;
  }
  try { localStorage.setItem(medKluczWlasny(), String(m)); } catch (err) {}
  medWybrane = m;
  medWybranoRecznie = true;
  medEl.wlasny.hidden = true;
  medEl.wlasnyPole.blur();
  renderMedKoraliki();
});

// Pięć nitek oceny jako radiogroup
function renderMedNitki(kontener, wartosc, wybierz) {
  kontener.innerHTML = "";
  [1, 2, 3, 4, 5].forEach(function (n) {
    const wybrana = n === wartosc;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "med-nitka" + (wybrana ? " wybrana" : "");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", wybrana ? "true" : "false");
    b.setAttribute("aria-label", n + " z 5" + (n === 1 ? ", splątany" : n === 5 ? ", gładki" : ""));
    const svg = medSvg("svg", { viewBox: "0 0 52 34", "aria-hidden": "true" });
    svg.appendChild(medSvg("path", { d: medNitkaOceny(n, 52, 34) }));
    const liczba = document.createElement("span");
    liczba.textContent = String(n);
    b.append(svg, liczba);
    b.addEventListener("click", function () { wybierz(n); });
    kontener.appendChild(b);
  });
}

function renderMedPrzed() {
  renderMedNitki(medEl.przed, medPrzed, function (n) {
    medPrzed = n;
    medPrzedPominieta = false;
    renderMedPrzed();
  });
  medEl.przedPomin.textContent = medPrzedPominieta ? "Pominięte" : "Pomiń";
  medEl.przedPomin.setAttribute("aria-pressed", medPrzedPominieta ? "true" : "false");
}
medEl.przedPomin.addEventListener("click", function () {
  medPrzed = null;
  medPrzedPominieta = true;
  renderMedPrzed();
});

function renderMedData() {
  const d = new Date();
  medEl.dzienTyg.textContent = DNI_TYGODNIA_PELNE[(d.getDay() + 6) % 7];
  medEl.dataTekst.textContent = d.getDate() + " " + MIESIACE_DOPELNIACZ[d.getMonth()];
}

// Cel czytany przy każdym wejściu na ekran; brak wiersza = 7 (wiersza nie tworzymy)
async function medWczytajCel() {
  const { data, error } = await db
    .from("medytacja_ustawienia")
    .select("cel_minuty")
    .eq("user_id", sesjaUzytkownika.user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać celu medytacji: " + error.message, "blad");
    return;
  }
  const cel = data && Number(data.cel_minuty) > 0 ? Number(data.cel_minuty) : MED_CEL_DOMYSLNY;
  if (cel !== medCel) {
    medCel = cel;
    if (!medWybranoRecznie) medWybrane = cel;
  }
  renderMedKoraliki();
}

// ===== Dźwięk: WAV 8 kHz / 8 bit / mono - cisza na całą sesję i zsyntetyzowany gong na końcu =====
const MED_GONG_S = 7;
function medUtworzDzwiek(sekundy) {
  const czestotliwosc = 8000;
  const n = Math.round((sekundy + MED_GONG_S) * czestotliwosc);
  const bufor = new ArrayBuffer(44 + n);
  const v = new DataView(bufor);
  const tekst = function (poz, t) { for (let i = 0; i < t.length; i++) v.setUint8(poz + i, t.charCodeAt(i)); };
  tekst(0, "RIFF"); v.setUint32(4, 36 + n, true); tekst(8, "WAVE");
  tekst(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, czestotliwosc, true); v.setUint32(28, czestotliwosc, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  tekst(36, "data"); v.setUint32(40, n, true);

  const probki = new Uint8Array(bufor, 44);
  probki.fill(128); // cisza w 8-bitowym PCM
  // Gong: kilka sinusów (lekko nieharmonicznych) z wykładniczym wygaszaniem
  const tony = [[174, 1, 2.6], [349, 0.55, 1.8], [524, 0.32, 1.2], [702, 0.22, 0.85], [1046, 0.12, 0.5]];
  const poczatek = Math.round(sekundy * czestotliwosc);
  const dlugosc = n - poczatek;
  for (let i = 0; i < dlugosc; i++) {
    const t = i / czestotliwosc;
    const narastanie = Math.min(1, t / 0.012);
    const wybrzmienie = Math.min(1, (dlugosc - i) / (0.3 * czestotliwosc));
    let s = 0;
    for (let k = 0; k < tony.length; k++) s += tony[k][1] * Math.sin(2 * Math.PI * tony[k][0] * t) * Math.exp(-t / tony[k][2]);
    probki[poczatek + i] = Math.max(0, Math.min(255, Math.round(128 + 52 * s * narastanie * wybrzmienie)));
  }
  return new Blob([bufor], { type: "audio/wav" });
}

// Start dźwięku musi zajść w obsłudze stuknięcia (wymóg iOS)
function medStartDzwieku(sekundy) {
  medStopDzwieku();
  try {
    medAudioUrl = URL.createObjectURL(medUtworzDzwiek(sekundy));
    medAudio = new Audio(medAudioUrl);
    medAudio.setAttribute("playsinline", "");
    medAudio.addEventListener("ended", medStopDzwieku);
    const gra = medAudio.play();
    if (gra && gra.catch) gra.catch(function (e) { console.warn("Medytacja: dźwięk nie ruszył", e); });
  } catch (e) {
    console.warn("Medytacja: nie udało się przygotować dźwięku", e);
  }
  try {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "Medytacja", artist: "Siłownia" });
      navigator.mediaSession.playbackState = "playing";
    }
  } catch (e) {}
  medBlokadaEkranu(true);
}
function medStopDzwieku() {
  if (medAudio) {
    try { medAudio.pause(); } catch (e) {}
    medAudio = null;
  }
  if (medAudioUrl) {
    URL.revokeObjectURL(medAudioUrl);
    medAudioUrl = null;
  }
  try { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none"; } catch (e) {}
}
// Blokada wygaszania ekranu - dodatek, gdy przeglądarka ją ma
async function medBlokadaEkranu(wlacz) {
  try {
    if (wlacz && "wakeLock" in navigator) medWakeLock = await navigator.wakeLock.request("screen");
    else if (!wlacz && medWakeLock) {
      await medWakeLock.release();
      medWakeLock = null;
    }
  } catch (e) {}
}

// ===== Widok 2: odliczanie =====
function medStartTimera() {
  if (!medTimer) medTimer = setInterval(medTik, 500);
  medTik();
}
function medStopTimera() {
  clearInterval(medTimer);
  medTimer = null;
}

// Tik: zegar, postęp i wygładzanie nici; po czasie automatyczny zapis (gong gra dalej z pliku audio)
function medTik() {
  if (!medSesja || medSesja.faktyczne != null || medSesja.koniec == null) {
    medStopTimera();
    return;
  }
  const teraz = Date.now();
  if (teraz >= medSesja.koniec) {
    medStopTimera();
    medBlokadaEkranu(false);
    medSesja.faktyczne = medSesja.minuty;
    medZapiszStan();
    medRender();
    medZapiszSesje();
    return;
  }
  const calosc = medSesja.koniec - medSesja.start;
  const postep = Math.min(1, Math.max(0, (teraz - medSesja.start) / calosc));
  const zostalo = Math.ceil((medSesja.koniec - teraz) / 1000);
  const tekst = Math.floor(zostalo / 60) + ":" + String(zostalo % 60).padStart(2, "0");
  if (medEl.zegar.textContent !== tekst) medEl.zegar.textContent = tekst;
  medEl.postep.style.transform = "scaleX(" + postep.toFixed(4) + ")";
  const skala = Math.max(0.06, 1 - postep * 0.94);
  if (medSkala === null || Math.abs(skala - medSkala) > 0.002) {
    medSkala = skala;
    medGNicTrwa.style.transform = "scaleY(" + skala.toFixed(3) + ")";
  }
}

medEl.zacznij.addEventListener("click", function () {
  if (medSesja) return;
  const teraz = Date.now();
  medSesja = {
    start: teraz,
    koniec: teraz + medWybrane * 60000,
    minuty: medWybrane,
    przed: medPrzed,
    data: isoZDaty(new Date(teraz)),
    faktyczne: null
  };
  medStartDzwieku(medWybrane * 60);
  medZapiszStan();
  medSkala = null;
  medRender();
  medStartTimera();
});

medEl.bezTimera.addEventListener("click", function () {
  if (medSesja) return;
  const teraz = Date.now();
  medSesja = { start: teraz, koniec: null, minuty: medWybrane, przed: medPrzed, data: isoZDaty(new Date(teraz)), faktyczne: medWybrane };
  medZapiszStan();
  medRender();
  medZapiszSesje();
});

// Zakończ wcześniej: poniżej minuty anulowanie bez zapisu, inaczej zapis faktycznych minut
medEl.zakoncz.addEventListener("click", function () {
  if (!medCzyTrwa()) return;
  if (!window.confirm("Zakończyć medytację wcześniej?")) return;
  const uplynelo = Date.now() - medSesja.start;
  medStopTimera();
  medStopDzwieku();
  medBlokadaEkranu(false);
  if (uplynelo < 60000) {
    medSesja = null;
    medZapiszStan();
    medRender();
    pokazToast("Krócej niż minuta - sesja anulowana bez zapisu.", "sukces");
    return;
  }
  medSesja.faktyczne = Math.max(0.1, Math.round(uplynelo / 6000) / 10);
  medZapiszStan();
  medRender();
  medZapiszSesje();
});

// ===== Zapis sesji: najpierw baza, potem ekran; przy błędzie karta z "Spróbuj ponownie", stan zostaje =====
async function medZapiszSesje() {
  if (medZapisTrwa || !medSesja || medSesja.id || medSesja.faktyczne == null) return;
  medZapisTrwa = true;
  medEl.kartaZapisBtn.disabled = true;
  medEl.kartaZapisBtn.textContent = "Zapisuję…";
  medEl.kartaZapisBlad.hidden = true;

  const { data, error } = await db
    .from("medytacje")
    .insert({ data: medSesja.data, minuty: medSesja.faktyczne, ocena_przed: medSesja.przed })
    .select("id")
    .single();

  medZapisTrwa = false;
  medEl.kartaZapisBtn.disabled = false;
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać medytacji: " + error.message, "blad");
    medEl.kartaZapisBlad.textContent = error.message;
    medEl.kartaZapisBlad.hidden = false;
    medEl.kartaZapisBtn.textContent = "Spróbuj ponownie";
    return;
  }

  medSesja.id = data.id;
  medZapiszStan();
  pokazToast("Zapisano medytację: " + medMinutyTekst(medSesja.faktyczne) + " min", "sukces");
  medRender();
  medOdznaczNawyk(medSesja.data);
  medWczytajHistorie();
}
medEl.kartaZapisBtn.addEventListener("click", medZapiszSesje);

// Nawyk z "medyt" w nazwie: ustawiany jako zrobiony (już zrobiony - bez zmian); brak nawyku - nic nie tworzymy
async function medOdznaczNawyk(data) {
  const nawyk = nawyki.find(function (n) { return (n.nazwa || "").toLowerCase().indexOf("medyt") !== -1; });
  if (!nawyk) {
    console.warn("Medytacja: brak nawyku z „medyt” w nazwie - nie odznaczono.");
    return;
  }
  if (czyNawykZrobiony(nawyk.id, data)) return;
  if (!(await zapiszNawykZrobiony(nawyk, data))) return;
  renderNawykiListy(true);
  renderHabitsPodsumowanie();
  renderDzis();
}

// ===== Widok 3: koniec - ocena "po" i notatka aktualizują zapisany wiersz =====
function renderMedKoniec() {
  medEl.koniecMinuty.textContent = medMinutyTekst(medSesja.faktyczne);
  const po = medSesja.po || null;
  renderMedNitki(medEl.po, po, function (n) {
    medSesja.po = n;
    medZapiszStan();
    renderMedKoniec();
  });
  const roznica = medSesja.przed && po ? po - medSesja.przed : 0;
  const pokaz = roznica > 0;
  medEl.roznica.hidden = !pokaz;
  medEl.porownanie.hidden = !pokaz;
  if (pokaz) {
    medEl.roznica.textContent = "+" + roznica + " gładkości";
    medEl.porownaniePrzed.innerHTML = "";
    medEl.porownaniePrzed.appendChild(medSvg("path", { d: medNitkaOceny(medSesja.przed, 70, 26) }));
    medEl.porownaniePo.innerHTML = "";
    medEl.porownaniePo.appendChild(medSvg("path", { d: medNitkaOceny(po, 70, 26) }));
  }
  if (document.activeElement !== medEl.notatka) medEl.notatka.value = medSesja.notatka || "";
}
medEl.notatka.addEventListener("input", function () {
  if (!medSesja) return;
  medSesja.notatka = medEl.notatka.value;
  medZapiszStan();
});

medEl.zapisz.addEventListener("click", async function () {
  if (!medSesja || !medSesja.id) return;
  medEl.zapisz.disabled = true;
  medEl.koniecBlad.hidden = true;
  const notatka = (medEl.notatka.value || "").trim();
  const { error } = await db
    .from("medytacje")
    .update({ ocena_po: medSesja.po || null, notatka: notatka || null })
    .eq("id", medSesja.id);
  medEl.zapisz.disabled = false;
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać oceny: " + error.message, "blad");
    medEl.koniecBlad.textContent = error.message;
    medEl.koniecBlad.hidden = false;
    medEl.zapisz.textContent = "Spróbuj ponownie";
    return;
  }
  medEl.zapisz.textContent = "Zapisz";
  medSesja = null;
  medZapiszStan();
  medPrzed = null;
  medPrzedPominieta = false;
  medEl.notatka.value = "";
  pokazToast("Zapisano", "sukces");
  medRender();
  medWczytajHistorie();
});

// ===== Spis ukończonych medytacji (z bazy, najnowsze pierwsze) =====
async function medWczytajHistorie() {
  const { data, error } = await db
    .from("medytacje")
    .select("id, data, minuty, ocena_przed, ocena_po, notatka")
    .eq("user_id", sesjaUzytkownika.user.id)
    .order("data", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać medytacji: " + error.message, "blad");
    return;
  }
  medHistoria = data || [];
  renderMedHistoria();
}

function renderMedHistoria() {
  const lista = medEl.historiaLista;
  lista.innerHTML = "";
  const ile = medHistoria.length;
  if (!ile) {
    medEl.historiaSuma.textContent = "";
    lista.innerHTML = '<li class="med-historia-pusto">' + pustyStanHTML("🧘", "Jeszcze żadnej medytacji. Pierwsza nić czeka.") + "</li>";
    medEl.historiaWiecej.hidden = true;
    return;
  }
  const suma = medHistoria.reduce(function (s, w) { return s + (Number(w.minuty) || 0); }, 0);
  medEl.historiaSuma.textContent = ile + " " + odmianaLiczby(ile, "sesja", "sesje", "sesji") + " · " + medMinutyTekst(suma) + " min";
  medHistoria.slice(0, medHistoriaIle).forEach(function (w) {
    const li = document.createElement("li");
    li.className = "med-historia-wpis";
    const gora = document.createElement("div");
    gora.className = "med-historia-wiersz";
    const data = document.createElement("span");
    data.className = "med-historia-data";
    data.textContent = formatDatyRejestru(w.data);
    const min = document.createElement("span");
    min.className = "med-historia-min";
    min.textContent = medMinutyTekst(Number(w.minuty) || 0) + " min";
    gora.append(data, min);
    li.appendChild(gora);
    if (w.ocena_przed || w.ocena_po) {
      const ocena = document.createElement("span");
      ocena.className = "med-historia-ocena";
      ocena.textContent = "nić " + (w.ocena_przed || "–") + " → " + (w.ocena_po || "–");
      li.appendChild(ocena);
    }
    if (w.notatka) {
      const n = document.createElement("p");
      n.className = "med-historia-notatka";
      n.textContent = w.notatka;
      li.appendChild(n);
    }
    lista.appendChild(li);
  });
  medEl.historiaWiecej.hidden = ile <= medHistoriaIle;
}
medEl.historiaWiecej.addEventListener("click", function () {
  medHistoriaIle += MED_HISTORIA_PORCJA;
  renderMedHistoria();
});

// ===== Który widok =====
function medRender() {
  renderMedData();
  const trwa = medCzyTrwa();
  const doZapisu = !!medSesja && !medSesja.id && medSesja.faktyczne != null;
  const zapisana = !!medSesja && !!medSesja.id;
  medEl.start.hidden = !!medSesja;
  medEl.trwa.hidden = !trwa;
  medEl.kartaZapis.hidden = !doZapisu;
  medEl.koniec.hidden = !zapisana;
  medEl.historia.hidden = trwa;
  if (medSesja) medEl.wlasny.hidden = true;
  if (!medSesja) {
    renderMedKoraliki();
    renderMedPrzed();
  }
  if (trwa) medEl.trwaOpis.textContent = "Medytacja · " + medMinutyTekst(medSesja.minuty) + " min";
  if (doZapisu) {
    medEl.kartaZapisTekst.textContent = "Sesja skończona, zapisać " + medMinutyTekst(medSesja.faktyczne) + " min?";
    if (!medZapisTrwa && medEl.kartaZapisBlad.hidden) medEl.kartaZapisBtn.textContent = "Zapisz";
  }
  if (zapisana) renderMedKoniec();
}

// Po starcie apki (nawyki już wczytane): trwająca sesja wraca do odliczania, skończona niezapisana zapisuje się sama,
// zapisana z wcześniejszego dnia (bez oceny "po") jest porzucana - wiersz w bazie już jest
function medPrzywrocSesje() {
  let zapisana = null;
  try { zapisana = JSON.parse(localStorage.getItem(medKlucz()) || "null"); } catch (e) {}
  if (!zapisana || !zapisana.start) return;
  if (zapisana.id && zapisana.data !== dzisiaj()) {
    medSesja = null;
    medZapiszStan();
    return;
  }
  medSesja = zapisana;
  medRender();
  if (medSesja.faktyczne == null && medSesja.koniec != null) medStartTimera(); // tik sam zapisze, gdy czas już minął
  else if (!medSesja.id) medZapiszSesje();
}

// Powrót do apki: od razu tik (zapis po czasie), bez czekania na interwał
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || !medDostep || !medSesja) return;
  if (medSesja.faktyczne == null && medSesja.koniec != null) medStartTimera();
  else if (!medSesja.id) medZapiszSesje();
});

function ustawDostepMedytacji(dostep) {
  medDostep = dostep;
  navMedytacja.hidden = !dostep;
  if (!dostep) {
    medStopTimera();
    medStopDzwieku();
    medSesja = null;
    if (navMedytacja.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dzis"]').click();
    }
  }
}

navMedytacja.addEventListener("click", function () {
  if (!medDostep) return;
  medRender();
  medWczytajCel();
  medWczytajHistorie();
});
