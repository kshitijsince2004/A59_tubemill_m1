const CACHE = 'a59-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

/** Never cache Vite/HMR/module graph — stale modules break local dev hard. */
function shouldBypassCache(url) {
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/tubemill')) return true;
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules/')) {
    return true;
  }
  if (url.searchParams.has('t') || url.searchParams.has('v') || url.searchParams.has('import')) return true;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    // In local Vite: only shell assets may be cached; everything else bypasses.
    if (!SHELL.includes(url.pathname) && url.pathname !== '/sw.js') return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (shouldBypassCache(url)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok && SHELL.includes(url.pathname)) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return network.catch(() => cached);
    }),
  );
});
