// tracking-worker.js
let trackingData = null;
let lastUpdate = Date.now();
let trackingInterval = null;
let supabaseClient = null;
let currentUser = null;
let gameID = null;

// Helper functions
function treat(text) {
    if (!text) return null;
    return text.split('.').join('');
}

function setDeepValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    return obj;
}

function getDeepValue(obj, path) {
    return path.split('.').reduce((curr, part) => curr && curr[part], obj);
}

async function saveTrackingData() {
    if (!supabaseClient || !currentUser || !trackingData) return;

    try {
        const { error } = await supabaseClient
            .from('u_profiles')
            .update({ tracking_data: trackingData })
            .eq('id', currentUser.id);

        if (error) {
            console.error('Error saving tracking data:', error);
        }
    } catch (err) {
        console.error('Failed to save tracking data:', err);
    }
}

async function updateTracking(attrPath, value) {
    if (!trackingData) {
        trackingData = { games: {}, total_playtime: 0 };
    }

    setDeepValue(trackingData, attrPath, value);
}

async function trackingTick() {
    const now = Date.now();
    const timeDiff = now - lastUpdate;
    lastUpdate = now;

    const minutesElapsedX = (timeDiff / 60000);
    const minutesElapsed = Math.round((minutesElapsedX + Number.EPSILON) * 100) / 100;
    
    if (minutesElapsed > 0 && gameID) {
        const tGameID = treat(gameID);
        if (!trackingData.games[tGameID]) {
            trackingData.games[tGameID] = { playtime: 0 };
        }

        const currentPlaytime = getDeepValue(trackingData, `games.${tGameID}.playtime`) || 0;
        await updateTracking(`games.${tGameID}.playtime`, currentPlaytime + minutesElapsed);

        const totalPlaytime = trackingData.total_playtime || 0;
        await updateTracking('total_playtime', totalPlaytime + minutesElapsed);
        
        await saveTrackingData();
    }
}

// Service Worker event handlers
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'INIT':
            supabaseClient = data.supabaseClient;
            currentUser = data.user;
            trackingData = data.trackingData;
            gameID = data.gameID;
            lastUpdate = Date.now();
            
            // Start tracking interval
            if (trackingInterval) {
                clearInterval(trackingInterval);
            }
            trackingInterval = setInterval(trackingTick, 5 * 60 * 1000);
            break;

        case 'UPDATE_LOCATION':
            if (trackingData) {
                const path = `pages_visited.${treat(data.pathname)}.count`;
                const currentCount = getDeepValue(trackingData, path) || 0;
                await updateTracking(path, currentCount + 1);
                await saveTrackingData();
            }
            break;

        case 'CLEANUP':
            if (trackingInterval) {
                clearInterval(trackingInterval);
                trackingInterval = null;
            }
            if (trackingData) {
                await trackingTick();
                if (data.stateSync) {
                    try {
                        const state = await data.stateSync.syncUtil.exportState();
                        await data.stateSync.saveToServer(state.state);
                    } catch (err) {
                        console.error('Error saving state:', err);
                    }
                }
            }
            break;
    }
});