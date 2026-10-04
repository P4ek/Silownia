// Konfiguracja: połączenie z Supabase (db), stałe konta i stan sesji. Ładowany jako pierwszy.

const SUPABASE_URL = "https://yrnubpuffivauxatvthr.supabase.co";
const SUPABASE_KEY = "sb_publishable_4nd418S2FdKpFmp5vGh1Ug_jltWAFrI";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== Logowanie (Supabase Auth, magic link) =====================

let sesjaUzytkownika = null; // aktualna sesja Supabase, ustawiana przez onAuthStateChange
let aplikacjaZainicjowana = false;
const AI_UZYTKOWNIK_ID = "1f1fc4a4-1b87-4ea7-9ddd-785873e98cbc"; // jedyne konto z dostępem do sekcji "AI Analiza" (i customowego nagłówka)
