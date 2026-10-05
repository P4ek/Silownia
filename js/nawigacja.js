// Nawigacja: hamburger, panel boczny i przełączanie widoków.

// ----- Nawigacja: hamburger + panel boczny -----
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const widoki = document.querySelectorAll(".widok");
const navBtns = document.querySelectorAll(".nav-btn");

const topbarIkony = document.querySelector(".topbar-ikony");

function otworzPanel() {
  sidebar.classList.add("open");
  overlay.hidden = false;
  topbarIkony.classList.add("panel-otwarty");
}
function zamknijPanel() {
  sidebar.classList.remove("open");
  overlay.hidden = true;
  topbarIkony.classList.remove("panel-otwarty");
}
hamburger.addEventListener("click", otworzPanel);
overlay.addEventListener("click", zamknijPanel);

navBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    const cel = btn.dataset.widok;
    if (!cel) return;

    const aktualny = document.querySelector(".widok.aktywny");
    navBtns.forEach(function (b) { b.classList.toggle("aktywny", b === btn); });

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
      if (cel === "widok-jedzenie") {
        renderJedzenie();
        wczytajJedzOstatnie();
      }
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
