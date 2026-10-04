// Ekran "Zapisz trening" (#widok-dodaj): wybór ćwiczenia, liczniki, serie z wersją roboczą, plan w trakcie, baner rekordu, "Dziś zapisane", zapis i usuwanie wpisów z tabeli treningi.

const ZASADY = [
  "Bądź mężczyzną i dopchaj to do końca.",
  "Porażka to stan umysłu, nie fakt.",
  "Konsekwencja to 95% sukcesu.",
  "Lanie jest wartościowe pod warunkiem że cię czegoś nauczy.",
  "Żaden dobry traf nie przydarzy ci się, jeśli nie podejmiesz żadnego działania.",
  "99% rzeczy, o które się martwisz, się nie wydarzy."
];

// Zasada dnia: indeks = numer dnia w roku (czas lokalny) modulo liczba zasad — ta sama przez cały dzień
(function renderZasadaDnia() {
  const dzis = new Date();
  const poczatekRoku = Date.UTC(dzis.getFullYear(), 0, 1);
  const dzisUTC = Date.UTC(dzis.getFullYear(), dzis.getMonth(), dzis.getDate());
  const dzienRoku = Math.round((dzisUTC - poczatekRoku) / 86400000) + 1;
  const el = document.getElementById("zasada-dnia");
  if (el) el.textContent = ZASADY[dzienRoku % ZASADY.length];
})();

const zapisSesja = document.getElementById("zapis-sesja");
const zapisSzkicStary = document.getElementById("zapis-szkic-stary");
const zapisSzkicStaryTekst = document.getElementById("zapis-szkic-stary-tekst");
const btnSzkicStaryZapisz = document.getElementById("zapis-szkic-stary-zapisz");
const btnSzkicStaryOdrzuc = document.getElementById("zapis-szkic-stary-odrzuc");
const zapisChipy = document.getElementById("zapis-chipy");
const zapisCwiczeniaPasek = document.getElementById("zapis-cwiczenia");
const zapisBrak = document.getElementById("zapis-brak");
const zapisPanel = document.getElementById("zapis-panel");
const zapisPartiaKropka = document.getElementById("zapis-partia-kropka");
const zapisPartiaNazwa = document.getElementById("zapis-partia-nazwa");
const zapisTytul = document.getElementById("zapis-tytul");
const zapisDoPobicia = document.getElementById("zapis-do-pobicia");
const zapisRekord = document.getElementById("zapis-rekord");
const inputZapisKg = document.getElementById("zapis-kg");
const inputZapisPowt = document.getElementById("zapis-powt");
const zapisPodpowiedz = document.getElementById("zapis-podpowiedz");
const btnZapisZalicz = document.getElementById("zapis-zalicz");
const zapisZaliczTekst = document.getElementById("zapis-zalicz-tekst");
const zapisSerieLicznik = document.getElementById("zapis-serie-licznik");
const zapisSerieBox = document.getElementById("zapis-serie");
const btnZapisZapisz = document.getElementById("zapis-zapisz");
const zapisDzisLicznik = document.getElementById("zapis-dzis-licznik");
const planTrakcieBaner = document.getElementById("plan-trakcie-baner");
const planPostepLiczba = document.getElementById("plan-postep-liczba");
const planPostepLuk = document.getElementById("plan-postep-luk");
const planTrakcieTekst = document.getElementById("plan-trakcie-tekst");
const btnPlanPomin = document.getElementById("btn-plan-pomin");
const btnPlanZakoncz = document.getElementById("btn-plan-zakoncz");
const lista = document.getElementById("lista");
const rekordBaner = document.getElementById("rekord-baner");
const rekordTekst = document.getElementById("rekord-tekst");
// Ostatni (najświeższy, wg daty) zapisany wpis z tabeli "treningi" dla danego ćwiczenia
function ostatniWpisDlaCwiczenia(cwiczenie) {
  let ostatni = null;
  wpisy.forEach(function (w) {
    if (w.cwiczenie !== cwiczenie) return;
    if (!ostatni || w.data > ostatni.data) ostatni = w;
  });
  return ostatni;
}

