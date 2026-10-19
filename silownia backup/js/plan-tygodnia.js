// Ekran "Plan tygodnia" / Kompas tygodnia (#widok-plan): role, cele tygodniowe, podsumowanie tygodnia.

// ===================== Widok 5: Plan tygodnia =====================

const roleLista = document.getElementById("role-lista");
const formRola = document.getElementById("form-rola");
const inputNowaRola = document.getElementById("nowa-rola");
const nowaRolaWymiary = document.getElementById("nowa-rola-wymiary");
const btnEdytujRole = document.getElementById("btn-edytuj-role");
const kompasWrap = document.getElementById("kompas-wrap");
const kompasSvg = document.getElementById("kompas-svg");
const kompasWynik = document.getElementById("kompas-wynik");
const kompasRola = document.getElementById("kompas-rola");
const kompasLegenda = document.getElementById("kompas-legenda");
const formCel = document.getElementById("form-cel");
const formCelTytul = document.getElementById("form-cel-tytul");
const inputCelTresc = document.getElementById("cel-tresc");
const inputCelPlan = document.getElementById("cel-plan");
const btnCelCalyTydzien = document.getElementById("cel-caly-tydzien");
const tydzienDataEl = document.getElementById("tydzien-data");
const btnTydzienPoprzedni = document.getElementById("tydzien-poprzedni");
const btnTydzienNastepny = document.getElementById("tydzien-nastepny");
const celeLista = document.getElementById("cele-lista");
const tydzienPodsumowanie = document.getElementById("tydzien-podsumowanie");
const tydzienPodsumowanieTekst = document.getElementById("tydzien-podsumowanie-tekst");
const tydzienProgressRing = document.getElementById("tydzien-progress-ring");
const celeTydzienPigulkaEl = document.getElementById("cele-tydzien-pigulka");
const OBWOD_PIERSCIENIA_TYGODNIA = 2 * Math.PI * 15.5;
const btnZakonczTydzien = document.getElementById("btn-zakoncz-tydzien");
const podsumowanieSzczegoly = document.getElementById("podsumowanie-tydzien-szczegoly");
const wykresTydzienBrak = document.getElementById("wykres-tydzien-brak");
const niezrealizowaneLista = document.getElementById("niezrealizowane-lista");
const btnZapiszPodsumowanie = document.getElementById("btn-zapisz-podsumowanie");
let wykresTydzienKolowy = null;
let wierszeNiezrealizowanychRoboczych = []; // { cel, input, checkbox } - stan roboczy formularza podsumowania

let role = [];  // wiersze z tabeli "role": { id, nazwa, wymiar: "cialo" | "umysl" | "duch" | "relacje" | null }
let cele = [];  // wiersze z tabeli "cele_tygodniowe" dla wybranego tygodnia: { ..., dzien: "RRRR-MM-DD" | null (cały tydzień) }
let planWybranaRolaId = null;   // rola wybrana w kompasie / chipach
let planWybranyDzien = null;    // dzień w formularzu nowego celu (null = cały tydzień)
let planEdycjaRol = false;      // "Edytuj role": zmiana wymiaru i usuwanie ról
let planNowaRolaWymiar = null;  // wymiar wybrany w formularzu nowej roli
const PLAN_WYBRANA_ROLA_KEY = "plan-wybrana-rola";

let wybranyPoniedzialek = poniedzialekTygodnia(new Date());

