// service-worker.js - This should be placed on the game server
const CACHE_NAME = 'game-cache-v1';
const CACHE_METADATA_KEY = 'game-cache-metadata';
const MAX_AGE_DAYS = 7; // Revalidate files older than 7 days

// Assets to cache immediately on service worker installation
const PRECACHE_ASSETS = [
    // Add critical game assets here if needed
];

// Game file patterns that should be aggressively cached
const GAME_FILE_PATTERNS = [
    /game_/,           // Files containing 'game_'
    /\.data$/,         // Unity WebGL data files
    /\.wasm$/,         // WebAssembly files
    /\.bundle$/,       // Asset bundles
    /\.unity3d$/,      // Unity asset files
    /\.pak$/,          // Package files
    /\.bin$/,          // Binary files
    /\.spritemap$/,    // Sprite atlases
    /assets\//,        // Assets directory
    /gamedata\//,      // Game data directory
];

// Helper function to identify large/important game files
function isGameFile(url) {
    const urlObj = new URL(url);
    return GAME_FILE_PATTERNS.some(pattern => pattern.test(urlObj.pathname));
}

// Helper function to get the cache metadata store
async function getMetadataStore() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const metadataResponse = await cache.match(CACHE_METADATA_KEY);
        
        if (metadataResponse) {
            return await metadataResponse.json();
        } else {
            // Initialize with empty metadata if none exists
            return {};
        }
    } catch (error) {
        console.error('Error getting metadata store:', error);
        return {};
    }
}

// Helper function to save cache metadata
async function saveMetadataStore(metadata) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metadataResponse = new Response(metadataBlob);
        await cache.put(CACHE_METADATA_KEY, metadataResponse);
    } catch (error) {
        console.error('Error saving metadata store:', error);
    }
}

// Helper function to update timestamp for a cached file
async function updateCacheTimestamp(url) {
    try {
        const metadata = await getMetadataStore();
        metadata[url] = Date.now();
        await saveMetadataStore(metadata);
    } catch (error) {
        console.error('Error updating cache timestamp:', error);
    }
}

// Helper function to check if a cached file is stale (older than MAX_AGE_DAYS)
async function isFileStale(url) {
    try {
        const metadata = await getMetadataStore();
        const timestamp = metadata[url];
        
        if (!timestamp) {
            return true; // No timestamp means we should revalidate
        }
        
        const now = Date.now();
        const age = now - timestamp;
        const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
        
        return age > maxAgeMs;
    } catch (error) {
        console.error('Error checking if file is stale:', error);
        return true; // Assume stale on error
    }
}

// Helper function to check if response is valid for caching
function isValidResponse(response) {
    return response && 
           response.ok && 
           response.status >= 200 && 
           response.status < 300 &&
           response.status !== 206 && // Partial content
           response.status !== 209;   // Contents of Related
}

