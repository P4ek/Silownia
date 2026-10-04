// Ekran "Zaplanuj trening" (#widok-zaplanuj): budowanie planu, zapisane plany, Notion.

const formPlanTreningu = document.getElementById("form-plan-treningu");
const inputPlanNazwa = document.getElementById("plan-nazwa");
const inputPlanData = document.getElementById("plan-data");
const planDataTekst = document.getElementById("plan-data-tekst");
const planOkladkaKola = document.getElementById("plan-okladka-kola");
const planLicznik = document.getElementById("plan-licznik");
const planChipy = document.getElementById("plan-chipy");
const planKatalog = document.getElementById("plan-katalog");
const planCwiczeniaLista = document.getElementById("plan-cwiczenia-lista");
const btnPlanWyslijNotion = document.getElementById("plan-wyslij-notion");
const planyLista = document.getElementById("plany-lista");
const planyLicznik = document.getElementById("plany-licznik");

inputPlanData.value = dzisiaj();
renderPlanData();

// ===================== Widok: Zaplanuj trening =====================

let planCwiczeniaRobocze = []; // ćwiczenia dodane do budowanego planu, przed zapisem: [{ partia, cwiczenie }]
let plany = []; // wiersze z tabeli "plany_treningowe": { id, nazwa, cwiczenia, user_id }

let planWybranaPartia = PARTIE[0]; // partia wybrana chipem w "Dodaj do planu"
let planWyslijDoNotion = false;     // przełącznik "Wyślij też do Notion"

// Okładka planu: koło na każde ćwiczenie w kolorze jego partii (pozycje jak w makiecie; szer = szerokość karty w makiecie,
// z której liczony jest procent położenia w poziomie, więc okładka skaluje się do szerokości ekranu). Pusty plan = jedno przerywane koło.
function renderOkladkePlanu(kontenerKol, pozycje, szer, wys, skala) {
  kontenerKol.innerHTML = "";
  if (!pozycje.length) {
    const kolo = document.createElement("span");
    kolo.className = "plan-kolo puste";
    kolo.style.width = kolo.style.height = "100px";
    kolo.style.left = "calc(50% - 50px)";
    kolo.style.top = (wys / 2 - 80) + "px";
    kontenerKol.appendChild(kolo);
    return;
  }
  pozycje.forEach(function (poz, i) {
    const rozmiar = Math.round((150 - (i % 3) * 34) * skala);
    const x = ((i * 97 + 20) % (szer - 40)) / szer * 100;
    const y = Math.round(((i * 53 + 10) % Math.max(40, wys - 120)) - rozmiar / 4);
    const kolo = document.createElement("span");
    kolo.className = "plan-kolo";
    kolo.style.setProperty("--kolor-partii", kolorPartiiCSS(poz.partia));
    kolo.style.width = kolo.style.height = rozmiar + "px";
    kolo.style.left = "calc(" + x.toFixed(2) + "% - " + Math.round(rozmiar / 3) + "px)";
    kolo.style.top = y + "px";
    kontenerKol.appendChild(kolo);
  });
}

// Data planu w formie "Niedziela, 4 października"; pole daty leży przezroczyste na tym wierszu
function renderPlanData() {
  if (!inputPlanData.value) {
    planDataTekst.textContent = "Wybierz datę";
    return;
  }
  const czesci = inputPlanData.value.split("-").map(Number);
  const tekst = new Date(czesci[0], czesci[1] - 1, czesci[2])
    .toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  planDataTekst.textContent = tekst.charAt(0).toUpperCase() + tekst.slice(1);
}
inputPlanData.addEventListener("change", renderPlanData);
inputPlanData.addEventListener("click", function () {
  try { if (inputPlanData.showPicker) inputPlanData.showPicker(); } catch (e) {}
});

function czyWPlanie(partia, cwiczenie) {
  return planCwiczeniaRobocze.some(function (poz) { return poz.partia === partia && poz.cwiczenie === cwiczenie; });
}

