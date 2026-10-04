// Ekran "Nawyki" (#widok-habits): kafle na dziś, karta tygodnia, konfetti.

// ===================== Widok 6: Nawyki =====================

const habitsKicker = document.getElementById("habits-kicker");
const habitsDzisLiczba = document.getElementById("habits-dzis-liczba");
const habitsDzisDzien = document.getElementById("habits-dzis-dzien");
const habitsDzisMiesiac = document.getElementById("habits-dzis-miesiac");
const habitsDzisLicznik = document.getElementById("habits-dzis-licznik");
const btnHabitsEdytuj = document.getElementById("habits-edytuj");
const habitsZakres = document.getElementById("habits-zakres");
const habitsPodsumowanie = document.getElementById("habits-podsumowanie");
const habitsPodsumowanieTekst = document.getElementById("habits-podsumowanie-tekst");
const habitsPodsumowaniePodpis = document.getElementById("habits-podsumowanie-podpis");
const habitsProgressProcent = document.getElementById("habits-progress-procent");
const habitsNiebo = document.getElementById("habits-niebo");
const btnHabitsNowy = document.getElementById("habits-nowy-btn");
const habitsNowyPanel = document.getElementById("habits-nowy-panel");
const formNawyk = document.getElementById("form-nawyk");
const inputNowyNawyk = document.getElementById("nowy-nawyk");
const nawykiLista = document.getElementById("nawyki-lista");
const btnHabitsTydzienPoprzedni = document.getElementById("habits-tydzien-poprzedni");
const btnHabitsTydzienNastepny = document.getElementById("habits-tydzien-nastepny");
let nawyki = [];      // wiersze z tabeli "nawyki": { id, nazwa, user_id }
let nawykiWpisy = [];  // wiersze z tabeli "nawyki_wpisy": { id, nawyk_id, data, user_id }
let habitsWybranyPoniedzialek = poniedzialekTygodnia(new Date()); // poniedziałek przeglądanego tygodnia (nawigacja strzałkami)
let habitsTrybEdycji = false; // "Edytuj": kosz na kaflach, kliknięcie kafla nie odhacza

// 7 dat (RRRR-MM-DD) tygodnia zaczynającego się w danym poniedziałku (domyślnie: przeglądany tydzień)
function habitsDniTygodnia(poniedzialek) {
  poniedzialek = poniedzialek || habitsWybranyPoniedzialek;
  const dni = [];
  for (let i = 0; i < 7; i++) {
    dni.push(isoZDaty(new Date(poniedzialek.getFullYear(), poniedzialek.getMonth(), poniedzialek.getDate() + i)));
  }
  return dni;
}
function czyNawykZrobiony(nawykId, data) {
  return nawykiWpisy.some(function (w) { return w.nawyk_id === nawykId && w.data === data; });
}

// Numer tygodnia wg ISO 8601 (tydzień z pierwszym czwartkiem roku = 1)
function numerTygodniaISO(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dzienTyg = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dzienTyg);
  const poczatekRoku = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - poczatekRoku) / 86400000 + 1) / 7);
}

// Nagłówek: "NAWYKI · TYDZIEŃ 40", duża liczba dnia, nazwa dnia, miesiąc + dopisek
function renderHabitsNaglowek() {
  const dzis = new Date();
  const indeksDnia = (dzis.getDay() + 6) % 7; // 0 = poniedziałek
  const nazwa = DNI_TYGODNIA_PELNE[indeksDnia];
  const doKonca = 6 - indeksDnia;
  let dopisek;
  if (indeksDnia === 0) dopisek = "pierwszy dzień tygodnia";
  else if (doKonca === 0) dopisek = "ostatni dzień tygodnia";
  else dopisek = "jeszcze " + doKonca + (doKonca === 1 ? " dzień" : " dni") + " do końca tygodnia";
  habitsKicker.textContent = "Nawyki · Tydzień " + numerTygodniaISO(dzis);
  habitsDzisLiczba.textContent = String(dzis.getDate());
  habitsDzisDzien.textContent = nazwa.charAt(0).toUpperCase() + nazwa.slice(1);
  habitsDzisMiesiac.textContent = MIESIACE_DOPELNIACZ[dzis.getMonth()] + " · " + dopisek;
}
renderHabitsNaglowek();

