// Start aplikacji - ładowany jako OSTATNI: dopiero tu ruszają sprawdzanie sesji, onAuthStateChange i inicjalizujDaneAplikacji, gdy wszystkie pliki ekranów są już wczytane. Na końcu rejestracja service workera.

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

  const kontoAI = !!(sesjaUzytkownika && sesjaUzytkownika.user && sesjaUzytkownika.user.id === AI_UZYTKOWNIK_ID);
  ustawDostepRadZKsiazek(kontoAI);
  if (kontoAI) wczytajRadyZKsiazek();
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
});


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