// Wiersz listy "Dziś zapisane": partia z kropką, nazwa, serie, kosz (usuwanie z potwierdzeniem w usunWpis)
function budujWpisDzis(row) {
  const li = document.createElement("li");
  li.className = "zapis-dzis-wiersz";
  const opis = document.createElement("div");
  opis.className = "zapis-dzis-opis";
  const nazwa = document.createElement("span");
  nazwa.className = "zapis-dzis-nazwa";
  nazwa.appendChild(kropkaPartii(row.partia));
  nazwa.appendChild(document.createTextNode(row.cwiczenie));
  const serie = document.createElement("span");
  serie.className = "zapis-dzis-serie";
  serie.textContent = (row.podejscia || []).map(function (p) { return formatKg(Number(p["cieżar"]) || 0) + " kg × " + (Number(p.powtorzenia) || 0); }).join(", ");
  opis.append(nazwa, serie);

  const btnUsun = document.createElement("button");
  btnUsun.type = "button";
  btnUsun.className = "rejestr-btn-usun";
  btnUsun.setAttribute("aria-label", "Usuń zapis „" + row.cwiczenie + "”");
  btnUsun.innerHTML = IKONA_KOSZ_KATALOG;
  btnUsun.addEventListener("click", function () { usunWpis(row, btnUsun); });
  li.append(opis, btnUsun);
  return li;
}

// Baner z rekordem (obliczRekordy) o najwyższym wyniku ciężar × powtórzenia; przy remisie nowszy
function renderRekord() {
  let best = null;
  const rekordy = obliczRekordy();
  Object.keys(rekordy).forEach(function (cw) {
    const r = rekordy[cw];
    if (!best || r.wynik > best.wynik || (r.wynik === best.wynik && r.data > best.data)) best = r;
  });
  if (!best) { rekordBaner.hidden = true; return; }
  rekordTekst.textContent =
    "Ostatni rekord: " + best.cwiczenie + " — " + best.ciezar + " kg × " + best.powtorzenia;
  rekordBaner.hidden = false;
  rekordBaner.classList.remove("rekord-pulsuj");
  void rekordBaner.offsetWidth; // wymuszenie przeliczenia stylów, żeby animacja odpaliła się ponownie przy każdym pokazaniu
  rekordBaner.classList.add("rekord-pulsuj");
  setTimeout(function () { rekordBaner.classList.remove("rekord-pulsuj"); }, 600);
}

// Render listy "Dziś zapisane" - tylko wpisy z dzisiejszą datą (reset o północy) + nagłówek "SESJA · 4 PAŹ"
function renderOstatnio() {
  const dzis = dzisiaj();
  const dzisiejsze = wpisy.filter(function (w) { return w.data === dzis; });
  renderZapisSesja();
  zapisDzisLicznik.textContent = dzisiejsze.length + " " + odmianaLiczby(dzisiejsze.length, "ćwiczenie", "ćwiczenia", "ćwiczeń");

  lista.innerHTML = "";
  if (dzisiejsze.length === 0) {
    lista.innerHTML = pustyStanHTML("🏋️", "Dziś jeszcze nic - zalicz serie i zapisz pierwsze ćwiczenie powyżej.");
    return;
  }
  dzisiejsze.slice().reverse().forEach(function (row, i) {
    lista.appendChild(wjazdKarty(budujWpisDzis(row), i));
  });
}

// Zaplanuj odświeżenie listy tuż po najbliższej północy (i tak co dobę)
function zaplanujResetOPolnocy() {
  const teraz = new Date();
  const polnoc = new Date(
    teraz.getFullYear(), teraz.getMonth(), teraz.getDate() + 1, 0, 0, 2
  );
  setTimeout(function () {
    renderOstatnio();
    zaplanujResetOPolnocy();
  }, polnoc - teraz);
}
zaplanujResetOPolnocy();