// Wymiary "ostrzenia piły" (Nawyk 7) z ikonami (ścieżki SVG w układzie 24×24)
const WYMIARY_ROL = [
  { klucz: "cialo", nazwa: "Ciało", ikona: '<path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10"/>' },
  { klucz: "umysl", nazwa: "Umysł", ikona: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z"/>' },
  { klucz: "duch", nazwa: "Duch", ikona: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>' },
  { klucz: "relacje", nazwa: "Relacje", ikona: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.8 3 6"/>' }
];
function wymiarRoli(klucz) {
  return WYMIARY_ROL.find(function (w) { return w.klucz === klucz; }) || null;
}
function ikonaWymiaruHTML(klucz) {
  const w = wymiarRoli(klucz);
  return w ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + w.ikona + "</svg>" : "";
}
function wybranaRola() {
  return role.find(function (r) { return r.id === planWybranaRolaId; }) || null;
}
function ustawWybranaRole(id) {
  planWybranaRolaId = id;
  try { localStorage.setItem(PLAN_WYBRANA_ROLA_KEY, String(id)); } catch (e) {}
  renderRoleListy();
  renderCeleWszystkie();
}
function celeRoli(rolaId) {
  return cele.filter(function (c) { return c.rola_id === rolaId; });
}

// ----- Kompas (SVG 300×300, kąty od góry zgodnie z ruchem wskazówek) -----
function kompasPunkt(r, kat) {
  const a = (kat - 90) * Math.PI / 180;
  return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
}
function kompasWycinek(r1, r2, od, doKata) {
  const p1 = kompasPunkt(r2, od), p2 = kompasPunkt(r2, doKata), p3 = kompasPunkt(r1, doKata), p4 = kompasPunkt(r1, od);
  const duzy = doKata - od > 180 ? 1 : 0;
  return "M" + p1.join(" ") + " A" + r2 + " " + r2 + " 0 " + duzy + " 1 " + p2.join(" ") +
    " L" + p3.join(" ") + " A" + r1 + " " + r1 + " 0 " + duzy + " 0 " + p4.join(" ") + "Z";
}
function kompasLuk(r, od, doKata) {
  const p1 = kompasPunkt(r, od), p2 = kompasPunkt(r, doKata);
  return "M" + p1.join(" ") + " A" + r + " " + r + " 0 " + (doKata - od > 180 ? 1 : 0) + " 1 " + p2.join(" ");
}
function kompasIkona(klucz, r, kat, rozmiar, klasy) {
  const w = wymiarRoli(klucz);
  if (!w) return "";
  const p = kompasPunkt(r, kat);
  const skala = rozmiar / 24;
  return '<g class="kompas-ikona ' + (klasy || "") + '" transform="translate(' + (p[0] - rozmiar / 2).toFixed(1) + " " + (p[1] - rozmiar / 2).toFixed(1) + ") scale(" + skala + ')">' + w.ikona + "</g>";
}

function renderKompas() {
  const n = role.length;
  let html = "";
  // Zewnętrzny pierścień: segment na rolę, złoty łuk = część zrealizowanych celów roli w tym tygodniu
  const przerwa = n > 1 ? 2 : 0;
  const krok = 360 / n;
  role.forEach(function (r, i) {
    const od = i * krok + przerwa / 2;
    const doKata = Math.min((i + 1) * krok - przerwa / 2, od + 359.99);
    const c = celeRoli(r.id);
    const zrobione = c.filter(function (x) { return x.zrealizowane; }).length;
    const wybrana = r.id === planWybranaRolaId;
    html += '<path class="kompas-segment' + (wybrana ? " wybrany" : "") + '" data-rola="' + r.id + '" d="' + kompasWycinek(104, 146, od, doKata) + '" tabindex="0" role="button"></path>';
    const torOd = od + 3, torDo = Math.max(torOd + 0.1, doKata - 3);
    html += '<path class="kompas-tor" d="' + kompasLuk(139, torOd, torDo) + '"/>';
    if (c.length > 0 && zrobione > 0) {
      html += '<path class="kompas-luk" d="' + kompasLuk(139, torOd, torOd + (torDo - torOd) * zrobione / c.length) + '"/>';
    }
    html += kompasIkona(r.wymiar, 120, (od + doKata) / 2, n > 6 ? 16 : 20, wybrana ? "wybrana" : "");
  });
  // Wewnętrzny pierścień: 4 wymiary, ćwiartka świeci przy choć jednym zrealizowanym celu roli o tym wymiarze
  let swiecace = 0;
  WYMIARY_ROL.forEach(function (w, i) {
    const srodek = i * 90;
    const swieci = cele.some(function (c) {
      if (!c.zrealizowane) return false;
      const r = role.find(function (x) { return x.id === c.rola_id; });
      return r && r.wymiar === w.klucz;
    });
    if (swieci) swiecace++;
    html += '<path class="kompas-cwiartka' + (swieci ? " swieci" : "") + '" d="' + kompasWycinek(64, 96, srodek - 43, srodek + 43) + '"><title>' + w.nazwa + (swieci ? " - naostrzone" : "") + "</title></path>";
    html += kompasIkona(w.klucz, 80, srodek, 14, "wymiar" + (swieci ? " swieci" : ""));
  });
  html += '<circle class="kompas-tlo-srodka" cx="150" cy="150" r="60"/>';
  kompasSvg.innerHTML = html;

  kompasSvg.querySelectorAll(".kompas-segment").forEach(function (seg) {
    const r = role.find(function (x) { return String(x.id) === seg.getAttribute("data-rola"); });
    const c = celeRoli(r.id);
    const zrobione = c.filter(function (x) { return x.zrealizowane; }).length;
    seg.setAttribute("aria-label", r.nazwa + ": " + zrobione + " z " + c.length + " celów zrealizowanych");
    seg.setAttribute("aria-pressed", r.id === planWybranaRolaId ? "true" : "false");
    seg.addEventListener("click", function () { ustawWybranaRole(r.id); });
    seg.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ustawWybranaRole(r.id); }
    });
  });

  const rola = wybranaRola();
  const c = rola ? celeRoli(rola.id) : [];
  kompasWynik.textContent = c.filter(function (x) { return x.zrealizowane; }).length + "/" + c.length;
  kompasRola.textContent = rola ? rola.nazwa : "";
  kompasLegenda.innerHTML = "";
  const b1 = document.createElement("b");
  b1.textContent = "Zewnętrzny pierścień:";
  const b2 = document.createElement("b");
  b2.textContent = "Środek:";
  kompasLegenda.append(b1, document.createTextNode(" Twoje role · złoty łuk: postęp celów. "), b2,
    document.createTextNode(" Nawyk 7 – ostrzenie piły (" + swiecace + "/4: ciało, umysł, duch, relacje)"));
}

