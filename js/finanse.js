// Finanse → Oszczędności: tygodniowe budżety na kategorie (tabela budzety), wydatki dzień po dniu (tabela wydatki)
// i suma zaoszczędzona od początku (widok oszczednosci, tylko odczyt). Tylko konta z FINANSE_DOSTEP_IDS (dostęp ustawia start.js).
// Zapytania: budżety i wydatki tylko oglądanego tygodnia + jedno o sumę ogólną + jedno o najwcześniejszy tydzień.

const navFinanse = document.getElementById("nav-finanse");
const menuRozdzialFinanse = document.getElementById("menu-rozdzial-finanse");

let finDostep = false;
let finTydzienOd = null;        // "RRRR-MM-DD" – poniedziałek oglądanego tygodnia
let finNajwczesniejszy = null;  // najwcześniejszy tydzien_od z budzety (null = brak danych)
let finBudzety = [];            // [{ kategoria, kwota }] oglądanego tygodnia
let finWydatki = [];            // [{ id, data, kategoria, kwota, opis }] oglądanego tygodnia
let finSumaOgolna = null;       // suma zaoszczedzone ze wszystkich tygodni
let finWczytane = false;
let finZapytanieNr = 0;         // chroni przed spóźnioną odpowiedzią po szybkim przełączaniu tygodni

function ustawDostepFinansow(dostep) {
  finDostep = dostep;
  menuRozdzialFinanse.hidden = !dostep;
  if (!dostep) {
    finTydzienOd = null;
    finNajwczesniejszy = null;
    finBudzety = [];
    finWydatki = [];
    finSumaOgolna = null;
    finWczytane = false;
    if (navFinanse.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
    }
  }
}

// ----- Pomocnicze -----
function finUid() {
  return sesjaUzytkownika && sesjaUzytkownika.user ? sesjaUzytkownika.user.id : null;
}

function finBiezacyTydzien() {
  return isoZDaty(poniedzialekTygodnia(new Date()));
}

function finDataZIso(iso) {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

function finPrzesunDni(iso, dni) {
  const d = finDataZIso(iso);
  return isoZDaty(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dni));
}