// Pobranie wszystkich wpisów przy otwarciu strony
async function wczytajWpisy() {
  const { data, error } = await db
    .from("treningi")
    .select("*")
    .order("data", { ascending: false });

  if (error) {
    console.error(error);
    pokazToast("Nie udało się pobrać treningów: " + error.message, "blad");
    return;
  }
  (data || []).forEach(function (row) { wpisy.push(row); });
  renderOstatnio();
  renderRekord();
  renderRejestr();
  renderWykresPostepu();
  odswiezZapisPoZmianieWpisow();
}

// ----- Trening rozpoczęty z zapisanego planu (widok "Zapisz trening") -----
let planWTrakcie = null; // gdy aktywny: { nazwa, cwiczenia, indeks }

// Podsunięcie bieżącej pozycji trwającego planu w "Zapisz trening" + tekst banera
function ustawFormularzNaCwiczeniePlanu() {
  const poz = planWTrakcie.cwiczenia[planWTrakcie.indeks];
  wybierzCwiczenie(poz.partia, poz.cwiczenie);

  planTrakcieTekst.textContent =
    "Plan: " + planWTrakcie.nazwa + " — ćwiczenie " + (planWTrakcie.indeks + 1) + " z " +
    planWTrakcie.cwiczenia.length + ": " + poz.partia + " — " + poz.cwiczenie;

  const nr = planWTrakcie.indeks + 1;
  const wszystkie = planWTrakcie.cwiczenia.length;
  planPostepLiczba.textContent = nr + "/" + wszystkie;
  planPostepLuk.style.strokeDashoffset = String(119.38 * (1 - nr / wszystkie));
}

// Uruchomienie trybu "trening z planu" po kliknięciu "Rozpocznij" na karcie planu
function rozpocznijTreningZPlanu(plan) {
  planWTrakcie = { nazwa: plan.nazwa, cwiczenia: plan.cwiczenia, indeks: 0 };
  document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
  ustawFormularzNaCwiczeniePlanu();
  planTrakcieBaner.hidden = false;
}

// Zakończenie trybu "trening z planu"
function zakonczPlanWTrakcie() {
  planWTrakcie = null;
  planTrakcieBaner.hidden = true;
}

// Przejście do kolejnego ćwiczenia z trwającego planu (po zapisie lub po pominięciu)
function przejdzDoNastepnegoCwiczeniaPlanu() {
  planWTrakcie.indeks++;
  if (planWTrakcie.indeks >= planWTrakcie.cwiczenia.length) {
    pokazToast("Plan ukończony!", "sukces");
    zakonczPlanWTrakcie();
    return;
  }
  ustawFormularzNaCwiczeniePlanu();
}

btnPlanPomin.addEventListener("click", function () {
  if (!planWTrakcie) return;
  przejdzDoNastepnegoCwiczeniaPlanu();
});

btnPlanZakoncz.addEventListener("click", function () {
  zakonczPlanWTrakcie();
});

// ===== Zapisz trening: wybór ćwiczenia, liczniki, zaliczone serie (wersja robocza w localStorage), zapis do "treningi" =====
let zapisPartia = PARTIE[0];
let zapisCwiczenie = null;   // nazwa wybranego ćwiczenia
let zapisKg = 20;
let zapisPowt = 10;
let zapisSerie = [];         // zaliczone serie, w formacie "treningi.podejscia": [{ "cieżar", powtorzenia }]
let zapisDataSzkicu = null;  // data wersji roboczej (dzień pierwszej zaliczonej serii)
let zapisWartosciRecznie = false; // użytkownik zmienił liczniki - nie nadpisuj ich wartościami startowymi
let zapisTrwa = false;
let zapisStareSzkice = [];   // wersje robocze z wcześniejszych dni, czekające na decyzję
const ZAPIS_KROK_KG = 2.5;
const ZAPIS_OBROTY_PIECZATEK = [-6, 5, -3, 8, -5];

