// Ekran "Wnioski" (#widok-wnioski): statystyki liczone w przeglądarce.

// ===================== Widok: Wnioski (czysta matematyka w przeglądarce, bez AI) =====================
const wnioskiLista = document.getElementById("wnioski-lista");
const WNIOSKI_ZA_MALO = "Za mało danych - wróć po tygodniu regularnego korzystania z aplikacji.";

function formatujLiczbe(x) {
  return x.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
}

function pokazWnioski(zdania) {
  wnioskiLista.innerHTML = "";
  zdania.forEach(function (tekst) {
    const karta = document.createElement("div");
    karta.className = "karta wniosek-karta";
    karta.textContent = tekst;
    wnioskiLista.appendChild(karta);
  });
}

async function renderWnioski() {
  pokazWnioski(["Liczę…"]);

  const dzis = dataSprzedDni(0);
  const start30 = dataSprzedDni(29);  // ostatnie 30 dni: [dziś-29, dziś]
  const start60 = dataSprzedDni(59);  // poprzednie 30 dni: [dziś-59, dziś-30]

  const [treningiRes, nawykiRes, wpisyRes] = await Promise.all([
    db.from("treningi").select("data").gte("data", start60).lte("data", dzis),
    db.from("nawyki").select("id, nazwa"),
    db.from("nawyki_wpisy").select("nawyk_id, data").gte("data", start30).lte("data", dzis)
  ]);

  const blad = treningiRes.error || nawykiRes.error || wpisyRes.error;
  if (blad) {
    console.error(blad);
    pokazWnioski(["Nie udało się pobrać danych: " + blad.message]);
    return;
  }

  const zdania = [];

  // 1. Średnia liczba dni treningowych w tygodniu + trend względem poprzednich 30 dni
  const dniTeraz = new Set();
  const dniPoprzednio = new Set();
  (treningiRes.data || []).forEach(function (t) {
    if (t.data >= start30) dniTeraz.add(t.data);
    else dniPoprzednio.add(t.data);
  });

  if (dniTeraz.size === 0 && dniPoprzednio.size === 0) {
    zdania.push(WNIOSKI_ZA_MALO);
  } else {
    const sredniaTeraz = dniTeraz.size / (30 / 7);
    const sredniaPoprzednio = dniPoprzednio.size / (30 / 7);
    let zdanie = "Trenujesz średnio " + formatujLiczbe(sredniaTeraz) + " razy w tygodniu w ostatnim miesiącu";
    if (sredniaPoprzednio > 0) {
      const zmiana = Math.round((sredniaTeraz - sredniaPoprzednio) / sredniaPoprzednio * 100);
      if (zmiana === 0) {
        zdanie += " (bez zmian względem poprzedniego miesiąca)";
      } else {
        zdanie += " (" + (zmiana > 0 ? "wzrost" : "spadek") + " o " + Math.abs(zmiana) + "% względem poprzedniego miesiąca)";
      }
    }
    zdania.push(zdanie + ".");
  }

  // 2. Nawyk z najniższym % odznaczonych dni w ostatnich 30 dniach
  const listaNawykow = nawykiRes.data || [];
  if (listaNawykow.length > 0) {
    const dniNawyku = {};
    (wpisyRes.data || []).forEach(function (w) {
      if (!dniNawyku[w.nawyk_id]) dniNawyku[w.nawyk_id] = new Set();
      dniNawyku[w.nawyk_id].add(w.data);
    });
    let najgorszy = null;
    listaNawykow.forEach(function (n) {
      const procent = (dniNawyku[n.id] ? dniNawyku[n.id].size : 0) / 30 * 100;
      if (!najgorszy || procent < najgorszy.procent) najgorszy = { nazwa: n.nazwa, procent: procent };
    });
    zdania.push("Najczęściej pomijany nawyk: " + najgorszy.nazwa + " (odznaczony w " + Math.round(najgorszy.procent) + "% dni).");
  }

  pokazWnioski(zdania);
}