// Kwota z pola: przecinek albo kropka, spacje ignorowane, zaokrąglenie do 2 miejsc; null dla pustej, błędnej lub ujemnej
function finParsujKwote(tekst) {
  const t = String(tekst == null ? "" : tekst).replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function finZl(n) {
  return (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function finZakresTygodnia(od) {
  const p = finDataZIso(od);
  const n = finDataZIso(finPrzesunDni(od, 6));
  const dzienMies = function (d) { return d.getDate() + " " + MIESIACE_SKROT[d.getMonth()]; };
  return dzienMies(p) + " – " + dzienMies(n) + " " + n.getFullYear();
}

function finWydanoKategorii(kategoria) {
  return finWydatki
    .filter(function (w) { return w.kategoria === kategoria; })
    .reduce(function (s, w) { return s + (Number(w.kwota) || 0); }, 0);
}

function finSuma(lista) {
  return lista.reduce(function (s, x) { return s + (Number(x.kwota) || 0); }, 0);
}

// ----- Wczytywanie -----
// Wejście na ekran: przy pierwszym wejściu bieżący tydzień + najwcześniejszy tydzień + suma ogólna
function finWejscie() {
  if (!finDostep || finWczytane) return;
  finWczytane = true;
  finTydzienOd = finBiezacyTydzien();
  renderFinanse();
  wczytajNajwczesniejszyTydzien();
  wczytajSumeOszczednosci();
  wczytajTydzienFinansow(finTydzienOd);
}

async function wczytajNajwczesniejszyTydzien() {
  const { data, error } = await db
    .from("budzety")
    .select("tydzien_od")
    .eq("user_id", finUid())
    .order("tydzien_od", { ascending: true })
    .limit(1);
  if (error) {
    console.error(error);
    return;
  }
  const z = data && data[0] ? data[0].tydzien_od : null;
  if (z && (!finNajwczesniejszy || z < finNajwczesniejszy)) finNajwczesniejszy = z;
  renderFinNawigacje();
}

async function wczytajSumeOszczednosci() {
  const { data, error } = await db.from("oszczednosci").select("zaoszczedzone");
  if (error) {
    console.error(error);
    return;
  }
  finSumaOgolna = (data || []).reduce(function (s, r) { return s + (Number(r.zaoszczedzone) || 0); }, 0);
  renderFinSumaOgolna();
}

async function wczytajTydzienFinansow(od) {
  const nr = ++finZapytanieNr;
  const uid = finUid();
  const nd = finPrzesunDni(od, 6);
  const [budz, wyd] = await Promise.all([
    db.from("budzety").select("kategoria, kwota").eq("user_id", uid).eq("tydzien_od", od),
    db.from("wydatki").select("id, data, kategoria, kwota, opis").eq("user_id", uid)
      .gte("data", od).lte("data", nd).order("id", { ascending: true })
  ]);
  if (nr !== finZapytanieNr) return;
  if (budz.error || wyd.error) {
    console.error(budz.error || wyd.error);
    pokazToast("Nie udało się wczytać finansów.", "blad");
    return;
  }
  let budzety = budz.data || [];
  if (!budzety.length) {
    budzety = await finSkopiujBudzety(od);
    if (nr !== finZapytanieNr) return;
  }
  finBudzety = budzety.sort(function (a, b) { return a.kategoria.localeCompare(b.kategoria, "pl"); });
  finWydatki = wyd.data || [];
  renderFinanse();
}

// Tydzień bez budżetów: kopia z ostatniego wcześniejszego tygodnia, który je ma, zapisana dla tego tygodnia
async function finSkopiujBudzety(od) {
  const uid = finUid();
  const ostatni = await db
    .from("budzety")
    .select("tydzien_od")
    .eq("user_id", uid)
    .lt("tydzien_od", od)
    .order("tydzien_od", { ascending: false })
    .limit(1);
  if (ostatni.error || !ostatni.data || !ostatni.data.length) {
    if (ostatni.error) console.error(ostatni.error);
    return [];
  }
  const zrodlo = await db
    .from("budzety")
    .select("kategoria, kwota")
    .eq("user_id", uid)
    .eq("tydzien_od", ostatni.data[0].tydzien_od);
  if (zrodlo.error || !zrodlo.data || !zrodlo.data.length) {
    if (zrodlo.error) console.error(zrodlo.error);
    return [];
  }
  const wiersze = zrodlo.data.map(function (b) { return { tydzien_od: od, kategoria: b.kategoria, kwota: b.kwota }; });
  const { error } = await db.from("budzety").upsert(wiersze, { onConflict: "user_id,tydzien_od,kategoria" });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się skopiować budżetów z poprzedniego tygodnia.", "blad");
    return [];
  }
  pokazToast("Skopiowano budżety z poprzedniego tygodnia.", "sukces");
  wczytajSumeOszczednosci();
  return zrodlo.data.map(function (b) { return { kategoria: b.kategoria, kwota: b.kwota }; });
}

// ----- Zapis -----
async function finZapiszBudzet(kategoria, kwota) {
  const od = finTydzienOd;
  const { error } = await db
    .from("budzety")
    .upsert({ tydzien_od: od, kategoria: kategoria, kwota: kwota }, { onConflict: "user_id,tydzien_od,kategoria" });
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać budżetu.", "blad");
    return false;
  }
  if (od !== finTydzienOd) return true;
  const istniejacy = finBudzety.find(function (b) { return b.kategoria === kategoria; });
  if (istniejacy) istniejacy.kwota = kwota;
  else {
    finBudzety.push({ kategoria: kategoria, kwota: kwota });
    finBudzety.sort(function (a, b) { return a.kategoria.localeCompare(b.kategoria, "pl"); });
  }
  if (!finNajwczesniejszy || od < finNajwczesniejszy) finNajwczesniejszy = od;
  renderFinanse();
  wczytajSumeOszczednosci();
  return true;
}

async function finUsunBudzet(kategoria) {
  if (!window.confirm("Usunąć kategorię „" + kategoria + "” z budżetu tego tygodnia?")) return;
  const od = finTydzienOd;
  const { error } = await db
    .from("budzety")
    .delete()
    .eq("user_id", finUid())
    .eq("tydzien_od", od)
    .eq("kategoria", kategoria);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć kategorii.", "blad");
    return;
  }
  if (od === finTydzienOd) {
    finBudzety = finBudzety.filter(function (b) { return b.kategoria !== kategoria; });
    renderFinanse();
  }
  pokazToast("Usunięto kategorię.", "sukces");
  wczytajSumeOszczednosci();
}