function kluczSzkicu(stare) {
  return "silownia-szkic-treningu-" + (stare ? "stare-" : "") + (sesjaUzytkownika ? sesjaUzytkownika.user.id : "anon");
}
// Wersja robocza zapisywana na bieżąco (osobno dla konta), żeby serie przetrwały zamknięcie apki
function zapiszSzkic() {
  try {
    if (zapisSerie.length === 0) localStorage.removeItem(kluczSzkicu());
    else localStorage.setItem(kluczSzkicu(), JSON.stringify({
      partia: zapisPartia, cwiczenie: zapisCwiczenie, data: zapisDataSzkicu || dzisiaj(), podejscia: zapisSerie
    }));
  } catch (e) {}
}
function zapiszStareSzkice() {
  try {
    if (zapisStareSzkice.length === 0) localStorage.removeItem(kluczSzkicu(true));
    else localStorage.setItem(kluczSzkicu(true), JSON.stringify(zapisStareSzkice));
  } catch (e) {}
}

// Po zalogowaniu: dzisiejsza wersja robocza wraca do edycji, wcześniejsza trafia do "starych" (zapisz z tamtą datą / odrzuć)
function wczytajSzkicTreningu() {
  zapisSerie = [];
  zapisDataSzkicu = null;
  zapisCwiczenie = null;
  zapisWartosciRecznie = false;
  let szkic = null;
  zapisStareSzkice = [];
  try {
    szkic = JSON.parse(localStorage.getItem(kluczSzkicu()) || "null");
    zapisStareSzkice = JSON.parse(localStorage.getItem(kluczSzkicu(true)) || "[]") || [];
  } catch (e) {}
  if (szkic && szkic.cwiczenie && (szkic.podejscia || []).length) {
    if (szkic.data === dzisiaj()) {
      zapisPartia = szkic.partia;
      zapisCwiczenie = szkic.cwiczenie;
      zapisSerie = szkic.podejscia;
      zapisDataSzkicu = szkic.data;
    } else {
      zapisStareSzkice.push(szkic);
      zapiszStareSzkice();
      try { localStorage.removeItem(kluczSzkicu()); } catch (e) {}
    }
  }
  ustawWartosciStartowe();
  renderZapisTrening();
  renderStarySzkic();
}

function renderStarySzkic() {
  const szkic = zapisStareSzkice[0];
  zapisSzkicStary.hidden = !szkic;
  if (!szkic) return;
  zapisSzkicStaryTekst.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = formatDatyRejestru(szkic.data);
  zapisSzkicStaryTekst.append(
    document.createTextNode("Niezapisane serie z "), b,
    document.createTextNode(": " + szkic.cwiczenie + " - " + opisSerii(szkic.podejscia) + ".")
  );
  btnSzkicStaryZapisz.textContent = "Zapisz z datą " + formatDatyRejestru(szkic.data);
}
btnSzkicStaryZapisz.addEventListener("click", async function () {
  const szkic = zapisStareSzkice[0];
  if (!szkic) return;
  btnSzkicStaryZapisz.disabled = true;
  const wpis = await zapiszWpisTreningu(szkic.partia, szkic.cwiczenie, szkic.data, szkic.podejscia);
  btnSzkicStaryZapisz.disabled = false;
  if (!wpis) return;
  zapisStareSzkice.shift();
  zapiszStareSzkice();
  renderStarySzkic();
  pokazToast("Zapisano: " + szkic.cwiczenie + " (" + formatDatyRejestru(szkic.data) + ")", "sukces");
});
btnSzkicStaryOdrzuc.addEventListener("click", function () {
  const szkic = zapisStareSzkice[0];
  if (!szkic) return;
  if (!window.confirm("Odrzucić niezapisane serie „" + szkic.cwiczenie + "” z dnia " + szkic.data + "?")) return;
  zapisStareSzkice.shift();
  zapiszStareSzkice();
  renderStarySzkic();
});

// Nagłówek "SESJA · 4 PAŹ" - trening zawsze zapisuje się z dzisiejszą datą
function renderZapisSesja() {
  const d = new Date();
  zapisSesja.textContent = "Sesja · " + d.getDate() + " " + MIESIACE_SKROT[d.getMonth()];
}