// Install event - precache critical resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('Precaching game assets');
                if (PRECACHE_ASSETS.length > 0) {
                    await cache.addAll(PRECACHE_ASSETS);
                    
                    // Initialize timestamps for precached assets
                    const metadata = await getMetadataStore();
                    const now = Date.now();
                    
                    PRECACHE_ASSETS.forEach(asset => {
                        const url = new URL(asset, self.location.origin).href;
                        metadata[url] = now;
                    });
                    
                    await saveMetadataStore(metadata);
                }
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to precache assets:', error);
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
                    console.log('Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Helper function to determine if a request should be cached
function isCacheableRequest(request) {
    const url = new URL(request.url);
    
    // Check for cache-busting query parameters
    const params = new URLSearchParams(url.search);
    if (params.has('cache') && params.get('cache') === 'false' || 
        params.has('cacheBust') || 
        params.has('cachebust') || 
        params.has('bust') ||
        params.has('v') || 
        params.has('version')) {
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

    // Don't cache if it has no-cache header
    if (request.headers.get('cache-control') === 'no-cache') {
        return false;
    }

    return true;
}

// Network-first strategy with fallback to cache
async function networkFirstStrategy(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // If successful and valid, clone and cache
        if (isValidResponse(networkResponse)) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await updateCacheTimestamp(request.url);
            return networkResponse;
        }

        // If network response is not valid for caching, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return the network response even if not cacheable
        return networkResponse;
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Nothing in cache, rethrow the error
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
        console.log('✅ Served fresh from cache:', request.url);
        return cachedResponse;
    }
    
    console.log('⚠️ Cache miss or stale, fetching from network:', request.url, { 
        hasCached: !!cachedResponse, 
        isStale 
    });
    
    // Otherwise, get from network (either no cache or stale cache)
    try {
        const networkResponse = await fetch(request);
        
        // Cache the network response for future if it's valid
        if (isValidResponse(networkResponse)) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await updateCacheTimestamp(request.url);
            console.log('✅ Updated cache from network:', request.url);
        }
        
        return networkResponse;
    } catch (error) {
        // If network fails and we have a cached version (even if stale), return it
        if (cachedResponse) {
            console.log('✅ Served stale cache after network failure:', request.url);
            return cachedResponse;
        }
        
        // No cached fallback available
        console.error('❌ Network failed, no cache available for:', request.url);
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
            console.log('🔄 Serving stale cache while revalidating:', request.url);
            // Fetch from network and update cache in the background
            fetch(request).then(async networkResponse => {
                if (isValidResponse(networkResponse)) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, networkResponse.clone());
                    await updateCacheTimestamp(request.url);
                    console.log('🔄 Background revalidation complete:', request.url);
                }
            }).catch(error => {
                console.error('❌ Background revalidation failed:', request.url, error);
            });
        } else {
            console.log('✅ Served fresh from cache (SWR):', request.url);
        }
        
        // Return the cached response immediately
        return cachedResponse;
    } else {
        console.log('⚠️ No cache, fetching from network (SWR):', request.url);
        // No cached response, fetch from network
        const networkResponse = await fetch(request);
        
        if (isValidResponse(networkResponse)) {
            // Cache the response for future
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await updateCacheTimestamp(request.url);
            console.log('✅ Cached new response (SWR):', request.url);
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
        const url = new URL(request.url);
        
        // For large game files, use aggressive cache-first strategy
        if (isGameFile(request.url)) {
            console.log('🎮 Game file detected:', request.url);
            event.respondWith(timeAwareCacheFirstStrategy(request));
        }
        // For HTML and JSON files, use network-first to get latest versions
        else if (url.pathname.endsWith('.html') || url.pathname.endsWith('.json')) {
            console.log('📄 Dynamic content detected:', request.url);
            event.respondWith(networkFirstStrategy(request));
        }
        // For JS files, use network-first to ensure updates
        else if (url.pathname.endsWith('.js')) {
            console.log('📜 JavaScript file detected:', request.url);
            event.respondWith(networkFirstStrategy(request));
        }
        // For everything else cacheable, use time-aware stale-while-revalidate
        else {
            console.log('🗂️ Static asset detected:', request.url);
            event.respondWith(timeAwareStaleWhileRevalidateStrategy(request));
        }
    }
    // Let non-cacheable requests go through without service worker intervention
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
    // Handle custom cache invalidation
    if (event.data && event.data.action === 'CLEAR_CACHE') {
        console.log('🗑️ Clearing all caches...');
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ status: 'Cache cleared' });
        });
    }
    // Handle force revalidation of all assets
    else if (event.data && event.data.action === 'REVALIDATE_ALL') {
        console.log('🔄 Marking all assets for revalidation...');
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
    // Handle selective cache invalidation
    else if (event.data && event.data.action === 'INVALIDATE_URL') {
        const url = event.data.url;
        console.log('🗑️ Invalidating specific URL:', url);
        caches.open(CACHE_NAME).then(cache => {
            return cache.delete(url);
        }).then(success => {
            if (success) {
                // Also remove from metadata
                return getMetadataStore().then(metadata => {
                    delete metadata[url];
                    return saveMetadataStore(metadata);
                });
            }
        }).then(() => {
            event.ports[0].postMessage({ status: `Invalidated ${url}` });
        });
    }
});