async function finDodajWydatek(data, kwota, kategoria, opis) {
  const { data: wynik, error } = await db
    .from("wydatki")
    .insert({ data: data, kategoria: kategoria, kwota: kwota, opis: opis || null })
    .select("id, data, kategoria, kwota, opis")
    .single();
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać wydatku.", "blad");
    return false;
  }
  if (data >= finTydzienOd && data <= finPrzesunDni(finTydzienOd, 6)) {
    finWydatki.push(wynik);
    renderFinanse();
  }
  pokazToast("Zapisano wydatek.", "sukces");
  wczytajSumeOszczednosci();
  return true;
}

async function finUsunWydatek(w) {
  if (!window.confirm("Usunąć wydatek " + finZl(w.kwota) + (w.opis ? " („" + w.opis + "”)" : "") + "?")) return;
  const { error } = await db.from("wydatki").delete().eq("id", w.id);
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć wydatku.", "blad");
    return;
  }
  finWydatki = finWydatki.filter(function (x) { return x.id !== w.id; });
  renderFinanse();
  pokazToast("Usunięto wydatek.", "sukces");
  wczytajSumeOszczednosci();
}

// ----- Rysowanie -----
function renderFinanse() {
  if (!finTydzienOd) return;
  renderFinNawigacje();
  renderFinBudzety();
  renderFinDni();
  renderFinPodsumowanieTygodnia();
  renderFinSumaOgolna();
}

function renderFinNawigacje() {
  if (!finTydzienOd) return;
  document.getElementById("fin-tydzien-data").textContent = finZakresTygodnia(finTydzienOd);
  const najwczesniejszy = finNajwczesniejszy && finNajwczesniejszy < finBiezacyTydzien() ? finNajwczesniejszy : finBiezacyTydzien();
  document.getElementById("fin-tydzien-poprzedni").disabled = finTydzienOd <= najwczesniejszy;
  document.getElementById("fin-tydzien-nastepny").disabled = finTydzienOd >= finBiezacyTydzien();
}

