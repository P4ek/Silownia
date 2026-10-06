// Nawigacja: przycisk-kropla (otwiera i zamyka menu), pełnoekranowe menu, skróty-zakładki i przełączanie widoków.

// ----- Nawigacja: kropla + menu -----
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const widoki = document.querySelectorAll(".widok");
const navBtns = document.querySelectorAll(".nav-btn");

const topbarIkony = document.querySelector(".topbar-ikony");
const menuSkrotZdjecie = document.getElementById("menu-skrot-zdjecie");

let menuOtwarte = false;
let menuScrollY = 0; // pozycja przewinięcia strony sprzed otwarcia menu (blokada przewijania tła)

function otworzPanel() {
  if (menuOtwarte) return;
  menuOtwarte = true;
  odswiezWartosciMenu();
  // Skrót "Zdjęcie" tylko wtedy, gdy pozycja Jedzenie jest dostępna (dostęp ustawia start.js)
  menuSkrotZdjecie.hidden = navJedzenie.hidden;

  // Blokada przewijania tła: przypięcie body (overflow:hidden na body nie wystarcza w iOS Safari)
  menuScrollY = window.scrollY;
  document.body.style.top = -menuScrollY + "px";
  document.documentElement.classList.add("menu-otwarte");

  sidebar.classList.add("open");
  sidebar.setAttribute("aria-hidden", "false");
  sidebar.scrollTop = 0;
  overlay.hidden = false;
  topbarIkony.classList.add("panel-otwarty");
  hamburger.setAttribute("aria-expanded", "true");
  hamburger.setAttribute("aria-label", "Zamknij menu");
}
function zamknijPanel() {
  if (!menuOtwarte) return;
  menuOtwarte = false;
  sidebar.classList.remove("open");
  sidebar.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  topbarIkony.classList.remove("panel-otwarty");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.setAttribute("aria-label", "Menu");

  document.documentElement.classList.remove("menu-otwarte");
  document.body.style.top = "";
  window.scrollTo(0, menuScrollY);
}
hamburger.addEventListener("click", function () {
  if (menuOtwarte) zamknijPanel();
  else otworzPanel();
});
overlay.addEventListener("click", zamknijPanel);
// Menu zajmuje cały ekran, więc jego puste tło (wszystko poza przyciskami) działa jak #overlay
sidebar.addEventListener("click", function (e) {
  if (!e.target.closest("button")) zamknijPanel();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && menuOtwarte) {
    zamknijPanel();
    hamburger.focus();
  }
});
// "Wyloguj": okno potwierdzenia otwiera logowanie.js, tu tylko zamknięcie menu
document.getElementById("btn-wyloguj").addEventListener("click", zamknijPanel);

// Zakładki-skróty: klik w pozycję menu o tym samym data-widok (ten sam mechanizm przełączania)
document.querySelectorAll(".menu-zakladka").forEach(function (z) {
  z.addEventListener("click", function () {
    document.querySelector('.nav-btn[data-widok="' + z.dataset.skrot + '"]').click();
  });
});

// ----- Wartości po prawej stronie pozycji: tylko z danych już wczytanych, bez zapytań do bazy -----
function liczbaRzymska(n) {
  const znaki = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let wynik = "";
  znaki.forEach(function (z) {
    while (n >= z[0]) { wynik += z[1]; n -= z[0]; }
  });
  return wynik;
}

function odswiezWartosciMenu() {
  const wartosci = {
    zapisz: planWTrakcie ? planWTrakcie.nazwa : "",
    rejestr: "",
    zaplanuj: plany.length ? plany.length + " " + odmianaLiczby(plany.length, "plan", "plany", "planów") : "",
    katalog: katalog.length ? String(katalog.length) : "",
    wykres: "",
    nawyki: "",
    jedzenie: "",
    rady: ""
  };

  if (wpisy.length) {
    const ostatnia = wpisy.reduce(function (max, w) { return w.data > max ? w.data : max; }, "");
    if (ostatnia) wartosci.rejestr = ostatnia.slice(8, 10) + "." + ostatnia.slice(5, 7);
    const liczbaRekordow = Object.keys(obliczRekordy()).length;
    if (liczbaRekordow) wartosci.wykres = liczbaRekordow + " rek.";
  }

  if (nawyki.length) {
    const dzis = dzisiaj();
    const zrobione = nawyki.filter(function (n) { return czyNawykZrobiony(n.id, dzis); }).length;
    wartosci.nawyki = zrobione + "/" + nawyki.length;
  }

  // Kcal z dzisiejszych posiłków, gdy dane Jedzenia są już wczytane
  if (jedzDostep && jedzWczytaneOd) wartosci.jedzenie = jedzFormat(jedzSumaDnia(dzisiaj()).kcal);

  // Poziom z "Rad z książek" (z PD), gdy książki są wczytane
  if (!navRady.hidden && radyKsiazki.length) wartosci.rady = liczbaRzymska(radyPoziomZPD(radyObliczPD()));

  document.querySelectorAll("[data-menu-wartosc]").forEach(function (el) {
    el.textContent = wartosci[el.dataset.menuWartosc] || "";
  });
}

navBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    const cel = btn.dataset.widok;
    if (!cel) return;

    const aktualny = document.querySelector(".widok.aktywny");
    navBtns.forEach(function (b) {
      b.classList.toggle("aktywny", b === btn);
      if (b === btn) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    function przelaczWidoki() {
      widoki.forEach(function (w) {
        w.classList.remove("widok-znika");
        w.classList.toggle("aktywny", w.id === cel);
      });
      const nowyWidok = document.getElementById(cel);
      if (nowyWidok) {
        nowyWidok.classList.add("widok-znika");
        void nowyWidok.offsetWidth; // wymuszenie przeliczenia stylów, żeby przejście z opacity:0 na 1 faktycznie się zanimowało
        nowyWidok.classList.remove("widok-znika");
      }
      if (cel === "widok-rejestr") renderRejestr();
      if (cel === "widok-wykres") renderWykresPostepu();
      if (cel === "widok-wnioski") renderWnioski();
      if (cel === "widok-jedzenie") renderJedzenie();
      zamknijPanel();
    }

    if (aktualny && aktualny.id !== cel) {
      aktualny.classList.add("widok-znika");
      setTimeout(przelaczWidoki, 120);
    } else {
      przelaczWidoki();
    }
  });
});