// Odświeżenie wszystkiego, co zależy od budowanego planu: okładka, licznik, lista, znaczniki "w planie"
function renderPlanCwiczeniaListy() {
  const n = planCwiczeniaRobocze.length;
  renderOkladkePlanu(planOkladkaKola, planCwiczeniaRobocze, 342, 300, 1);
  planLicznik.textContent = ("Nowy plan · " + n + " " + odmianaLiczby(n, "ćwiczenie", "ćwiczenia", "ćwiczeń")).toUpperCase();

  planCwiczeniaLista.innerHTML = "";
  if (n === 0) {
    const pusto = document.createElement("li");
    pusto.className = "plan-lista-pusto";
    pusto.textContent = "Plan jest pusty – dodaj ćwiczenia poniżej.";
    planCwiczeniaLista.appendChild(pusto);
  }
  planCwiczeniaRobocze.forEach(function (poz, indeks) {
    const wiersz = document.createElement("li");
    wiersz.className = "plan-lista-wiersz";

    const numer = document.createElement("span");
    numer.className = "plan-lista-numer";
    numer.textContent = String(indeks + 1).padStart(2, "0");

    const opis = document.createElement("span");
    opis.className = "plan-lista-opis";
    const nazwa = document.createElement("span");
    nazwa.className = "plan-lista-nazwa";
    nazwa.textContent = poz.cwiczenie;
    const partia = document.createElement("span");
    partia.className = "plan-lista-partia";
    const kropka = document.createElement("span");
    kropka.className = "plan-kropka";
    kropka.style.setProperty("--kolor-partii", kolorPartiiCSS(poz.partia));
    partia.append(kropka, document.createTextNode(poz.partia));
    opis.append(nazwa, partia);

    const btnUsunPoz = document.createElement("button");
    btnUsunPoz.type = "button";
    btnUsunPoz.className = "plan-btn-x";
    btnUsunPoz.setAttribute("aria-label", "Usuń " + poz.cwiczenie + " z planu");
    btnUsunPoz.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    btnUsunPoz.addEventListener("click", function () {
      planCwiczeniaRobocze.splice(indeks, 1);
      renderPlanCwiczeniaListy();
    });

    wiersz.append(numer, opis, btnUsunPoz);
    planCwiczeniaLista.appendChild(wiersz);
  });
  renderPlanKatalog();
}

// "Dodaj do planu": chipy partii + ćwiczenia wybranej partii z katalogu (klik dodaje albo usuwa z planu)
function renderPlanKatalog() {
  planChipy.innerHTML = "";
  PARTIE.forEach(function (partia) {
    const aktywny = partia === planWybranaPartia;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "plan-chip" + (aktywny ? " aktywny" : "");
    chip.setAttribute("aria-pressed", aktywny ? "true" : "false");
    const kropka = document.createElement("span");
    kropka.className = "plan-kropka";
    kropka.style.setProperty("--kolor-partii", kolorPartiiCSS(partia));
    chip.append(kropka, document.createTextNode(partia));
    chip.addEventListener("click", function () {
      planWybranaPartia = partia;
      renderPlanKatalog();
    });
    planChipy.appendChild(chip);
  });

  planKatalog.innerHTML = "";
  const cwiczenia = cwiczeniaDlaPartii(planWybranaPartia);
  if (cwiczenia.length === 0) {
    planKatalog.innerHTML = pustyStanHTML("💪", "Brak ćwiczeń w partii " + planWybranaPartia + " - dodaj je w Katalogu ćwiczeń.");
    return;
  }
  cwiczenia.forEach(function (nazwa) {
    const partia = planWybranaPartia;
    const wPlanie = czyWPlanie(partia, nazwa);
    const wiersz = document.createElement("button");
    wiersz.type = "button";
    wiersz.className = "plan-katalog-wiersz" + (wPlanie ? " w-planie" : "");
    wiersz.setAttribute("aria-pressed", wPlanie ? "true" : "false");
    const nazwaEl = document.createElement("span");
    nazwaEl.className = "plan-katalog-nazwa";
    nazwaEl.textContent = nazwa;
    const znacznik = document.createElement("span");
    znacznik.className = "plan-katalog-znacznik";
    znacznik.textContent = wPlanie ? "w planie" : "+ dodaj";
    wiersz.append(nazwaEl, znacznik);
    wiersz.addEventListener("click", function () {
      if (czyWPlanie(partia, nazwa)) {
        planCwiczeniaRobocze = planCwiczeniaRobocze.filter(function (poz) { return !(poz.partia === partia && poz.cwiczenie === nazwa); });
      } else {
        planCwiczeniaRobocze.push({ partia: partia, cwiczenie: nazwa });
      }
      renderPlanCwiczeniaListy();
    });
    planKatalog.appendChild(wiersz);
  });
}