function renderFinBudzety() {
  const lista = document.getElementById("fin-budzety-lista");
  lista.innerHTML = "";
  if (!finBudzety.length) {
    lista.innerHTML = pustyStanHTML("💰", "Brak budżetów w tym tygodniu. Dodaj pierwszą kategorię.");
    return;
  }
  finBudzety.forEach(function (b) {
    const wydano = finWydanoKategorii(b.kategoria);
    const zostalo = (Number(b.kwota) || 0) - wydano;

    const wiersz = document.createElement("div");
    wiersz.className = "fin-budzet";

    const gora = document.createElement("div");
    gora.className = "fin-budzet-gora";
    const nazwa = document.createElement("span");
    nazwa.className = "fin-budzet-nazwa";
    nazwa.textContent = b.kategoria;

    const pole = document.createElement("input");
    pole.type = "text";
    pole.inputMode = "decimal";
    pole.className = "fin-budzet-kwota";
    pole.value = String(b.kwota).replace(".", ",");
    pole.setAttribute("aria-label", "Budżet: " + b.kategoria);
    pole.addEventListener("keydown", function (e) { if (e.key === "Enter") pole.blur(); });
    pole.addEventListener("change", async function () {
      const kwota = finParsujKwote(pole.value);
      if (kwota === null) {
        pokazToast("Podaj poprawną kwotę (nieujemną).", "blad");
        pole.value = String(b.kwota).replace(".", ",");
        return;
      }
      if (kwota === Number(b.kwota)) return;
      if (await finZapiszBudzet(b.kategoria, kwota)) pokazToast("Zmieniono budżet.", "sukces");
    });

    const usun = document.createElement("button");
    usun.type = "button";
    usun.className = "fin-usun";
    usun.setAttribute("aria-label", "Usuń kategorię " + b.kategoria);
    usun.textContent = "×";
    usun.addEventListener("click", function () { finUsunBudzet(b.kategoria); });

    gora.append(nazwa, pole, usun);

    const staty = document.createElement("div");
    staty.className = "fin-budzet-staty";
    staty.innerHTML =
      "<span>budżet <b></b></span><span>wydano <b></b></span><span>zostało <b></b></span>";
    const b3 = staty.querySelectorAll("b");
    b3[0].textContent = finZl(b.kwota);
    b3[1].textContent = finZl(wydano);
    b3[2].textContent = finZl(zostalo);
    if (zostalo < 0) b3[2].classList.add("fin-minus");

    const pasek = document.createElement("div");
    pasek.className = "fin-pasek";
    const wypelnienie = document.createElement("span");
    const proc = Number(b.kwota) > 0 ? Math.min(100, (wydano / Number(b.kwota)) * 100) : (wydano > 0 ? 100 : 0);
    wypelnienie.style.width = proc + "%";
    if (zostalo < 0) wypelnienie.classList.add("fin-minus-tlo");
    pasek.appendChild(wypelnienie);

    wiersz.append(gora, staty, pasek);
    lista.appendChild(wiersz);
  });
}

function renderFinDni() {
  const kontener = document.getElementById("fin-dni");
  kontener.innerHTML = "";
  const dzis = dzisiaj();
  for (let i = 0; i < 7; i++) {
    const data = finPrzesunDni(finTydzienOd, i);
    const d = finDataZIso(data);
    const wydatkiDnia = finWydatki.filter(function (w) { return w.data === data; });

    const karta = document.createElement("div");
    karta.className = "karta fin-dzien" + (data === dzis ? " fin-dzien-dzis" : "");

    const naglowek = document.createElement("div");
    naglowek.className = "fin-dzien-naglowek";
    const tytul = document.createElement("span");
    tytul.className = "fin-dzien-tytul";
    tytul.textContent = DNI_TYGODNIA_PELNE[i] + ", " + d.getDate() + " " + MIESIACE_SKROT[d.getMonth()];
    const suma = document.createElement("span");
    suma.className = "fin-dzien-suma";
    suma.textContent = wydatkiDnia.length ? finZl(finSuma(wydatkiDnia)) : "";
    naglowek.append(tytul, suma);
    karta.appendChild(naglowek);

    if (wydatkiDnia.length) {
      const ul = document.createElement("ul");
      ul.className = "fin-wydatki";
      wydatkiDnia.forEach(function (w) {
        const li = document.createElement("li");
        const opis = document.createElement("span");
        opis.className = "fin-wydatek-opis";
        opis.textContent = w.opis || "—";
        const kat = document.createElement("span");
        kat.className = "fin-wydatek-kat";
        kat.textContent = w.kategoria;
        const kwota = document.createElement("span");
        kwota.className = "fin-wydatek-kwota";
        kwota.textContent = finZl(w.kwota);
        const usun = document.createElement("button");
        usun.type = "button";
        usun.className = "fin-usun";
        usun.setAttribute("aria-label", "Usuń wydatek");
        usun.textContent = "×";
        usun.addEventListener("click", function () { finUsunWydatek(w); });
        li.append(opis, kat, kwota, usun);
        ul.appendChild(li);
      });
      karta.appendChild(ul);
    }

    karta.appendChild(finFormularzWydatku(data));
    kontener.appendChild(karta);
  }
}