// Zakres przeglądanego tygodnia na dole karty, np. "28 wrz – 4 paź"
function renderHabitsZakresTygodnia() {
  const poniedzialek = habitsWybranyPoniedzialek;
  const niedziela = new Date(poniedzialek.getFullYear(), poniedzialek.getMonth(), poniedzialek.getDate() + 6);
  const zakres = poniedzialek.getMonth() === niedziela.getMonth()
    ? poniedzialek.getDate() + " – " + niedziela.getDate() + " " + MIESIACE_SKROT[niedziela.getMonth()]
    : poniedzialek.getDate() + " " + MIESIACE_SKROT[poniedzialek.getMonth()] + " – " + niedziela.getDate() + " " + MIESIACE_SKROT[niedziela.getMonth()];
  habitsZakres.textContent = zakres + (niedziela.getFullYear() !== new Date().getFullYear() ? " " + niedziela.getFullYear() : "");
}
renderHabitsZakresTygodnia();

// Nawigacja: poprzedni / następny tydzień - zmienia się tylko przeglądany zakres dat w karcie tygodnia
btnHabitsTydzienPoprzedni.addEventListener("click", function () {
  habitsWybranyPoniedzialek = new Date(
    habitsWybranyPoniedzialek.getFullYear(), habitsWybranyPoniedzialek.getMonth(), habitsWybranyPoniedzialek.getDate() - 7
  );
  renderHabitsZakresTygodnia();
  renderHabitsPodsumowanie();
});
btnHabitsTydzienNastepny.addEventListener("click", function () {
  habitsWybranyPoniedzialek = new Date(
    habitsWybranyPoniedzialek.getFullYear(), habitsWybranyPoniedzialek.getMonth(), habitsWybranyPoniedzialek.getDate() + 7
  );
  renderHabitsZakresTygodnia();
  renderHabitsPodsumowanie();
});

// "Edytuj" / "Gotowe": tryb usuwania nawyków z kafli
btnHabitsEdytuj.addEventListener("click", function () {
  habitsTrybEdycji = !habitsTrybEdycji;
  renderNawykiListy(true);
});

// "Nowy nawyk – nowa gwiazda": rozwija/zwija formularz dodawania
function przelaczPanelNowegoNawyku(otworz) {
  habitsNowyPanel.hidden = !otworz;
  btnHabitsNowy.setAttribute("aria-expanded", otworz ? "true" : "false");
  if (otworz) inputNowyNawyk.focus();
}
btnHabitsNowy.addEventListener("click", function () { przelaczPanelNowegoNawyku(habitsNowyPanel.hidden); });

// Karta tygodnia: procent i "X z Y gwiazd" dla przeglądanego tygodnia + siatka nawyki × dni
function renderHabitsPodsumowanie() {
  if (nawyki.length === 0) {
    habitsPodsumowanie.hidden = true;
    return;
  }
  const dni = habitsDniTygodnia();
  let sumaZaznaczonych = 0;
  nawyki.forEach(function (n) {
    dni.forEach(function (d) { if (czyNawykZrobiony(n.id, d)) sumaZaznaczonych++; });
  });
  const mianownik = nawyki.length * 7;
  const biezacy = isoZDaty(habitsWybranyPoniedzialek) === isoZDaty(poniedzialekTygodnia(new Date()));

  animujLiczbe(habitsProgressProcent, Math.round(mianownik > 0 ? sumaZaznaczonych / mianownik * 100 : 0));
  animujLiczbe(habitsPodsumowanieTekst, sumaZaznaczonych, function (n) { return n + " z " + mianownik; });
  habitsPodsumowaniePodpis.textContent = "gwiazd zapalonych " + (biezacy ? "w tym tygodniu" : "w tamtym tygodniu");
  renderHabitsNiebo(dni, biezacy);
  habitsPodsumowanie.hidden = false;
}

