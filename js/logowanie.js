// Ekran logowania (link/kod z maila) i wylogowanie. Samo sprawdzanie sesji startuje dopiero w start.js.

const ekranLogowania = document.getElementById("ekran-logowania");
const aplikacja = document.getElementById("aplikacja");
const formLogowania = document.getElementById("form-logowania");
const inputEmailLogowania = document.getElementById("logowanie-email");
const formKodu = document.getElementById("form-kodu");
const inputKodLogowania = document.getElementById("logowanie-kod");
const logowanieStatus = document.getElementById("logowanie-status");
let logowanieEmail = ""; // e-mail zapamiętany między krokiem wysyłki kodu a jego weryfikacją

formLogowania.addEventListener("submit", async function (e) {
  e.preventDefault();
  const email = inputEmailLogowania.value.trim();
  if (!email) return;

  const btn = formLogowania.querySelector(".btn-submit");
  btn.disabled = true;
  logowanieStatus.hidden = true;

  const { error } = await db.auth.signInWithOtp({
    email: email,
  });

  btn.disabled = false;

  if (error) {
    console.error(error);
    logowanieStatus.textContent = "Nie udało się wysłać linku: " + error.message;
    logowanieStatus.style.color = "oklch(0.78 0.12 28)";
    logowanieStatus.hidden = false;
    return;
  }

  logowanieEmail = email;
  logowanieStatus.textContent = "Sprawdź maila";
  logowanieStatus.style.color = "oklch(0.8 0.1 150)";
  logowanieStatus.hidden = false;
  formLogowania.hidden = true;
  formKodu.hidden = false;
});

formKodu.addEventListener("submit", async function (e) {
  e.preventDefault();
  const kod = inputKodLogowania.value.trim();
  if (!kod) return;

  const btn = formKodu.querySelector(".btn-submit");
  btn.disabled = true;
  logowanieStatus.hidden = true;

  const { error } = await db.auth.verifyOtp({
    email: logowanieEmail,
    token: kod,
    type: "email",
  });

  btn.disabled = false;

  if (error) {
    console.error(error);
    logowanieStatus.textContent = "Nie udało się zalogować: " + error.message;
    logowanieStatus.style.color = "oklch(0.78 0.12 28)";
    logowanieStatus.hidden = false;
  }
});

const btnWyloguj = document.getElementById("btn-wyloguj");
const wylogujOverlay = document.getElementById("wyloguj-overlay");
const btnWylogujTak = document.getElementById("btn-wyloguj-tak");
const btnWylogujNie = document.getElementById("btn-wyloguj-nie");

function otworzWylogujModal() {
  wylogujOverlay.hidden = false;
}
function zamknijWylogujModal() {
  wylogujOverlay.hidden = true;
}

btnWyloguj.addEventListener("click", otworzWylogujModal);
btnWylogujNie.addEventListener("click", zamknijWylogujModal);
wylogujOverlay.addEventListener("click", function (e) {
  if (e.target === wylogujOverlay) zamknijWylogujModal();
});

btnWylogujTak.addEventListener("click", async function () {
  btnWylogujTak.disabled = true;
  await db.auth.signOut();
  aplikacjaZainicjowana = false;
  btnWylogujTak.disabled = false;
  zamknijWylogujModal();
});
