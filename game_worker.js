// service-worker.js - This should be placed on the game server
const CACHE_NAME = 'game-cache-v1';
const CACHE_METADATA_KEY = 'game-cache-metadata';
const MAX_AGE_DAYS = 7; // Revalidate files older than 7 days
const CLEANUP_AGE_DAYS = 90; // Remove files older than 3 months

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

// In-memory cache for metadata to reduce cache operations
let metadataCache = null;
let metadataPromise = null;
let metadataUpdateQueue = [];
let isProcessingQueue = false;

// Helper function to identify large/important game files
function isGameFile(url) {
    const urlObj = new URL(url);
    return GAME_FILE_PATTERNS.some(pattern => pattern.test(urlObj.pathname));
}

// Helper function to get the cache metadata store with in-memory caching
async function getMetadataStore() {
    // Return cached metadata if available
    if (metadataCache !== null) {
        return { ...metadataCache }; // Return a copy to prevent mutations
    }

    // If already loading metadata, wait for it
    if (metadataPromise) {
        await metadataPromise;
        return { ...metadataCache };
    }

    // Load metadata from cache
    metadataPromise = loadMetadataFromCache();
    
    try {
        metadataCache = await metadataPromise;
        return { ...metadataCache };
    } catch (error) {
        console.error('Error getting metadata store:', error);
        metadataCache = {};
        return {};
    } finally {
        metadataPromise = null;
    }
}

// Helper function to load metadata from cache
async function loadMetadataFromCache() {
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
        console.error('Error loading metadata from cache:', error);
        return {};
    }
}

// Queue-based metadata update system to prevent race conditions
async function queueMetadataUpdate(updateFn) {
    return new Promise((resolve, reject) => {
        metadataUpdateQueue.push({ updateFn, resolve, reject });
        processMetadataQueue();
    });
}

// Process the metadata update queue sequentially
async function processMetadataQueue() {
    if (isProcessingQueue || metadataUpdateQueue.length === 0) {
        return;
    }

    isProcessingQueue = true;

    try {
        while (metadataUpdateQueue.length > 0) {
            const { updateFn, resolve, reject } = metadataUpdateQueue.shift();
            
            try {
                // Ensure we have the latest metadata
                if (metadataCache === null) {
                    metadataCache = await loadMetadataFromCache();
                }

                // Apply the update function
                const result = await updateFn(metadataCache);
                
                // Save the updated metadata
                await saveMetadataToCache(metadataCache);
                
                resolve(result);
            } catch (error) {
                console.error('Error processing metadata update:', error);
                reject(error);
            }
        }
    } finally {
        isProcessingQueue = false;
    }
}

// Helper function to save cache metadata
async function saveMetadataToCache(metadata) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metadataResponse = new Response(metadataBlob);
        await cache.put(CACHE_METADATA_KEY, metadataResponse);
    } catch (error) {
        console.error('Error saving metadata to cache:', error);
        throw error;
    }
}

// Helper function to update timestamp for a cached file (thread-safe)
async function updateCacheTimestamp(url) {
    try {
        await queueMetadataUpdate(async (metadata) => {
            metadata[url] = Date.now();
            return metadata[url];
        });
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
        const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        return age > maxAgeMs;
    } catch (error) {
        console.error('Error checking if file is stale:', error);
        return true; // Assume stale on error
    }
}

// Helper function to cleanup old cache entries (older than 3 months)
async function cleanupOldCacheEntries() {
    try {
        console.log('🧹 Starting cache cleanup...');
        const now = Date.now();
        const cleanupAgeMs = CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000; // 90 days in milliseconds
        
        await queueMetadataUpdate(async (metadata) => {
            const cache = await caches.open(CACHE_NAME);
            const keysToDelete = [];
            
            // Find entries older than cleanup age
            for (const [url, timestamp] of Object.entries(metadata)) {
                if (url === CACHE_METADATA_KEY) continue;
                
                const age = now - timestamp;
                if (age > cleanupAgeMs) {
                    keysToDelete.push(url);
                }
            }
            
            // Delete old entries from cache and metadata
            const deletePromises = keysToDelete.map(async (url) => {
                try {
                    await cache.delete(url);
                    delete metadata[url];
                    console.log('🗑️ Cleaned up old cache entry:', url);
                } catch (error) {
                    console.error('Error deleting cache entry:', url, error);
                }
            });
            
            await Promise.allSettled(deletePromises);
            
            if (keysToDelete.length > 0) {
                console.log(`🧹 Cleanup complete: removed ${keysToDelete.length} old entries`);
            } else {
                console.log('🧹 Cleanup complete: no old entries to remove');
            }
            
            return keysToDelete.length;
        });
    } catch (error) {
        console.error('Error during cache cleanup:', error);
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
                    const now = Date.now();
                    
                    await queueMetadataUpdate(async (metadata) => {
                        PRECACHE_ASSETS.forEach(asset => {
                            const url = new URL(asset, self.location.origin).href;
                            metadata[url] = now;
                        });
                        return metadata;
                    });
                }
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to precache assets:', error);
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches and perform maintenance
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Clean up old cache versions
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
            }),
            // Perform cleanup of old entries
            cleanupOldCacheEntries()
        ]).then(() => self.clients.claim())
    );
});

