// Finanse → Majątek: gotówka (główna kwota) i dwa osobne konta – Inwestycje i Side hustle – których salda NIE wliczają się
// do gotówki. Tabela majatek_ruchy: jeden wiersz = wpłata (+) albo wypłata (−) na koncie; saldo konta = suma jego kwot.
// Tylko konta z FINANSE_DOSTEP_IDS (dostęp ustawia start.js). Dane wczytywane raz, przy pierwszym wejściu na ekran.
// Korzysta z pomocniczych funkcji finanse.js (kwoty, daty, usuwanie w dwóch stuknięciach, listy kluczowane).

const navMajatek = document.getElementById("nav-majatek");

const MAJ_KONTA = {
  gotowka: { nazwa: "Gotówka", dodaj: "Dodaj pieniądze", opis: "Wlicza się do majątku." },
  inwestycje: { nazwa: "Inwestycje", dodaj: "Inwestycje", opis: "Osobno od gotówki – nie zmienia głównej kwoty." },
  side_hustle: { nazwa: "Side hustle", dodaj: "Side hustle", opis: "Osobno od gotówki – nie zmienia głównej kwoty." }
};
const MAJ_NA_STRONIE = { gotowka: 15, inwestycje: 6, side_hustle: 6 };
const MAJ_MIESIACE_W = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];
const MAJ_KLUCZ_OTWARTE = "majatek-otwarte"; // localStorage: które osobne konta są rozwinięte

let majDostep = false;
let majWczytane = false;
let majLadowanie = false;
let majRuchy = [];              // [{ id, konto, data, kwota, opis }] malejąco po dacie
let majPokazane = Object.assign({}, MAJ_NA_STRONIE);
let majOknoKonto = "gotowka";
let majKierunek = 1;            // 1 = dodaję, -1 = odejmuję
let majZapisTrwa = false;
let majNowyId = null;           // świeżo dodany wiersz dostaje animację wjazdu

const majEl = {
  gotowka: document.getElementById("maj-gotowka"),
  fakty: document.getElementById("maj-fakty"),
  historiaLicznik: document.getElementById("maj-historia-licznik"),
  okno: document.getElementById("maj-okno"),
  oknoTytul: document.getElementById("maj-okno-tytul"),
  oknoOpis: document.getElementById("maj-okno-opis"),
  kierunek: document.getElementById("maj-kierunek"),
  kwota: document.getElementById("maj-kwota"),
  opis: document.getElementById("maj-opis"),
  data: document.getElementById("maj-data"),
  zapisz: document.getElementById("maj-zapisz")
};

function ustawDostepMajatku(dostep) {
  majDostep = dostep;
  navMajatek.hidden = !dostep;
  if (!dostep) {
    majRuchy = [];
    majWczytane = false;
    if (navMajatek.classList.contains("aktywny")) {
      document.querySelector('.nav-btn[data-widok="widok-dodaj"]').click();
    }
  }
}

// ----- Pomocnicze -----
function majRuchyKonta(konto) {
  return majRuchy.filter(function (r) { return r.konto === konto; });
}

function majSaldo(konto) {
  return Math.round(finSuma(majRuchyKonta(konto)) * 100) / 100;
}

// Zmiana salda w bieżącym miesiącu
function majWMiesiacu(konto) {
  const poczatek = dzisiaj().slice(0, 8) + "01";
  return finSuma(majRuchyKonta(konto).filter(function (r) { return r.data >= poczatek; }));
}

function majZeZnakiem(n) {
  return (n > 0 ? "+" : "") + finZl(n);
}

function majSortuj() {
  majRuchy.sort(function (a, b) { return a.data === b.data ? b.id - a.id : (a.data < b.data ? 1 : -1); });
}

// ----- Wczytywanie -----
async function majWejscie() {
  if (!majDostep || majWczytane) return;
  majWczytane = true;
  majLadowanie = true;
  renderMajatek();
  const { data, error } = await db.from("majatek_ruchy")
    .select("id, konto, data, kwota, opis")
    .eq("user_id", finUid())
    .order("data", { ascending: false })
    .order("id", { ascending: false });
  majLadowanie = false;
  if (error) {
    console.error(error);
    majWczytane = false;
    pokazToast("Nie udało się wczytać majątku.", "blad");
    renderMajatek();
    return;
  }
  majRuchy = (data || []).map(function (r) { return Object.assign({}, r, { kwota: Number(r.kwota) }); });
  renderMajatek();
}