// Przyciski wyboru wymiaru (4 wymiary + "Brak")
function budujWyborWymiaru(kontener, aktualny, poWyborze) {
  kontener.innerHTML = "";
  WYMIARY_ROL.concat([{ klucz: null, nazwa: "Brak", ikona: "" }]).forEach(function (w) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kompas-wymiar";
    btn.setAttribute("aria-pressed", (aktualny || null) === w.klucz ? "true" : "false");
    btn.innerHTML = ikonaWymiaruHTML(w.klucz);
    btn.appendChild(document.createTextNode(w.nazwa));
    btn.addEventListener("click", function () { poWyborze(w.klucz); });
    kontener.appendChild(btn);
  });
}

// Chipy ról (wybór roli) + "+" nowa rola; w trybie "Edytuj role" lista z wymiarem i koszem
function renderRoleListy() {
  roleLista.innerHTML = "";
  roleLista.classList.toggle("edycja", planEdycjaRol);
  btnEdytujRole.hidden = role.length === 0;
  btnEdytujRole.textContent = planEdycjaRol ? "Gotowe" : "Edytuj role";
  btnEdytujRole.setAttribute("aria-pressed", planEdycjaRol ? "true" : "false");

  if (planEdycjaRol) {
    role.forEach(function (r) {
      const wiersz = document.createElement("div");
      wiersz.className = "kompas-rola-edycja";
      const nazwa = document.createElement("span");
      nazwa.className = "kompas-rola-edycja-nazwa";
      nazwa.textContent = r.nazwa;
      const btnUsun = document.createElement("button");
      btnUsun.type = "button";
      btnUsun.className = "kompas-btn-kosz";
      btnUsun.setAttribute("aria-label", "Usuń rolę „" + r.nazwa + "”");
      btnUsun.innerHTML = IKONA_KOSZ_KATALOG;
      btnUsun.addEventListener("click", function () { usunRole(r, btnUsun); });
      const wymiary = document.createElement("div");
      wymiary.className = "kompas-wymiary";
      budujWyborWymiaru(wymiary, r.wymiar, function (klucz) { zmienWymiarRoli(r, klucz); });
      wiersz.append(nazwa, btnUsun, wymiary);
      roleLista.appendChild(wiersz);
    });
    return;
  }

  role.forEach(function (r) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "kompas-chip" + (r.id === planWybranaRolaId ? " aktywny" : "");
    chip.setAttribute("aria-pressed", r.id === planWybranaRolaId ? "true" : "false");
    chip.innerHTML = ikonaWymiaruHTML(r.wymiar);
    chip.appendChild(document.createTextNode(r.nazwa));
    chip.addEventListener("click", function () { ustawWybranaRole(r.id); });
    roleLista.appendChild(chip);
  });
  const nowa = document.createElement("button");
  nowa.type = "button";
  nowa.className = "kompas-chip nowa";
  nowa.setAttribute("aria-label", "Nowa rola");
  nowa.setAttribute("aria-expanded", formRola.hidden ? "false" : "true");
  nowa.textContent = role.length === 0 ? "+ Pierwsza rola" : "+";
  nowa.addEventListener("click", function () { przelaczFormularzRoli(formRola.hidden); });
  roleLista.appendChild(nowa);
}

function przelaczFormularzRoli(otworz) {
  formRola.hidden = !otworz;
  if (otworz) {
    budujWyborWymiaru(nowaRolaWymiary, planNowaRolaWymiar, function (klucz) {
      planNowaRolaWymiar = klucz;
      przelaczFormularzRoli(true);
    });
    if (document.activeElement !== inputNowaRola) inputNowaRola.focus();
  }
  const chip = roleLista.querySelector(".kompas-chip.nowa");
  if (chip) chip.setAttribute("aria-expanded", otworz ? "true" : "false");
}

btnEdytujRole.addEventListener("click", function () {
  planEdycjaRol = !planEdycjaRol;
  renderRoleListy();
});

