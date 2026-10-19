# Siłownia – mapa projektu

Aplikacja PWA (dziennik treningowy + rozwój osobisty) hostowana na GitHub Pages jako zwykłe pliki statyczne.
Bez bundlera, npm i kroku build. Dane w Supabase (`js/konfiguracja.js`), wykresy przez Chart.js z CDN.

## Pliki

- `index.html` – cały HTML wszystkich ekranów (sekcje `<section id="widok-...">`), menu boczne, ekran logowania; podpina CSS i JS.
- `sw.js` – service worker (cache plików aplikacji, powiadomienia push). Po każdej zmianie plików podbij `CACHE_NAME`, a nowy plik CSS/JS dopisz do `ASSETS`.
- `manifest.json`, `logo/` – PWA.

| Ekran (menu) | Sekcja HTML | JS | CSS |
|---|---|---|---|
| Dziś (ekran startowy; bez własnych zapytań, dane ze startu przez `dzisDaneGotowe` w `start.js`; sztanga dnia zamiast gwiazdozbioru) | `#widok-dzis` | `js/dzis.js` | `css/dzis.css` |
| Zapisz trening | `#widok-dodaj` | `js/zapisz-trening.js` | `css/zapisz-trening.css` |
| Rejestr ćwiczeń | `#widok-rejestr` | `js/rejestr.js` | `css/rejestr.css` |
| Wykres postępu | `#widok-wykres` | `js/wykres.js` | `css/wykres.css` |
| Katalog ćwiczeń | `#widok-nowe` | `js/katalog.js` | `css/katalog.css` |
| Zaplanuj trening | `#widok-zaplanuj` | `js/zaplanuj-trening.js` | `css/zaplanuj-trening.css` |
| Jedzenie (tylko konta z `JEDZENIE_DOSTEP_IDS`) | `#widok-jedzenie` | `js/jedzenie.js` | `css/jedzenie.css` |
| Plan tygodnia (Kompas) | `#widok-plan` | `js/plan-tygodnia.js` | `css/plan-tygodnia.css` |
| Nawyki | `#widok-habits` | `js/nawyki.js` | `css/nawyki.css` |
| Rady z książek (tylko konta z `RADY_DOSTEP_IDS`) | `#widok-rady` | `js/rady-z-ksiazek.js` | `css/rady-z-ksiazek.css` |
| Medytacja (tylko konta z `MEDYTACJA_DOSTEP_IDS`; pozycja `#nav-medytacja` w ROZWÓJ ukryta do sprawdzenia dostępu w `start.js`) | `#widok-medytacja` | `js/medytacja.js` (start / odliczanie / koniec wg `makiety/medytacja-nic-ekrany-1-3.html`; nić z `medFala` – maks. 3 ścieżki, ruch przez transform, animacje tylko na ekranie; koralik „+” = własny czas 1–`MED_MAX_MINUT` (20) min, więcej obcinane do 20, cel z bazy też najwyżej 20, ostatni zapamiętany w localStorage jako koralik; na dole spis ukończonych sesji z `medytacje`, wczytywany przy wejściu i po każdym zapisie, ukryty w trakcie odliczania) | `css/medytacja.css` (ładowany po `motyw.css`; zakres `#widok-medytacja`; płasko: `.med-szklo` to zwykła powierzchnia, `.med-szklo-tint` jasny przycisk, ścieżka poświaty nici ukryta) |
| Wnioski (ukryte w menu, kod zostaje) | `#widok-wnioski` | `js/wnioski.js` | `css/wnioski.css` |
| AI Analiza (ukryta w menu, kod zostaje) | `#widok-ai-analiza` | `js/ai-analiza.js` | `css/ai-analiza.css` |
| Finanse → Oszczędności (tylko konta z `FINANSE_DOSTEP_IDS`; cały rozdział menu `#menu-rozdzial-finanse` ukryty do sprawdzenia dostępu w `start.js`) | `#widok-finanse` | `js/finanse.js` (układ wg `makiety/oszczednosci-liquid-glass.html`, wygląd płaski jak reszta apki; listy kluczowane i aktualizowane punktowo, formularz wydatku to stały HTML – pola nie tracą fokusu; tytuł aplikacji ukryty na tym ekranie, kapsuła tygodnia w wierszu przycisku menu; iskra `dzisIskra` z `dzis.js`) | `css/finanse.css` (ładowany po `motyw.css`; zakres `#widok-finanse`; `.fin-szklo` to zwykła powierzchnia – bez rozmycia; tło i gwiazdki tła ukryte; blade odcienie kategorii `--fin-k1..7` wg kolejności kategorii, poziom w fiolkach szary, przekroczenie w `--negatyw`) |