// ----- Rysowanie -----
function renderMajatek() {
  renderMajGotowka();
  Object.keys(MAJ_KONTA).forEach(renderMajListe);
  renderMajKafel("inwestycje");
  renderMajKafel("side_hustle");
}

function renderMajGotowka() {
  if (majLadowanie && !majRuchy.length) {
    majEl.gotowka.textContent = "…";
    majEl.fakty.textContent = "";
    return;
  }
  const saldo = majSaldo("gotowka");
  majEl.gotowka.style.setProperty("--maj-znaki", finKwota(saldo, true).length);
  animujLiczbe(majEl.gotowka, saldo, function (n) { return finKwota(n, true); });
  majEl.gotowka.classList.toggle("maj-minus", saldo < 0);

  const ruchy = majRuchyKonta("gotowka");
  const fakty = [];
  if (ruchy.length) {
    const miesiac = majWMiesiacu("gotowka");
    fakty.push({ tekst: "w " + MAJ_MIESIACE_W[new Date().getMonth()], wartosc: majZeZnakiem(miesiac), klasa: miesiac < 0 ? "minus" : (miesiac > 0 ? "plus" : "") });
    const ostatni = ruchy[0];
    fakty.push({ tekst: "ostatnio", wartosc: ostatni.data === dzisiaj() ? "dziś" : finDzienMies(finDataZIso(ostatni.data)) });
  } else {
    fakty.push({ tekst: "Dodaj pierwszą kwotę, żeby zacząć liczyć.", wartosc: "" });
  }
  majEl.fakty.replaceChildren.apply(majEl.fakty, fakty.map(function (f) {
    const el = document.createElement("span");
    el.className = "maj-fakt" + (f.klasa ? " maj-fakt-" + f.klasa : "");
    el.append(f.tekst + (f.wartosc ? " " : ""));
    if (f.wartosc) {
      const b = document.createElement("strong");
      b.textContent = f.wartosc;
      el.append(b);
    }
    return el;
  }));
}

function renderMajKafel(konto) {
  const kafel = document.getElementById("maj-konto-" + konto);
  const saldoEl = kafel.querySelector("[data-saldo]");
  const miesiacEl = kafel.querySelector("[data-miesiac]");
  if (majLadowanie && !majRuchy.length) {
    saldoEl.textContent = "…";
    miesiacEl.textContent = "";
    return;
  }
  const saldo = majSaldo(konto);
  saldoEl.style.setProperty("--maj-znaki", finKwota(saldo, true).length);
  animujLiczbe(saldoEl, saldo, function (n) { return finKwota(n, true); });
  saldoEl.classList.toggle("maj-minus", saldo < 0);
  const miesiac = majWMiesiacu(konto);
  const ile = majRuchyKonta(konto).length;
  miesiacEl.textContent = ile
    ? (miesiac ? majZeZnakiem(miesiac) + " w tym miesiącu" : "Bez zmian w tym miesiącu")
    : "Jeszcze nic tu nie ma.";
  // Kwota na przycisku przełączającym, żeby było widać saldo bez rozwijania
  const przelacz = document.querySelector('.maj-przelacz[data-konto="' + konto + '"]');
  let wartosc = przelacz.querySelector(".maj-przelacz-wartosc");
  if (!wartosc) {
    wartosc = document.createElement("span");
    wartosc.className = "maj-przelacz-wartosc";
    przelacz.append(wartosc);
  }
  wartosc.textContent = ile ? finZl(saldo) : "";
}