// Najlepsza seria (ciężar × powtórzenia) z ostatniego treningu ćwiczenia - podpis na karcie ćwiczenia
function najlepszaSeriaOstatnio(cwiczenie) {
  const ostatni = ostatniWpisDlaCwiczenia(cwiczenie);
  let najlepsza = null;
  ((ostatni && ostatni.podejscia) || []).forEach(function (p) {
    if (!najlepsza || wynikSerii(p) > wynikSerii(najlepsza)) najlepsza = p;
  });
  return najlepsza;
}
// Wartości startowe: ciężar z rekordu, powtórzenia z rekordu + 1; pierwszy raz 20 kg × 10
function ustawWartosciStartowe() {
  const rekord = zapisCwiczenie ? obliczRekordy()[zapisCwiczenie] : null;
  zapisKg = rekord ? rekord.ciezar : 20;
  zapisPowt = rekord ? rekord.powtorzenia + 1 : 10;
  zapisWartosciRecznie = false;
}
// Wynik do pobicia: rekord ćwiczenia albo lepsza seria zaliczona już dziś
function wynikDoPobicia() {
  const rekord = zapisCwiczenie ? obliczRekordy()[zapisCwiczenie] : null;
  let najlepszy = rekord ? rekord.wynik : 0;
  zapisSerie.forEach(function (p) { najlepszy = Math.max(najlepszy, wynikSerii(p)); });
  return najlepszy;
}

// Po wczytaniu/usunięciu wpisów: zmienia się rekord i "ostatnio", więc odśwież panel (i wartości startowe, jeśli nietknięte)
function odswiezZapisPoZmianieWpisow() {
  if (!zapisWartosciRecznie && zapisSerie.length === 0) ustawWartosciStartowe();
  renderZapisTrening();
}

// Zmiana ćwiczenia/partii; niezapisane serie zapisują się wtedy automatycznie
async function wybierzCwiczenie(partia, cwiczenie) {
  if (partia === zapisPartia && cwiczenie === zapisCwiczenie) return;
  if (zapisSerie.length > 0) {
    const ok = await zapiszBiezaceCwiczenie(true);
    if (!ok) return;
  }
  zapisPartia = partia;
  zapisCwiczenie = cwiczenie;
  ustawWartosciStartowe();
  renderZapisTrening();
}

function renderZapisTrening() {
  renderZapisSesja();
  const cwiczenia = cwiczeniaDlaPartii(zapisPartia);
  if (!zapisCwiczenie && cwiczenia.length > 0) {
    zapisCwiczenie = cwiczenia[0];
    ustawWartosciStartowe();
  }

  // Chipy partii
  zapisChipy.innerHTML = "";
  PARTIE.forEach(function (partia) {
    const aktywny = partia === zapisPartia;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "plan-chip" + (aktywny ? " aktywny" : "");
    chip.setAttribute("aria-pressed", aktywny ? "true" : "false");
    const kropka = document.createElement("span");
    kropka.className = "plan-kropka";
    kropka.style.setProperty("--kolor-partii", kolorPartiiCSS(partia));
    chip.append(kropka, document.createTextNode(partia));
    chip.addEventListener("click", function () {
      if (partia === zapisPartia) return;
      wybierzCwiczenie(partia, cwiczeniaDlaPartii(partia)[0] || null);
    });
    zapisChipy.appendChild(chip);
  });

  // Karty ćwiczeń wybranej partii z podpisem "ostatnio X×Y" / "pierwszy raz"
  zapisCwiczeniaPasek.innerHTML = "";
  let aktywnaKarta = null;
  cwiczenia.forEach(function (nazwa) {
    const aktywna = nazwa === zapisCwiczenie;
    const karta = document.createElement("button");
    karta.type = "button";
    karta.className = "zapis-cw-karta" + (aktywna ? " aktywna" : "");
    karta.setAttribute("aria-pressed", aktywna ? "true" : "false");
    const nazwaEl = document.createElement("span");
    nazwaEl.className = "zapis-cw-nazwa";
    nazwaEl.textContent = nazwa;
    const ostatnio = document.createElement("span");
    ostatnio.className = "zapis-cw-ostatnio";
    const seria = najlepszaSeriaOstatnio(nazwa);
    ostatnio.textContent = seria ? "ostatnio " + formatKg(Number(seria["cieżar"]) || 0) + "×" + (Number(seria.powtorzenia) || 0) : "pierwszy raz";
    karta.append(nazwaEl, ostatnio);
    karta.addEventListener("click", function () { wybierzCwiczenie(zapisPartia, nazwa); });
    zapisCwiczeniaPasek.appendChild(karta);
    if (aktywna) aktywnaKarta = karta;
  });
  if (aktywnaKarta) {
    const lewa = aktywnaKarta.offsetLeft - 16;
    if (lewa < zapisCwiczeniaPasek.scrollLeft || lewa + aktywnaKarta.offsetWidth > zapisCwiczeniaPasek.scrollLeft + zapisCwiczeniaPasek.clientWidth) {
      zapisCwiczeniaPasek.scrollLeft = Math.max(0, lewa);
    }
  }

  // Brak ćwiczeń w partii (i nic wybranego z planu) - pusty stan zamiast panelu
  const brak = !zapisCwiczenie;
  zapisBrak.hidden = !brak;
  zapisPanel.hidden = brak;
  zapisCwiczeniaPasek.hidden = cwiczenia.length === 0;
  if (brak) {
    zapisBrak.innerHTML = pustyStanHTML("💪", "Brak ćwiczeń w partii " + zapisPartia + " - dodaj je w Katalogu ćwiczeń.");
    return;
  }

  // Aktualne ćwiczenie + "DO POBICIA"
  zapisPartiaKropka.style.setProperty("--kolor-partii", kolorPartiiCSS(zapisPartia));
  zapisPartiaNazwa.textContent = zapisPartia;
  zapisTytul.textContent = zapisCwiczenie.charAt(0).toUpperCase() + zapisCwiczenie.slice(1);
  const rekord = obliczRekordy()[zapisCwiczenie];
  zapisDoPobicia.hidden = !rekord;
  if (rekord) zapisRekord.textContent = formatKg(rekord.ciezar) + " kg × " + rekord.powtorzenia;

  renderZapisLiczniki();
  renderZapisSerie();
}