Pozostałe:
- `js/konfiguracja.js` – klient Supabase (`db`), `AI_UZYTKOWNIK_ID`, `JEDZENIE_DOSTEP_IDS` (konta z sekcją Jedzenie: tabele `posilki`, `jedzenie_cele`, Edge Function `analizuj-posliek`; „Zjedz ponownie” w `jedzenie.js` dodaje kopię posiłku z ostatnich 30 dni bez AI), `RADY_DOSTEP_IDS` (konta z sekcją Rady z książek), `MEDYTACJA_DOSTEP_IDS` (konta z sekcją Medytacja: tabela `medytacje` – data, minuty numeric(5,1), ocena_przed/ocena_po 1–5, notatka – i `medytacja_ustawienia` z `cel_minuty`, czytany przy każdym wejściu na ekran, brak wiersza = 7, wiersza nie tworzymy; `user_id` uzupełnia baza. Sesja zapisuje się sama po czasie (insert), a „Zapisz” na końcu robi update tego wiersza; czas z zapisanego końca sesji (`Date.now`), stan sesji w localStorage; przy zablokowanym ekranie apkę trzyma element audio z WAV generowanym w przeglądarce (cisza + gong-miska 16 s, 11025 Hz/16 bit/mono, gong liczony raz w `medPoliczGong`); po zapisie nawyk z „medyt” w nazwie ustawiany przez `zapiszNawykZrobiony` z `nawyki.js`; trwająca sesja wraca po starcie przez `medPrzywrocSesje` w `start.js`), `FINANSE_DOSTEP_IDS` (konta z sekcją Finanse: tabele `wydatki`, `budzety` – unikalne `(user_id, tydzien_od, kategoria)`, zapis przez upsert – i widok `oszczednosci` tylko do odczytu; `user_id` uzupełnia baza; dane wczytywane przy pierwszym wejściu na ekran, tylko oglądany tydzień + suma ogólna + najwcześniejszy tydzień + podpowiedzi „Często” (50 ostatnich wydatków); tydzień bez budżetów dostaje kopię z ostatniego wcześniejszego tygodnia zapisaną w bazie), stan sesji (`sesjaUzytkownika`).
- `js/wspolne.js` – funkcje używane przez wiele ekranów: `pokazToast`, `pustyStanHTML`, `wjazdKarty`, `animujLiczbe`, daty (`dzisiaj`, `isoZDaty`, `poniedzialekTygodnia`, `formatDatyRejestru`, nazwy dni/miesięcy), partie (`PARTIE`, `kolorPartiiCSS`, `kropkaPartii`), odmiana (`odmianaLiczby`), wspólne dane (`wpisy` – treningi, `katalog` – ćwiczenia) i JEDNA definicja rekordu (`obliczRekordy`, `wynikSerii`, `seriaRekordowaWpisu`, `czyWpisMaRekord`).
- `js/logowanie.js` – formularze logowania (kod z maila) i wylogowanie.
- `js/powiadomienia.js` – subskrypcja push (przycisk z dzwonkiem).
- `js/nawigacja.js` – hamburger, panel boczny, przełączanie widoków (odświeża Rejestr/Wykres/Wnioski przy wejściu).
- `js/start.js` – start aplikacji (patrz niżej) + rejestracja service workera.
- `css/baza.css` – tokeny stylu (patrz „Styl” niżej), stare nazwy `--habits-*` przypięte do nowych tokenów, kolory partii `--partia-*`, typografia, karty, formularze, przyciski, banery, toasty, konfetti, puste stany, logowanie, responsywność.
- `css/motyw.css` – reguły ciemnego motywu (`.kontener.motyw-habits`), zawsze włączonego; płaskie karty, bez szkła i poświat.
- `css/menu.css` – menu: okrągły przycisk menu (`.kropla`, 44 px), pełnoekranowe menu z rzędem trzech skrótów (`.menu-zakladka`) i listą bez kursywy, aktywna pozycja = jaśniejszy tekst (logika w `js/nawigacja.js`). Ładowany po `motyw.css`, potem `dzis.css`, `finanse.css`, `rejestr-superseria.css`, `medytacja.css` i `sztanga.css`.
- `css/rejestr-superseria.css` – karta superserii w Rejestrze (`budujRamkeSuperserii` w `js/rejestr.js`, układ wg `makiety/rejestr-superseria.html`) i pigułka „N superserii”; zakres `#widok-rejestr`, ładowany ostatni. Rundy = podejścia ćwiczeń sparowane po indeksie (brak = „–”), maks. 4 rundy widoczne, więcej przewija się w bok. Płaska karta bez animacji: iskry, mostek i numer są ukryte w CSS, klasy `.ssw-animowana`/`.widoczna` z JS nic już nie animują; słupki w kolorze partii, rekord w `--akcent-danych`.
- `css/sztanga.css` – warstwa charakteru „Kreda i żelazo” (patrz „Styl”), ładowana jako ostatnia.

