/// <reference lib="webworker" />
const CACHE = 'a59-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => (self as unknown as ServiceWorkerGlobalScope).skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const e = event as ExtendableEvent;
  e.waitUntil((self as unknown as ServiceWorkerGlobalScope).clients.claim());
});

self.addEventListener('fetch', (event) => {
  const e = event as FetchEvent;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/tubemill')) {
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
