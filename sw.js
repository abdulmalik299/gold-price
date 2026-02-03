// Simple service worker for offline-first shell caching (PWA)
const CACHE_NAME = "aurum-iq-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./logic.js",
  "./worker.js",
  "./config.js",
  "./chart-history.json",
  "./manifest.json",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for the live API, cache-first for app assets
  if (url.hostname.includes("api.gold-api.com")){
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type":"application/json" } }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      // update cache
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
