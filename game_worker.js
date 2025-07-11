// service-worker.js - This should be placed on the game server
const CACHE_NAME = 'game-cache-v1';
const CACHE_METADATA_KEY = 'game-cache-metadata';
const MAX_AGE_DAYS = 7; // Revalidate files older than 7 days

// Assets to cache immediately on service worker installation
const PRECACHE_ASSETS = [
    
];

// Helper function to get the cache metadata store
async function getMetadataStore() {
    const cache = await caches.open(CACHE_NAME);
    const metadataResponse = await cache.match(CACHE_METADATA_KEY);
    
    if (metadataResponse) {
        return metadataResponse.json();
    } else {
        // Initialize with empty metadata if none exists
        return {};
    }
}

// Helper function to save cache metadata
async function saveMetadataStore(metadata) {
    const cache = await caches.open(CACHE_NAME);
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const metadataResponse = new Response(metadataBlob);
    await cache.put(CACHE_METADATA_KEY, metadataResponse);
}

// Helper function to update timestamp for a cached file
async function updateCacheTimestamp(url) {
    const metadata = await getMetadataStore();
    metadata[url] = Date.now();
    await saveMetadataStore(metadata);
}

// Helper function to check if a cached file is stale (older than MAX_AGE_DAYS)
async function isFileStale(url) {
    const metadata = await getMetadataStore();
    const timestamp = metadata[url];
    
    if (!timestamp) {
        return true; // No timestamp means we should revalidate
    }
    
    const now = Date.now();
    const age = now - timestamp;
    const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    
    return age > maxAgeMs;
}

// Install event - precache critical resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Precaching game assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(async () => {
                // Initialize timestamps for precached assets
                const metadata = await getMetadataStore();
                const now = Date.now();
                
                PRECACHE_ASSETS.forEach(asset => {
                    const url = new URL(asset, self.location.origin).href;
                    metadata[url] = now;
                });
                
                await saveMetadataStore(metadata);
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName.startsWith('game-cache-') &&
                        cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Helper function to determine if a request should be cached
function isCacheableRequest(request) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    if (params.has('cache') && params.get('cache') === 'false' || params.has('cacheBust') || params.has('cachebust') || params.has('bust')) {
        return false; // Cache-busting query parameter
    }
    // Never cache txt files, change often
    if (url.pathname.endsWith('.txt')) {
        return false;
    }

    // Only cache GET requests
    if (request.method !== 'GET') {
        return false;
    }

    // Blacklist, not whitelist
    return true;
}

// Network-first strategy with fallback to cache
async function networkFirstStrategy(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // If successful, clone and cache
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await updateCacheTimestamp(request.url);
            return networkResponse;
        }

        // If network fails with an error status, try cache
        throw new Error('Network response was not ok');
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Nothing in cache, return the error response
        throw error;
    }
}

// Time-aware cache-first strategy with network fallback
async function timeAwareCacheFirstStrategy(request) {
    // Check if we have a cached version first
    const cachedResponse = await caches.match(request);
    
    // Determine if the cached file is stale
    const isStale = await isFileStale(request.url);
    
    // If we have a non-stale cached response, return it
    if (cachedResponse && !isStale) {
        return cachedResponse;
    }
    
    // Otherwise, get from network (either no cache or stale cache)
    try {
        const networkResponse = await fetch(request);
        
        // Cache the network response for future
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await updateCacheTimestamp(request.url);
        }
        
        return networkResponse;
    } catch (error) {
        // If network fails and we have a cached version (even if stale), return it
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // No cached fallback available
        console.error('Fetch failed:', error);
        throw error;
    }
}

// Stale-while-revalidate strategy with timestamp awareness
async function timeAwareStaleWhileRevalidateStrategy(request) {
    // Get from cache immediately
    const cachedResponse = await caches.match(request);
    
    // Check if the cached file is stale
    const isStale = await isFileStale(request.url);
    
    // If cachedResponse exists, fetch from network only if it's stale
    if (cachedResponse) {
        if (isStale) {
            // Fetch from network and update cache in the background
            fetch(request).then(async networkResponse => {
                if (networkResponse.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, networkResponse.clone());
                    await updateCacheTimestamp(request.url);
                }
            }).catch(error => {
                console.error('Background fetch failed:', error);
            });
        }
        
        // Return the cached response immediately
        return cachedResponse;
    } else {
        // No cached response, fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache the response for future
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await updateCacheTimestamp(request.url);
        }
        
        return networkResponse;
    }
}

// Fetch event - handle all requests
self.addEventListener('fetch', event => {
    // Ignore non-GET requests
    if (event.request.method !== 'GET') return;

    const request = event.request;

    // Choose caching strategy based on request type
    if (isCacheableRequest(request)) {
        // For most game assets, use time-aware cache-first
        if (request.url.includes('game_')) {
            event.respondWith(timeAwareCacheFirstStrategy(request));
        }
        // For HTML and JSON files, use network-first to get latest versions
        else if (request.url.endsWith('.html') || request.url.endsWith('.json')) {
            event.respondWith(networkFirstStrategy(request));
        }
        // For everything else cacheable, use time-aware stale-while-revalidate
        else {
            event.respondWith(timeAwareStaleWhileRevalidateStrategy(request));
        }
    }
    // Let non-cacheable requests go through without service worker intervention
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
    // Handle custom cache invalidation
    if (event.data && event.data.action === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ status: 'Cache cleared' });
        });
    }
    // Handle force revalidation of all assets
    else if (event.data && event.data.action === 'REVALIDATE_ALL') {
        getMetadataStore().then(metadata => {
            // Set all timestamps to 0 to force revalidation
            Object.keys(metadata).forEach(url => {
                if (url !== CACHE_METADATA_KEY) {
                    metadata[url] = 0;
                }
            });
            return saveMetadataStore(metadata);
        }).then(() => {
            event.ports[0].postMessage({ status: 'All assets marked for revalidation' });
        });
    }
});