async function zmienWymiarRoli(rola, klucz) {
  if ((rola.wymiar || null) === klucz) return;
  const { error } = await db.from("role").update({ wymiar: klucz }).eq("id", rola.id);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zmienić wymiaru roli: " + error.message, "blad");
    return;
  }
  rola.wymiar = klucz;
  renderRoleListy();
  renderCeleWszystkie();
}

// Usunięcie roli (cele roli: tak, jak zachowa się baza); po usunięciu pobieramy cele tygodnia na nowo
async function usunRole(rola, btn) {
  if (!window.confirm("Usunąć rolę „" + rola.nazwa + "”?")) return;
  btn.disabled = true;
  const { error } = await db.from("role").delete().eq("id", rola.id);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć roli: " + error.message, "blad");
    btn.disabled = false;
    return;
  }
  role = role.filter(function (r) { return r.id !== rola.id; });
  if (planWybranaRolaId === rola.id) planWybranaRolaId = role[0] ? role[0].id : null;
  if (role.length === 0) planEdycjaRol = false;
  renderRoleListy();
  wczytajCeleDlaTygodnia();
}

// Zakres tygodnia przy strzałkach, np. "28 wrz – 4 paź"
function renderTydzienEtykieta() {
  const pon = wybranyPoniedzialek;
  const nd = new Date(pon.getFullYear(), pon.getMonth(), pon.getDate() + 6);
  tydzienDataEl.textContent = (pon.getMonth() === nd.getMonth()
    ? pon.getDate() + " – " + nd.getDate() + " " + MIESIACE_SKROT[nd.getMonth()]
    : pon.getDate() + " " + MIESIACE_SKROT[pon.getMonth()] + " – " + nd.getDate() + " " + MIESIACE_SKROT[nd.getMonth()]) +
    (nd.getFullYear() !== new Date().getFullYear() ? " " + nd.getFullYear() : "");
}

// Pigułka w panelu bocznym obok "Plan tygodnia": X/Y celów zrealizowanych w BIEŻĄCYM (dzisiejszym) tygodniu,
// niezależnie od tygodnia aktualnie przeglądanego strzałkami. Gdy przeglądany tydzień to nie bieżący tydzień,
// pigułka zostaje bez zmian (nie dotyczy przeglądanych tygodni).
function renderCeleTydzienPigulkaBocznej() {
  if (isoZDaty(wybranyPoniedzialek) !== isoZDaty(poniedzialekTygodnia(new Date()))) return;
  const wszystkie = cele.length;
  if (wszystkie === 0) {
    celeTydzienPigulkaEl.hidden = true;
    return;
  }
  const zrealizowane = cele.filter(function (c) { return c.zrealizowane; }).length;
  celeTydzienPigulkaEl.textContent = zrealizowane + "/" + wszystkie;
  celeTydzienPigulkaEl.classList.toggle("pigulka-kompletna", zrealizowane === wszystkie);
  celeTydzienPigulkaEl.hidden = false;
}

// Pigułka podsumowania: ile celów (ze wszystkich ról) zrealizowano w wybranym tygodniu
function renderPodsumowanieTygodnia() {
  const wszystkie = cele.length;
  if (wszystkie === 0) {
    tydzienPodsumowanie.hidden = true;
    renderCeleTydzienPigulkaBocznej();
    return;
  }
  const zrealizowane = cele.filter(function (c) { return c.zrealizowane; }).length;
  tydzienPodsumowanieTekst.textContent =
    "Ten tydzień: " + zrealizowane + " z " + wszystkie + " celów zrealizowanych";
  const udzial = zrealizowane / wszystkie;
  tydzienProgressRing.style.strokeDasharray = String(OBWOD_PIERSCIENIA_TYGODNIA);
  tydzienProgressRing.style.strokeDashoffset = String(OBWOD_PIERSCIENIA_TYGODNIA * (1 - udzial));
  tydzienPodsumowanie.hidden = false;
  renderCeleTydzienPigulkaBocznej();
}

