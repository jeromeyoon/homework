/**
 * sw.js — Service Worker (PWA offline support)
 *
 * Caches all app shell files on install.
 * Cache-first strategy: serve from cache, fall back to network.
 *
 * Native conversion: not needed — native apps are always offline-capable.
 */

const CACHE = 'homework-v1';
const SHELL = [
  './index.html',
  './style.css',
  './db.js',
  './app.js',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
