// Start aplikacji - ładowany jako OSTATNI: dopiero tu ruszają sprawdzanie sesji, onAuthStateChange i inicjalizujDaneAplikacji, gdy wszystkie pliki ekranów są już wczytane. Na końcu rejestracja service workera.

// Wywoływane raz, przy pierwszym pokazaniu aplikacji po zalogowaniu - wczytuje wszystkie dane
// Ekran "Dziś" nie ma własnych zapytań: po każdym wczytaniu dostaje znak (dzisDaneGotowe) i dorysowuje swoją część
function inicjalizujDaneAplikacji() {
  dzisResetDanych();
  wczytajKatalog();
  wczytajWpisy().then(function () { dzisDaneGotowe("treningi"); });
  wczytajSzkicTreningu();
  renderTydzienEtykieta();
  wczytajRole().then(function () { renderDzis(); });
  wczytajCeleDlaTygodnia().then(function () { dzisDaneGotowe("cele"); });
  wczytajNawyki().then(function () { dzisDaneGotowe("nawyki"); });
  wczytajNawykiWpisy().then(function () { dzisDaneGotowe("nawykiWpisy"); });
  wczytajPlanyTreningowe().then(function () { dzisDaneGotowe("plany"); });

  const dostepRady = !!(sesjaUzytkownika && sesjaUzytkownika.user && RADY_DOSTEP_IDS.includes(sesjaUzytkownika.user.id));
  ustawDostepRadZKsiazek(dostepRady);
  if (dostepRady) wczytajRadyZKsiazek().then(function () { dzisDaneGotowe("rady"); });

  const dostepJedzenie = !!(sesjaUzytkownika && sesjaUzytkownika.user && JEDZENIE_DOSTEP_IDS.includes(sesjaUzytkownika.user.id));
  ustawDostepJedzenia(dostepJedzenie);
  if (dostepJedzenie) wczytajJedzenie().then(function () { dzisDaneGotowe("jedzenie"); });

  // Finanse: tylko widoczność menu; dane wczytuje finanse.js przy pierwszym wejściu na ekran
  const dostepFinanse = !!(sesjaUzytkownika && sesjaUzytkownika.user && FINANSE_DOSTEP_IDS.includes(sesjaUzytkownika.user.id));
  ustawDostepFinansow(dostepFinanse);
  renderDzis();
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
