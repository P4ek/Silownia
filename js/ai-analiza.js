// Ekran "AI Analiza" (#widok-ai-analiza).

// ===================== Widok: AI Analiza =====================
const btnAnalizujTydzien = document.getElementById("btn-analizuj-tydzien");
const aiAnalizaWynik = document.getElementById("ai-analiza-wynik");

if (btnAnalizujTydzien) {
  btnAnalizujTydzien.addEventListener("click", async function () {
    aiAnalizaWynik.hidden = true;
    aiAnalizaWynik.classList.remove("ai-analiza-blad");
    aiAnalizaWynik.textContent = "";

    const tekstPrzycisku = btnAnalizujTydzien.textContent;
    btnAnalizujTydzien.disabled = true;
    btnAnalizujTydzien.textContent = "Analizuję...";

    const { data, error } = await db.functions.invoke("analizuj-tydzien");

    btnAnalizujTydzien.textContent = tekstPrzycisku;
    btnAnalizujTydzien.disabled = false;

    // Błąd może przyjść z samego wywołania (np. sieć) albo z pola "error" w odpowiedzi funkcji
    const tekstBledu = error ? error.message : (data && data.error ? data.error : null);

    if (tekstBledu) {
      aiAnalizaWynik.classList.add("ai-analiza-blad");
      aiAnalizaWynik.textContent = tekstBledu;
      aiAnalizaWynik.hidden = false;
      return;
    }

    aiAnalizaWynik.textContent = (data && data.analiza) ? data.analiza : "Brak wyniku analizy.";
    aiAnalizaWynik.hidden = false;
  });
}
