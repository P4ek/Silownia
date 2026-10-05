// Start aplikacji - ładowany jako OSTATNI: dopiero tu ruszają sprawdzanie sesji, onAuthStateChange i inicjalizujDaneAplikacji, gdy wszystkie pliki ekranów są już wczytane. Na końcu rejestracja service workera.

// Ekran startowy: widoczny do odpowiedzi getSession(); bez sieci po START_LIMIT_MS komunikat i "Spróbuj ponownie"
const START_LIMIT_MS = 8000;
const ekranStartowy = document.getElementById("ekran-startowy");
const startTimer = setTimeout(function () {
  ekranStartowy.classList.add("blad");
  document.getElementById("start-tekst").textContent = "Nie udało się połączyć";
  document.getElementById("start-ponow").hidden = false;
}, START_LIMIT_MS);
document.getElementById("start-ponow").addEventListener("click", function () {
  location.reload();
});

function schowajEkranStartowy() {
  clearTimeout(startTimer);
  if (ekranStartowy.hidden) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ekranStartowy.hidden = true;
    return;
  }
  ekranStartowy.addEventListener("transitionend", function () { ekranStartowy.hidden = true; }, { once: true });
  ekranStartowy.classList.add("znika");
}

// Wywoływane raz, przy pierwszym pokazaniu aplikacji po zalogowaniu - wczytuje wszystkie dane
function inicjalizujDaneAplikacji() {
  wczytajKatalog();
  wczytajWpisy();
  wczytajSzkicTreningu();
  renderTydzienEtykieta();
  wczytajRole();
  wczytajCeleDlaTygodnia();
  wczytajNawyki();
  wczytajNawykiWpisy();
  wczytajPlanyTreningowe();

  const dostepRady = !!(sesjaUzytkownika && sesjaUzytkownika.user && RADY_DOSTEP_IDS.includes(sesjaUzytkownika.user.id));
  ustawDostepRadZKsiazek(dostepRady);
  if (dostepRady) wczytajRadyZKsiazek();

  const dostepJedzenie = !!(sesjaUzytkownika && sesjaUzytkownika.user && JEDZENIE_DOSTEP_IDS.includes(sesjaUzytkownika.user.id));
  ustawDostepJedzenia(dostepJedzenie);
  if (dostepJedzenie) wczytajJedzenie();
}

function pokazAplikacje() {
  ekranLogowania.hidden = true;
  aplikacja.hidden = false;
  const jestUzytkownikiemAI = !!(sesjaUzytkownika && sesjaUzytkownika.user && sesjaUzytkownika.user.id === AI_UZYTKOWNIK_ID);
  const appTytulEl = document.getElementById("app-tytul");
  if (appTytulEl) {
    appTytulEl.textContent = jestUzytkownikiemAI
      ? "Compare yourself to who you were yesterday, not to who someone else is today."
      : "Dziennik treningowy";
    appTytulEl.classList.toggle("app-tytul-cytat", jestUzytkownikiemAI);
  }
  if (!aplikacjaZainicjowana) {
    aplikacjaZainicjowana = true;
    inicjalizujDaneAplikacji();
  }
}

function pokazEkranLogowania() {
  aplikacja.hidden = true;
  ekranLogowania.hidden = false;
}

// Reakcja na zmianę stanu logowania (m.in. wejście z linku logowania z maila)
db.auth.onAuthStateChange(function (event, session) {
  sesjaUzytkownika = session;
  if (session) {
    pokazAplikacje();
  } else {
    pokazEkranLogowania();
  }
});

// Sprawdzenie aktywnej sesji przy pierwszym wejściu na stronę
db.auth.getSession().then(function (wynik) {
  sesjaUzytkownika = wynik.data.session;
  if (sesjaUzytkownika) {
    pokazAplikacje();
  } else {
    pokazEkranLogowania();
  }
  schowajEkranStartowy();
});


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
