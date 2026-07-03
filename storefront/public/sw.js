const CACHE = "ovira-v4";
const OFFLINE_URL = "/shop/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/shop", OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // NEVER intercept API/auth calls: they must reach the network natively so the
  // session cookie is always sent/stored. Routing them through the SW's
  // fetch(request) can drop credentials in some browsers and break login.
  if (url.pathname.includes("/api/")) return;

  // Navigations: network-first, fall back to the offline page when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
      ),
    );
    return;
  }

  // Only static assets + images are cached (cache-first). Everything else is
  // left to the browser's native handling.
  const cacheable = request.destination === "image" || url.pathname.includes("/_next/static");
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached),
    ),
  );
});