const IKONA_PTASZEK_CEL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// Cel: checkbox zrealizowania (przelaczCel), treść kursywą, plan "Jak?", kosz (usunCel z potwierdzeniem)
function budujCelKompasu(c) {
  const wiersz = document.createElement("div");
  wiersz.className = "kompas-cel" + (c.zrealizowane ? " zrealizowany" : "");
  const check = document.createElement("label");
  check.className = "kompas-cel-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!c.zrealizowane;
  checkbox.setAttribute("aria-label", "Zrealizowany: " + c.tresc);
  checkbox.addEventListener("change", function () { przelaczCel(c, checkbox, wiersz); });
  const wizualny = document.createElement("span");
  wizualny.innerHTML = IKONA_PTASZEK_CEL;
  check.append(checkbox, wizualny);

  const tresc = document.createElement("div");
  tresc.className = "kompas-cel-tresc";
  const glowna = document.createElement("span");
  glowna.className = "kompas-cel-glowna";
  glowna.textContent = c.tresc;
  tresc.appendChild(glowna);
  if (c.plan) {
    const plan = document.createElement("span");
    plan.className = "kompas-cel-plan";
    plan.textContent = c.plan;
    tresc.appendChild(plan);
  }
  const btnUsun = document.createElement("button");
  btnUsun.type = "button";
  btnUsun.className = "kompas-btn-kosz";
  btnUsun.setAttribute("aria-label", "Usuń cel „" + c.tresc + "”");
  btnUsun.innerHTML = IKONA_KOSZ_KATALOG;
  btnUsun.addEventListener("click", function () { usunCel(c, btnUsun); });
  wiersz.append(check, tresc, btnUsun);
  return wiersz;
}

function formatDzienFormularza(d) {
  const data = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return DNI_TYGODNIA_PELNE[(data.getDay() + 6) % 7] + ", " + data.getDate() + " " + MIESIACE_SKROT[data.getMonth()];
}
// Tytuł formularza "Nowy cel · [rola] · [dzień albo cały tydzień]"
function renderFormularzCelu() {
  const rola = wybranaRola();
  formCel.hidden = !rola;
  if (!rola) return;
  formCelTytul.innerHTML = "";
  const b1 = document.createElement("b");
  b1.textContent = rola.nazwa;
  const b2 = document.createElement("b");
  b2.textContent = planWybranyDzien ? formatDzienFormularza(planWybranyDzien) : "cały tydzień";
  formCelTytul.append(document.createTextNode("Nowy cel · "), b1, document.createTextNode(" · "), b2);
  btnCelCalyTydzien.setAttribute("aria-pressed", planWybranyDzien ? "false" : "true");
}
btnCelCalyTydzien.addEventListener("click", function () {
  planWybranyDzien = null;
  renderCeleWszystkie();
});

// Render całego ekranu dla wybranej roli: kompas, "Tydzień roli" (cały tydzień + 7 dni), formularz celu
function renderCeleWszystkie() {
  renderTydzienEtykieta();
  renderPodsumowanieTygodnia();
  celeLista.innerHTML = "";

  if (role.length === 0) {
    kompasWrap.hidden = true;
    formCel.hidden = true;
    celeLista.innerHTML = pustyStanHTML("🧭", "Nie masz jeszcze ról - dodaj pierwszą (np. Pracownik, Rodzic, Sportowiec) przyciskiem „+ Pierwsza rola” powyżej.");
    return;
  }
  if (!wybranaRola()) planWybranaRolaId = role[0].id;
  const dniTygodnia = [];
  for (let i = 0; i < 7; i++) {
    dniTygodnia.push(isoZDaty(new Date(wybranyPoniedzialek.getFullYear(), wybranyPoniedzialek.getMonth(), wybranyPoniedzialek.getDate() + i)));
  }
  if (planWybranyDzien && dniTygodnia.indexOf(planWybranyDzien) === -1) planWybranyDzien = null;

  kompasWrap.hidden = false;
  renderKompas();

  const rola = wybranaRola();
  const celeWybranej = celeRoli(rola.id);
  const blok = document.createElement("section");
  blok.className = "kompas-tydzien-roli";
  const etykieta = document.createElement("span");
  etykieta.className = "kompas-etykieta";
  etykieta.textContent = "Tydzień roli";
  const nazwa = document.createElement("h3");
  nazwa.className = "kompas-tydzien-rola";
  nazwa.textContent = rola.nazwa;
  blok.append(etykieta, nazwa);

  // Cele bez dnia (na cały tydzień) albo z datą spoza tygodnia
  const naCalyTydzien = celeWybranej.filter(function (c) { return !c.dzien || dniTygodnia.indexOf(c.dzien) === -1; });
  if (naCalyTydzien.length > 0) {
    const caly = document.createElement("div");
    caly.className = "kompas-blok";
    const tytul = document.createElement("span");
    tytul.className = "kompas-blok-tytul";
    tytul.textContent = "Na cały tydzień";
    caly.appendChild(tytul);
    naCalyTydzien.forEach(function (c) { caly.appendChild(budujCelKompasu(c)); });
    blok.appendChild(caly);
  }

  const dzis = dzisiaj();
  const lista = document.createElement("ol");
  lista.className = "kompas-dni";
  dniTygodnia.forEach(function (d, i) {
    const li = document.createElement("li");
    li.className = "kompas-dzien" + (d === dzis ? " dzis" : "");
    const naglowek = document.createElement("div");
    naglowek.className = "kompas-dzien-naglowek";
    const skrot = document.createElement("span");
    skrot.className = "kompas-dzien-skrot";
    skrot.textContent = DNI_TYGODNIA_ETYKIETY[i];
    const numer = document.createElement("span");
    numer.className = "kompas-dzien-numer";
    numer.textContent = String(+d.slice(8, 10));
    const btnDodaj = document.createElement("button");
    btnDodaj.type = "button";
    const wybrany = planWybranyDzien === d;
    btnDodaj.className = "kompas-btn-dodaj" + (wybrany ? " wybrany" : "");
    btnDodaj.textContent = wybrany ? "✓ wybrany dzień" : "+ dodaj";
    btnDodaj.setAttribute("aria-label", (wybrany ? "Wybrany dzień: " : "Dodaj cel na ") + formatDzienFormularza(d));
    btnDodaj.addEventListener("click", function () {
      planWybranyDzien = d;
      renderCeleWszystkie();
      formCel.scrollIntoView({ behavior: "smooth", block: "center" });
      inputCelTresc.focus({ preventScroll: true });
    });
    naglowek.append(skrot, numer, btnDodaj);
    li.appendChild(naglowek);
    celeWybranej.filter(function (c) { return c.dzien === d; }).forEach(function (c) { li.appendChild(budujCelKompasu(c)); });
    lista.appendChild(wjazdKarty(li, i));
  });
  blok.appendChild(lista);
  celeLista.appendChild(blok);
  renderFormularzCelu();
}

