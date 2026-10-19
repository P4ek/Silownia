// Konfiguracja: połączenie z Supabase (db), stałe konta i stan sesji. Ładowany jako pierwszy.

const SUPABASE_URL = "https://yrnubpuffivauxatvthr.supabase.co";
const SUPABASE_KEY = "sb_publishable_4nd418S2FdKpFmp5vGh1Ug_jltWAFrI";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== Logowanie (Supabase Auth, magic link) =====================

let sesjaUzytkownika = null; // aktualna sesja Supabase, ustawiana przez onAuthStateChange
let aplikacjaZainicjowana = false;
const AI_UZYTKOWNIK_ID = "1f1fc4a4-1b87-4ea7-9ddd-785873e98cbc"; // jedyne konto z dostępem do sekcji "AI Analiza" (i customowego nagłówka)
const JEDZENIE_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z dostępem do sekcji "Jedzenie" (tabele posilki, jedzenie_cele)
const FINANSE_DOSTEP_IDS = [AI_UZYTKOWNIK_ID, "7b44bfd8-d20d-45bc-872a-8633deff4798"]; // konta z dostępem do sekcji "Finanse" (tabele wydatki, budzety, widok oszczednosci) (te same konta co Jedzenie)
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
