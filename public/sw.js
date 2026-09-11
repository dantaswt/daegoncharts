const CACHE_NAME = "daegon-charts-assets-v2";
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("daegon-charts-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Cache versioned assets only; HTML and server functions always use live data.
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/assets/")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 150)).map((key) => cache.delete(key)));
    }
    return response;
  })());
});