## Kolejność ładowania i dlaczego

CSS (`<link>` w `<head>`): `baza` → arkusze ekranów → `motyw`. Kolejność ma znaczenie dla kaskady: `motyw.css` nadpisuje style ekranów, a po nim idą `menu.css`, `dzis.css`, `finanse.css`, `rejestr-superseria.css`, `medytacja.css` i na końcu `sztanga.css` (warstwa charakteru).

JS: najpierw Supabase i Chart.js z CDN (zwykłe `<script>`), potem pliki aplikacji jako zwykłe skrypty (NIE `type="module"`) z `defer`, wykonywane po kolei po wczytaniu HTML:

1. `konfiguracja.js` – `db` musi istnieć, zanim cokolwiek z niego skorzysta.
2. `wspolne.js` – funkcje i stałe wykonywane od razu w plikach ekranów (np. `PARTIE[0]`, `poniedzialekTygodnia(new Date())`).
3. `logowanie.js`, pliki ekranów, `powiadomienia.js`, `nawigacja.js`.
4. `start.js` – ZAWSZE ostatni.

Wszystkie pliki dzielą jedną przestrzeń globalną (funkcje i `const`/`let` najwyższego poziomu są widoczne między plikami), ale:
- funkcja z pliku ładowanego później jest dostępna dopiero po jego wykonaniu. Kod wykonywany od razu przy wczytaniu pliku (poza funkcjami i obsługą zdarzeń) może więc używać tylko rzeczy z tego samego pliku albo z plików wcześniejszych;
- dlatego dopiero `start.js` uruchamia `db.auth.getSession()`, `onAuthStateChange` i `inicjalizujDaneAplikacji()`. Odpowiedź Supabase jest asynchroniczna i mogłaby przyjść między plikami, zanim wczytają się dalsze ekrany.

Nowy ekran: HTML w `index.html`, plik w `js/` (przed `nawigacja.js` i `start.js`) i w `css/` (przed `motyw.css`), wczytywanie danych dopisane w `inicjalizujDaneAplikacji` w `start.js`, oba pliki w `ASSETS` w `sw.js`.

## Styl „Kreda i żelazo”

