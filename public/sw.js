/* Vector Control service worker.
 * Privacy rule: business data is NEVER cached. Only static build assets and the
 * offline page are stored. Page navigations always go to the network; when the
 * network is down the user sees a simple offline page instead of stale data. */
const VERSION = 'vc-v1';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, '/logo.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never touch server actions / mutations
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase etc. go straight to the network

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Immutable hashed build assets and icons: cache-first.
  if (url.pathname.startsWith('/_next/static/') || /\.(?:png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
