// Ekran "Katalog ćwiczeń" (#widok-nowe) + wczytywanie katalogu ćwiczeń (tabela cwiczenia).

const formNowe = document.getElementById("form-nowe-cwiczenie");
const inputNoweNazwa = document.getElementById("nowe-nazwa");
const nowePartiaNazwa = document.getElementById("nowe-partia-nazwa");
const katalogSumaLiczba = document.getElementById("katalog-suma-liczba");
const katalogKafle = document.getElementById("katalog-kafle");
const katalogPartiaKropka = document.getElementById("katalog-partia-kropka");
const katalogPartiaTytul = document.getElementById("katalog-partia-tytul");
const katalogPartiaLicznik = document.getElementById("katalog-partia-licznik");
const katalogLista = document.getElementById("katalog-lista");
// Odświeżenie wszystkich list ćwiczeń na stronie
function odswiezSelectyCwiczen() {
  renderZapisTrening();
  renderPlanKatalog();
  odbudujDatalistRejestr();
  renderKatalogListy();
}

// Pobranie katalogu ćwiczeń z tabeli "cwiczenia"
async function wczytajKatalog() {
  const { data, error } = await db
    .from("cwiczenia")
    .select("*")
    .order("partia", { ascending: true })
    .order("nazwa", { ascending: true });

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać listy ćwiczeń: " + error.message, "blad");
    return;
  }
  katalog = data || [];
  odswiezSelectyCwiczen();
}

// ----- Katalog ćwiczeń: kafle partii, formularz nowego ćwiczenia, lista wybranej partii -----
let katalogWybranaPartia = PARTIE[0];

function odmianaCwiczen(n) {
  if (n === 1) return "ćwiczenie";
  const r10 = n % 10;
  const r100 = n % 100;
  return r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14) ? "ćwiczenia" : "ćwiczeń";
}
function cwiczeniaPartiiKatalogu(partia) {
  return katalog
    .filter(function (c) { return c.partia === partia; })
    .sort(function (a, b) { return a.nazwa.localeCompare(b.nazwa, "pl"); });
}

// Kafel "Nowe ćwiczenie": rozwija/zwija formularz dodawania do wybranej partii
function przelaczFormularzNowego(otworz) {
  formNowe.hidden = !otworz;
  const kafel = katalogKafle.querySelector(".katalog-kafel-nowe");
  if (kafel) kafel.setAttribute("aria-expanded", otworz ? "true" : "false");
  if (otworz) inputNoweNazwa.focus();
}

// Submit: dodanie nowego ćwiczenia do tabeli "cwiczenia" (w aktualnie wybranej partii)
formNowe.addEventListener("submit", async function (e) {
  e.preventDefault();

  const partia = katalogWybranaPartia;
  const nazwa = inputNoweNazwa.value.trim();
  if (!partia || !nazwa) return;

  const istnieje = katalog.some(function (c) {
    return c.partia === partia && c.nazwa.toLowerCase() === nazwa.toLowerCase();
  });
  if (istnieje) {
    pokazToast("To ćwiczenie już jest w bazie dla tej partii.", "blad");
    return;
  }

  const btn = formNowe.querySelector(".katalog-btn-zapisz");
  btn.disabled = true;

  const { data: wstawione, error } = await db
    .from("cwiczenia")
    .insert({ partia: partia, nazwa: nazwa, user_id: sesjaUzytkownika.user.id })
    .select();

  btn.disabled = false;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać: " + error.message, "blad");
    return;
  }

  katalog.push(wstawione && wstawione[0] ? wstawione[0] : { partia: partia, nazwa: nazwa });
  formNowe.reset();
  przelaczFormularzNowego(false);
  odswiezSelectyCwiczen();
  pokazToast('Dodano: „' + nazwa + '" (' + partia + ")", "sukces");
});

// Render katalogu ćwiczeń (widok "Katalog ćwiczeń"): liczba, kafle partii i lista wybranej partii
function renderKatalogListy() {
  katalogSumaLiczba.textContent = String(katalog.length);
  renderKatalogKafle();
  renderKatalogPartii();
}

