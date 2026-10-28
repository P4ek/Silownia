// Pigułka kosmetyków (#kosmetyki): przypomnienie o planie na bieżącą porę dnia, na każdej sekcji apki.
// Bez odznaczania i bez bazy – plan w stałych KOSMETYKI_* z konfiguracja.js, dzień tygodnia z lokalnej daty.
// Dostęp: start.js woła ustawDostepKosmetykow(); dla innych kont pigułka w ogóle się nie pokazuje.
// Jak Dynamic Island: zwinięta pigułka, stuknięcie rozwija ją w kartę z krokami bieżącej pory i zwija (bez rozwijania przy starcie). Rozmiar (szerokość, wysokość) animowany jednorazowo przy każdej zmianie, poza tym transform/opacity.

const KOSMETYKI_DNI = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

const kosmEl = document.getElementById("kosmetyki");
const kosmPrzelacz = document.getElementById("kosm-przelacz");
const kosmKarta = document.getElementById("kosm-karta");
let kosmDostep = false;
let kosmRozwinieta = false;
let kosmTimerPory = null;

function kosmWieczor(teraz) {
  return teraz.getHours() >= KOSMETYKI_PROG_WIECZOR;
}

function kosmWypelnijListe(id, kroki) {
  const lista = document.getElementById(id);
  lista.innerHTML = "";
  kroki.forEach(function (k) {
    const li = document.createElement("li");
    li.textContent = k;
    lista.appendChild(li);
  });
}

// Treść pigułki i karty dla bieżącej chwili
function renderKosmetyki() {
  if (!kosmDostep) return;
  const teraz = new Date();
  const wieczor = kosmWieczor(teraz);
  const krokiWieczor = KOSMETYKI_WIECZOR[teraz.getDay()];
  const kroki = wieczor ? krokiWieczor : KOSMETYKI_RANO;

  document.getElementById("kosm-pora").textContent = wieczor ? "Wieczór" : "Rano";
  document.getElementById("kosm-ile").textContent = kroki.length + " " + odmianaLiczby(kroki.length, "krok", "kroki", "kroków");
  kosmWypelnijListe("kosm-rano-lista", KOSMETYKI_RANO);
  kosmWypelnijListe("kosm-wieczor-lista", krokiWieczor);
  document.getElementById("kosm-wieczor-dzien").textContent = "· " + KOSMETYKI_DNI[teraz.getDay()];
  document.getElementById("kosm-rano").classList.toggle("biezaca", !wieczor);
  document.getElementById("kosm-wieczor").classList.toggle("biezaca", wieczor);
  // Bieżąca pora na górze karty
  const pierwsza = document.getElementById(wieczor ? "kosm-wieczor" : "kosm-rano");
  if (kosmKarta.firstElementChild !== pierwsza) kosmKarta.insertBefore(pierwsza, kosmKarta.firstElementChild);
  kosmPrzelacz.setAttribute("aria-label", "Kosmetyki: " + (wieczor ? "wieczór" : "rano") + ", " + kroki.length + " " +
    odmianaLiczby(kroki.length, "krok", "kroki", "kroków") + (kosmRozwinieta ? ". Zwiń" : ". Rozwiń"));
  if (kosmRozwinieta) kosmUstawWysokosc();
  kosmZaplanujZmianePory(teraz);
}

// Przerysowanie dokładnie na progu wieczoru i o północy (zmiana dnia = inny plan wieczoru)
function kosmZaplanujZmianePory(teraz) {
  clearTimeout(kosmTimerPory);
  const prog = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate(), KOSMETYKI_PROG_WIECZOR);
  const polnoc = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate() + 1);
  const nastepna = teraz < prog ? prog : polnoc;
  kosmTimerPory = setTimeout(renderKosmetyki, nastepna - teraz + 500);
}

// Wysokość rozwiniętej karty: nagłówek + treść, zmierzona przy docelowej szerokości
function kosmUstawWysokosc() {
  kosmEl.style.height = (kosmPrzelacz.offsetHeight + kosmKarta.scrollHeight) + "px";
}

function kosmRozwin() {
  if (kosmRozwinieta) return;
  kosmRozwinieta = true;
  kosmEl.classList.add("rozwinieta");
  kosmPrzelacz.setAttribute("aria-expanded", "true");
  kosmUstawWysokosc();
  renderKosmetyki();
}
function kosmZwin() {
  if (!kosmRozwinieta) return;
  kosmRozwinieta = false;
  kosmEl.classList.remove("rozwinieta");
  kosmPrzelacz.setAttribute("aria-expanded", "false");
  kosmEl.style.height = "";
  renderKosmetyki();
}

kosmEl.addEventListener("click", function () {
  if (kosmRozwinieta) kosmZwin();
  else kosmRozwin();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && kosmRozwinieta) kosmZwin();
});
// Powrót do apki (np. po nocy): świeża pora i dzień
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) renderKosmetyki();
});
window.addEventListener("resize", function () {
  if (kosmRozwinieta) kosmUstawWysokosc();
});

// Wywoływane z inicjalizujDaneAplikacji (start.js)
function ustawDostepKosmetykow(dostep) {
  kosmDostep = dostep;
  kosmEl.hidden = !dostep;
  document.documentElement.classList.toggle("kosm-widoczna", dostep);
  if (!dostep) {
    clearTimeout(kosmTimerPory);
    return;
  }
  renderKosmetyki();
}