// Lista ruchów konta: kluczowana po id, najnowsze u góry, "Pokaż więcej" dokłada kolejną stronę
function renderMajListe(konto) {
  const kontener = konto === "gotowka" ? document.getElementById("maj-historia") : document.getElementById("maj-konto-" + konto);
  const lista = kontener.querySelector("[data-lista]");
  const wiecej = kontener.querySelector("[data-wiecej]");
  const ruchy = majRuchyKonta(konto);
  const widoczne = ruchy.slice(0, majPokazane[konto]);
  wiecej.hidden = ruchy.length <= widoczne.length;

  if (konto === "gotowka") {
    majEl.historiaLicznik.textContent = majLadowanie || !ruchy.length ? "" : ruchy.length + " " + odmianaLiczby(ruchy.length, "wpis", "wpisy", "wpisów");
    let pusto = kontener.querySelector(".maj-pusto");
    if (!majLadowanie && !ruchy.length) {
      if (!pusto) {
        pusto = document.createElement("p");
        pusto.className = "maj-pusto";
        pusto.textContent = "Tu pojawi się każda dodana i odjęta kwota.";
        kontener.prepend(pusto);
      }
    } else if (pusto) pusto.remove();
  }

  finSynchronizuj(lista, widoczne.map(function (r) { return String(r.id); }), function (k) {
    const r = majRuchy.find(function (x) { return String(x.id) === k; });
    const wiersz = document.createElement("div");
    wiersz.className = "maj-ruch" + (r.kwota < 0 ? " maj-ruch-minus" : "");
    const znak = document.createElement("span");
    znak.className = "maj-ruch-znak";
    znak.setAttribute("aria-hidden", "true");
    znak.innerHTML = r.kwota < 0
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
    const teksty = document.createElement("span");
    teksty.className = "maj-ruch-teksty";
    const opis = document.createElement("span");
    opis.className = "maj-ruch-opis";
    opis.textContent = r.opis || (r.kwota < 0 ? "Odjęte" : "Dodane");
    const meta = document.createElement("span");
    meta.className = "maj-ruch-meta";
    meta.textContent = r.data === dzisiaj() ? "dziś" : finSkrotDnia(r.data) + " " + finDzienMies(finDataZIso(r.data));
    teksty.append(opis, meta);
    const kwota = document.createElement("span");
    kwota.className = "maj-ruch-kwota";
    kwota.textContent = (r.kwota < 0 ? "−" : "+") + finKwota(Math.abs(r.kwota));
    const usun = finPrzyciskUsun("Usuń wpis: " + (r.opis || MAJ_KONTA[konto].nazwa) + ", " + finZl(r.kwota));
    usun.addEventListener("click", function () {
      finPotwierdzKlik(usun, function () {
        usun.disabled = true;
        majUsun(r).finally(function () { usun.disabled = false; });
      });
    });
    wiersz.append(znak, teksty, kwota, usun);
    return wiersz;
  }, function (wiersz, k, i, nowy) {
    if (nowy && majNowyId === widoczne[i].id) {
      finAnimujRaz(wiersz, "maj-wjazd");
      majNowyId = null;
    }
  });
}

// ----- Okno dodawania -----
function majOtworzOkno(konto) {
  if (!majDostep) return;
  majOknoKonto = konto;
  majUstawKierunek(1);
  majEl.oknoTytul.textContent = MAJ_KONTA[konto].dodaj;
  majEl.oknoOpis.textContent = MAJ_KONTA[konto].opis;
  majEl.kwota.value = "";
  majEl.opis.value = "";
  majEl.data.value = dzisiaj();
  majEl.data.max = dzisiaj();
  majRenderZapisz();
  majEl.okno.showModal();
  majEl.kwota.focus();
}

function majUstawKierunek(k) {
  majKierunek = k;
  majEl.kierunek.querySelectorAll("button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(Number(b.dataset.kierunek) === k));
  });
  majEl.okno.classList.toggle("maj-okno-minus", k < 0);
  majRenderZapisz();
}

function majRenderZapisz() {
  const kwota = finParsujKwote(majEl.kwota.value);
  majEl.zapisz.disabled = majZapisTrwa || !kwota;
  majEl.zapisz.textContent = majZapisTrwa ? "Zapisuję…" : (kwota ? (majKierunek < 0 ? "Odejmij " : "Dodaj ") + finZl(kwota) : "Wpisz kwotę");
}

async function majZapisz() {
  const kwota = finParsujKwote(majEl.kwota.value);
  if (majZapisTrwa || !kwota) return;
  const data = majEl.data.value && majEl.data.value <= dzisiaj() ? majEl.data.value : dzisiaj();
  const wiersz = { konto: majOknoKonto, data: data, kwota: majKierunek * kwota, opis: majEl.opis.value.trim() || null };
  majZapisTrwa = true;
  majRenderZapisz();
  const { data: zapisany, error } = await db.from("majatek_ruchy").insert(wiersz).select("id, konto, data, kwota, opis").single();
  majZapisTrwa = false;
  majRenderZapisz();
  if (error) {
    console.error(error);
    pokazToast("Nie udało się zapisać kwoty.", "blad");
    return;
  }
  majRuchy.push(Object.assign({}, zapisany, { kwota: Number(zapisany.kwota) }));
  majSortuj();
  majNowyId = zapisany.id;
  majEl.okno.close();
  if (majOknoKonto !== "gotowka") majUstawOtwarte(majOknoKonto, true);
  renderMajatek();
  pokazToast((wiersz.kwota < 0 ? "Odjęto " : "Dodano ") + finZl(Math.abs(wiersz.kwota)) + " – " + MAJ_KONTA[majOknoKonto].nazwa.toLowerCase() + ".", "sukces");
}

