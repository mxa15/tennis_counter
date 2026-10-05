const CACHE_NAME = "Offline-test-v1.0.0";

const CACHE_FILES = [
  "/offline-startpage.html",
  "/offlineMatch",
  "/match.js",
  "/match_handy.css",
  "/match.css",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(CACHE_FILES);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const exists = await caches.has(CACHE_NAME);

      if (!exists) {
        const cacheNames = await caches.keys();

        await Promise.all(cacheNames.map((name) => caches.delete(name)));

        const cache = await caches.open(CACHE_NAME);

        await cache.addAll(CACHE_FILES);
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname == "/startseite") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("/offline-startpage.html");
      }),
    );
  }
});
