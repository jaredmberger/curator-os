const CACHE = 'curatoros-preview-v1';
const ASSETS = [
  './',
  './index.html',
  './preview.js',
  './manifest.webmanifest',
  './icon.svg',
  '../src/styles/collection-catalog-shell.css',
  '../src/core/database.js',
  '../src/core/storage.js',
  '../src/core/relationships.js',
  '../src/ui/collection-catalog-shell.js',
  '../src/ui/structured-record-authoring.js',
  '../src/ui/record-authoring-dialogs.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
