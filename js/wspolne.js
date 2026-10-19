// Wspólne funkcje pomocnicze: toasty, puste stany, animacje wejścia i liczników, daty, partie, kolory partii, JEDNA definicja rekordu, wspólne dane (wpisy, katalog).

// Krótki komunikat na dole ekranu zamiast alert(); typ: "sukces" | "blad", znika po ~3 s
function pokazToast(tekst, typ) {
  let kontenerToastow = document.getElementById("toast-kontener");
  if (!kontenerToastow) {
    kontenerToastow = document.createElement("div");
    kontenerToastow.id = "toast-kontener";
    kontenerToastow.className = "toast-kontener";
    document.body.appendChild(kontenerToastow);
  }
  const toast = document.createElement("div");
  toast.className = "toast " + (typ === "sukces" ? "toast-sukces" : "toast-blad");
  toast.setAttribute("role", typ === "sukces" ? "status" : "alert");
  toast.textContent = tekst;
  kontenerToastow.appendChild(toast);

  // Dwie klatki, żeby przeglądarka zdążyła narysować stan początkowy i przejście się zanimowało
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { toast.classList.add("widoczny"); });
  });
  setTimeout(function () {
    toast.classList.remove("widoczny");
    setTimeout(function () { toast.remove(); }, 300);
  }, 3000);
}

// Kaskadowe wejście elementu listy: opóźnienie rośnie z indeksem, ale tylko dla pierwszych 15 elementów
const WJAZD_KROK_S = 0.05;
const WJAZD_MAX_INDEKS = 15;
function wjazdKarty(el, indeks) {
  return wjazdZOpoznieniem(el, Math.min(indeks, WJAZD_MAX_INDEKS) * WJAZD_KROK_S);
}
function wjazdZOpoznieniem(el, sekundy) {
  el.classList.add("karta-wjazd");
  el.style.animationDelay = sekundy + "s";
  return el;
}

// Płynna zmiana licznika: odliczanie od wartości wyświetlanej do docelowej przez ~400 ms z wyhamowaniem (ease-out cubic).
// formatuj (opcjonalnie) buduje tekst z liczby, np. function (n) { return n + "/" + wszystkie; }.
// Pierwsze ustawienie elementu i prefers-reduced-motion: wartość od razu, bez animacji.
const ANIMACJA_LICZBY_MS = 400;
function animujLiczbe(element, docelowa, formatuj) {
  formatuj = formatuj || String;
  const start = element._liczbaBiezaca;
  if (element._animacjaLiczby) cancelAnimationFrame(element._animacjaLiczby);
  element._animacjaLiczby = null;

  const bezAnimacji = typeof start !== "number" || start === docelowa ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (bezAnimacji) {
    element._liczbaBiezaca = docelowa;
    element.textContent = formatuj(docelowa);
    return;
  }

  // Start liczony od znacznika pierwszej klatki (bywa wcześniejszy niż performance.now() z chwili wywołania), postęp przycięty do 0–1
  let t0 = null;
  function klatka(teraz) {
    if (t0 === null) t0 = teraz;
    const postep = Math.min(1, Math.max(0, (teraz - t0) / ANIMACJA_LICZBY_MS));
    const wyhamowanie = 1 - Math.pow(1 - postep, 3);
    element._liczbaBiezaca = Math.round(start + (docelowa - start) * wyhamowanie);
    element.textContent = formatuj(element._liczbaBiezaca);
    element._animacjaLiczby = postep < 1 ? requestAnimationFrame(klatka) : null;
  }
  element._animacjaLiczby = requestAnimationFrame(klatka);
}

// Pigułka "nowy rekord" z gwiazdką — wspólna dla Rejestru i "Rekordów osobistych"
function tagNowyRekord() {
  const tag = document.createElement("span");
  tag.className = "rekord-tag-rejestr";
  tag.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.26 6.9.86-5.1 4.62 1.4 6.86L12 17.9l-6.1 3.2 1.4-6.86-5.1-4.62 6.9-.86L12 2.5z"/></svg>nowy rekord';
  return tag;
}

// Wyśrodkowany pusty stan listy: ikona (emoji) + krótki tekst; tekst jest escapowany
function pustyStanHTML(ikona, tekst) {
  const p = document.createElement("p");
  p.className = "pusto pusto-z-ikona";
  const ikonaEl = document.createElement("span");
  ikonaEl.className = "pusto-ikona";
  ikonaEl.setAttribute("aria-hidden", "true");
  ikonaEl.textContent = ikona;
  const tekstEl = document.createElement("span");
  tekstEl.textContent = tekst;
  p.append(ikonaEl, tekstEl);
  return p.outerHTML;
}

