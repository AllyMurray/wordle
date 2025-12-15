// Service Worker for Wordle PWA
const CACHE_NAME = 'wordle-v1';
const BASE_PATH = '/wordle/';

// Static assets to cache on install
const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icons/icon-192.svg',
  BASE_PATH + 'icons/icon-512.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Take control immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('wordle-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
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