// Helper function to determine if a request should be cached
function isCacheableRequest(request) {
    const url = new URL(request.url);
    
    // Check for cache-busting query parameters (fixed logic)
    const params = new URLSearchParams(url.search);
    if ((params.has('cache') && params.get('cache') === 'false') || 
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
            try {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, networkResponse.clone());
                await updateCacheTimestamp(request.url);
                console.log('✅ Cached from network (network-first):', request.url);
            } catch (cacheError) {
                console.error('Error caching response:', request.url, cacheError);
            }
            return networkResponse;
        }

        // If network response is not valid for caching, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('✅ Served from cache after invalid network response:', request.url);
            return cachedResponse;
        }

        // Return the network response even if not cacheable
        return networkResponse;
    } catch (error) {
        console.error('Network request failed:', request.url, error);
        
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('✅ Served from cache after network error:', request.url);
            return cachedResponse;
        }

        // Nothing in cache, rethrow the error
        throw error;
    }
}

// Time-aware cache-first strategy with network fallback
async function timeAwareCacheFirstStrategy(request) {
    try {
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
                try {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, networkResponse.clone());
                    await updateCacheTimestamp(request.url);
                    console.log('✅ Updated cache from network:', request.url);
                } catch (cacheError) {
                    console.error('Error caching network response:', request.url, cacheError);
                }
            }
            
            return networkResponse;
        } catch (networkError) {
            console.error('Network request failed:', request.url, networkError);
            
            // If network fails and we have a cached version (even if stale), return it
            if (cachedResponse) {
                console.log('✅ Served stale cache after network failure:', request.url);
                return cachedResponse;
            }
            
            // No cached fallback available
            console.error('❌ Network failed, no cache available for:', request.url);
            throw networkError;
        }
    } catch (error) {
        console.error('Error in cache-first strategy:', request.url, error);
        throw error;
    }
}

// Stale-while-revalidate strategy with timestamp awareness
async function timeAwareStaleWhileRevalidateStrategy(request) {
    try {
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
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await cache.put(request, networkResponse.clone());
                            await updateCacheTimestamp(request.url);
                            console.log('🔄 Background revalidation complete:', request.url);
                        } catch (cacheError) {
                            console.error('Error during background caching:', request.url, cacheError);
                        }
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
                try {
                    // Cache the response for future
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, networkResponse.clone());
                    await updateCacheTimestamp(request.url);
                    console.log('✅ Cached new response (SWR):', request.url);
                } catch (cacheError) {
                    console.error('Error caching new response:', request.url, cacheError);
                }
            }
            
            return networkResponse;
        }
    } catch (error) {
        console.error('Error in stale-while-revalidate strategy:', request.url, error);
        throw error;
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
        
        Promise.all([
            caches.delete(CACHE_NAME),
            // Clear in-memory cache
            (() => {
                metadataCache = null;
                metadataPromise = null;
                metadataUpdateQueue.length = 0;
                isProcessingQueue = false;
                return Promise.resolve();
            })()
        ]).then(() => {
            event.ports[0].postMessage({ status: 'Cache cleared' });
        }).catch(error => {
            console.error('Error clearing cache:', error);
            event.ports[0].postMessage({ status: 'Error clearing cache', error: error.message });
        });
    }
    // Handle force revalidation of all assets
    else if (event.data && event.data.action === 'REVALIDATE_ALL') {
        console.log('🔄 Marking all assets for revalidation...');
        
        queueMetadataUpdate(async (metadata) => {
            // Set all timestamps to 0 to force revalidation
            Object.keys(metadata).forEach(url => {
                if (url !== CACHE_METADATA_KEY) {
                    metadata[url] = 0;
                }
            });
            return metadata;
        }).then(() => {
            event.ports[0].postMessage({ status: 'All assets marked for revalidation' });
        }).catch(error => {
            console.error('Error marking assets for revalidation:', error);
            event.ports[0].postMessage({ status: 'Error during revalidation', error: error.message });
        });
    }
    // Handle selective cache invalidation
    else if (event.data && event.data.action === 'INVALIDATE_URL') {
        const url = event.data.url;
        console.log('🗑️ Invalidating specific URL:', url);
        
        Promise.all([
            caches.open(CACHE_NAME).then(cache => cache.delete(url)),
            queueMetadataUpdate(async (metadata) => {
                delete metadata[url];
                return metadata;
            })
        ]).then(([cacheDeleted]) => {
            const status = cacheDeleted ? `Invalidated ${url}` : `URL not found in cache: ${url}`;
            event.ports[0].postMessage({ status });
        }).catch(error => {
            console.error('Error invalidating URL:', url, error);
            event.ports[0].postMessage({ status: `Error invalidating ${url}`, error: error.message });
        });
    }
    // Handle manual cleanup trigger
    else if (event.data && event.data.action === 'CLEANUP_OLD_ENTRIES') {
        console.log('🧹 Manual cleanup triggered...');
        
        cleanupOldCacheEntries().then(() => {
            event.ports[0].postMessage({ status: 'Cleanup completed' });
        }).catch(error => {
            console.error('Error during manual cleanup:', error);
            event.ports[0].postMessage({ status: 'Error during cleanup', error: error.message });
        });
    }
});