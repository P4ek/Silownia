// Odsłanianie przy przewijaniu (wszystkie ekrany, oba wyglądy): karty i wiersze list, które w chwili pojawienia się w DOM
// są poniżej widocznej części ekranu (albo na ukrytym ekranie), pokazują się płynnie dopiero, gdy do nich zjedziesz.
// To, co od początku jest na ekranie, nie animuje się – przerysowanie listy (np. po odhaczeniu nawyku) niczego nie miga.
// Kilka elementów wchodzących naraz dostaje kolejne opóźnienia. Po animacji klasy znikają, więc element wraca do własnych
// styli (przechyły, sprężynowanie). Bezpośrednie dzieci ekranu pomija (mają wejście z blask.css). Style: css/odslanianie.css.

const ODSLON_SELEKTOR = [
  ".karta", ".rejestr-karta", ".wykres-karta", ".gablota-karta", ".plany-karta", ".plan-okladka", ".zapis-sztanga", ".zapis-licznik",
  ".habits-tydzien", ".habits-kafel", ".katalog-kafel", ".kompas-blok", ".kompas-dzien", ".rady-bilet", ".ssw",
  ".zapis-dzis-wiersz", ".katalog-wiersz", ".plan-lista-wiersz", ".superseria-slot", ".superseria-runda",
  ".dzis-bohater", ".dzis-czesc", ".dzis-lista", ".dzis-tydzien-gwiazdy", ".dzis-cel", ".dzis-rada",
  ".fin-szklo", ".fin-nowy", ".fin-wydatek", ".fin-fiolka", ".med-szklo", "#med-historia-lista > li",
  ".maj-lista-glowna", ".maj-ruch", ".maj-akcja", ".jedz-posilek"
].join(", ");
const ODSLON_KROK_MS = 60;     // opóźnienie między elementami wchodzącymi naraz
const ODSLON_MAKS_KROKOW = 6;

(function () {
  if (!window.IntersectionObserver || !window.MutationObserver) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const aplikacjaEl = document.getElementById("aplikacja");

  function zakoncz(el) {
    el.classList.remove("odslon", "odslon-widoczne");
    el.style.removeProperty("--odslon-opoznienie");
  }

  const obserwator = new IntersectionObserver(function (wpisy) {
    let krok = 0;
    wpisy.forEach(function (w) {
      const el = w.target;
      // Pierwsze zgłoszenie: widoczny od razu → bez animacji; poza ekranem (albo na ukrytym ekranie) → czeka schowany
      if (!el._odslonStan) {
        if (w.isIntersecting) {
          el._odslonStan = "jest";
          obserwator.unobserve(el);
        } else {
          el._odslonStan = "czeka";
          el.classList.add("odslon");
        }
        return;
      }
      if (w.isIntersecting && el._odslonStan === "czeka") {
        el._odslonStan = "jest";
        obserwator.unobserve(el);
        el.style.setProperty("--odslon-opoznienie", Math.min(krok++, ODSLON_MAKS_KROKOW) * ODSLON_KROK_MS + "ms");
        el.classList.add("odslon-widoczne");
        el.addEventListener("transitionend", function koniec(e) {
          if (e.target !== el || e.propertyName !== "transform") return;
          el.removeEventListener("transitionend", koniec);
          zakoncz(el);
        });
        setTimeout(function () { zakoncz(el); }, 1600); // gdyby transitionend nie przyszedł
      }
    });
  }, { rootMargin: "0px 0px -6% 0px" });

  function obserwuj(el) {
    if (el._odslonStan || el.parentElement && el.parentElement.classList.contains("widok")) return;
    obserwator.observe(el);
  }
  function przeszukaj(korzen) {
    if (korzen.nodeType !== 1) return;
    if (korzen.matches(ODSLON_SELEKTOR)) obserwuj(korzen);
    korzen.querySelectorAll(ODSLON_SELEKTOR).forEach(obserwuj);
  }

  przeszukaj(aplikacjaEl);
  new MutationObserver(function (zmiany) {
    zmiany.forEach(function (z) { z.addedNodes.forEach(przeszukaj); });
  }).observe(aplikacjaEl, { childList: true, subtree: true });
})();
