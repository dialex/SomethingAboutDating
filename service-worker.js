const CACHE_NAME = "something-dating-v1.2.64";
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

// Install: cache all assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch: cache-first, fall back to network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});