const IKONA_GWIAZDA_NAWYK =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"/></svg>';
const IKONA_PTASZEK_NAWYK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// Siatka "niebo tygodnia": wiersz na nawyk, kolumny Pn–Nd; zrobione = świecąca gwiazdka, niezrobione = kropka
function renderHabitsNiebo(dni, biezacy) {
  habitsNiebo.innerHTML = "";
  const dzis = dzisiaj();
  const indeksDzis = biezacy ? dni.indexOf(dzis) : -1;

  if (indeksDzis !== -1) {
    const pas = document.createElement("div");
    pas.className = "habits-niebo-dzis";
    pas.style.setProperty("--dzien", String(indeksDzis));
    habitsNiebo.appendChild(pas);
  }

  const siatka = document.createElement("div");
  siatka.className = "habits-niebo-siatka";
  siatka.appendChild(document.createElement("span"));
  DNI_TYGODNIA_ETYKIETY.forEach(function (etykieta, i) {
    const naglowekDnia = document.createElement("span");
    naglowekDnia.className = "habits-niebo-dzien" + (i === indeksDzis ? " dzis" : "");
    naglowekDnia.textContent = etykieta;
    siatka.appendChild(naglowekDnia);
  });

  nawyki.forEach(function (n) {
    const nazwa = document.createElement("span");
    nazwa.className = "habits-niebo-nazwa";
    nazwa.textContent = n.nazwa;
    nazwa.title = n.nazwa;
    siatka.appendChild(nazwa);

    dni.forEach(function (data, i) {
      const zrobiony = czyNawykZrobiony(n.id, data);
      const komorka = document.createElement("button");
      komorka.type = "button";
      komorka.className = "habits-niebo-komorka" + (i === indeksDzis ? " dzis" : "");
      komorka.setAttribute("aria-pressed", zrobiony ? "true" : "false");
      komorka.setAttribute("aria-label", n.nazwa + ", " + DNI_TYGODNIA_PELNE[i] + " " + data + (zrobiony ? " – zrobione" : ""));
      komorka.innerHTML = zrobiony ? IKONA_GWIAZDA_NAWYK : '<span class="habits-niebo-kropka"></span>';
      komorka.addEventListener("click", function () { przelaczNawykDzien(n, data, komorka); });
      siatka.appendChild(komorka);
    });
  });
  habitsNiebo.appendChild(siatka);
}

// Ikona kosza przy przycisku usuwania nawyku
const IKONA_KOSZ =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const HABITS_OBROTY_PIECZATEK = [-6, 4, -3, 7];

