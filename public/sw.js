/* Tombstone. This path once held a cache-first service worker; anybody who
   added the web app to their home screen still has it registered and it will
   keep serving the old shell from disk regardless of what is deployed.
   This file clears every cache, unregisters itself and reloads each client
   exactly once. Do not delete it until the installs have turned over. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      try {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      } catch (e) { /* nothing to clear */ }
      try { await self.registration.unregister(); } catch (e) { /* already gone */ }
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) {
        if (c.url && typeof c.navigate === 'function') { c.navigate(c.url); }
      });
    })()
  );
});

/* No fetch handler. Nothing is served from cache while this worker lives. */