function renderZapisLiczniki() {
  if (document.activeElement !== inputZapisKg) inputZapisKg.value = formatKg(zapisKg);
  if (document.activeElement !== inputZapisPowt) inputZapisPowt.value = String(zapisPowt);

  const doPobicia = wynikDoPobicia();
  const wynik = zapisKg * zapisPowt;
  let tekst;
  let zlota = false;
  if (doPobicia <= 0) {
    tekst = "Pierwsza seria ustawi rekord";
    zlota = true;
  } else if (wynik > doPobicia) {
    tekst = "Ta seria pobije rekord!";
    zlota = true;
  } else if (zapisKg <= 0) {
    tekst = "Ustaw ciężar, żeby powalczyć o rekord";
  } else {
    const brakuje = Math.floor(doPobicia / zapisKg) + 1 - zapisPowt;
    tekst = "Brakuje " + brakuje + " powt. do rekordu";
  }
  zapisPodpowiedz.textContent = tekst;
  zapisPodpowiedz.classList.toggle("zlota", zlota);
}

const IKONA_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// Lista "Zaliczone serie": seria jest rekordowa, gdy bije rekord ćwiczenia i wszystkie wcześniejsze serie dnia
function renderZapisSerie() {
  const n = zapisSerie.length;
  zapisZaliczTekst.textContent = "Zalicz serię " + (n + 1);
  zapisSerieLicznik.textContent = n + " " + odmianaLiczby(n, "seria", "serie", "serii");
  btnZapisZapisz.disabled = n === 0;

  zapisSerieBox.innerHTML = "";
  if (n === 0) {
    const pusto = document.createElement("p");
    pusto.className = "zapis-serie-pusto";
    pusto.textContent = "Ustaw ciężar i powtórzenia, potem zalicz pierwszą serię.";
    zapisSerieBox.appendChild(pusto);
    return;
  }
  const rekord = obliczRekordy()[zapisCwiczenie];
  let najlepszy = rekord ? rekord.wynik : 0;
  zapisSerie.forEach(function (p, i) {
    const wynik = wynikSerii(p);
    const czyRekord = wynik > najlepszy;
    if (czyRekord) najlepszy = wynik;

    const wiersz = document.createElement("div");
    wiersz.className = "zapis-seria" + (czyRekord ? " rekord" : "");
    const pieczatka = document.createElement("span");
    pieczatka.className = "zapis-seria-pieczatka";
    pieczatka.style.setProperty("--obrot", ZAPIS_OBROTY_PIECZATEK[i % ZAPIS_OBROTY_PIECZATEK.length] + "deg");
    pieczatka.textContent = String(i + 1);
    const opis = document.createElement("span");
    opis.className = "zapis-seria-opis";
    opis.textContent = formatKg(Number(p["cieżar"]) || 0) + " kg × " + (Number(p.powtorzenia) || 0);
    wiersz.append(pieczatka, opis);
    if (czyRekord) {
      const pigulka = document.createElement("span");
      pigulka.className = "zapis-pigulka-rekord";
      pigulka.innerHTML = IKONA_GWIAZDKA_REKORD + "Rekord";
      wiersz.appendChild(pigulka);
    }
    const btnX = document.createElement("button");
    btnX.type = "button";
    btnX.className = "zapis-btn-x";
    btnX.setAttribute("aria-label", "Usuń serię " + (i + 1));
    btnX.innerHTML = IKONA_X;
    btnX.addEventListener("click", function () {
      if (!window.confirm("Usunąć serię " + (i + 1) + " (" + opis.textContent + ")?")) return;
      zapisSerie.splice(i, 1);
      if (zapisSerie.length === 0) zapisDataSzkicu = null;
      zapiszSzkic();
      renderZapisLiczniki();
      renderZapisSerie();
    });
    wiersz.appendChild(btnX);
    zapisSerieBox.appendChild(wiersz);
  });
}