// Przełącznik "Wyślij też do Notion" (zamiast checkboxa)
function ustawPlanNotion(wlaczony) {
  planWyslijDoNotion = wlaczony;
  btnPlanWyslijNotion.setAttribute("aria-checked", wlaczony ? "true" : "false");
}
btnPlanWyslijNotion.addEventListener("click", function () { ustawPlanNotion(!planWyslijDoNotion); });

renderPlanCwiczeniaListy();

// Karta zapisanego planu: mini okładka z kołami partii, nazwa, liczby, ▶ rozpoczęcie, Notion, kosz
function budujKartePlanu(plan) {
  const cwiczenia = plan.cwiczenia || [];
  const liczbaPartii = new Set(cwiczenia.map(function (poz) { return poz.partia; })).size;

  const karta = document.createElement("article");
  karta.className = "plany-karta";

  const okladka = document.createElement("div");
  okladka.className = "plany-karta-okladka";
  okladka.setAttribute("aria-hidden", "true");
  renderOkladkePlanu(okladka, cwiczenia, 220, 150, 0.6);

  const tresc = document.createElement("div");
  tresc.className = "plany-karta-tresc";
  const tytul = document.createElement("h3");
  tytul.className = "plany-karta-nazwa";
  tytul.textContent = plan.nazwa;
  tytul.title = plan.nazwa;
  const info = document.createElement("span");
  info.className = "plany-karta-info";
  info.textContent = cwiczenia.length + " " + odmianaLiczby(cwiczenia.length, "ćwiczenie", "ćwiczenia", "ćwiczeń") +
    " · " + liczbaPartii + " " + odmianaLiczby(liczbaPartii, "partia", "partie", "partii");
  karta.title = cwiczenia.map(function (poz) { return poz.partia + " — " + poz.cwiczenie; }).join("\n");

  const akcje = document.createElement("div");
  akcje.className = "plany-karta-akcje";
  const btnDodajDoNotion = document.createElement("button");
  btnDodajDoNotion.type = "button";
  btnDodajDoNotion.className = "plany-btn-notion";
  btnDodajDoNotion.textContent = "Notion";
  btnDodajDoNotion.setAttribute("aria-label", "Dodaj plan " + plan.nazwa + " do Notion");
  btnDodajDoNotion.addEventListener("click", function () {
    wyslijPlanDoNotion(plan, btnDodajDoNotion);
  });
  const btnUsunPlan = document.createElement("button");
  btnUsunPlan.type = "button";
  btnUsunPlan.className = "plany-btn-kosz";
  btnUsunPlan.setAttribute("aria-label", "Usuń plan " + plan.nazwa);
  btnUsunPlan.innerHTML = IKONA_KOSZ_KATALOG;
  btnUsunPlan.addEventListener("click", function () {
    const potwierdzenie = window.confirm('Usunąć plan „' + plan.nazwa + '"?');
    if (!potwierdzenie) return;
    usunPlan(plan, btnUsunPlan);
  });
  akcje.append(btnDodajDoNotion, btnUsunPlan);
  tresc.append(tytul, info, akcje);

  const btnRozpocznij = document.createElement("button");
  btnRozpocznij.type = "button";
  btnRozpocznij.className = "plany-btn-start";
  btnRozpocznij.setAttribute("aria-label", "Rozpocznij plan " + plan.nazwa);
  btnRozpocznij.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  btnRozpocznij.addEventListener("click", function () {
    rozpocznijTreningZPlanu(plan);
  });

  karta.append(okladka, tresc, btnRozpocznij);
  return karta;
}

