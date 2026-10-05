const CACHE_NAME = "silownia-v21";
const ASSETS = [
  "./",
  "./index.html",
  "./css/baza.css",
  "./css/zapisz-trening.css",
  "./css/rejestr.css",
  "./css/wykres.css",
  "./css/katalog.css",
  "./css/zaplanuj-trening.css",
  "./css/jedzenie.css",
  "./css/plan-tygodnia.css",
  "./css/nawyki.css",
  "./css/rady-z-ksiazek.css",
  "./css/wnioski.css",
  "./css/ai-analiza.css",
  "./css/motyw.css",
  "./js/konfiguracja.js",
  "./js/wspolne.js",
  "./js/logowanie.js",
  "./js/zapisz-trening.js",
  "./js/rejestr.js",
  "./js/wykres.js",
  "./js/katalog.js",
  "./js/zaplanuj-trening.js",
  "./js/jedzenie.js",
  "./js/plan-tygodnia.js",
  "./js/nawyki.js",
  "./js/rady-z-ksiazek.js",
  "./js/wnioski.js",
  "./js/ai-analiza.js",
  "./js/powiadomienia.js",
  "./js/nawigacja.js",
  "./js/start.js",
  "./manifest.json",
  "./logo/icon-192.png",
  "./logo/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Zostaw przeglądarce bez ingerencji wszystko poza GET-ami do własnej domeny
  // (czyli m.in. wszystkie zapytania do Supabase i Edge Functions)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
// ----- Obsługa powiadomień push (przypomnienie o zapisaniu treningu/nawyku) -----

self.addEventListener("push", (event) => {
  let dane = {};
  try {
    dane = event.data ? event.data.json() : {};
  } catch (e) {
    dane = { title: "Silownia", body: event.data ? event.data.text() : "" };
  }

  const tytul = dane.title || "Dziennik treningowy";
  const opcje = {
    body: dane.body || "",
    icon: "./logo/icon-192.png",
    badge: "./logo/icon-192.png",
    tag: "silownia-przypomnienie"
  };

  event.waitUntil(self.registration.showNotification(tytul, opcje));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((lista) => {
      for (const klient of lista) {
        if ("focus" in klient) return klient.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
    })
  );
});
