// service-worker.js - Optimized for better caching strategies
const CACHE_NAME = 'ccported-cache-v2';

// Assets to cache immediately on service worker installation
const PRECACHE_ASSETS = [];

// Static allowed domains (fallback)
let ALLOWED_DOMAINS = [
    'ccgstatic.com',
];

const BLACKLIST = [
    "googlesyndication.com",
    "storage.ko-fi.com",
    "monu.delivery",
    "www.google-analytics.com",
    "cognito-identity.us-west-2.amazonaws.com",
    "dynamodb.us-west-2.amazonaws.com",
    "googletagmanager.com"
    // Note: removed amazonaws.com from blacklist since you have AWS domains in servers.txt
];

// Cache for storing servers list with timestamp
let serversCache = {
    domains: [],
    lastUpdated: 0,
    updateInterval: 5 * 60 * 1000 // 5 minutes
};

// Load and parse servers.txt
async function updateAllowedDomains() {
    try {
        const now = Date.now();

        // Check if we need to update (every 5 minutes)
        if (now - serversCache.lastUpdated < serversCache.updateInterval && serversCache.domains.length > 0) {
            return serversCache.domains;
        }

        const response = await fetch("/servers.txt", { cache: 'no-cache' });

        if (!response.ok) {
            return serversCache.domains.length > 0 ? serversCache.domains : ALLOWED_DOMAINS;
        }

        const text = await response.text();
        const domains = text.split('\n')
            .map(line => line.split(",")[0].trim())
            .filter(line => line.length > 0);

        // Update cache
        serversCache = {
            domains: [...ALLOWED_DOMAINS, ...domains],
            lastUpdated: now,
            updateInterval: serversCache.updateInterval
        };

        return serversCache.domains;

    } catch (error) {
        console.error('Error updating allowed domains:', error);
        return serversCache.domains.length > 0 ? serversCache.domains : ALLOWED_DOMAINS;
    }
}

// Robust precaching function
async function precacheAssets(cache, assets) {
    const results = await Promise.allSettled(
        assets.map(async (asset) => {
            try {
                await cache.add(asset);
            } catch (error) {
                console.warn('Failed to precache:', asset, error.message);
                // Try alternative approach for relative paths
                if (asset.startsWith('./')) {
                    const alternativeAsset = asset.substring(2);
                    try {
                        await cache.add(alternativeAsset);
                    } catch (altError) {
                        console.warn('Alternative path also failed:', alternativeAsset, altError.message);
                        throw altError;
                    }
                } else {
                    throw error;
                }
            }
        })
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Don't fail installation if some assets fail to precache
    return true;
}

// Install event - precache critical resources and load servers
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            // Precache assets with error handling
            caches.open(CACHE_NAME).then(cache => {
                return precacheAssets(cache, PRECACHE_ASSETS);
            }),
            // Load servers list
            updateAllowedDomains()
        ]).then(() => {
            return self.skipWaiting();
        }).catch(error => {
            console.error('Service worker installation failed:', error);
            // Still skip waiting to allow the service worker to activate
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
async function isCacheableRequest(request) {
    const url = new URL(request.url);
    if (url.pathname.includes("blocked_res")) {
        return false; // Never cache ping requests
    }
    // Never cache txt files (they change often)
    if (url.pathname.endsWith('.txt')) {
        return false;
    }

    // Only cache GET requests
    if (request.method !== 'GET') {
        return false;
    }

    // Check blacklist first
    const isBlacklisted = BLACKLIST.some(domain => url.hostname.includes(domain));
    if (isBlacklisted) {
        return false;
    }

    // Allow caching for same origin
    const isSameOrigin = url.origin === self.location.origin;
    if (isSameOrigin) {
        return true;
    }

    // For cross-origin, check against allowed domains
    const allowedDomains = await updateAllowedDomains();
    const isAllowedDomain = allowedDomains.some(domain => url.hostname.includes(domain));

    if (!isAllowedDomain) {
        return false;
    }

    // Cache based on file extensions
    const cacheableExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.otf',
        '.mp3', '.ogg', '.wav',
        '.mp4', '.webm',
        '.data', '.wasm', '.bundle', '.unity3d', '.pak', '.bin'
    ];

    return cacheableExtensions.some(ext => url.pathname.endsWith(ext));
}

// Helper function to check if response is valid for caching
function isValidResponse(response) {
    return response &&
        response.ok &&
        response.status >= 200 &&
        response.status < 300 &&
        response.status !== 209;
}

// Network-first strategy for HTML, CSS, JS
async function networkFirstStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    try {

        // Configure fetch options for cross-origin requests
        const fetchOptions = {};
        const url = new URL(request.url);
        const isCrossOrigin = url.origin !== self.location.origin;

        if (isCrossOrigin) {
            fetchOptions.mode = 'cors';
            fetchOptions.credentials = 'same-origin';
        }

        // Try network first with a timeout
        const networkResponse = await Promise.race([
            fetch(request, fetchOptions),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Network timeout')), 5000)
            )
        ]);

        // If successful and valid, cache and return
        if (isValidResponse(networkResponse)) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }

        // If network response is invalid, try cache
        throw new Error('Invalid network response');

    } catch (error) {
        // Fall back to cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // No cache available, return a basic error response for HTML
        if (request.url.endsWith('.html')) {
            return new Response(
                `<!DOCTYPE html><html><head><title>Offline</title></head><body>
                <h1>You're offline</h1><p>This page is not available offline.</p>
                </body></html>`,
                {
                    headers: { 'Content-Type': 'text/html' },
                    status: 200
                }
            );
        }

        throw error;
    }
}

