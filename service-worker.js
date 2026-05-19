const CACHE_NAME = "something-dating-v1.4.5";
// Paths are relative to the service-worker location so they resolve
// correctly under both the GitHub Pages scope (/SomethingDating/) and the
// local dev server (/).
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/workflow.js",
  "./js/install.js",
  "./js/fittext.js",
  "./js/markdown.js",
  "./js/theme.js",
  "./js/phases/intro.js",
  "./js/phases/meeting.js",
  "./js/phases/dating.js",
  "./js/phases/keeping.js",
  "./html/credits.html",
  "./html/install-ios.html",
  "./html/install-android.html",
  "./images/logo/icon-192.png",
  "./images/logo/icon-512.png",
  "./images/intro.jpg",
  "./images/meeting.jpg",
  "./images/dating.jpg",
  "./images/keeping.jpg",
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
