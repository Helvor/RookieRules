// Service worker : met l'application en cache pour l'utiliser hors ligne.
// Les fichiers sont servis « réseau d'abord » : changer VERSION n'est utile que pour purger l'ancien cache.
const VERSION = "trackrules-v4";

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/js/app.js",
  "assets/js/ecriture.js",
  "assets/js/prefs.js",
  "assets/js/i18n.js",
  "assets/js/quiz.js",
  "assets/js/rules.js",
  "assets/js/store.js",
  "assets/js/util.js",
  "data/rules.json",
  "data/questions.json",
  "data/rules.en.json",
  "data/questions.en.json",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/figures/fig-2-1-track.png",
  "assets/figures/fig-2-2-zones-cibles.png",
  "assets/figures/fig-2-3-zones-blocage.png",
  "assets/figures/fig-4-1-1-zones-cibles.png",
  "assets/figures/fig-4-1-2-zones-blocage.png",
  "assets/figures/c2-2-positions.png",
  "assets/figures/c2-3-a.png",
  "assets/figures/c2-3-b.png",
  "assets/figures/c2-3-c.png",
  "assets/figures/en/track_dimensions.png",
  "assets/figures/en/target_zones.png",
  "assets/figures/en/blocking_zones.png",
  "assets/figures/en/c-gameplay-positions.png",
  "assets/figures/en/c-gameplay-pack-blocked-out.png",
  "assets/figures/en/c-gameplay-front-skates-forward.png",
  "assets/figures/en/c-gameplay-pack-stretch.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Réseau d'abord (pour avoir les dernières règles et questions), cache en secours hors ligne.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))),
  );
});
