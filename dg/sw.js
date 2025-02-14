// sw.js
const CACHE_NAME = 'trex-game-cache-v1';
const ASSETS_TO_CACHE = [
  '/dg/',
  '/dg/index.html',
  '/dg/index.css',
  '/dg/index.js',
  '/dg/assets/default_100_percent/100-offline-sprite.png',
  '/dg/assets/default_200_percent/200-offline-sprite.png',
  '/dg/assets/default_100_percent/100-disabled.png',
  '/dg/assets/default_100_percent/100-error-offline.png',
  '/dg/assets/default_200_percent/200-disabled.png',
  '/dg/assets/default_200_percent/200-error-offline.png',
  '/dg/assets/offline-sprite-1x.png',
  '/dg/assets/offline-sprite-2x.png'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response as it can only be consumed once
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});