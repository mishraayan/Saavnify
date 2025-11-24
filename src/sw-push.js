/* =========================
   Saavnify ULTRA — Service Worker
   Offline caching + Push
========================= */

/* ---- CACHE NAMES ---- */
const STATIC_CACHE = "saavnify-static-v1";
const AUDIO_CACHE = "saavnify-audio-v1";
const API_CACHE = "saavnify-api-v1";

/* ---- APP SHELL (offline UI) ---- */
/* ---- APP SHELL (offline UI) ---- */
const APP_SHELL = [
  "/",
  "/index.html",
  "/site.webmanifest",               // ⬅️ or whatever your manifest file is called
  "/web-app-manifest-192x192.png",   // ⬅️ 192 icon
  "/web-app-manifest-512x512.png",   // ⬅️ 512 icon
  "/apple-touch-icon.png",           // ⬅️ iOS icon (optional but nice)
];


/* =========================
    INSTALL
========================= */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* =========================
    ACTIVATE
========================= */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              ![STATIC_CACHE, AUDIO_CACHE, API_CACHE].includes(key)
          )
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

/* =========================
    FETCH STRATEGY
========================= */
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // 🎧 Audio streaming cache
  if (url.includes("aac.saavncdn.com")) {
    event.respondWith(cacheAudio(event.request));
    return;
  }

  // 🟢 Search API caching
  if (url.includes("rythm-1s3u.onrender.com")) {
    event.respondWith(cacheAPI(event.request));
    return;
  }

  // 🌐 Navigation fallback (Offline → index.html)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
    return;
  }
});

/* =========================
    CACHE HELPERS
========================= */
async function cacheAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);

  // If already cached → play offline
  if (cached) return cached;

  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch {
    // If fetch fails → fallback to existing cached
    return cached || Response.error();
  }
}

async function cacheAPI(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const res = await fetch(request); // online API
    cache.put(request, res.clone()); // store for offline
    return res;
  } catch {
    return cache.match(request); // fallback offline
  }
}

/* =========================
    PUSH NOTIFICATIONS
========================= */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const title = data.title || "Saavnify ULTRA 🎵";
  const body  = data.body  || "Tap to explore trending music!";
  const url   = data.url   || "/";

  const options = {
    body,
    icon: "/web-app-manifest-192x192.png",   // ⬅️ was /pwa-192.png
    badge: "/web-app-manifest-192x192.png",  // ⬅️ was /pwa-192.png
    vibrate: [80, 50, 80],
    data: { url },
    actions: [
      { action: "open", title: "Open App" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* =========================
    NOTIFICATION CLICK
========================= */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        // Focus if already open
        for (const client of clientsArr) {
          if (client.url.includes(url)) {
            return client.focus();
          }
        }
        // Otherwise open new tab
        return self.clients.openWindow(url);
      })
  );
});