async function majUsun(r) {
  const { error } = await db.from("majatek_ruchy").delete().eq("id", r.id).eq("user_id", finUid());
  if (error) {
    console.error(error);
    pokazToast("Nie udało się usunąć wpisu.", "blad");
    return;
  }
  majRuchy = majRuchy.filter(function (x) { return x.id !== r.id; });
  renderMajatek();
  pokazToast("Usunięto wpis.", "sukces");
}

// ----- Osobne konta: rozwijane przyciskami, wybór zapamiętany na urządzeniu -----
function majUstawOtwarte(konto, otwarte) {
  document.getElementById("maj-konto-" + konto).hidden = !otwarte;
  document.querySelector('.maj-przelacz[data-konto="' + konto + '"]').setAttribute("aria-expanded", String(otwarte));
  try {
    const zapis = JSON.parse(localStorage.getItem(MAJ_KLUCZ_OTWARTE) || "{}");
    zapis[konto] = otwarte;
    localStorage.setItem(MAJ_KLUCZ_OTWARTE, JSON.stringify(zapis));
  } catch (e) {}
}

// ----- Budowa stałych elementów -----
(function majZbudujStale() {
  document.getElementById("maj-gwiazdy-tla").innerHTML = DZIS_PYL.slice(4, 16).map(function (d) {
    return '<circle class="dzis-pyl" cx="' + d.x + '" cy="' + d.y + '" r="' + d.r + '" style="animation-delay:' + d.opoznienie + 's"/>';
  }).join("");
  let zapis = {};
  try { zapis = JSON.parse(localStorage.getItem(MAJ_KLUCZ_OTWARTE) || "{}") || {}; } catch (e) {}
  ["inwestycje", "side_hustle"].forEach(function (konto) {
    document.getElementById("maj-konto-" + konto).hidden = !zapis[konto];
    document.querySelector('.maj-przelacz[data-konto="' + konto + '"]').setAttribute("aria-expanded", String(!!zapis[konto]));
  });
})();

// ----- Zdarzenia -----
navMajatek.addEventListener("click", majWejscie);

document.querySelectorAll("#widok-majatek [data-dodaj-konto]").forEach(function (btn) {
  btn.addEventListener("click", function () { majOtworzOkno(btn.dataset.dodajKonto); });
});

document.querySelectorAll("#widok-majatek .maj-przelacz").forEach(function (btn) {
  btn.addEventListener("click", function () {
    majUstawOtwarte(btn.dataset.konto, btn.getAttribute("aria-expanded") !== "true");
  });
});

document.querySelectorAll("#widok-majatek [data-wiecej]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const konto = btn.closest("[data-konto]").dataset.konto;
    majPokazane[konto] += MAJ_NA_STRONIE[konto];
    renderMajListe(konto);
  });
});

majEl.kierunek.addEventListener("click", function (e) {
  const btn = e.target.closest("button[data-kierunek]");
  if (btn) majUstawKierunek(Number(btn.dataset.kierunek));
});

// Pole kwoty: tylko cyfry i jeden przecinek, maks. 2 miejsca po przecinku (jak w Oszczędnościach)
majEl.kwota.addEventListener("input", function () {
  const surowe = majEl.kwota.value;
  let t = surowe.replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const i = t.indexOf(",");
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/,/g, "").slice(0, 2);
  if (t !== surowe) majEl.kwota.value = t;
  majRenderZapisz();
});

document.getElementById("maj-form").addEventListener("submit", function (e) {
  e.preventDefault();
  majZapisz();
});
document.getElementById("maj-anuluj").addEventListener("click", function () { majEl.okno.close(); });
// Stuknięcie w tło poza oknem zamyka je
majEl.okno.addEventListener("click", function (e) {
  if (e.target === majEl.okno) majEl.okno.close();
});
