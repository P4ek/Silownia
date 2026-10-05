# Siłownia – mapa projektu

Aplikacja PWA (dziennik treningowy + rozwój osobisty) hostowana na GitHub Pages jako zwykłe pliki statyczne.
Bez bundlera, npm i kroku build. Dane w Supabase (`js/konfiguracja.js`), wykresy przez Chart.js z CDN.

## Pliki

- `index.html` – cały HTML wszystkich ekranów (sekcje `<section id="widok-...">`), menu boczne, ekran logowania; podpina CSS i JS.
- `sw.js` – service worker (cache plików aplikacji, powiadomienia push). Po każdej zmianie plików podbij `CACHE_NAME`, a nowy plik CSS/JS dopisz do `ASSETS`.
- `manifest.json`, `logo/` – PWA.

| Ekran (menu) | Sekcja HTML | JS | CSS |
|---|---|---|---|
| Zapisz trening | `#widok-dodaj` | `js/zapisz-trening.js` | `css/zapisz-trening.css` |
| Rejestr ćwiczeń | `#widok-rejestr` | `js/rejestr.js` | `css/rejestr.css` |
| Wykres postępu | `#widok-wykres` | `js/wykres.js` | `css/wykres.css` |
| Katalog ćwiczeń | `#widok-nowe` | `js/katalog.js` | `css/katalog.css` |
| Zaplanuj trening | `#widok-zaplanuj` | `js/zaplanuj-trening.js` | `css/zaplanuj-trening.css` |
| Jedzenie (tylko konta z `JEDZENIE_DOSTEP_IDS`) | `#widok-jedzenie` | `js/jedzenie.js` | `css/jedzenie.css` |
| Plan tygodnia (Kompas) | `#widok-plan` | `js/plan-tygodnia.js` | `css/plan-tygodnia.css` |
| Nawyki | `#widok-habits` | `js/nawyki.js` | `css/nawyki.css` |
| Rady z książek (tylko konta z `RADY_DOSTEP_IDS`) | `#widok-rady` | `js/rady-z-ksiazek.js` | `css/rady-z-ksiazek.css` |
| Wnioski | `#widok-wnioski` | `js/wnioski.js` | `css/wnioski.css` |
| AI Analiza | `#widok-ai-analiza` | `js/ai-analiza.js` | `css/ai-analiza.css` |

Pozostałe:
- `js/konfiguracja.js` – klient Supabase (`db`), `AI_UZYTKOWNIK_ID`, `JEDZENIE_DOSTEP_IDS` (konta z sekcją Jedzenie: tabele `posilki`, `jedzenie_cele`, Edge Function `analizuj-posliek`), `RADY_DOSTEP_IDS` (konta z sekcją Rady z książek), stan sesji (`sesjaUzytkownika`).
- `js/wspolne.js` – funkcje używane przez wiele ekranów: `pokazToast`, `pustyStanHTML`, `wjazdKarty`, `animujLiczbe`, daty (`dzisiaj`, `isoZDaty`, `poniedzialekTygodnia`, `formatDatyRejestru`, nazwy dni/miesięcy), partie (`PARTIE`, `kolorPartiiCSS`, `kropkaPartii`), odmiana (`odmianaLiczby`), wspólne dane (`wpisy` – treningi, `katalog` – ćwiczenia) i JEDNA definicja rekordu (`obliczRekordy`, `wynikSerii`, `seriaRekordowaWpisu`, `czyWpisMaRekord`).
- `js/logowanie.js` – formularze logowania (kod z maila) i wylogowanie.
- `js/powiadomienia.js` – subskrypcja push (przycisk z dzwonkiem).
- `js/nawigacja.js` – hamburger, panel boczny, przełączanie widoków (odświeża Rejestr/Wykres/Wnioski przy wejściu).
- `js/start.js` – start aplikacji (patrz niżej) + rejestracja service workera.
- `css/baza.css` – zmienne (ciemny motyw, kolory partii `--partia-*`, złoty `--habits-zloto`), typografia, menu, karty, formularze, przyciski, banery, toasty, konfetti, animacje, puste stany, logowanie, responsywność.
- `css/motyw.css` – reguły ciemnego motywu (`.kontener.motyw-habits`, `#sidebar.motyw-habits`), zawsze włączonego.

## Kolejność ładowania i dlaczego

CSS (`<link>` w `<head>`): `baza` → arkusze ekranów → `motyw`. Kolejność ma znaczenie dla kaskady: `motyw.css` nadpisuje style ekranów, więc musi być ostatni.

JS: najpierw Supabase i Chart.js z CDN (zwykłe `<script>`), potem pliki aplikacji jako zwykłe skrypty (NIE `type="module"`) z `defer`, wykonywane po kolei po wczytaniu HTML:

1. `konfiguracja.js` – `db` musi istnieć, zanim cokolwiek z niego skorzysta.
2. `wspolne.js` – funkcje i stałe wykonywane od razu w plikach ekranów (np. `PARTIE[0]`, `poniedzialekTygodnia(new Date())`).
3. `logowanie.js`, pliki ekranów, `powiadomienia.js`, `nawigacja.js`.
4. `start.js` – ZAWSZE ostatni.

Wszystkie pliki dzielą jedną przestrzeń globalną (funkcje i `const`/`let` najwyższego poziomu są widoczne między plikami), ale:
- funkcja z pliku ładowanego później jest dostępna dopiero po jego wykonaniu. Kod wykonywany od razu przy wczytaniu pliku (poza funkcjami i obsługą zdarzeń) może więc używać tylko rzeczy z tego samego pliku albo z plików wcześniejszych;
- dlatego dopiero `start.js` uruchamia `db.auth.getSession()`, `onAuthStateChange` i `inicjalizujDaneAplikacji()`. Odpowiedź Supabase jest asynchroniczna i mogłaby przyjść między plikami, zanim wczytają się dalsze ekrany.

Nowy ekran: HTML w `index.html`, plik w `js/` (przed `nawigacja.js` i `start.js`) i w `css/` (przed `motyw.css`), wczytywanie danych dopisane w `inicjalizujDaneAplikacji` w `start.js`, oba pliki w `ASSETS` w `sw.js`.

## Zasady

- Apka ma zawsze ciemny motyw; kolory partii tylko ze zmiennych `--partia-*`.
- Rekord liczy wyłącznie `obliczRekordy()` (seria z najwyższym ciężar × powtórzenia).
- Wpisy treningów w tabeli `treningi` mają podejścia w formacie `[{ "cieżar": liczba, "powtorzenia": liczba }]` (z polskim „ż” w kluczu) – nie zmieniać.
- Usuwanie zawsze z potwierdzeniem, komunikaty przez `pokazToast`.
- `AI_UZYTKOWNIK_ID` (samo to konto): nielimitowana AI Analiza i cytat w nagłówku. Dane każdej sekcji zawsze filtrowane po `sesjaUzytkownika.user.id`, nigdy po stałych kont.
- Po zmianach podbij `CACHE_NAME` w `sw.js`.
