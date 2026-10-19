// Powiadomienia push: subskrypcja przypomnień (przycisk z dzwonkiem).

// ===================== Powiadomienia push: subskrypcja przypomnień =====================
const VAPID_PUBLIC_KEY = "BALkhoQiMsI1xvieey3yF9eHsli8XrOBqM_CfIG1K_6SBjPLhjH-TatVDLMIsjQT4CFCL1MgNv2iMSa4gqy0z1k";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function wlaczPrzypomnienia() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    pokazToast("Twoja przeglądarka nie wspiera powiadomień push.", "blad");
    return;
  }

  const zgoda = await Notification.requestPermission();
  if (zgoda !== "granted") {
    pokazToast("Nie zezwolono na powiadomienia - włącz je w ustawieniach systemowych, jeśli zmienisz zdanie.", "blad");
    return;
  }

  try {
    const rejestracja = await navigator.serviceWorker.ready;
    const subskrypcja = await rejestracja.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    const subJson = subskrypcja.toJSON();

    const { error } = await db.from("push_subskrypcje").upsert(
      {
        user_id: sesjaUzytkownika.user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      pokazToast("Nie udało się zapisać subskrypcji: " + error.message, "blad");
      return;
    }

    pokazToast("Przypomnienia włączone - odezwą się o 20:00, jeśli nic jeszcze nie zapiszesz.", "sukces");
  } catch (e) {
    pokazToast("Nie udało się włączyć przypomnień: " + e.message, "blad");
  }
}

const btnPrzypomnienia = document.getElementById("btn-przypomnienia");
if (btnPrzypomnienia) {
  btnPrzypomnienia.addEventListener("click", wlaczPrzypomnienia);
}
