const APP_CACHE = 'parking-personal-app-v3';
const RUNTIME_CACHE = 'parking-personal-runtime-v3';
const APP_SHELL = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([APP_CACHE, RUNTIME_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trimRuntime(maxItems = 180) {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  while (keys.length > maxItems) {
    const first = keys.shift();
    if (first) await cache.delete(first);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
    trimRuntime().catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(APP_CACHE);
        cache.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  const cacheableHost =
    url.origin === self.location.origin ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'tile.openstreetmap.org' ||
    url.hostname.endsWith('.tile.openstreetmap.org');

  if (cacheableHost) event.respondWith(cacheFirst(request));
});