// Stała lista partii; ćwiczenia pobierane z tabeli "cwiczenia"
const PARTIE = ["Klata", "Plecy", "Biceps", "Triceps", "Barki", "Brzuch", "Nogi", "Dupa"];
let katalog = []; // wiersze z tabeli "cwiczenia": { partia, nazwa }

function cwiczeniaDlaPartii(partia) {
  return katalog
    .filter(function (c) { return c.partia === partia; })
    .map(function (c) { return c.nazwa; })
    .sort(function (a, b) { return a.localeCompare(b, "pl"); });
}

// Wszystkie pobrane wpisy z tabeli "treningi"
const wpisy = [];

// Ustawienie dzisiejszej daty
function dzisiaj() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
// Kolorowa kropka danej partii
function kropkaPartii(partia) {
  const s = document.createElement("span");
  s.className = "dot dot-" + partia;
  return s;
}

// ===== Rekordy: JEDNA definicja dla całej apki =====
// Rekord ćwiczenia = pojedyncza seria z najwyższym wynikiem ciężar × powtórzenia w całej historii tego ćwiczenia.
function wynikSerii(p) {
  return (Number(p["cieżar"]) || 0) * (Number(p.powtorzenia) || 0);
}

// Jedyna funkcja licząca rekordy: { [cwiczenie]: { cwiczenie, partia, ciezar, powtorzenia, wynik, data } }.
// Przy remisie rekordem jest seria zrobiona najwcześniej (pierwsza, która osiągnęła ten wynik).
function obliczRekordy() {
  const rekordy = {};
  wpisy.forEach(function (w) {
    (w.podejscia || []).forEach(function (p) {
      const wynik = wynikSerii(p);
      if (wynik <= 0) return;
      const r = rekordy[w.cwiczenie];
      if (!r || wynik > r.wynik || (wynik === r.wynik && w.data < r.data)) {
        rekordy[w.cwiczenie] = {
          cwiczenie: w.cwiczenie, partia: w.partia, data: w.data, wynik: wynik,
          ciezar: Number(p["cieżar"]) || 0, powtorzenia: Number(p.powtorzenia) || 0
        };
      }
    });
  });
  return rekordy;
}

// Seria z wpisu, która wyrównuje rekord swojego ćwiczenia (null, gdy wpis nie zawiera rekordu)
function seriaRekordowaWpisu(w, rekordy) {
  const r = rekordy[w.cwiczenie];
  if (!r) return null;
  return (w.podejscia || []).find(function (p) { return wynikSerii(p) === r.wynik; }) || null;
}
function czyWpisMaRekord(w, rekordy) {
  return !!seriaRekordowaWpisu(w, rekordy);
}

const REJESTR_DNI_SKROT = ["Ndz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
const IKONA_GWIAZDKA_REKORD =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>';

// "Czw, 24 wrz" (z rokiem, gdy inny niż bieżący)
function formatDatyRejestru(d) {
  const data = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return REJESTR_DNI_SKROT[data.getDay()] + ", " + data.getDate() + " " + MIESIACE_SKROT[data.getMonth()] +
    (data.getFullYear() !== new Date().getFullYear() ? " " + data.getFullYear() : "");
}
function formatKg(n) {
  return String(n).replace(".", ",");
}
function opisSerii(podejscia) {
  return (podejscia || []).map(function (p) { return formatKg(Number(p["cieżar"]) || 0) + "×" + (Number(p.powtorzenia) || 0); }).join(", ");
}

// Kolor partii ze wspólnej mapy --partia-* (Klata → var(--partia-klata))
function kolorPartiiCSS(partia) {
  return "var(--partia-" + partia.toLowerCase() + ")";
}
const IKONA_KOSZ_KATALOG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function odmianaLiczby(n, jeden, kilka, wiele) {
  if (n === 1) return jeden;
  const r10 = n % 10;
  const r100 = n % 100;
  return r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14) ? kilka : wiele;
}

// Poniedziałek tygodnia zawierającego podaną datę
function poniedzialekTygodnia(d) {
  const dzienTyg = d.getDay(); // 0 = niedziela ... 6 = sobota
  const offset = dzienTyg === 0 ? -6 : 1 - dzienTyg;
  const wynik = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  wynik.setHours(0, 0, 0, 0);
  return wynik;
}

// Data (obiekt Date) -> "RRRR-MM-DD" w lokalnej strefie
function isoZDaty(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const DNI_TYGODNIA_ETYKIETY = ["PN", "WT", "ŚR", "CZ", "PT", "SO", "ND"];
const DNI_TYGODNIA_PELNE = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];
const MIESIACE_DOPELNIACZ = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
];
const MIESIACE_SKROT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

