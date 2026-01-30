/* ======================================================
   SERVICE WORKER — GOLD ENGINE PWA
   Cache-first UI • Network-first API • Auto-clean
   ====================================================== */

const CACHE_NAME = "gold-engine-v4";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./logic.js",
  "./dailyChange.js",
  "./manifest.json"
];

/* ---------- INSTALL ---------- */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* ---------- ACTIVATE ---------- */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ---------- FETCH ---------- */
self.addEventListener("fetch", event => {
  const req = event.request;

  // Live price APIs → Network first
  if (
    req.url.includes("gold") ||
    req.url.includes("api") ||
    req.url.includes("price")
  ) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // App shell → Cache first
  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});
