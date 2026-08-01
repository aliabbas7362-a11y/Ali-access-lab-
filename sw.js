/* ==========================================================
   Court Piece (Rung) — Service Worker
   Ali Access Labs

   GOAL:
   - Offline: app opens and works from the last cached version
   - Online: app always tries the network FIRST, so your existing
     live-update system (server.url + version.json banner) keeps
     working exactly as before — this SW never blocks fresh content.

   Strategy: "network-first, cache fallback"
   - This page (index.html) and the Firebase SDK scripts are the
     only things this app loads, so that's all we cache.
   ========================================================== */

const CACHE_NAME = 'court-piece-offline-v2';
/* v1 → v2: precache list mein 11 missing sound files add kiye
   (5 purane — bg-music-1/2, bust, eliminate, king-hit — jo shuru
   se hi list mein nahi the; aur 6 naye Reward System sounds —
   coin, purchase, equip, challenge, fanfare, drawer-open). Version
   bump isliye taake purana cache clear ho kar poori list se fresh
   precache ho, "activate" step ke cleanup ke saath. */

/* Files to pre-cache on install. Relative paths resolve against
   this file's own location (the GitHub Pages folder), so this
   works no matter what the repo/folder is named. */
const PRECACHE_URLS = [
  './',
  './index.html',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics-compat.js',

  /* Sound files — pre-cached explicitly so ALL sounds work offline
     from the first install, even ones the user hasn't triggered yet
     (e.g. trick-loss only plays after losing a trick). Yeh poori
     list ab index.html mein maujood HAR Audio() ke saath match
     karti hai — koi bhi sound miss nahi hai. */
  './sounds/card-flip.mp3',
  './sounds/shuffle.mp3',
  './sounds/win.mp3',
  './sounds/lose.mp3',
  './sounds/trick-win.mp3',
  './sounds/trick-lose.mp3',
  './sounds/king-hit.mp3',
  './sounds/bust.mp3',
  './sounds/eliminate.mp3',
  './sounds/bg-music-1.mp3',
  './sounds/bg-music-2.mp3',

  /* Reward System sounds */
  './sounds/coin.mp3',
  './sounds/purchase.mp3',
  './sounds/equip.mp3',
  './sounds/challenge.mp3',
  './sounds/fanfare.mp3',
  './sounds/drawer-open.mp3'
];

/* ---------- INSTALL: cache the app shell ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      /* addAll fails entirely if even one request fails, so we
         cache each file individually and just skip any that fail
         (e.g. if offline during first install). */
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] Precache skipped for', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

/* ---------- ACTIVATE: clean up old cache versions ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---------- FETCH: network-first, cache fallback ---------- */
self.addEventListener('fetch', (event) => {
  /* Only handle GET requests; let everything else (Firestore
     writes, auth POSTs, analytics beacons, etc.) go straight
     to the network untouched. */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        /* Got a fresh copy from the network — this is how live
           updates keep flowing through. Save a copy for offline
           use next time, then return the fresh copy. */
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone).catch(() => {
            /* Some cross-origin (opaque) responses can't always
               be cached depending on request mode — safe to ignore. */
          });
        });
        return networkResponse;
      })
      .catch(() => {
        /* Network failed (offline) — serve the last cached
           version instead. Fall back to index.html for page
           navigations so the app still opens offline. */
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});