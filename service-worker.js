const CACHE_NAME = "something-dating-v1.4.4";
const ASSETS = [
  "/SomethingDating/",
  "/SomethingDating/index.html",
  "/SomethingDating/css/styles.css",
  "/SomethingDating/js/app.js",
  "/SomethingDating/js/workflow.js",
  "/SomethingDating/js/install.js",
  "/SomethingDating/js/fittext.js",
  "/SomethingDating/html/credits.html",
  "/SomethingDating/html/install-ios.html",
  "/SomethingDating/html/install-android.html",
  "/SomethingDating/js/phases/intro.js",
  "/SomethingDating/js/phases/meeting.js",
  "/SomethingDating/js/phases/dating.js",
  "/SomethingDating/js/phases/keeping.js",
  "/SomethingDating/manifest.json",
  "/SomethingDating/images/logo/icon-192.png",
  "/SomethingDating/images/logo/icon-512.png",
  "/SomethingDating/images/intro.jpg",
  "/SomethingDating/images/meeting.jpg",
  "/SomethingDating/images/dating.jpg",
  "/SomethingDating/images/keeping.jpg",
];

// Install: pre-cache all assets in the new versioned cache.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

// Activate: delete old caches and take control of open clients.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch strategy:
//   - Navigation (HTML): network-first, fall back to cache. Ensures cold
//     starts pull the latest app shell when online.
//   - App-shell code (JS/CSS/JSON/HTML partials): stale-while-revalidate.
//     Fast paint from cache, refresh in background for next launch.
//   - Everything else (images, fonts): cache-first.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const accept = req.headers.get("accept") || "";
  const isNavigation =
    req.mode === "navigate" || accept.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (cached) =>
                cached || caches.match("/SomethingDating/index.html"),
            ),
        ),
    );
    return;
  }

  const isAppShell = /\.(js|css|json)$/.test(url.pathname) ||
    /\/html\/.+\.html$/.test(url.pathname);
  if (isAppShell) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)),
  );
});
