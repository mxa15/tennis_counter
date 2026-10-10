const CACHE_NAME = "Tennis-Counter-Offline-test-v1.0.2";

const CACHE_FILES = [
  "/images/image.png",
  "/offline-startpage.html",
  "/index_handy.css",
  "/offlineMatch",
  "/match.js",
  "/match_handy.css",
  "/match.css",
  "/service-worker-register.js",
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
  console.log("hallo");

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
  if (url.pathname == "/index_handy.css") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("/index_handy.css");
      }),
    );
  }
  if (url.pathname == "/images/image.png") {
    event.respondWith(caches.match("/images/image.png"));
  }
  if (url.pathname == "/service-worker-register.js") {
    event.respondWith(caches.match("/service-worker-register.js"));
  }
  if (url.pathname == "/api/updatematch") {
    event.respondWith(
      (async () => {
        const requestCopy = event.request.clone();

        try {
          return await fetch(event.request);
        } catch {
          console.log("offfff");

          const cache = await caches.open(CACHE_NAME);
          const body = await requestCopy.text();

          await cache.put(
            "/matchsettings.json",
            new Response(body, {
              headers: {
                "Content-Type": "application/json",
              },
            }),
          );

          return new Response(JSON.stringify({ offline: true, saved: true }), {
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
      })(),
    );
  }
});
