/* Senku-frameXTV · service worker
   - precache app shell
   - cache-first: posters/backdrops (long TTL)
   - network-first: API + pages (fresh content, offline fallback)          */

const VERSION = "senku-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const IMG_CACHE = `${VERSION}-img`;
const PAGE_CACHE = `${VERSION}-pages`;

const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isImage(request) {
  return (
    request.destination === "image" ||
    /\.(png|jpe?g|webp|avif|svg|ico)$/i.test(new URL(request.url).pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // never cache cross-origin API or stream hosts
  if (url.origin !== self.location.origin) {
    return;
  }

  // images → cache-first (posters are immutable-ish)
  if (isImage(request)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // navigation / API → network-first with cache fallback
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok && url.pathname.startsWith("/api/")) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          const cached =
            (await caches.match(request)) ||
            (await caches.open(PAGE_CACHE).then((c) => c.match(request)));
          if (cached) return cached;
          if (request.mode === "navigate") {
            const shell = await caches.match("/");
            if (shell) return shell;
          }
          return Response.error();
        }
      })()
    );
  }
});
