// Konfiguracja: połączenie z Supabase (db), stałe konta i stan sesji. Ładowany jako pierwszy.

const SUPABASE_URL = "https://yrnubpuffivauxatvthr.supabase.co";
const SUPABASE_KEY = "sb_publishable_4nd418S2FdKpFmp5vGh1Ug_jltWAFrI";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== Logowanie (Supabase Auth, magic link) =====================

let sesjaUzytkownika = null; // aktualna sesja Supabase, ustawiana przez onAuthStateChange
let aplikacjaZainicjowana = false;
const AI_UZYTKOWNIK_ID = "1f1fc4a4-1b87-4ea7-9ddd-785873e98cbc"; // jedyne konto z dostępem do sekcji "AI Analiza" (i customowego nagłówka)
const JEDZENIE_WLACZONE = false; // Posiłki chwilowo schowane (menu, skrót "Zdjęcie", gwiazdy i sekcja na ekranie Dziś); kod, tabele i dane zostają – true przywraca
const JEDZENIE_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z dostępem do sekcji "Jedzenie" (tabele posilki, jedzenie_cele)
const FINANSE_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z dostępem do sekcji "Finanse" (tabele wydatki, budzety, widok oszczednosci) (te same konta co Jedzenie)
// Flip Hub (osobny projekt Supabase "flipy"): Side hustle w Majątku czyta stan telefonów funkcją stan_flipow(klucz);
// klucz konta leży w tabeli flip_hub_polaczenie (tylko do odczytu właściciela), klucz publiczny projektu jak we flip-hubie
const FLIP_HUB_URL = "https://gdmynwywomsfjbgzvfjt.supabase.co";
const FLIP_HUB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXlud3l3b21zZmpiZ3p2Zmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzM0NDQsImV4cCI6MjEwODQ0OTQ0NH0.bvvctdix-DsWTOWCGYzGHzqr0zf3--mTaJa4KTxc4fg";
const PRZEGLAD_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z przeglądem tygodnia od Claude (slajdy w js/podsumowanie.js, tabela przeglady, Edge Function przeglad-tygodnia z tą samą listą)
const MEDYTACJA_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z dostępem do sekcji "Medytacja" (tabele medytacje, medytacja_ustawienia) - te same co Jedzenie
const RADY_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z dostępem do sekcji "Rady z książek"
const KOSMETYKI_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z pigułką kosmetyków (te same co Jedzenie); dane tylko tu, bez bazy

// Plan kosmetyków (pigułka js/kosmetyki.js): rano codziennie, wieczór wg dnia tygodnia (getDay: 0 = niedziela)
const KOSMETYKI_PROG_WIECZOR = 15; // od tej godziny pigułka pokazuje wieczór, wcześniej rano
const KOSMETYKI_RANO = [
  "Żel CeraVe oczyszczający albo sama woda (jeśli skóra jest sucha, wystarczy woda)",
  "Niacynamid",
  "SPF Holika Holika"
];
const KOSMETYKI_WIECZOR_HIALURON = ["Żel CeraVe", "Kwas hialuronowy na wilgotną skórę", "Krem Dr. Althea 345"];
const KOSMETYKI_WIECZOR_KWAS = ["Żel CeraVe", "Tonik z kwasem glikolowym", "Emulsja CeraVe"];
const KOSMETYKI_WIECZOR_SPOKOJ = ["Żel CeraVe", "Krem Dr. Althea 345"];
const KOSMETYKI_WIECZOR = [
  KOSMETYKI_WIECZOR_SPOKOJ,   // niedziela
  KOSMETYKI_WIECZOR_HIALURON, // poniedziałek
  KOSMETYKI_WIECZOR_KWAS,     // wtorek
  KOSMETYKI_WIECZOR_HIALURON, // środa
  KOSMETYKI_WIECZOR_SPOKOJ,   // czwartek
  KOSMETYKI_WIECZOR_HIALURON, // piątek
  KOSMETYKI_WIECZOR_KWAS      // sobota
];
