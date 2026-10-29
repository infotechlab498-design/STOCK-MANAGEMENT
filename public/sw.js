/**
 * StructStock SW — intentionally non-intercepting.
 * Stale offline workers previously called respondWith(fetch(...)) and rejected
 * on SPA navigations (/material-issues, /stock, etc.), breaking Vite localhost.
 * This worker claims clients, clears caches, and never hijacks fetch.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) {
        /* ignore */
      }
      await self.clients.claim();
      // Self-unregister so subsequent loads are SW-free in local/dev.
      try {
        await self.registration.unregister();
      } catch (_) {
        /* ignore */
      }
    })()
  );
});

// Do not call event.respondWith — browser default network handling only.
self.addEventListener('fetch', () => {});
