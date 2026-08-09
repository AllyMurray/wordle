// Service Worker for Game Hub PWA
const CACHE_NAME = 'gamehub-v2';
const BASE_PATH = '/gamehub/';
const BUILD_MANIFEST_URL = BASE_PATH + 'asset-manifest.json';

// Static assets to cache on install
const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  '/gamehub/icons/icon-192.svg',
  '/gamehub/icons/icon-512.svg',
  '/gamehub/icons/icon-maskable.svg',
  BASE_PATH + 'data/boggle-words.txt',
];

// Vite records every hashed entry, CSS file, and lazy chunk in this manifest.
// Precaching it makes the complete solo app available during the first install,
// before a service worker-controlled reload has occurred.
async function cacheBuildAssets(cache) {
  try {
    const response = await fetch(BUILD_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return;

    const manifest = await response.json();
    const assetUrls = new Set([BUILD_MANIFEST_URL]);
    for (const entry of Object.values(manifest)) {
      if (entry.file) assetUrls.add(BASE_PATH + entry.file);
      for (const cssFile of entry.css || []) assetUrls.add(BASE_PATH + cssFile);
      for (const assetFile of entry.assets || []) assetUrls.add(BASE_PATH + assetFile);
    }

    await cache.addAll([...assetUrls]);
  } catch (error) {
    // Development servers do not emit a build manifest. Static shell caching
    // should still succeed there rather than aborting service worker install.
    console.warn('Unable to precache build assets:', error);
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      await cacheBuildAssets(cache);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('gamehub-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip WebRTC/PeerJS requests (multiplayer requires network)
  if (url.hostname.includes('peerjs') ||
      url.pathname.includes('peerjs') ||
      url.protocol === 'wss:' ||
      url.protocol === 'ws:') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // For navigation requests (HTML), use network-first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(event.request).then((cached) => {
            return cached || caches.match(BASE_PATH);
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images), use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached version but also update cache in background
        fetch(event.request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          })
          .catch(() => {
            // Network failed, but we already returned cached version
          });
        return cached;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then((response) => {
        // Only cache successful responses for same-origin requests
        if (response.ok && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
