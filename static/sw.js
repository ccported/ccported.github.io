// service-worker.js - Enhanced for cross-origin caching
const CACHE_NAME = 'ccported-cache-v1';
const CACHE_METADATA_KEY = 'ccported-cache-metadata';
const MAX_AGE_DAYS = 7; // Revalidate files older than 7 days

// Assets to cache immediately on service worker installation
const PRECACHE_ASSETS = [
    './index.html',    
];

// Add the domains you want to cache from
const ALLOWED_DOMAINS = [
    'ccgstatic.com',
    // Add other domains here as needed
];
const BLACKLIST = [
    "pagead2.googlesyndication.com",
    "storage.ko-fi.com",
    "www.google-analytics.com",
    "amazonaws.com"
]

// Install event - precache critical resources
self.addEventListener('install', event => {
    fetch("/servers.txt").then(response => response.text()).then(text => {
        const servers = text.split('\n').map(line => line.split(",")[0].trim()).filter(line => line.length > 0);
        ALLOWED_DOMAINS.push(...servers);
    });
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Precaching game assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName.startsWith('ccported-cache-') &&
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

    // Never cache txt files, change often
    if (url.pathname.endsWith('.txt')) {
        return false;
    }

    // Only cache GET requests
    if (request.method !== 'GET') {
        return false;
    }

    // Check if domain is allowed for cross-origin caching
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => url.hostname.includes(domain));
    const isBlacklisted = BLACKLIST.some(domain => url.hostname.includes(domain));
    if (isBlacklisted) {
        return false;
    }
    // Allow caching for origin domain or explicitly allowed domains
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin && !isAllowedDomain) {
        return false;
    }

    // Cache based on file extensions (website - non game- assets)
    const extensions = [
        '.html', '.js', '.css', '.json',
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.otf',
        '.mp3', '.ogg', '.wav',
        '.mp4', '.webm'
    ];

    if (extensions.some(ext => url.pathname.endsWith(ext))) {
        return true;
    }

    return false;
}

// Network-first strategy with fallback to cache
async function networkFirstStrategy(request) {
    try {
        // For cross-origin requests that need credentials, use appropriate fetch options
        const fetchOptions = {};
        if (isCrossOrigin(request)) {
            fetchOptions.mode = 'cors';
            // Don't send credentials by default for cross-origin requests
            // unless you explicitly need them
            fetchOptions.credentials = 'same-origin';
        }

        // Try network first
        const networkResponse = await fetch(request, fetchOptions);

        // If successful, clone and cache
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
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

// Helper function to check if request is cross-origin
function isCrossOrigin(request) {
    const url = new URL(request.url);
    return url.origin !== self.location.origin;
}

// Cache-first strategy with network fallback
async function cacheFirstStrategy(request) {
    // Try the cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    // If not in cache, get from network with appropriate options
    try {
        const fetchOptions = {};
        if (isCrossOrigin(request)) {
            fetchOptions.mode = 'cors';
            fetchOptions.credentials = 'same-origin';
        }

        const networkResponse = await fetch(request, fetchOptions);

        // Cache the network response for future
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Handle fetch failure
        console.error('Fetch failed:', error);
        throw error;
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidateStrategy(request) {
    // Try to get from cache immediately
    const cachedResponse = await caches.match(request);

    // Fetch from network and update cache in the background
    const fetchOptions = {};
    if (isCrossOrigin(request)) {
        fetchOptions.mode = 'cors';
        fetchOptions.credentials = 'same-origin';
    }

    const fetchPromise = fetch(request, fetchOptions).then(networkResponse => {
        if (networkResponse.ok) {
            const cache = caches.open(CACHE_NAME).then(cache => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
            });
        }
        return networkResponse;
    }).catch(error => {
        console.error('Background fetch failed:', error);
    });

    // Return the cached response immediately if we have it
    return cachedResponse || fetchPromise;
}

// Time-aware cache-first strategy with network fallback
async function timeAwareCacheFirstStrategy(request) {
    // Check if we have a cached version first
    const cachedResponse = await caches.match(request.url);
    // Determine if the cached file is stale
    const isStale = await isFileStale(request.url);
    
    // If we have a non-stale cached response, return it
    if (cachedResponse && !isStale) {
        return cachedResponse;
    }
    console.log(request.url, isStale)
    
    // Otherwise, get from network (either no cache or stale cache)
    try {
        const fetchOptions = {};
        if (isCrossOrigin(request)) {
            fetchOptions.mode = 'cors';
            fetchOptions.credentials = 'same-origin';
        }

        const networkResponse = await fetch(request, fetchOptions);
        
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

async function isFileStale(url) {
    const metadata = await getMetadataStore();
    const timestamp = metadata[url];
    
    if (!timestamp) {
        console.log("No timestamp for", url);
        return true; // No timestamp means we should revalidate
    }
    
    const now = Date.now();
    const age = now - timestamp;
    const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    return age > maxAgeMs;
}

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

// Fetch event - handle all requests
self.addEventListener('fetch', event => {
    // Ignore non-GET requests
    if (event.request.method !== 'GET') return;

    const request = event.request;

    // Choose caching strategy based on request type
    if (isCacheableRequest(request)) {
        // For image assets from external domains, use cache-first
        const url = new URL(request.url);
        const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname);
        const isExternalDomain = ALLOWED_DOMAINS.some(domain => url.hostname.includes(domain));
        
        if (isImage && isExternalDomain) {
            event.respondWith(timeAwareCacheFirstStrategy(request));
        }
        // For game assets, use cache-first
        else if (request.url.includes('game_')) {
            event.respondWith(cacheFirstStrategy(request));
        }
        // For HTML and JSON files, use network-first to get latest versions
        else if (request.url.endsWith('.html') || request.url.endsWith('.json') || request.url.endsWith('.txt')) {
            event.respondWith(networkFirstStrategy(request));
        }
        // For everything else cacheable, use time-aware cache
        else {
            event.respondWith(timeAwareCacheFirstStrategy(request));
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
});