// Data "YYYY-MM-DD" (czas lokalny) sprzed n dni
function dataSprzedDni(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// ----- Sztanga (styl "Kreda i żelazo") -----
// Talerze olimpijskie: waga, kolor (zmienna CSS), grubość i wysokość w jednostkach SVG. Bumpery 25–10 mają pełną wysokość,
// talerze 5 / 2,5 / 1,25 są mniejsze. Kolejność od najcięższego = kolejność zakładania od zacisku na zewnątrz.
const SZTANGA_TALERZE = [
  { kg: 25, kolor: "var(--talerz-25)", w: 15, h: 120 },
  { kg: 20, kolor: "var(--talerz-20)", w: 13, h: 120 },
  { kg: 15, kolor: "var(--talerz-15)", w: 11, h: 120 },
  { kg: 10, kolor: "var(--talerz-10)", w: 9, h: 120 },
  { kg: 5, kolor: "var(--talerz-5)", w: 8, h: 70 },
  { kg: 2.5, kolor: "var(--talerz-25)", w: 6, h: 54 },
  { kg: 1.25, kolor: "var(--tekst-3)", w: 5, h: 44 }
];
const SZTANGA_GRYF_KG = 20;

// Talerze na jedną stronę dla ciężaru całkowitego (gryf 20 kg); reszta, której nie da się złożyć, w "brak"
function sztangaTalerzeNaStrone(kg) {
  let strona = Math.max(0, (kg - SZTANGA_GRYF_KG) / 2);
  const talerze = [];
  SZTANGA_TALERZE.forEach(function (t) {
    while (strona + 1e-9 >= t.kg && talerze.length < 14) {
      talerze.push(t);
      strona -= t.kg;
    }
  });
  return { talerze: talerze, brak: Math.round(strona * 100) / 100 };
}

// Opis załadunku, np. "2 × 25 + 2 × 10 na gryfie 20 kg"
function sztangaOpis(kg) {
  if (kg < SZTANGA_GRYF_KG) return kg > 0 ? "Lżej niż gryf – hantle, wyciąg albo maszyna" : "Bez obciążenia";
  const { talerze, brak } = sztangaTalerzeNaStrone(kg);
  if (!talerze.length) return "Sam gryf, 20 kg";
  const ile = new Map();
  talerze.forEach(function (t) { ile.set(t.kg, (ile.get(t.kg) || 0) + 2); });
  const czesci = Array.from(ile, function (p) { return p[1] + " × " + String(p[0]).replace(".", ","); });
  return czesci.join(" + ") + " na gryfie 20 kg" + (brak > 0 ? " (+" + String(brak * 2).replace(".", ",") + " kg reszty)" : "");
}

// SVG obciążonej sztangi; talerze symetrycznie od zacisków na zewnątrz. Szerokość viewBox dopasowana do liczby talerzy.
function sztangaSVG(kg) {
  const { talerze } = sztangaTalerzeNaStrone(kg);
  const H = 140, sr = H / 2, chwyt = 46, zacisk = 6, odstep = 2;
  const szerokoscTalerzy = talerze.reduce(function (s, t) { return s + t.w + odstep; }, 0);
  const tuleja = Math.max(60, szerokoscTalerzy + 14);
  const W = 2 * (chwyt + zacisk + tuleja) + 8;
  const cx = W / 2;
  let svg = '<svg class="sztanga" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + sztangaEsc(sztangaOpis(kg)) + '">';
  // Gryf z radełkowaniem, zaciski i tuleje
  svg += '<rect class="sztanga-gryf" x="' + (cx - chwyt) + '" y="' + (sr - 3) + '" width="' + 2 * chwyt + '" height="6" rx="1"/>';
  svg += '<path class="sztanga-radelko" d="M' + (cx - chwyt + 8) + " " + sr + "H" + (cx - 10) + "M" + (cx + 10) + " " + sr + "H" + (cx + chwyt - 8) + '"/>';
  [-1, 1].forEach(function (str) {
    const z = cx + str * chwyt;
    svg += '<rect class="sztanga-zacisk" x="' + (str < 0 ? z - zacisk : z) + '" y="' + (sr - 11) + '" width="' + zacisk + '" height="22" rx="1.5"/>';
    const t0 = z + str * zacisk;
    svg += '<rect class="sztanga-tuleja" x="' + (str < 0 ? t0 - tuleja : t0) + '" y="' + (sr - 6) + '" width="' + tuleja + '" height="12" rx="2"/>';
    let x = t0 + str * 3;
    talerze.forEach(function (t, i) {
      const lewy = str < 0 ? x - t.w : x;
      svg += '<rect class="sztanga-talerz" style="fill:' + t.kolor + ";animation-delay:" + (i * 45) + 'ms" x="' + lewy + '" y="' + (sr - t.h / 2) + '" width="' + t.w + '" height="' + t.h + '" rx="2"/>';
      x += str * (t.w + odstep);
    });
  });
  return svg + "</svg>";
}
function sztangaEsc(t) {
  return String(t).replace(/[&<>"']/g, function (z) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]; });
}
