// Offline support for the installed app.
// Game files: network first, so a new version shows up on the next launch;
// the cached copy is used only when the network is slow or offline.
const CACHE = 'wood-tetris-v3';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'js/game.js',
  'js/sw-register.js',
  'fonts/rubik-hebrew.woff2',
  'fonts/rubik-latin.woff2',
  'fonts/yusei-magic-game.woff2',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') return cache.match('index.html');
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin === self.location.origin) e.respondWith(networkFirst(req));
});