function finFormularzWydatku(data) {
  const form = document.createElement("div");
  form.className = "fin-wydatek-form";

  const kwota = document.createElement("input");
  kwota.type = "text";
  kwota.inputMode = "decimal";
  kwota.placeholder = "Kwota";
  kwota.setAttribute("aria-label", "Kwota");

  const kategoria = document.createElement("select");
  kategoria.setAttribute("aria-label", "Kategoria");
  if (finBudzety.length) {
    finBudzety.forEach(function (b) {
      const opt = document.createElement("option");
      opt.value = b.kategoria;
      opt.textContent = b.kategoria;
      kategoria.appendChild(opt);
    });
  } else {
    const opt = document.createElement("option");
    opt.textContent = "Najpierw dodaj budżet";
    kategoria.appendChild(opt);
    kategoria.disabled = true;
  }

  const opis = document.createElement("input");
  opis.type = "text";
  opis.placeholder = "Na co";
  opis.setAttribute("aria-label", "Na co");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fin-btn-dodaj";
  btn.textContent = "Dodaj";
  btn.disabled = !finBudzety.length;

  async function dodaj() {
    const k = finParsujKwote(kwota.value);
    if (k === null || k === 0) {
      pokazToast("Podaj kwotę większą od zera.", "blad");
      kwota.focus();
      return;
    }
    if (!finBudzety.length) return;
    btn.disabled = true;
    const ok = await finDodajWydatek(data, k, kategoria.value, opis.value.trim());
    btn.disabled = false;
    if (ok) {
      kwota.value = "";
      opis.value = "";
    }
  }
  btn.addEventListener("click", dodaj);
  [kwota, opis].forEach(function (p) {
    p.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); dodaj(); } });
  });

  form.append(kwota, kategoria, opis, btn);
  return form;
}

function renderFinPodsumowanieTygodnia() {
  const budzet = finSuma(finBudzety);
  const wydano = finSuma(finWydatki);
  const zaoszczedzone = budzet - wydano;
  document.getElementById("fin-tydz-budzet").textContent = finZl(budzet);
  document.getElementById("fin-tydz-wydano").textContent = finZl(wydano);
  const el = document.getElementById("fin-tydz-zaoszczedzone");
  el.textContent = finZl(zaoszczedzone);
  el.classList.toggle("fin-minus", zaoszczedzone < 0);
}

function renderFinSumaOgolna() {
  const el = document.getElementById("fin-suma-ogolna");
  el.textContent = finSumaOgolna === null ? "…" : finZl(finSumaOgolna);
  el.classList.toggle("fin-minus", finSumaOgolna !== null && finSumaOgolna < 0);
}

// ----- Zdarzenia -----
navFinanse.addEventListener("click", finWejscie);

document.getElementById("fin-tydzien-poprzedni").addEventListener("click", function () {
  if (!finTydzienOd) return;
  finTydzienOd = finPrzesunDni(finTydzienOd, -7);
  finBudzety = [];
  finWydatki = [];
  renderFinanse();
  wczytajTydzienFinansow(finTydzienOd);
});
document.getElementById("fin-tydzien-nastepny").addEventListener("click", function () {
  if (!finTydzienOd || finTydzienOd >= finBiezacyTydzien()) return;
  finTydzienOd = finPrzesunDni(finTydzienOd, 7);
  finBudzety = [];
  finWydatki = [];
  renderFinanse();
  wczytajTydzienFinansow(finTydzienOd);
});

document.getElementById("fin-budzet-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const poleNazwa = document.getElementById("fin-budzet-nazwa");
  const poleKwota = document.getElementById("fin-budzet-kwota");
  const nazwa = poleNazwa.value.trim();
  const kwota = finParsujKwote(poleKwota.value);
  if (!nazwa) {
    pokazToast("Podaj nazwę kategorii.", "blad");
    return;
  }
  if (kwota === null) {
    pokazToast("Podaj poprawną kwotę (nieujemną).", "blad");
    return;
  }
  const istnieje = finBudzety.some(function (b) { return b.kategoria === nazwa; });
  if (await finZapiszBudzet(nazwa, kwota)) {
    poleNazwa.value = "";
    poleKwota.value = "";
    pokazToast(istnieje ? "Zmieniono budżet kategorii." : "Dodano kategorię.", "sukces");
  }
});