// Liczniki: − / + (ciężar co 2,5 kg, powtórzenia co 1) i wpisywanie z klawiatury (bez wartości ujemnych)
function ustawKg(kg) {
  zapisKg = Math.max(0, Math.round(kg * 100) / 100);
  zapisWartosciRecznie = true;
  renderZapisLiczniki();
}
function ustawPowt(powt) {
  zapisPowt = Math.max(1, Math.round(powt));
  zapisWartosciRecznie = true;
  renderZapisLiczniki();
}
document.getElementById("zapis-kg-minus").addEventListener("click", function () { ustawKg(zapisKg - ZAPIS_KROK_KG); });
document.getElementById("zapis-kg-plus").addEventListener("click", function () { ustawKg(zapisKg + ZAPIS_KROK_KG); });
document.getElementById("zapis-powt-minus").addEventListener("click", function () { ustawPowt(zapisPowt - 1); });
document.getElementById("zapis-powt-plus").addEventListener("click", function () { ustawPowt(zapisPowt + 1); });

inputZapisKg.addEventListener("input", function () {
  const czyste = inputZapisKg.value.replace(/[^0-9.,]/g, "");
  if (czyste !== inputZapisKg.value) inputZapisKg.value = czyste;
});
inputZapisPowt.addEventListener("input", function () {
  const czyste = inputZapisPowt.value.replace(/[^0-9]/g, "");
  if (czyste !== inputZapisPowt.value) inputZapisPowt.value = czyste;
});
inputZapisKg.addEventListener("focus", function () { inputZapisKg.select(); });
inputZapisPowt.addEventListener("focus", function () { inputZapisPowt.select(); });
inputZapisKg.addEventListener("change", function () {
  const kg = parseFloat(inputZapisKg.value.replace(",", "."));
  if (isNaN(kg) || kg < 0) inputZapisKg.value = formatKg(zapisKg);
  else ustawKg(kg);
});
inputZapisPowt.addEventListener("change", function () {
  const powt = parseInt(inputZapisPowt.value, 10);
  if (isNaN(powt) || powt < 1) inputZapisPowt.value = String(zapisPowt);
  else ustawPowt(powt);
});
[inputZapisKg, inputZapisPowt].forEach(function (pole) {
  pole.addEventListener("keydown", function (e) { if (e.key === "Enter") pole.blur(); });
  pole.addEventListener("blur", function () { renderZapisLiczniki(); });
});