Apka wygląda jak siłownia (koncept zamiast szablonu; wcześniejszy płaski styl ze skilla `design-taste-frontend` był „bez duszy”):
- Tokeny w `:root` w `css/baza.css`: tło `--tlo` + `--guma` (gumowa podłoga z kolorowymi drobinkami, SVG w data URI na `body` i menu), `--powierzchnia` / `--wypukle`, `--linia` / `--linia-mocna`, kreda `--tekst` / `--tekst-2` / `--tekst-3`, talerze olimpijskie `--talerz-25` (czerwony), `--talerz-20` (niebieski), `--talerz-15` (żółty), `--talerz-10` (zielony), `--talerz-5` (biały), `--pozytyw` / `--negatyw`. Stare `--habits-*` wskazują na nie (`--habits-akcent` i `--habits-zloto` = żółty talerz). Partie mają barwy talerzy (klata 25, plecy 20, barki 15, nogi 10, brzuch 5) i taśm.
- Kroje: `--font-tablica` (Big Shoulders Display, WERSALIKI) na tytułach, nagłówkach sekcji, menu, przyciskach głównych i dużych liczbach (tablica wyników); `--font` (Archivo) na tekście. Małe etykiety zwykłym tekstem (bez rozstrzelonych wersalików, bez `.toUpperCase()` w JS).
- `css/sztanga.css` (ładowany ostatni) to warstwa charakteru: listy selektorów z krojem tablicowym i rozmiarami, przyciski główne jako żółta taśma (`border-radius: 6px`), przycisk menu = żółty talerz obracany przy otwarciu, menu jak napisy na ścianie (aktywna pozycja na żółtej taśmie, skróty w kolorach talerzy), sztanga i kolory części dnia. Uwaga: listy `:is(...)` zawierają selektory z `#id`, więc późniejsze nadpisanie potrzebuje też `#widok-…`.
- Sztanga: `sztangaSVG(kg)` / `sztangaOpis(kg)` / `sztangaTalerzeNaStrone(kg)` w `js/wspolne.js` (gryf 20 kg, talerze 25–1,25 zachłannie na stronę). Zapisz trening rysuje ją nad licznikami (`renderZapisSztanga`, przerysowanie tylko przy zmianie załadunku). Ekran Dziś: `renderDzisNiebo` rysuje sztangę dnia – każda rzecz do zrobienia to para talerzy (trening 25, misja 20, posiłki 10, nawyki 15), zrobione w kolorze, reszta przerywaną kredą; przyciski talerzy po prawej (lustro po lewej ma `aria-hidden`). Ikony części dnia i tydzień to talerze/słupki.
- Bez gradientów, szkła i poświat; animacje tylko krótkie (talerz wjeżdża na gryf), wyłączane przez `prefers-reduced-motion`.
- Podgląd do zrzutów (bez Supabase): `.taste-skill/podglad/` (atrapa bazy, `zbuduj.sh` robi `podglad.html`, `zrzuty.mjs <folder> 390 widok-…` – też `menu` i `sztanga`); poza gitem.

## Zasady

- Apka ma zawsze ciemny motyw; kolory partii tylko ze zmiennych `--partia-*`.
- Rekord liczy wyłącznie `obliczRekordy()` (seria z najwyższym ciężar × powtórzenia).
- Wpisy treningów w tabeli `treningi` mają podejścia w formacie `[{ "cieżar": liczba, "powtorzenia": liczba }]` (z polskim „ż” w kluczu) – nie zmieniać.
- Superseria (przycisk „Super seria” w Zapisz trening, kod na końcu `js/zapisz-trening.js`): 2–3 różne ćwiczenia, rundy wpisywane na przemian, zapisywane tylko pełne rundy. Każde ćwiczenie to zwykły wiersz `treningi` (Wykres/rekordy działają bez zmian) ze wspólnym `superseria_id` (UUID z apki) i `superseria_poz` 1–3, ta sama data, tablice `podejscia` równej długości; wszystkie wiersze jednym insertem. Rejestr pokazuje je w jednej ramce „Superseria” (rundy, objętość, rekordy; patrz `css/rejestr-superseria.css`) i pigułkę „N superserii”; usunięcie (Rejestr i „Dziś zapisane”, przez `usunSuperserie`) kasuje wszystkie wiersze z tym `superseria_id` jednym zapytaniem. Pojedynczych wpisów superserii się nie edytuje ani nie usuwa.
- Usuwanie zawsze z potwierdzeniem, komunikaty przez `pokazToast`.
- `AI_UZYTKOWNIK_ID` (samo to konto): nielimitowana AI Analiza i cytat w nagłówku. Dane każdej sekcji zawsze filtrowane po `sesjaUzytkownika.user.id`, nigdy po stałych kont.
- Po zmianach podbij `CACHE_NAME` w `sw.js`.