// Wykres kołowy: ile celów w tygodniu zrealizowano, a ile nie
function renderWykresTygodniaKolowy() {
  const canvas = document.getElementById("wykres-tydzien-kolowy");
  const wszystkie = cele.length;
  const zrealizowane = cele.filter(function (c) { return c.zrealizowane; }).length;

  if (wszystkie === 0) {
    wykresTydzienBrak.hidden = false;
    canvas.hidden = true;
    if (wykresTydzienKolowy) { wykresTydzienKolowy.destroy(); wykresTydzienKolowy = null; }
    return;
  }

  wykresTydzienBrak.hidden = true;
  canvas.hidden = false;

  if (wykresTydzienKolowy) wykresTydzienKolowy.destroy();
  wykresTydzienKolowy = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Zrealizowane", "Niezrealizowane"],
      datasets: [{
        data: [zrealizowane, wszystkie - zrealizowane],
        backgroundColor: ["#D6D0C0", "oklch(0.24 0.01 245)"],
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { position: "bottom", labels: { color: "oklch(0.85 0.005 240)" } } }
    }
  });
}

// Lista niezrealizowanych celów: pole "co Cię zatrzymało" + przełącznik przeniesienia na kolejny tydzień
function renderNiezrealizowaneLista() {
  niezrealizowaneLista.innerHTML = "";
  wierszeNiezrealizowanychRoboczych = [];
  const niezrealizowane = cele.filter(function (c) { return !c.zrealizowane; });

  if (niezrealizowane.length === 0) {
    niezrealizowaneLista.innerHTML = pustyStanHTML("🎉", "Wszystkie cele w tym tygodniu zrealizowane!");
    btnZapiszPodsumowanie.hidden = true;
    return;
  }
  btnZapiszPodsumowanie.hidden = false;
  btnZapiszPodsumowanie.textContent = "Zapisz podsumowanie";

  const naglowek = document.createElement("h4");
  naglowek.className = "przeszkoda-naglowek";
  naglowek.textContent = "Co Cię zatrzymało?";
  niezrealizowaneLista.appendChild(naglowek);

  niezrealizowane.forEach(function (c) {
    const rola = role.find(function (r) { return r.id === c.rola_id; });

    const wiersz = document.createElement("div");
    wiersz.className = "przeszkoda-wiersz";

    const tytul = document.createElement("div");
    tytul.className = "przeszkoda-tytul";
    tytul.textContent = (rola ? rola.nazwa + " — " : "") + c.tresc;
    wiersz.appendChild(tytul);

    const formularz = document.createElement("div");
    formularz.className = "przeszkoda-form";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Co Cię zatrzymało?";
    input.autocomplete = "off";
    input.value = c.powod || "";
    formularz.appendChild(input);

    wiersz.appendChild(formularz);

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "przeszkoda-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const toggleTekst = document.createElement("span");
    toggleTekst.textContent = "Przenieś na następny tydzień";
    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(toggleTekst);
    wiersz.appendChild(toggleLabel);

    niezrealizowaneLista.appendChild(wiersz);
    wierszeNiezrealizowanychRoboczych.push({ cel: c, input: input, checkbox: checkbox });
  });
}