// Kafle "Dziś do odhaczenia" (zawsze dzisiejsza data) + nagłówek z datą
// bezWjazdu: true przy samym odhaczaniu — kafle przerysowują się po każdym kliknięciu i kaskada by migała
function renderNawykiListy(bezWjazdu) {
  renderHabitsNaglowek();
  nawykiLista.innerHTML = "";
  nawykiLista.classList.toggle("edycja", habitsTrybEdycji);
  btnHabitsEdytuj.textContent = habitsTrybEdycji ? "Gotowe" : "Edytuj";
  btnHabitsEdytuj.setAttribute("aria-pressed", habitsTrybEdycji ? "true" : "false");

  if (nawyki.length === 0) {
    habitsTrybEdycji = false;
    nawykiLista.classList.remove("edycja");
    btnHabitsEdytuj.hidden = true;
    habitsDzisLicznik.hidden = true;
    nawykiLista.innerHTML = pustyStanHTML("✨", "Nie masz jeszcze nawyków - dodaj pierwszy przyciskiem „Nowy nawyk – nowa gwiazda” poniżej.");
    return;
  }
  btnHabitsEdytuj.hidden = false;
  habitsDzisLicznik.hidden = false;

  const dzis = dzisiaj();
  const dniBiezacegoTygodnia = habitsDniTygodnia(poniedzialekTygodnia(new Date()));
  animujLiczbe(habitsDzisLicznik, nawyki.filter(function (n) { return czyNawykZrobiony(n.id, dzis); }).length, function (n) { return n + "/" + nawyki.length; });

  nawyki.forEach(function (n, indeks) {
    const zrobiony = czyNawykZrobiony(n.id, dzis);
    const wTygodniu = dniBiezacegoTygodnia.filter(function (d) { return czyNawykZrobiony(n.id, d); }).length;

    const kafel = document.createElement("div");
    kafel.className = "habits-kafel" + (zrobiony ? " zrobiony" : "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "habits-kafel-btn";
    btn.setAttribute("aria-pressed", zrobiony ? "true" : "false");
    if (habitsTrybEdycji) btn.setAttribute("aria-disabled", "true");
    const pieczatka = document.createElement("span");
    pieczatka.className = "habits-pieczatka";
    pieczatka.style.setProperty("--obrot", HABITS_OBROTY_PIECZATEK[indeks % HABITS_OBROTY_PIECZATEK.length] + "deg");
    if (zrobiony) pieczatka.innerHTML = IKONA_PTASZEK_NAWYK;
    const nazwa = document.createElement("span");
    nazwa.className = "habits-kafel-nazwa";
    nazwa.textContent = n.nazwa;
    const pod = document.createElement("span");
    pod.className = "habits-kafel-pod";
    pod.textContent = zrobiony ? "zrobione dziś" : wTygodniu + "/7 w tym tygodniu";
    btn.append(pieczatka, nazwa, pod);
    btn.addEventListener("click", function () {
      if (habitsTrybEdycji) return;
      przelaczNawykDzien(n, dzis, btn);
    });
    kafel.appendChild(btn);

    if (habitsTrybEdycji) {
      const btnUsunNawyk = document.createElement("button");
      btnUsunNawyk.type = "button";
      btnUsunNawyk.className = "habits-kafel-kosz";
      btnUsunNawyk.setAttribute("aria-label", "Usuń nawyk „" + n.nazwa + "”");
      btnUsunNawyk.innerHTML = IKONA_KOSZ;
      btnUsunNawyk.addEventListener("click", function () {
        usunNawyk(n, btnUsunNawyk);
      });
      kafel.appendChild(btnUsunNawyk);
    }

    nawykiLista.appendChild(bezWjazdu ? kafel : wjazdKarty(kafel, indeks));
  });
}

// Czy wszystkie nawyki mają zaznaczenie w danym dniu (konfetti)
function wszystkieNawykiOdznaczone(data) {
  return nawyki.length > 0 && nawyki.every(function (n) {
    return nawykiWpisy.some(function (w) { return w.nawyk_id === n.id && w.data === data; });
  });
}

// Konfetti tylko raz na dzień — kolejne odznaczenia (np. po odznaczeniu i ponownym zaznaczeniu) już go nie odpalają
const KONFETTI_KEY = "silownia-konfetti-dzien";
let konfettiOstatniDzien = null;
try { konfettiOstatniDzien = localStorage.getItem(KONFETTI_KEY); } catch (e) {}

function odpalKonfettiRazDziennie(data) {
  if (konfettiOstatniDzien === data) return;
  konfettiOstatniDzien = data;
  try { localStorage.setItem(KONFETTI_KEY, data); } catch (e) {}
  odpalKonfetti();
}

// Kolorowe kwadraciki/kółka spadające z góry ekranu przez ~2 s (czysty CSS/JS)
function odpalKonfetti() {
  const KOLORY = ["#E2643F", "#E3A9B4", "#E0A82E", "#12A594", "#3F7DE2", "#8B5CF6", "#D6D0C0"];
  const warstwa = document.createElement("div");
  warstwa.className = "konfetti-warstwa";
  for (let i = 0; i < 80; i++) {
    const k = document.createElement("span");
    k.className = "konfetti";
    const rozmiar = 6 + Math.random() * 6;
    k.style.left = Math.random() * 100 + "vw";
    k.style.width = rozmiar + "px";
    k.style.height = (Math.random() < 0.5 ? rozmiar : rozmiar * 0.5) + "px";
    k.style.background = KOLORY[i % KOLORY.length];
    k.style.borderRadius = Math.random() < 0.4 ? "50%" : "2px";
    k.style.animationDelay = Math.random() * 0.35 + "s";
    k.style.setProperty("--czas", (1.4 + Math.random() * 0.6) + "s");
    k.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
    k.style.setProperty("--obrot", (Math.random() * 720 - 360) + "deg");
    warstwa.appendChild(k);
  }
  document.body.appendChild(warstwa);
  setTimeout(function () { warstwa.remove(); }, 2500);
}

// Odhaczenie/odznaczenie dnia (kafel na dziś albo komórka siatki) - wstawia lub usuwa wiersz w "nawyki_wpisy"
async function przelaczNawykDzien(nawyk, data, przycisk) {
  if (przycisk.disabled) return;
  przycisk.disabled = true;

  if (!czyNawykZrobiony(nawyk.id, data)) {
    const { data: wstawione, error } = await db
      .from("nawyki_wpisy")
      .insert({ nawyk_id: nawyk.id, data: data, user_id: sesjaUzytkownika.user.id })
      .select();

    przycisk.disabled = false;

    if (error) {
      console.error(error);
      pokazToast("Nie udało się zapisać zaznaczenia: " + error.message, "blad");
      return;
    }

    nawykiWpisy.push(wstawione && wstawione[0] ? wstawione[0] : { nawyk_id: nawyk.id, data: data });
    if (navigator.vibrate) navigator.vibrate(15);
    // Ten nawyk nie był odznaczony przed kliknięciem, więc dzień nie był wcześniej kompletny
    if (data === dzisiaj() && wszystkieNawykiOdznaczone(data)) odpalKonfettiRazDziennie(data);
  } else {
    const wpis = nawykiWpisy.find(function (w) { return w.nawyk_id === nawyk.id && w.data === data; });

    const { error } = await db
      .from("nawyki_wpisy")
      .delete()
      .eq("id", wpis.id);

    przycisk.disabled = false;

    if (error) {
      console.error(error);
      pokazToast("Nie udało się usunąć zaznaczenia: " + error.message, "blad");
      return;
    }

    nawykiWpisy = nawykiWpisy.filter(function (w) { return w !== wpis; });
  }

  renderNawykiListy(true);
  renderHabitsPodsumowanie();
}

// Usunięcie nawyku z tabeli "nawyki" wraz z jego zaznaczeniami w "nawyki_wpisy"
async function usunNawyk(nawyk, btn) {
  const potwierdzenie = window.confirm('Usunąć nawyk „' + nawyk.nazwa + '" wraz z całą historią zaznaczeń?');
  if (!potwierdzenie) return;

  btn.disabled = true;

  const { error: bladWpisow } = await db
    .from("nawyki_wpisy")
    .delete()
    .eq("nawyk_id", nawyk.id);

  if (bladWpisow) {
    console.error(bladWpisow);
    pokazToast("Nie udało się usunąć historii nawyku: " + bladWpisow.message, "blad");
    btn.disabled = false;
    return;
  }

  const { error } = await db
    .from("nawyki")
    .delete()
    .eq("id", nawyk.id);

  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć nawyku: " + error.message, "blad");
    btn.disabled = false;
    return;
  }

  nawyki = nawyki.filter(function (n) { return n.id !== nawyk.id; });
  nawykiWpisy = nawykiWpisy.filter(function (w) { return w.nawyk_id !== nawyk.id; });
  renderNawykiListy();
  renderHabitsPodsumowanie();
}

