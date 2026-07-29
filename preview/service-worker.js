const CACHE = 'curatoros-preview-v2';
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

  const requestUrl = new URL(event.request.url);

  // Never intercept links to another CuratorOS tool or any other origin.
  // Safari can otherwise route target="_blank" navigations through this
  // service worker and fall back to CuratorOS instead of opening the link.
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw new Error(`Network request failed for ${event.request.url}`);
    }))
  );
});
