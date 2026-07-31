// Ovira storefront service worker.
//
// Bump CACHE whenever the strategy below changes — the activate handler deletes
// every cache that isn't the current one, which is the only thing standing
// between a deploy and a browser serving last month's assets forever.
const CACHE = "ovira-v6";
// A STATIC file, not the Next route. This document gets served in response to a
// navigation to some other url, and a Next page shipped that way hydrates,
// discovers it is not at the route it was built for, and throws a client-side
// exception — so the shopper who lost their connection was shown a crash.
const OFFLINE_URL = "/shop/offline.html";

// Pages that must NEVER be written to the cache. Everything here is either
// personal (an order, an address, a balance) or a decision that has to be made
// against live data (a cart, a checkout). Serving any of it from disk after a
// sign-out would show one person the shape of another session, and serving a
// stale checkout would price an order from memory.
// `/shop/cart` is deliberately NOT here: it is a pure client component that
// renders from localStorage, so its shell holds nothing personal and caching it
// lets an offline shopper still see what they were buying. `/shop/checkout` is
// here precisely because it must NOT work offline — filling in an address and a
// payment method only to fail at the last step is worse than being told upfront.
const PRIVATE = [
  "/shop/account",
  "/shop/checkout",
  "/shop/vendor",
  "/shop/admin",
  "/shop/login",
  "/shop/register",
  "/shop/track",
];

function isPrivate(pathname) {
  return PRIVATE.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

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

  // Navigations: **network-first**, so an online shopper always sees live
  // prices and live stock. A cached copy only ever surfaces with no network,
  // which is exactly when a day-old product page beats a dinosaur.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Remember public pages, so "the pages you visited work offline" —
          // which the offline screen promises — is actually true. It used to
          // cache nothing but the home page and told shoppers otherwise.
          if (response.ok && url.origin === self.location.origin && !isPrivate(url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
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

// ---------------------------------------------------------------------------
// Web push: show incoming notifications and focus/open the app on click.
// ---------------------------------------------------------------------------

// The icons live under /shop/icons/. This pointed at /shop/icon-192.png, which
// is a 404 — so every notification this store has ever sent showed the
// browser's generic bell instead of the brand.
const ICON = "/shop/icons/icon-192.png";

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "أوفيرا", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "أوفيرا";
  const options = {
    body: data.body || "",
    icon: ICON,
    badge: ICON,
    tag: data.tag || "ovira",
    // Arabic text renders left-aligned in some Android launchers without this,
    // which makes the store's own message look like somebody else's.
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || "/shop" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/shop";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

// The page asks for this when it wants a waiting worker to take over now,
// instead of after every last tab has been closed.
self.addEventListener("message", (event) => {
  if (event.data === "ovira:skip-waiting") self.skipWaiting();
});
