// sw.js — Guarda la app (no los datos) para abrirla sin conexión.
// Solo intercepta archivos de la propia app; las peticiones a GitHub, cotizaciones y divisas van siempre a la red.
const VERSION = 'cartera-1.2.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/data.js', 'js/quotes.js', 'js/model.js', 'js/views.js', 'js/format.js', 'js/bio.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
];

// Se activa nada más instalarse: como la app pide primero a la red, no hace falta esperar a cerrarla.
self.addEventListener('install', (e) => {
  self.skipWaiting();
  // cache: 'reload' → descarga de verdad, sin pasar por la caché HTTP (GitHub Pages guarda 10 min).
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/demo/')) return; // el paquete de ejemplo, siempre de la red
  // Primero la red (para recibir cambios), y la copia si no hay conexión.
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request, { cache: 'no-cache' }); // revalida con el servidor
      if (r.ok) { const c = await caches.open(VERSION); c.put(e.request, r.clone()); }
      return r;
    } catch (err) {
      const hit = await caches.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('index.html');
      throw err;
    }
  })());
});
