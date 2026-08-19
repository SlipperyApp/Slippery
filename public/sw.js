/* A TOMBSTONE, NOT A SERVICE WORKER.
 *
 * The previous build shipped a cache-first service worker at this path.
 * Anybody who installed the web app still has it registered, and a
 * cache-first worker will keep serving the old shell from disk after the new
 * deployment goes live: they would see a version of Slippery that no longer
 * exists, backed by an API that no longer answers, and no amount of
 * refreshing would fix it because the refresh never reaches the network.
 *
 * So this file stays at the same path, claims the clients, deletes every
 * cache the old one made, unregisters itself, and reloads each page once.
 * It must not be removed until the installs have turned over.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    /* One reload each. Without it the page keeps running the old bundle
       until the person happens to close the tab. */
    for (const client of clients) client.navigate(client.url);
  })());
});

/* Nothing is intercepted in the meantime. Every request goes to the network,
   which is the whole point. */