// Formularz dodawania nowego nawyku
formNawyk.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nazwa = inputNowyNawyk.value.trim();
  if (!nazwa) return;

  const btn = formNawyk.querySelector(".btn-pill");
  btn.disabled = true;

  const { data, error } = await db
    .from("nawyki")
    .insert({ nazwa: nazwa, user_id: sesjaUzytkownika.user.id })
    .select();

  btn.disabled = false;

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać nawyku: " + error.message, "blad");
    return;
  }

  nawyki.push(data && data[0] ? data[0] : { id: Date.now(), nazwa: nazwa });
  formNawyk.reset();
  przelaczPanelNowegoNawyku(false);
  renderNawykiListy();
  renderHabitsPodsumowanie();
});

// Pobranie nawyków z tabeli "nawyki"
async function wczytajNawyki() {
  const { data, error } = await db
    .from("nawyki")
    .select("*")
    .order("nazwa", { ascending: true });

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać nawyków: " + error.message, "blad");
    return;
  }
  nawyki = data || [];
  renderNawykiListy();
  renderHabitsPodsumowanie();
}

// Pobranie wpisów (zaznaczeń) z tabeli "nawyki_wpisy"
async function wczytajNawykiWpisy() {
  const { data, error } = await db
    .from("nawyki_wpisy")
    .select("*");

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać wpisów nawyków: " + error.message, "blad");
    return;
  }
  nawykiWpisy = data || [];
  renderNawykiListy();
  renderHabitsPodsumowanie();
}