// Cache-first strategy for large game files
async function cacheFirstStrategy(request) {
    console.log("[SW][CACHE FIRST]", request.url);
    const cache = await caches.open(CACHE_NAME);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    // Fetch from network
    try {

        const url = new URL(request.url);
        const fetchOptions = {};

        if (url.origin !== self.location.origin) {
            fetchOptions.mode = 'cors';
            fetchOptions.credentials = 'same-origin';
        }

        const networkResponse = await fetch(request, fetchOptions);

        if (isValidResponse(networkResponse)) {
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.error('Failed to fetch game asset:', request.url, error);
        throw error;
    }
}

// Helper function to identify file types
function getFileType(url) {
    const pathname = url.pathname.toLowerCase();

    if (pathname.endsWith('.html')) return 'html';
    if (pathname.endsWith('.css')) return 'css';
    if (pathname.endsWith('.js')) return 'js';
    if (/\".png\"|\".jpg\"|\".jpeg\"|\".gif\"|\".webp\"|\".svg$/i.test(pathname)) return 'image';
    if (/\".data\"|\".wasm\"|\".bundle\"|\".unity3d\"|\".pak\"|\".bin$/i.test(pathname)) return 'game';

    return 'other';
}

// Main fetch event handler
self.addEventListener('fetch', async event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const request = event.request;
    const isCacheable = await isCacheableRequest(request);
    if (!isCacheable) {
        return;
    }
    event.respondWith(
        (async () => {
            const url = new URL(request.url);
            const fileType = getFileType(url);
            const allowedDomains = await updateAllowedDomains();
            const isFromAllowedDomain = allowedDomains.some(domain => url.hostname.includes(domain));

            // Route based on file type and domain
            switch (fileType) {
                case 'html':
                case 'css':
                case 'js':
                    return networkFirstStrategy(request);

                case 'image':
                    if (isFromAllowedDomain) {
                        return cacheOnlyForImages(request);
                    }
                    return networkFirstStrategy(request);

                case 'game':
                    return cacheFirstStrategy(request);

                default:
                    // For other cacheable files, use network-first
                    return networkFirstStrategy(request);
            }
        })()
    );
});

async function cacheOnlyForImages(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    try {
        const fetchOptions = {
            mode: 'cors',
            credentials: 'same-origin'
        };
        const networkResponse = await fetch(request, fetchOptions);

        if (isValidResponse(networkResponse)) {
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.error('Failed to fetch image:', request.url, error);
        throw error;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', event => {
    const sendMessage = (message) => {
        if (event.ports[0]) {
            event.ports[0].postMessage(message);
        } else {
            self.clients.matchAll({
                includeUncontrolled: true,
                type: 'window',
            }).then((clients) => {
                if (clients && clients.length) {
                    clients.forEach(client => client.postMessage(message));
                }
            });
        }
    };

    if (event.data && event.data.action === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log(`[SW][CLEAR_CACHE] Cache cleared`);
            serversCache = { domains: [], lastUpdated: 0, updateInterval: 5 * 60 * 1000 };
            sendMessage({ type: 'CACHE_CLEARED', status: 'Cache cleared successfully by service worker' });
        });
    }

    if (event.data && event.data.action === 'FORCE_REFRESH') {
        console.log(`[SW][FORCE_REFRESH] Force refreshing ${event.data.url}`);
        const url = event.data.url;
        caches.open(CACHE_NAME).then(cache => {
            cache.delete(url).then(() => {
                sendMessage({ status: `Cache cleared for ${url}` });
            });
        });
    }

    if (event.data && event.data.action === 'UPDATE_SERVERS') {
        console.log(`[SW][UPDATE_SERVERS] Updating servers list`);
        serversCache.lastUpdated = 0;
        updateAllowedDomains().then(() => {
            sendMessage({ status: 'Servers list updated' });
        });
    }
});