function renderPodsumowanieSzczegoly() {
  renderWykresTygodniaKolowy();
  renderNiezrealizowaneLista();
}

// Zbiorczy zapis podsumowania tygodnia:
// - dla każdego niezrealizowanego celu zapisuje powód (kolumna "powod") do jego wiersza (historia zostaje)
// - dla celów zaznaczonych do przeniesienia tworzy NOWY wiersz na kolejny tydzień (bez powodu),
//   stary wiersz pozostaje bez zmian poza zapisanym powodem
async function zapiszPodsumowanieTygodnia() {
  if (wierszeNiezrealizowanychRoboczych.length === 0) return;

  btnZapiszPodsumowanie.disabled = true;

  const nastepnyPoniedzialek = new Date(
    wybranyPoniedzialek.getFullYear(), wybranyPoniedzialek.getMonth(), wybranyPoniedzialek.getDate() + 7
  );
  const nowyTydzienStart = isoZDaty(nastepnyPoniedzialek);

  for (const wpis of wierszeNiezrealizowanychRoboczych) {
    const cel = wpis.cel;
    const powod = wpis.input.value.trim();

    if (powod !== (cel.powod || "")) {
      const { error } = await db
        .from("cele_tygodniowe")
        .update({ powod: powod || null })
        .eq("id", cel.id);

      if (error) {
        console.error(error);
        pokazToast('Nie udało się zapisać powodu dla celu „' + cel.tresc + '": ' + error.message, "blad");
        btnZapiszPodsumowanie.disabled = false;
        return;
      }
      cel.powod = powod || null;
    }

    if (wpis.checkbox.checked) {
      const { error: bladPrzeniesienia } = await db
        .from("cele_tygodniowe")
        .insert({
          rola_id: cel.rola_id,
          tydzien_start: nowyTydzienStart,
          dzien: cel.dzien ? isoZDaty(new Date(+cel.dzien.slice(0, 4), +cel.dzien.slice(5, 7) - 1, +cel.dzien.slice(8, 10) + 7)) : null,
          tresc: cel.tresc,
          plan: cel.plan || null,
          zrealizowane: false,
          powod: null,
          user_id: sesjaUzytkownika.user.id
        });

      if (bladPrzeniesienia) {
        console.error(bladPrzeniesienia);
        pokazToast('Nie udało się przenieść celu „' + cel.tresc + '" na następny tydzień: ' + bladPrzeniesienia.message, "blad");
        btnZapiszPodsumowanie.disabled = false;
        return;
      }
    }
  }

  btnZapiszPodsumowanie.disabled = false;
  renderNiezrealizowaneLista();
  if (!btnZapiszPodsumowanie.hidden) {
    btnZapiszPodsumowanie.textContent = "Zapisano ✓";
    setTimeout(function () {
      if (!btnZapiszPodsumowanie.hidden) btnZapiszPodsumowanie.textContent = "Zapisz podsumowanie";
    }, 1500);
  }
}

btnZapiszPodsumowanie.addEventListener("click", zapiszPodsumowanieTygodnia);

// Przełącznik panelu "Zakończ tydzień"
btnZakonczTydzien.addEventListener("click", function () {
  const otwarte = !podsumowanieSzczegoly.hidden;
  if (otwarte) {
    podsumowanieSzczegoly.hidden = true;
    btnZakonczTydzien.textContent = "Zakończ tydzień";
  } else {
    renderPodsumowanieSzczegoly();
    podsumowanieSzczegoly.hidden = false;
    btnZakonczTydzien.textContent = "Ukryj podsumowanie tygodnia";
  }
});

// Aktualizacja pola "zrealizowane" po kliknięciu checkboxa
async function przelaczCel(cel, checkbox, wiersz) {
  const nowaWartosc = checkbox.checked;
  checkbox.disabled = true;

  const { error } = await db
    .from("cele_tygodniowe")
    .update({ zrealizowane: nowaWartosc })
    .eq("id", cel.id);

  checkbox.disabled = false;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zaktualizować celu: " + error.message, "blad");
    checkbox.checked = !nowaWartosc;
    return;
  }

  cel.zrealizowane = nowaWartosc;
  wiersz.classList.toggle("zrealizowany", nowaWartosc);
  renderPodsumowanieTygodnia();
  renderKompas();
  if (!podsumowanieSzczegoly.hidden) renderPodsumowanieSzczegoly();
}

// Usunięcie pojedynczego celu z tabeli "cele_tygodniowe"
async function usunCel(cel, btn) {
  const potwierdzenie = window.confirm('Usunąć cel „' + cel.tresc + '"?');
  if (!potwierdzenie) return;

  btn.disabled = true;

  const { error } = await db
    .from("cele_tygodniowe")
    .delete()
    .eq("id", cel.id);

  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć celu: " + error.message, "blad");
    btn.disabled = false;
    return;
  }

  cele = cele.filter(function (c) { return c.id !== cel.id; });
  renderCeleWszystkie();
  if (!podsumowanieSzczegoly.hidden) renderPodsumowanieSzczegoly();
}