function renderKatalogKafle() {
  const formOtwarty = !formNowe.hidden;
  katalogKafle.innerHTML = "";
  PARTIE.forEach(function (partia) {
    const aktywny = partia === katalogWybranaPartia;
    const kafel = document.createElement("button");
    kafel.type = "button";
    kafel.className = "katalog-kafel" + (aktywny ? " aktywny" : "");
    kafel.style.setProperty("--kolor-partii", kolorPartiiCSS(partia));
    kafel.setAttribute("aria-pressed", aktywny ? "true" : "false");
    const liczba = document.createElement("span");
    liczba.className = "katalog-kafel-liczba";
    liczba.textContent = String(cwiczeniaPartiiKatalogu(partia).length);
    const nazwa = document.createElement("span");
    nazwa.className = "katalog-kafel-nazwa";
    nazwa.textContent = partia;
    kafel.append(liczba, nazwa);
    kafel.addEventListener("click", function () {
      katalogWybranaPartia = partia;
      renderKatalogKafle();
      renderKatalogPartii();
    });
    katalogKafle.appendChild(kafel);
  });

  const nowe = document.createElement("button");
  nowe.type = "button";
  nowe.className = "katalog-kafel-nowe";
  nowe.setAttribute("aria-expanded", formOtwarty ? "true" : "false");
  nowe.setAttribute("aria-controls", "form-nowe-cwiczenie");
  nowe.innerHTML =
    '<span class="katalog-kafel-nowe-ikona"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>' +
    "Nowe ćwiczenie";
  nowe.addEventListener("click", function () { przelaczFormularzNowego(formNowe.hidden); });
  katalogKafle.appendChild(nowe);
}

// Nagłówek i ponumerowana lista ćwiczeń wybranej partii (z koszem do usuwania)
function renderKatalogPartii() {
  const partia = katalogWybranaPartia;
  const cwiczenia = cwiczeniaPartiiKatalogu(partia);
  const kolor = kolorPartiiCSS(partia);

  nowePartiaNazwa.textContent = partia;
  katalogPartiaKropka.style.setProperty("--kolor-partii", kolor);
  katalogPartiaTytul.textContent = partia;
  katalogPartiaLicznik.textContent = (cwiczenia.length + " " + odmianaCwiczen(cwiczenia.length)).toUpperCase();

  katalogLista.innerHTML = "";
  if (cwiczenia.length === 0) {
    katalogLista.innerHTML = pustyStanHTML("💪", "Brak ćwiczeń w partii " + partia + " - dodaj pierwsze kaflem „Nowe ćwiczenie”.");
    return;
  }

  cwiczenia.forEach(function (c, i) {
    const wiersz = document.createElement("li");
    wiersz.className = "katalog-wiersz";

    const numer = document.createElement("span");
    numer.className = "katalog-wiersz-numer";
    numer.textContent = String(i + 1).padStart(2, "0");

    const nazwa = document.createElement("span");
    nazwa.className = "katalog-wiersz-nazwa";
    nazwa.textContent = c.nazwa;

    const btnUsun = document.createElement("button");
    btnUsun.type = "button";
    btnUsun.className = "katalog-btn-kosz";
    btnUsun.setAttribute("aria-label", "Usuń " + c.nazwa);
    btnUsun.title = "Usuń";
    btnUsun.innerHTML = IKONA_KOSZ_KATALOG;
    btnUsun.addEventListener("click", function () { usunCwiczenie(c, btnUsun); });

    wiersz.append(numer, nazwa, btnUsun);
    katalogLista.appendChild(wjazdKarty(wiersz, i));
  });
}

// Usunięcie ćwiczenia z tabeli "cwiczenia"
async function usunCwiczenie(cwicz, btn) {
  const potwierdzenie = window.confirm(
    'Usunąć ćwiczenie „' + cwicz.nazwa + '" (' + cwicz.partia + ") z katalogu?"
  );
  if (!potwierdzenie) return;

  btn.disabled = true;

  const { error } = await db
    .from("cwiczenia")
    .delete()
    .eq("id", cwicz.id);

  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć ćwiczenia: " + error.message, "blad");
    btn.disabled = false;
    return;
  }

  katalog = katalog.filter(function (c) { return c.id !== cwicz.id; });
  odswiezSelectyCwiczen();
}
