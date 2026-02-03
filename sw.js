/* LuxGold PWA Service Worker */
const CACHE_NAME = "luxgold-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./logic.js",
  "./worker.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./chart-history.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for live gold API
  if (url.hostname === "api.gold-api.com") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type":"application/json" }});
      }
    })());
    return;
  }

  // CDN: stale-while-revalidate
  if (url.hostname.includes("jsdelivr") || url.hostname.includes("cdnjs") || url.hostname.includes("unpkg")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => (cache.put(req, res.clone()), res)).catch(() => null);
      return cached || (await fetchPromise) || fetch(req);
    })());
    return;
  }

  // App shell: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    return cached || fetch(req);
  })());
});