// Dodanie nowego celu dla danej roli na aktualnie wybrany tydzień (dzien = wybrany dzień albo null = cały tydzień)
async function dodajCel(rola, input, inputPlan, btn, dzien) {
  const tresc = input.value.trim();
  if (!tresc) return;
  const plan = inputPlan.value.trim();

  btn.disabled = true;

  const { data, error } = await db
    .from("cele_tygodniowe")
    .insert({
      rola_id: rola.id,
      tydzien_start: isoZDaty(wybranyPoniedzialek),
      dzien: dzien || null,
      tresc: tresc,
      plan: plan || null,
      zrealizowane: false,
      user_id: sesjaUzytkownika.user.id
    })
    .select();

  btn.disabled = false;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać celu: " + error.message, "blad");
    return;
  }

  cele.push(data && data[0] ? data[0] : {
    id: Date.now(), rola_id: rola.id,
    tydzien_start: isoZDaty(wybranyPoniedzialek), dzien: dzien || null, tresc: tresc, plan: plan || null, zrealizowane: false
  });
  input.value = "";
  inputPlan.value = "";
  renderCeleWszystkie();
  if (!podsumowanieSzczegoly.hidden) renderPodsumowanieSzczegoly();
}

// Pobranie ról z tabeli "role"
async function wczytajRole() {
  const { data, error } = await db
    .from("role")
    .select("*")
    .order("nazwa", { ascending: true });

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać ról: " + error.message, "blad");
    return;
  }
  role = data || [];

  let zapisana = null;
  try { zapisana = localStorage.getItem(PLAN_WYBRANA_ROLA_KEY); } catch (e) {}
  const rolaZapisana = role.find(function (r) { return String(r.id) === zapisana; });
  planWybranaRolaId = rolaZapisana ? rolaZapisana.id : (role[0] ? role[0].id : null);

  renderRoleListy();
  renderCeleWszystkie();
  if (role.length === 0) przelaczFormularzRoli(false);
}

// Pobranie celów tygodniowych dla wybranego tygodnia (wszystkie role naraz)
async function wczytajCeleDlaTygodnia() {
  const { data, error } = await db
    .from("cele_tygodniowe")
    .select("*")
    .eq("tydzien_start", isoZDaty(wybranyPoniedzialek));

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać celów tygodniowych: " + error.message, "blad");
    return;
  }
  cele = data || [];
  renderCeleWszystkie();
  if (!podsumowanieSzczegoly.hidden) renderPodsumowanieSzczegoly();
}

// Formularz dodawania nowej roli
formRola.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nazwa = inputNowaRola.value.trim();
  if (!nazwa) return;

  const btn = formRola.querySelector(".kompas-btn-glowny");
  btn.disabled = true;

  const { data, error } = await db
    .from("role")
    .insert({ nazwa: nazwa, wymiar: planNowaRolaWymiar, user_id: sesjaUzytkownika.user.id })
    .select();

  btn.disabled = false;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać roli: " + error.message, "blad");
    return;
  }

  const nowaRola = data && data[0] ? data[0] : { id: Date.now(), nazwa: nazwa, wymiar: planNowaRolaWymiar };
  role.push(nowaRola);
  formRola.reset();
  planNowaRolaWymiar = null;
  przelaczFormularzRoli(false);
  ustawWybranaRole(nowaRola.id);
  pokazToast("Dodano rolę „" + nazwa + "”", "sukces");
});

// Formularz nowego celu wybranej roli ("Wpisz w tydzień")
formCel.addEventListener("submit", function (e) {
  e.preventDefault();
  const rola = wybranaRola();
  if (!rola) return;
  dodajCel(rola, inputCelTresc, inputCelPlan, formCel.querySelector(".kompas-btn-glowny"), planWybranyDzien);
});

// Nawigacja: poprzedni / następny tydzień
btnTydzienPoprzedni.addEventListener("click", function () {
  wybranyPoniedzialek = new Date(
    wybranyPoniedzialek.getFullYear(), wybranyPoniedzialek.getMonth(), wybranyPoniedzialek.getDate() - 7
  );
  wczytajCeleDlaTygodnia();
});
btnTydzienNastepny.addEventListener("click", function () {
  wybranyPoniedzialek = new Date(
    wybranyPoniedzialek.getFullYear(), wybranyPoniedzialek.getMonth(), wybranyPoniedzialek.getDate() + 7
  );
  wczytajCeleDlaTygodnia();
});