// "Zalicz serię N": dopisanie serii do wersji roboczej
btnZapisZalicz.addEventListener("click", function () {
  if (!zapisCwiczenie) return;
  // Wartość wpisana z klawiatury, a jeszcze niezatwierdzona (pole nadal aktywne)
  if (document.activeElement === inputZapisKg || document.activeElement === inputZapisPowt) document.activeElement.blur();
  const doPobicia = wynikDoPobicia();
  const seria = { "cieżar": zapisKg, powtorzenia: zapisPowt };
  if (zapisSerie.length === 0) zapisDataSzkicu = dzisiaj();
  zapisSerie.push(seria);
  zapiszSzkic();
  const rekord = wynikSerii(seria) > doPobicia && wynikSerii(seria) > 0;
  if (navigator.vibrate) navigator.vibrate(rekord ? [20, 40, 20] : 15);
  renderZapisLiczniki();
  renderZapisSerie();
});

// Zapis jednego wiersza do "treningi" (ten sam format podejść co dotąd) + odświeżenie widoków jak po starym zapisie
async function zapiszWpisTreningu(partia, cwiczenie, data, podejscia) {
  const { data: wstawione, error } = await db
    .from("treningi")
    .insert({ partia: partia, cwiczenie: cwiczenie, data: data, podejscia: podejscia, user_id: sesjaUzytkownika.user.id })
    .select();

  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać: " + error.message, "blad");
    return null;
  }

  const nowyWpis = wstawione && wstawione[0] ? wstawione[0] : { partia, cwiczenie, data, podejscia };
  wpisy.push(nowyWpis);
  renderOstatnio();
  renderRekord();
  renderRejestr();
  renderWykresPostepu();
  return nowyWpis;
}

// "Zapisz ćwiczenie i wybierz kolejne" (auto = true przy zmianie ćwiczenia/partii z niezapisanymi seriami)
async function zapiszBiezaceCwiczenie(auto) {
  if (zapisTrwa) return false;
  if (!zapisCwiczenie || zapisSerie.length === 0) {
    if (!auto) pokazToast("Zalicz najpierw przynajmniej jedną serię.", "blad");
    return auto;
  }
  zapisTrwa = true;
  btnZapisZapisz.disabled = true;
  const nazwa = zapisCwiczenie;
  const liczba = zapisSerie.length;
  const wpis = await zapiszWpisTreningu(zapisPartia, zapisCwiczenie, zapisDataSzkicu || dzisiaj(), zapisSerie.slice());
  zapisTrwa = false;
  btnZapisZapisz.disabled = false;
  if (!wpis) return false;

  zapisSerie = [];
  zapisDataSzkicu = null;
  zapiszSzkic();
  pokazToast((auto ? "Zapisano automatycznie: " : "Zapisano: ") + nazwa + " (" + liczba + " " + odmianaLiczby(liczba, "seria", "serie", "serii") + ")", "sukces");

  ustawWartosciStartowe();
  renderZapisTrening();
  if (!auto && planWTrakcie) {
    przejdzDoNastepnegoCwiczeniaPlanu();
  }
  return true;
}
btnZapisZapisz.addEventListener("click", function () { zapiszBiezaceCwiczenie(false); });

// Usunięcie zapisanego treningu (wiersza z tabeli "treningi"), np. błędnie wpisanej serii
async function usunWpis(row, btn) {
  const potwierdzenie = window.confirm(
    'Usunąć zapis „' + row.partia + " — " + row.cwiczenie + '" z dnia ' + row.data + "?"
  );
  if (!potwierdzenie) return;

  btn.disabled = true;

  const { error } = await db
    .from("treningi")
    .delete()
    .eq("id", row.id);

  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć wpisu: " + error.message, "blad");
    btn.disabled = false;
    return;
  }

  const idx = wpisy.indexOf(row);
  if (idx !== -1) wpisy.splice(idx, 1);

  renderOstatnio();
  renderRekord();
  renderRejestr();
  renderWykresPostepu();
  odswiezZapisPoZmianieWpisow();
}
