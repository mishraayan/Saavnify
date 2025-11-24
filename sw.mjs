/* =========================
   Saavnify ULTRA — Service Worker
   (Offline + Push)
========================= */
self.__WB_MANIFEST;
/* ---- CACHE NAMES ---- */
const STATIC_CACHE = "saavnify-static-v1";
const AUDIO_CACHE = "saavnify-audio-v1";
const API_CACHE = "saavnify-api-v1";

/* ---- APP SHELL (offline pages & assets) ---- */
const APP_SHELL = [
  "/",
  "/index.html",
  "/site.webmanifest",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  "/apple-touch-icon.png",
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
          .filter((key) => ![STATIC_CACHE, AUDIO_CACHE, API_CACHE].includes(key))
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

  // SPA navigation → index fallback
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
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function cacheAPI(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch {
    return cache.match(request);
  }
}

/* =========================
    PUSH
========================= */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || "Saavnify ULTRA 🎵";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Tap to explore trending music!",
      icon: "/web-app-manifest-192x192.png",
      badge: "/web-app-manifest-192x192.png",
      data: { url: data.url || "/" },
      vibrate: [90, 40, 90],
      actions: [
        { action: "open", title: "Open App" },
      ],
    })
  );
});

/* =========================
    NOTIFICATION CLICK
========================= */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((arr) => {
        for (const c of arr) {
          if (c.url.includes(url)) return c.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