// Render paska zapisanych planów + licznik przy nagłówku + placeholder na końcu
function renderPlanyListy() {
  planyLista.innerHTML = "";
  const n = plany.length;
  planyLicznik.textContent = (n + " " + odmianaLiczby(n, "zapisany", "zapisane", "zapisanych")).toUpperCase();
  plany.forEach(function (plan, i) {
    planyLista.appendChild(wjazdKarty(budujKartePlanu(plan), i));
  });
  const placeholder = document.createElement("div");
  placeholder.className = "plany-placeholder";
  placeholder.textContent = n === 0 ? "Tu pojawi się Twój pierwszy plan" : "Tu pojawi się Twój kolejny plan";
  planyLista.appendChild(placeholder);
}

// Pobranie zapisanych planów z tabeli "plany_treningowe", od najnowszego
async function wczytajPlanyTreningowe() {
  const { data, error } = await db
    .from("plany_treningowe")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać planów treningowych: " + error.message, "blad");
    return;
  }
  plany = data || [];
  renderPlanyListy();
}

// Usunięcie zapisanego planu treningowego z tabeli "plany_treningowe"
async function usunPlan(plan, btn) {
  btn.disabled = true;

  const { error } = await db
    .from("plany_treningowe")
    .delete()
    .eq("id", plan.id);

  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć planu: " + error.message, "blad");
    btn.disabled = false;
    return;
  }

  plany = plany.filter(function (p) { return p.id !== plan.id; });
  renderPlanyListy();
}

// Wysłanie już zapisanego planu do Notion, zawsze z dzisiejszą datą (nie z datą utworzenia treningu)
async function wyslijPlanDoNotion(plan, btn) {
  const tekstPrzycisku = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Wysyłam...";

  const { error } = await db.functions.invoke("wyslij-plan-do-notion", {
    body: { nazwa: plan.nazwa, cwiczenia: plan.cwiczenia, data: dzisiaj() },
  });

  btn.disabled = false;
  btn.textContent = tekstPrzycisku;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się wysłać do Notion: " + error.message, "blad");
    return;
  }
  pokazToast("Wysłano plan do Notion.", "sukces");
}

// Submit: zapisanie budowanego planu treningowego do tabeli "plany_treningowe"
formPlanTreningu.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nazwa = inputPlanNazwa.value.trim();
  if (!nazwa) return;
  if (planCwiczeniaRobocze.length === 0) {
    pokazToast("Dodaj przynajmniej jedno ćwiczenie do planu.", "blad");
    return;
  }

  const btn = formPlanTreningu.querySelector(".plan-btn-zapisz");
  btn.disabled = true;

  const { data, error } = await db
    .from("plany_treningowe")
    .insert({ user_id: sesjaUzytkownika.user.id, nazwa: nazwa, cwiczenia: planCwiczeniaRobocze, data: inputPlanData.value || null })
    .select();

  btn.disabled = false;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać planu: " + error.message, "blad");
    return;
  }

  const nowyPlan = data && data[0] ? data[0] : { nazwa: nazwa, cwiczenia: planCwiczeniaRobocze };
  plany.unshift(nowyPlan);
  renderPlanyListy();

  if (planWyslijDoNotion) {
    const { error: bladNotion } = await db.functions.invoke("wyslij-plan-do-notion", {
      body: { nazwa: nazwa, cwiczenia: planCwiczeniaRobocze, data: inputPlanData.value || null },
    });
    if (bladNotion) {
      console.error(bladNotion);
      pokazToast("Plan zapisany, ale nie udało się wysłać do Notion: " + bladNotion.message, "blad");
    } else {
      pokazToast("Plan zapisany i wysłany do Notion.", "sukces");
    }
  } else {
    pokazToast("Plan zapisany.", "sukces");
  }

  formPlanTreningu.reset();
  inputPlanData.value = dzisiaj();
  renderPlanData();
  ustawPlanNotion(false);
  planCwiczeniaRobocze = [];
  renderPlanCwiczeniaListy();
});
