window.ccPorted = {};

const link = document.createElement("link");
const script = document.currentScript;
const gameID = script.getAttribute("data-gameID");
const seenPopup = (localStorage.getItem("ccported-popup") == "yes");
const framed = pageInIframe();
const glocation =(!framed) ? window.location.hostname : document.location.ancestorOrigins[0];
const tGameID = treat(window.gameID);
const stlyeLoadPromise = new Promise((r, rr) => {
    link.onload = () => {
        r();
    }
});

let cachedChannels = null;
let trackingInterval = null;
let lastUpdate = Date.now();

window.gameID = window.ccPorted.gameID;
window.ccPorted.muteManagerPopupOpen = false;

window.addEventListener("beforeunload", cleanupTracking);

link.href = "/assets/styles/master.css";
link.setAttribute("rel", "stylesheet");
document.head.appendChild(link);

createGameStorageSandbox(window.gameID || "ccported")();
importJSON("/games.json").then(games => {
    var { games } = games;
    var unseengames = games.filter(game => {
        var hasSeen = !hasSeenGame(game.name);
        markGameSeen(game.name);
        return hasSeen;
    });
    if (unseengames.length == 0) return;
    var tail = "";
    if (unseengames.length > 5) {
        tail = " and more";
    }
    unseengames = unseengames.splice(0, 5);

    var string = "New games to play: ";
    unseengames.forEach((game, i) => {

        string += ((i == games.length - 1) ? "and " : "") + game.fName + ((i != unseengames.length - 1) ? ", " : "");
    });
    createPopup(string + tail);
    localStorage.setItem("ccported-popup", "yes", true)
});
shortcut([
    17, 77
], () => {
    if (!window.ccPorted.muteManagerPopupOpen) {
        muteManager()
    } else {
        closeMuteManager();
    }
});
shortcut([17, 81], toggleStats);

async function importJSON(path) {
    let url;
    if (path.startsWith("/") && !path.startsWith("//")) {
        url = new URL(path, window.location.origin);
    } else {
        url = new URL(path);
    }
    url.searchParams.append('_', Date.now());

    const res = await fetch(path, {
        method: "GET",
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
    return res.json();
}
async function trackingTick() {
    const now = Date.now();
    const timeDiff = now - lastUpdate;
    lastUpdate = now;

    let minutesElapsedX = timeDiff / 60000;
    const minutesElapsed =
        Math.round((minutesElapsedX + Number.EPSILON) * 100) / 100;
    if (minutesElapsed > 0 && tGameID) {
        if (!window.ccPorted.trackingData.games[tGameID]) {
            window.ccPorted.trackingData.games[tGameID] = { playtime: 0 };
        }

        const currentPlaytime =
            getDeepValue(window.ccPorted.trackingData, `games.${tGameID}.playtime`) ||
            0;
        updateTracking(
            `games.${tGameID}.playtime`,
            currentPlaytime + minutesElapsed
        );

        const totalPlaytime = window.ccPorted.trackingData.total_playtime || 0;
        updateTracking("total_playtime", totalPlaytime + minutesElapsed);
    }
    await saveTrackingData();
}
async function saveTrackingData() {
    try {
        const { error } = await window.ccPorted.supabaseClient
            .from("u_profiles")
            .update({ tracking_data: window.ccPorted.trackingData })
            .eq("id", window.ccPorted.user.id);

        if (error) {
            log("Error saving tracking data:", error);
        }
    } catch (err) {
        log("Failed to save tracking data:", err);
    }
}
async function updateTracking(attrPath, value) {
    if (!window.ccPorted.trackingData) {
        window.ccPorted.trackingData = { games: {}, total_playtime: 0 };
    }

    setDeepValue(window.ccPorted.trackingData, attrPath, value);
}
async function handleUserLoggedIn() {
    // Fetch tracking data if user exists
    const { data, error } = await window.ccPorted.supabaseClient
        .from("u_profiles")
        .select("tracking_data")
        .eq("id", window.ccPorted.user.id)
        .single();
    if (error) log("Error fetching tracking data:", error);
    if (data && data.tracking_data) {
        window.ccPorted.trackingData = data.tracking_data;
    } else {
        window.ccPorted.trackingData = {
            games: {},
            total_playtime: 0,
            chat_messages_sent: 0,
            pages_visited: {},
        };
    }
    setupTracking();
    window.ccPorted.stateSync = new GameStateSync(
        window.ccPorted.user.id,
        window.ccPorted.supabaseClient
    );
    window.ccPorted.stateSync.initialize();
}
async function installGTAG() {
    if (window.gtag) {
        emit();
        setInterval(emit, 1000 * 60 * 10);
        return Promise.resolve();
    } else {
        const script = document.createElement("script");
        const gID = `G-DJDL65P9Y4`;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gID}`;
        document.head.appendChild(script);
        const loadPromise = new Promise((r, rr) => {
            script.onload = () => {
                window.dataLayer = window.dataLayer || [];
                function gtag() { dataLayer.push(arguments); }
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', gID);
                emit();
                setInterval(emit, 1000 * 60 * 10);
                r();
            }
        });
        return loadPromise;
    }

}


async function init() {
    const stats = new Stats();
    window.ccPorted.stats = stats;
    window.ccPorted.supabaseClient = await installSupascript();
    await installGTAG();
    const { data: { user } } = await window.ccPorted.supabaseClient.auth.getUser();
    window.ccPorted.user = user;
    if (user) {
        handleUserLoggedIn();
    }
    if (localStorage.getItem("[ns-ccported]_chat-convo-all-muted") !== 1 && user) {
        setupRealtime();
    }
    if (localStorage.getItem("[ns-ccported]_hiring_popup") !== "yes") {
        createPopup();
        localStorage.setItem("hiring_popup", "yes", true);
    };
    if (!seenPopup) {
        setTimeout(createPopup, 120000);
    }
}
async function setupRealtime() {
    try {
        window.ccPorted.supabaseClient
            .channel('public:chat_messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                },
                handleNewMessage
            )
            .subscribe();
    } catch (err) {
        log(err);
    }
}
async function muteManagerPopup() {

    if (!window.ccPorted.user) {
        const { data: { user } } = await window.ccPorted.supabaseClient.auth.getUser();
        window.ccPorted.user = user;
        if (!user) {
            createNotif({
                message: `You must be logged in to use this feature`,
                cta: false,
                autoClose: 1,
                actions: []
            });
        }
    }
    if (window.ccPorted.fontAwesomeLoaded !== true) {
        await loadFontAwesome();
    }


    const popup = document.createElement("div");
    popup.classList.add("cc");
    popup.classList.add("popup");
    let rows = []
    if (cachedChannels) {
        rows = cachedChannels;
    } else {
        const { data, error } = await window.ccPorted.supabaseClient
            .rpc('user_in_joined_users', { user_id: window.ccPorted.user.id });
        rows = data;
        cachedChannels = rows;
        if (error) log(error)
    }

    popup.innerHTML = `
        <div class="cc popup-content">
            <h2>Manage Notifications</h2>
            <p>Use <code>CTRL+M</code> to pull this up</p>
            <div class = "cc channels-list-mute">
                ${rows.map((channel) => {
        return `<div class = "cc channel-row">
                            <p class = "cc channel-name">${channel.friendly_name}</p>
                            <p  data-channelid = "${channel.channel_id}" class="cc mute-channel"><i class="fa-solid fa-bell${isChannelMuted(channel) ? "-slash" : ""}"></i></p>
                        </div>`
    }).join("<br>")
        }
            </div>
            <div class = "cc popup-buttons">
                <button class = "cc" id="closer">Done</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    window.ccPorted.muteManagerPopupOpen = true;
    return popup;
}
async function muteManager() {
    const popup = await muteManagerPopup();
    window.ccPorted.muteManagerPopupRef = popup;
    document.addEventListener("keydown", (e) => {
        if (e.key == "Escape") {
            closeMuteManager();
        }
    });
    popup.querySelectorAll(".mute-channel").forEach((el) => {
        el.addEventListener("click", async (e) => {
            const channelID = el.getAttribute("data-channelid");
            if (localStorage.getItem(`channel-muted-${channelID}`) == 1) {
                localStorage.setItem(`channel-muted-${channelID}`, 0, true);
            } else {
                localStorage.setItem(`channel-muted-${channelID}`, 1, true);
            }
            el.innerHTML = `<i class="fa-solid fa-bell${isChannelMuted({ channel_id: channelID }) ? "-slash" : ""}"></i>`;
        });
    });
    popup.querySelector("#closer").addEventListener("click", () => {
        closeMuteManager();
    });
}
function log(...args) {
    console.log("[CCPORTED]: ", ...args);
    if (window.ccPorted?.stats) {
        window.ccPorted.stats.log(...args);
    }
}
function shuffle(array) {
    let currentIndex = array.length;

    while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
}
function closeMuteManager() {
    if (window.ccPorted.muteManagerPopupOpen) {
        window.ccPorted.muteManagerPopupRef.remove();;
        window.ccPorted.muteManagerPopupRef = null;
        window.ccPorted.muteManagerPopupOpen = false;
    }
}
function loadFontAwesome() {
    const link = document.createElement("link");
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css";
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("crossorigin", "anonymous");
    link.setAttribute("referrerpolicy", "no-referrer");
    document.head.appendChild(link);

    return new Promise((r, rr) => {
        link.onload = () => {
            window.ccPorted.fontAwesomeLoaded = true;
            r();
        }
    });
}
function isChannelMuted(channel) {
    return localStorage.getItem(`channel-muted-${channel.channel_id}`) == 1;
}
function shortcut(keys, cb) {
    log(`Creating shortcut for keys ${keys}, calling ${cb.name}`);
    var keyMap = {};
    for (const key of keys) {
        keyMap[key] = false;
    }
    document.addEventListener("keydown", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = true;
        }
        if (check()) {
            cb();
        }
    });
    document.addEventListener("keyup", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = false;
        }
    });
    function check() {
        var allPressed = true;
        for (const key of keys) {
            if (!keyMap[key]) {
                allPressed = false;
            }
        }
        return allPressed;
    }
}
function decamelize(string) {
    let denormalized = "";
    for (let i = 0; i < string.length; i++) {
        if (string[i] === string[i].toUpperCase() && ((string[i + 1] && string[i + 1] === string[i + 1].toUpperCase()) || !string[i + 1])) {
            denormalized += " " + string[i];
        } else {
            denormalized += string[i];
        }
    }
    denormalized = denormalized[0].toUpperCase() + denormalized.slice(1);
    return denormalized;
}
function installSupascript() {
    log("Installing Supabase script");
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@supabase/supabase-js@2";
    document.head.appendChild(script);
    const loadPromise = new Promise((r, rr) => {
        script.onload = () => {
            r(createClient());
        }
    });

    return loadPromise;
}
function pageInIframe() {
    return (window.location !== window.parent.location);
}
function toggleStats() {
    if (window.ccPorted.stats.isOpen) {
        window.ccPorted.stats.close();
    } else {
        window.ccPorted.stats.open();
    }
}
function treat(text) {
    if (!text) return null;
    return text.split(".").join("-");
}
function setDeepValue(obj, path, value) {
    const parts = path.split(".");
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
    return path.split(".").reduce((curr, part) => curr && curr[part], obj);
}
function setupTracking() {
    updateTracking(
        `pages_visited.${treat(window.location.pathname)}.count`,
        (getDeepValue(
            window.ccPorted.trackingData,
            `pages_visited.${treat(window.location.pathname)}.count`
        ) || 0) + 1
    );
    trackingTick();
    if (trackingInterval) {
        clearInterval(trackingInterval);
    }

    lastUpdate = Date.now();
    trackingInterval = setInterval(trackingTick, 5 * 60 * 1000);
}
function cleanupTracking() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    if (window.ccPorted.trackingData) {
        trackingTick();
    }
}
function createClient() {
    const SUPABASE_URL = 'https://dahljrdecyiwfjgklnvz.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGxqcmRlY3lpd2ZqZ2tsbnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjE3NzMsImV4cCI6MjA0MzgzNzc3M30.8-YlXqSXsYoPTaDlHMpTdqLxfvm89-8zk2HG2MCABRI';
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
function createGameStorageSandbox(gameId = "ccported") {
    // Create a unique namespace for this game
    const namespace = `[ns_${gameId}]`;

    // Save original storage APIs
    const originalLocalStorage = window.localStorage;
    const originalIndexedDB = window.indexedDB;
    const namespaceRegex = new RegExp(`^\[ns_[a-zA-Z0-9_-]+\]_`);

    // Create localStorage proxy
    const localStorageProxy = new Proxy(localStorage, {
        get: function (target, prop) {
            switch (prop) {
                case 'setItem':
                    return function (key, value, global = false) {
                        if (global) {
                            return originalLocalStorage.setItem('[ns_ccported]_' + key, value);
                        }
                        if (originalLocalStorage.getItem(`[ns_ccported]_${key}`)) {
                            return originalLocalStorage.setItem(`[ns_ccported]_${key}`, value);
                        }
                        if (originalLocalStorage.getItem(`${namespace}_${key}`)) {
                            return originalLocalStorage.setItem(`${namespace}_${key}`, value);
                        }
                        if (namespaceRegex.test(key)) {
                            return originalLocalStorage.setItem(key, value);
                        }
                        return originalLocalStorage.setItem(`${namespace}_${key}`, value);
                    }
                case 'getItem':
                    return function (key) {
                        if (originalLocalStorage.getItem(`[ns_ccported]_${key}`)) {
                            return originalLocalStorage.getItem(`[ns_ccported]_${key}`);
                        }
                        if (originalLocalStorage.getItem(`${namespace}_${key}`)) {
                            return originalLocalStorage.getItem(`${namespace}_${key}`);
                        }
                        if (namespaceRegex.test(key)) {
                            return originalLocalStorage.getItem(key);
                        }
                        return originalLocalStorage.getItem(`${namespace}_${key}`);
                    }
                case 'removeItem':
                    return function (key) {
                        if (originalLocalStorage.getItem(`[ns_ccported]_${key}`)) {
                            return originalLocalStorage.removeItem(`[ns_ccported]_${key}`);
                        }
                        if (originalLocalStorage.getItem(`${namespace}_${key}`)) {
                            return originalLocalStorage.removeItem(`${namespace}_${key}`);
                        }
                        if (namespaceRegex.test(key)) {
                            return originalLocalStorage.removeItem(key);
                        }
                        return;
                    }
                case 'clear':
                    return function (global = false) {
                        if (global) {
                            return originalLocalStorage.clear();
                        }
                        for (let i = originalLocalStorage.length - 1; i >= 0; i--) {
                            const key = originalLocalStorage.key(i);
                            if (key.startsWith(`${namespace}_`)) {
                                originalLocalStorage.removeItem(key);
                            }
                        }
                    }
                case 'key':
                    return function (index, global = false) {
                        if (global) {
                            return originalLocalStorage.key(index);
                        }
                        const gameKeys = [];
                        for (let i = 0; i < originalLocalStorage.length; i++) {
                            const key = originalLocalStorage.key(i);
                            if (key.startsWith(`${namespace}_`)) {
                                gameKeys.push(key.slice(namespace.length + 1));
                            }
                        }
                        return gameKeys[index];
                    }
                case 'length':
                    let count = 0;
                    for (let i = 0; i < originalLocalStorage.length; i++) {
                        if (originalLocalStorage.key(i).startsWith(`${namespace}_`)) {
                            count++;
                        }
                    }
                    return count;
                case 'globalLength':
                    return originalLocalStorage.length;
                default:
                    if (originalLocalStorage.getItem(`[ns_ccported]_${prop}`)) {
                        return originalLocalStorage.getItem(`[ns_ccported]_${prop}`);
                    }
                    if (originalLocalStorage.getItem(`${namespace}_${prop}`)) {
                        return originalLocalStorage.getItem(`${namespace}_${prop}`);
                    }
                    if (namespaceRegex.test(prop)) {
                        return originalLocalStorage.getItem(prop);
                    }
            }
        },
        set: function (target, prop, value) {
            ['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length', 'globalLength'].forEach((method) => {
                if (prop === method) {
                    throw new Error(`Cannot overwrite localStorage method ${method}`);
                }
            });
            if (originalLocalStorage.getItem(`[ns_ccported]_${prop}`)) {
                return originalLocalStorage.setItem(`[ns_ccported]_${prop}`, value);
            }
            if (originalLocalStorage.getItem(`${namespace}_${prop}`)) {
                return originalLocalStorage.setItem(`${namespace}_${prop}`, value);
            }
            if (namespaceRegex.test(prop)) {
                return originalLocalStorage.setItem(prop, value);
            }
            return originalLocalStorage.setItem(`${namespace}_${prop}`, value);
        }
    });

    // Create IndexedDB proxy
    const indexedDBProxy = new Proxy(window.indexedDB, {
        get: function (target, prop) {
            if (prop === 'open') {
                return function (dbName, version) {
                    const isNamespaced = namespaceRegex.test(dbName);
                    if (isNamespaced) {
                        return originalIndexedDB.open(dbName, version);
                    }
                    if (dbName.startsWith("[ns_ccported]_")) {
                        return originalIndexedDB.open(dbName, version);
                    }
                    const namespacedDBName = `${namespace}_${dbName}`;

                    const checkDatabases = async () => {
                        try {
                            const databases = await originalIndexedDB.databases();
                            const oldDBExists = databases.some(db => db.name === dbName);
                            return oldDBExists;
                        } catch (error) {
                            console.error('Error checking databases:', error);
                            return false;
                        }
                    };

                    const request = originalIndexedDB.open(namespacedDBName, version);

                    request.onerror = function (event) {
                        console.error(`Error opening database ${namespacedDBName}:`, event.target.error);
                    };

                    request.onupgradeneeded = function (event) {
                        const newDB = event.target.result;

                        checkDatabases().then(oldDBExists => {
                            if (oldDBExists) {
                                const oldDBRequest = originalIndexedDB.open(dbName);

                                oldDBRequest.onerror = function (event) {
                                    console.error(`Error opening old database ${dbName}:`, event.target.error);
                                };

                                oldDBRequest.onsuccess = function (event) {
                                    const oldDB = event.target.result;
                                    const storeNames = Array.from(oldDB.objectStoreNames);

                                    if (storeNames.length === 0) {
                                        oldDB.close();
                                        return;
                                    }

                                    storeNames.forEach(storeName => {
                                        try {
                                            const transaction = oldDB.transaction(storeName, 'readonly');
                                            const store = transaction.objectStore(storeName);
                                            const getAllRequest = store.getAll();

                                            getAllRequest.onsuccess = function () {
                                                try {
                                                    if (!newDB.objectStoreNames.contains(storeName)) {
                                                        const newStore = newDB.createObjectStore(storeName,
                                                            store.keyPath ? { keyPath: store.keyPath } :
                                                                { autoIncrement: store.autoIncrement });

                                                        Array.from(store.indexNames).forEach(indexName => {
                                                            const index = store.index(indexName);
                                                            newStore.createIndex(indexName, index.keyPath, {
                                                                unique: index.unique,
                                                                multiEntry: index.multiEntry
                                                            });
                                                        });
                                                    }

                                                    const newTransaction = newDB.transaction(storeName, 'readwrite');
                                                    const newStore = newTransaction.objectStore(storeName);
                                                    const items = getAllRequest.result;

                                                    items.forEach(item => {
                                                        try {
                                                            newStore.add(item);
                                                        } catch (error) {
                                                            console.error(`Error adding item to ${storeName}:`, error);
                                                        }
                                                    });

                                                    newTransaction.onerror = function (event) {
                                                        console.error(`Error in transfer transaction for ${storeName}:`, event.target.error);
                                                    };
                                                } catch (error) {
                                                    console.error(`Error processing store ${storeName}:`, error);
                                                }
                                            };

                                            getAllRequest.onerror = function (event) {
                                                console.error(`Error getting data from ${storeName}:`, event.target.error);
                                            };

                                            transaction.oncomplete = function () {
                                                if (storeName === storeNames[storeNames.length - 1]) {
                                                    oldDB.close();
                                                    const deleteRequest = originalIndexedDB.deleteDatabase(dbName);
                                                    deleteRequest.onerror = function (event) {
                                                        console.error(`Error deleting old database ${dbName}:`, event.target.error);
                                                    };
                                                }
                                            };
                                        } catch (error) {
                                            console.error(`Error in store transfer process for ${storeName}:`, error);
                                        }
                                    });
                                };
                            }
                        });
                    };

                    return request;
                };
            } else if (prop === 'deleteDatabase') {
                return function (dbName) {
                    if (namespaceRegex.test(dbName)) {
                        return originalIndexedDB.deleteDatabase(dbName);
                    }
                    const namespacedDBName = `${namespace}_${dbName}`;
                    return originalIndexedDB.deleteDatabase(namespacedDBName);
                };
            } else if (prop === 'databases') {
                return async function () {
                    const databases = await originalIndexedDB.databases();
                    return databases.map(db => {
                        db.name = db.name.replace(namespace + "_", '');
                        return db;
                    });
                };
            } else {
                const value = originalIndexedDB[prop];
                return typeof value === 'function' ? value.bind(originalIndexedDB) : value;
            }
        }
    });
    async function migrateDatabase(dbName, version) {
        const namespacedDBName = `${namespace}_${dbName}`;
        const databases = await originalIndexedDB.databases();
        const oldDBExists = databases.some(db => db.name === dbName);

        if (oldDBExists) {

            return new Promise((resolve, reject) => {
                const request = originalIndexedDB.open(namespacedDBName, version || 1);

                request.onerror = function (event) {
                    console.error(`Error opening namespaced database ${namespacedDBName}:`, event.target.error);
                    reject(event.target.error);
                };

                request.onsuccess = function (event) {
                    const oldDBRequest = originalIndexedDB.open(dbName);

                    oldDBRequest.onerror = function (event) {
                        console.error(`Error opening old database ${dbName}:`, event.target.error);
                        reject(event.target.error);
                    };

                    oldDBRequest.onsuccess = function (event) {
                        const oldDB = event.target.result;
                        const storeNames = Array.from(oldDB.objectStoreNames);

                        if (storeNames.length === 0) {
                            oldDB.close();
                            resolve();
                            return;
                        }

                        let completedStores = 0;
                        const upgradeRequest = originalIndexedDB.open(namespacedDBName, (version || 1) + 1);

                        upgradeRequest.onupgradeneeded = function (event) {
                            const upgradedDB = event.target.result;

                            storeNames.forEach(storeName => {
                                if (!upgradedDB.objectStoreNames.contains(storeName)) {
                                    const oldStore = oldDB.transaction(storeName).objectStore(storeName);
                                    const newStore = upgradedDB.createObjectStore(storeName,
                                        oldStore.keyPath ? { keyPath: oldStore.keyPath } :
                                            { autoIncrement: oldStore.autoIncrement }
                                    );

                                    // Copy indexes
                                    Array.from(oldStore.indexNames).forEach(indexName => {
                                        const index = oldStore.index(indexName);
                                        newStore.createIndex(indexName, index.keyPath, {
                                            unique: index.unique,
                                            multiEntry: index.multiEntry
                                        });
                                    });
                                }
                            });
                        };

                        upgradeRequest.onsuccess = function (event) {
                            const upgradedDB = event.target.result;

                            storeNames.forEach(storeName => {
                                try {
                                    const transaction = oldDB.transaction(storeName, 'readonly');
                                    const store = transaction.objectStore(storeName);
                                    const getAllRequest = store.getAll();

                                    getAllRequest.onsuccess = function () {
                                        try {
                                            const items = getAllRequest.result;
                                            const newTransaction = upgradedDB.transaction(storeName, 'readwrite');
                                            const newStore = newTransaction.objectStore(storeName);

                                            items.forEach(item => {
                                                try {
                                                    newStore.add(item);
                                                } catch (error) {
                                                    console.error(`Error adding item to ${storeName}:`, error);
                                                }
                                            });

                                            newTransaction.oncomplete = function () {
                                                completedStores++;

                                                if (completedStores === storeNames.length) {
                                                    oldDB.close();
                                                    upgradedDB.close();

                                                    const deleteRequest = originalIndexedDB.deleteDatabase(dbName);

                                                    deleteRequest.onsuccess = function () {
                                                        resolve();
                                                    };
                                                    deleteRequest.onerror = function (event) {
                                                        console.error(`Error deleting old database ${dbName}:`, event.target.error);
                                                        reject(event.target.error);
                                                    };
                                                }
                                            };

                                            newTransaction.onerror = function (event) {
                                                console.error(`Error in transfer transaction for ${storeName}:`, event.target.error);
                                                reject(event.target.error);
                                            };
                                        } catch (error) {
                                            console.error(`Error processing store ${storeName}:`, error);
                                            reject(error);
                                        }
                                    };

                                    getAllRequest.onerror = function (event) {
                                        console.error(`Error getting data from ${storeName}:`, event.target.error);
                                        reject(event.target.error);
                                    };
                                } catch (error) {
                                    console.error(`Error in store transfer process for ${storeName}:`, error);
                                    reject(error);
                                }
                            });
                        };

                        upgradeRequest.onerror = function (event) {
                            console.error(`Error upgrading database ${namespacedDBName}:`, event.target.error);
                            reject(event.target.error);
                        };
                    };
                };
            });
        } else {
            return Promise.resolve();
        }
    }
    return function setupGameEnvironment() {
        Object.defineProperty(window, 'localStorage', {
            value: localStorageProxy,
            writable: false,
            configurable: true
        });

        Object.defineProperty(window, 'indexedDB', {
            value: indexedDBProxy,
            writable: false,
            configurable: true
        });
        window.ccPorted.migrateDatabase = migrateDatabase;
    };
}
function emit() {
    const data = {
        gameID,
        location: (glocation.length > 0) ? glocation : "unknown",
        isFramed: framed,
    }
    if (framed) {
        data["parentDomainHost"] = (new URL(window.location.ancestorOrigins[0]).hostname.length > 0) ? new URL(window.location.ancestorOrigins[0]).hostname : "unknown";
    }
    log(data);
    gtag("event", "play_game", data);
}
function hasSeenGame(gameID) {
    return localStorage.getItem(`seen-${gameID}`) == "yes";
}
function markGameSeen(gameID) {
    localStorage.setItem(`seen-${gameID}`, "yes", true);
}
function createNotif(popupData) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 800px;
        min-width: 500px;
        background-color: rgb(37,37,37);
        border: 2px solid #333;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;
    if (popupData.autoClose) {
        const meter = document.createElement("div");
        meter.classList.add("meter");
        meter.style.cssText = `
            margin: 0;
            width: 100%;
            height: 10px;
            background-color: rgba(0,0,255,1);
            display: block;
            position: absolute;
            border-radius: 10px;
            z-index: 9;
            top: 0;
            left: 0;
            animation: meter-animation ${popupData.autoClose}s linear forwards;
        `;
        popup.appendChild(meter);

        setTimeout(() => {
            popup.style.animation = `fade 0.5s`;
            setTimeout(() => {
                popup.remove()
            }, 500);
        }, popupData.autoClose * 1000)
    }
    const popupContent = document.createElement("div");
    const message = document.createElement('p');
    message.textContent = popupData.message;
    message.style.marginBottom = '10px';
    message.style.color = 'white';
    let link;
    if (popupData.cta) {
        link = document.createElement('a');
        link.href = popupData.cta.link;
        link.textContent = popupData.cta.text;
        link.style.cssText = `
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
        `;
    }
    if (!popupData.autoClose) {
        const closeButton = document.createElement('a');
        closeButton.href = 'javascript:void(0)';
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            display: inline-block;
            background-color: rgb(248,0,0);
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
        `;
        closeButton.onclick = () => popup.remove();
    }
    const linkRow = document.createElement('div');
    linkRow.style.display = 'flex';
    linkRow.style.justifyContent = 'space-between';
    if (popupData.actions && popupData.actions.length >= 1) {
        const actionContainer = document.createElement("div");
        for (const action of popupData.actions) {
            const [actionName, actionFunc, color] = action;
            let button = document.createElement("button");
            button.style.cssText = `
            display: inline-block;
            background-color: ${(color) ? color : '#4CAF50'};
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
            border: 1px solid ${(color) ? color : '#4CAF50'};
            margin: 5px;
            cursor: pointer;
        `;
            button.onclick = () => {
                popup.remove();
                actionFunc();
            };
            button.innerText = actionName;
            actionContainer.appendChild(button);
        }
        linkRow.appendChild(actionContainer);
    }
    if (popupData.cta) {
        linkRow.appendChild(link);
    }
    if (!popupData.autoClose) {
        linkRow.appendChild(closeButton);
    }
    if (popupData.fullLink) {
        popup.style.cursor = "pointer";
        popup.addEventListener("click", () => {
            window.location.assign(popupData.fullLink);
        })
    }

    popupContent.appendChild(message);
    popupContent.appendChild(linkRow);
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
}
function handleNewMessage(payload) {
    const { new: message } = payload;
    if (localStorage.getItem(`chat-convo-all-muted`) == 1 || localStorage.getItem(`channel-muted-${message.channel_id}`) == 1) return;
    if (message.content.length > 50) {
        message.content = message.content.slice(0, 50);
        message.content += "...";
    }
    createNotif({
        message: `(${message.channel_name}) ${message.display_name}: ${message.content}`,
        cta: false,
        autoClose: 3,
        actions: [
            ["Respond", () => {
                window.location.assign(`/chat?channel=${message.channel_id}`)
            }],
            ["Mute", () => {
                muteManager();
            }, "rgb(248,0,0)"]
        ]

    });
}
function showAutoSaveNotification(text = 'Auto-saving...') {
    var notification = window.ccPorted.autoSaveNotification || document.createElement('div');
    notification.innerHTML = '';
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '10px';
    notification.style.borderRadius = '5px';
    notification.style.textAlign = 'center';
    notification.style.zIndex = '9999';
    notification.style.display = "flex";
    notification.style.alignItems = "center";
    notification.style.justifyContent = "center";
    notification.style.flexDirection = "row";
    notification.innerText = text;
    notification.setAttribute('data-creation-time', Date.now());
    notification.setAttribute('data-min-visible-time', '3000');

    const loading = document.createElement('img');
    loading.src = '/assets/images/loading.gif';
    loading.style.width = '20px';
    loading.style.height = '20px';
    loading.style.verticalAlign = 'middle';
    loading.style.marginRight = '10px';
    notification.insertBefore(loading, notification.firstChild);

    document.body.appendChild(notification);
    window.ccPorted.autoSaveNotification = notification;
    return notification;
}
function createPopup(text = "Check out more awesome games like Spelunky, Minecraft, Cookie Clicker, Drift Hunters, and Slope, all unblocked and free to play at ccported.github.io!", opts) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 800px;
        min-width: 500px;
        background-color: rgb(37,37,37);
        border: 2px solid #333;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;

    const message = document.createElement('p');
    message.textContent = text;
    message.style.marginBottom = '10px';
    message.style.color = 'white';

    const link = document.createElement('a' );
    link.href = '/';
    link.textContent = 'Visit ccported.github.io';
    link.style.cssText = `
        display: inline-block;
        background-color: #4CAF50;
        color: white;
        padding: 10px 15px;
        text-decoration: none;
        border-radius: 5px;
    `;
    const closeButton = document.createElement('a');
    closeButton.href = 'javascript:void(0)';
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
        display: inline-block;
        background-color: rgb(248,0,0);
        color: white;
        padding: 10px 15px;
        text-decoration: none;
        border-radius: 5px;
    `;
    closeButton.onclick = () => popup.remove();
    const linkRow = document.createElement('div');
    linkRow.style.display = 'flex';
    linkRow.style.justifyContent = 'space-between';
    linkRow.appendChild(link);
    linkRow.appendChild(closeButton);

    popup.appendChild(message);
    popup.appendChild(linkRow);

    document.body.appendChild(popup);
    localStorage.setItem("ccported-popup", "yes", true)
}
// Optimized State Synchronization Utility
class StateSyncUtility {
    constructor() {
        this.compressionEnabled = typeof CompressionStream !== 'undefined';
    }

    // Compress data using CompressionStream if available, return as Blob
    async compressData(data) {
        const jsonString = JSON.stringify(data);
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(jsonString);

        if (!this.compressionEnabled) {
            return new Blob([encodedData]);
        }

        const compressed = new Blob([encodedData]).stream()
            .pipeThrough(new CompressionStream('gzip'));

        return new Response(compressed).blob();
    }
    async decompressOldData(compressed) {
        if (!this.compressionEnabled) {
            return JSON.parse(atob(compressed));
        }

        const binaryString = atob(compressed);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const decompressed = new Blob([bytes]).stream()
            .pipeThrough(new DecompressionStream('gzip'));

        return new Response(decompressed).text().then(JSON.parse);
    }
    // Decompress data from Blob
    async decompressData(compressed) {
        const stream = compressed.stream();

        if (!this.compressionEnabled) {
            const text = await new Response(stream).text();
            return JSON.parse(text);
        }

        const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
        return new Response(decompressed).text().then(JSON.parse);
    }

    // Optimized localStorage data collection
    getLocalStorageData() {
        log(`[CCPorted State Manager] Getting local storage data.... (length: ${localStorage.globalLength})`)
        const data = {};
        for (let i = 0; i < localStorage.globalLength; i++) {
            const key = localStorage.key(i, true);
            if (key === 'ccStateLastSave') continue;
            data[key] = localStorage.getItem(key);
        }
        return data;
    }

    // Optimized schema extraction
    async getObjectStoreSchema(store) {
        return {
            name: store.name,
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement,
            indexes: Array.from(store.indexNames, indexName => {
                const index = store.index(indexName);
                return {
                    name: indexName,
                    keyPath: index.keyPath,
                    multiEntry: index.multiEntry,
                    unique: index.unique
                };
            })
        };
    }

    // Export state
    async exportState() {
        try {
            log("[CCPorted State Manager] Exporting state....")
            const time = Date.now();
            const state = {
                localStorage: this.getLocalStorageData(),
                indexedDB: await this.getAllIndexedDBData(),
                timestamp: time
            };

            return {
                state: await this.compressData(state),
                timestamp: time
            };
        } catch (error) {
            log('[CCPorted State Manager] Error exporting state: ' + error);
            throw error;
        }
    }

    // Optimized localStorage import
    async importLocalStorageState(data) {
        localStorage.clear(true);
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    }

    // Optimized store creation
    createObjectStore(db, schema) {
        const store = db.createObjectStore(schema.name, {
            keyPath: schema.keyPath,
            autoIncrement: schema.autoIncrement
        });

        schema.indexes.forEach(indexSchema => {
            store.createIndex(indexSchema.name, indexSchema.keyPath, {
                unique: indexSchema.unique,
                multiEntry: indexSchema.multiEntry
            });
        });

        return store;
    }

    // Optimized IndexedDB import
    async getAllIndexedDBData() {
        log(`[CCPorted State Manager] Getting indexedDB data....`)
        const databases = await window.indexedDB.databases();
        const data = {};

        await Promise.all(databases.map(async dbInfo => {
            const dbName = dbInfo.name;
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });

            data[dbName] = {
                version: dbInfo.version,
                stores: {},
                schema: {}
            };

            const stores = Array.from(db.objectStoreNames);
            await Promise.all(stores.map(async storeName => {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);

                data[dbName].schema[storeName] = await this.getObjectStoreSchema(store);

                // Always collect both data and keys for every store
                const [storeData, storeKeys] = await Promise.all([
                    new Promise((resolve, reject) => {
                        const request = store.getAll();
                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => resolve(request.result);
                    }),
                    new Promise((resolve, reject) => {
                        const request = store.getAllKeys();
                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => resolve(request.result);
                    })
                ]);

                data[dbName].stores[storeName] = storeData;
                data[dbName].stores[`${storeName}_keys`] = storeKeys;
            }));

            db.close();
        }));
        log(`[CCPorted State Manager] IndexedDB data collected`)
        return data;
    }

    async importIndexedDBState(backupData) {
        log(`[CCPorted State Manager] Starting IndexedDB import...`);
        log(`[CCPorted State Manager] Found ${Object.keys(backupData).length} databases to import`);

        // Delete existing databases first to avoid conflicts
        const existingDbs = await window.indexedDB.databases();
        log(`[CCPorted State Manager] Cleaning up ${existingDbs.length} existing databases...`);

        await Promise.all(existingDbs.map(dbInfo =>
            new Promise((resolve, reject) => {
                log(`[CCPorted State Manager] Deleting existing database: ${dbInfo.name}`);
                const request = window.indexedDB.deleteDatabase(dbInfo.name);
                request.onerror = () => {
                    log(`[CCPorted State Manager] ERROR: Failed to delete database ${dbInfo.name}:`, request.error);
                    reject(request.error);
                };
                request.onsuccess = () => {
                    log(`[CCPorted State Manager] Successfully deleted database: ${dbInfo.name}`);
                    resolve();
                };
            })
        ));

        // Import each database
        await Promise.all(Object.entries(backupData).map(async ([dbName, dbData]) => {
            log(`[CCPorted State Manager] Creating database: ${dbName} (version ${dbData.version})`);

            // Create database and object stores
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName, dbData.version);

                request.onerror = () => {
                    log(`[CCPorted State Manager] ERROR: Failed to create database ${dbName}:`, request.error);
                    reject(request.error);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    log(`[CCPorted State Manager] Setting up schema for database: ${dbName}`);

                    // Create object stores with their schemas
                    Object.entries(dbData.schema).forEach(([storeName, schema]) => {
                        log(`[CCPorted State Manager] Creating object store: ${storeName}`);
                        const storeOptions = {};
                        if (schema.keyPath) {
                            storeOptions.keyPath = schema.keyPath;
                            log(`[CCPorted State Manager] - Using keyPath: ${schema.keyPath}`);
                        }
                        if (schema.autoIncrement) {
                            storeOptions.autoIncrement = schema.autoIncrement;
                            log(`[CCPorted State Manager] - Using autoIncrement: ${schema.autoIncrement}`);
                        }

                        const store = db.createObjectStore(storeName, storeOptions);

                        // Create indexes
                        if (schema.indexes) {
                            schema.indexes.forEach(index => {
                                log(`[CCPorted State Manager] - Creating index: ${index.name}`);
                                store.createIndex(index.name, index.keyPath, {
                                    unique: index.unique,
                                    multiEntry: index.multiEntry
                                });
                            });
                        }
                    });
                };

                request.onsuccess = () => {
                    log(`[CCPorted State Manager] Successfully created database: ${dbName}`);
                    resolve(request.result);
                };
            });

            // Import data for each store
            const stores = Object.keys(dbData.schema);
            log(`[CCPorted State Manager] Importing data for ${stores.length} stores in ${dbName}`);

            await Promise.all(stores.map(async storeName => {
                const storeData = dbData.stores[storeName];
                const storeKeys = dbData.stores[`${storeName}_keys`];

                if (!storeData || storeData.length === 0) {
                    log(`[CCPorted State Manager] No data to import for store: ${storeName}`);
                    return;
                }

                log(`[CCPorted State Manager] Importing ${storeData.length} records into store: ${storeName}`);
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);

                // Import all records
                let successCount = 0;
                let errorCount = 0;

                await Promise.all(storeData.map(async (item, index) => {
                    return new Promise((resolve, reject) => {
                        let request;

                        // If we have explicit keys and the store doesn't use keyPath
                        if (!store.keyPath && storeKeys && storeKeys[index]) {
                            request = store.add(item, storeKeys[index]);
                        } else {
                            request = store.add(item);
                        }

                        request.onerror = () => {
                            errorCount++;
                            log(`[CCPorted State Manager] ERROR: Failed to import record ${index} in ${storeName}:`, request.error);
                            reject(request.error);
                        };
                        request.onsuccess = () => {
                            successCount++;
                            // Log progress every 100 records
                            if (successCount % 100 === 0 || successCount === storeData.length) {
                                log(`[CCPorted State Manager] Progress: ${successCount}/${storeData.length} records imported in ${storeName}`);
                            }
                            resolve();
                        };
                    });
                }));

                // Wait for transaction to complete
                await new Promise((resolve, reject) => {
                    transaction.oncomplete = () => {
                        log(`[CCPorted State Manager] Completed import for store ${storeName}:`);
                        log(`[CCPorted State Manager] - Successfully imported: ${successCount} records`);
                        log(`[CCPorted State Manager] - Failed to import: ${errorCount} records`);
                        resolve();
                    };
                    transaction.onerror = () => {
                        log(`[CCPorted State Manager] ERROR: Transaction failed for ${storeName}:`, transaction.error);
                        reject(transaction.error);
                    };
                });
            }));

            log(`[CCPorted State Manager] Closing database: ${dbName}`);
            db.close();
        }));

        log(`[CCPorted State Manager] IndexedDB import completed successfully`);
    }

    // Import state from blob
    async importState(compressedState, compressed = false) {
        try {
            let state;
            if (!compressed) {
                state = await this.decompressData(compressedState);
            } else {
                state = compressedState;
            }
            log('[329]', state);
            return {
                success: true,
                timestamp: state.timestamp,
                import: async () => {
                    await this.importLocalStorageState(state.localStorage);
                    await this.importIndexedDBState(state.indexedDB);
                }
            };
        } catch (error) {
            log('[CCPorted State Manager] Error importing state: ' + error);
            throw error;
        }
    }

    setupAutoSync(callback, interval = 5 * 60 * 1000) {
        this.forceSync = async (customMessage = 'Auto-saving...') => {
            try {
                // preload loading image
                const img = new Image();
                img.src = '/assets/images/loading.gif';

                log("[CCPorted State Manager] auto syncing....");
                showAutoSaveNotification(customMessage);
                const state = await this.exportState();
                await callback(state.state, state.timestamp);
            } catch (error) {
                log('[CCPorted State Manager] Auto-sync failed: ' + JSON.stringify(error) + ' ' + error.message + '\n' + error + '\n' + error.stack);
                var notif = showAutoSaveNotification(customMessage);
                notif.innerText = 'Auto-save failed';
                setTimeout(() => {
                    notif.remove();
                }, 2000);
            }
        };
        setInterval(async () => {
            this.forceSync();
        }, interval);
    }
}
class GameStateSync {
    constructor(userId, client) {
        this.userId = userId;
        this.client = client;
        this.syncUtil = new StateSyncUtility();
        this.stateFileName = `${userId}_save_state.state`;
        this.lastSync = 0;
    }

    async initialize() {
        this.syncUtil.setupAutoSync(async (state, timestamp) => {
            await this.saveState(state, timestamp);
        });
        await this.loadFromServer();
    }
    async saveState(state, timestamp) {
        this.lastSync = timestamp;
        localStorage.setItem('ccStateLastSave', timestamp, true);
        var notification = window.ccPorted.autoSaveNotification;
        await this.saveToServer(state, timestamp);
        if (notification.getAttribute('data-creation-time') + notification.getAttribute('data-min-visible-time') < Date.now()) {
            notification.remove();
        } else {
            setTimeout(() => {
                notification.remove();
            }, parseInt(notification.getAttribute('data-creation-time')) + parseInt(notification.getAttribute('data-min-visible-time')) - Date.now());
        }
    }

    async saveToServer(stateBlob, timestamp) {
        try {
            const { error } = await this.client
                .storage
                .from('save_states')
                .upload(this.stateFileName, stateBlob, {
                    upsert: true,
                    contentType: 'application/octet-stream'
                });
            const { error: error2 } = await this.client
                .from('u_profiles')
                .update({ last_save_state: timestamp })
                .eq('id', this.userId);

            if (error) {
                log('[CCPorted State Manager] Error saving state: ' + error);
                throw error;
            }
        } catch (error) {
            log('[CCPorted State Manager] Error saving state: ' + error);
            throw error;
        }
    }

    async loadFromServer() {
        try {
            log("Starting load from server")
            const { data: profile, error: profileError } = await this.client
                .from('u_profiles')
                .select('last_save_state')
                .eq('id', this.userId)
                .single();
            if (profileError) {
                log('[CCPorted State Manager] Error loading state: ' + profileError);
                throw profileError;
            }
            const lastSave = profile.last_save_state || 0;
            if (!profile.last_save_state) {
                log('[CCPorted State Manager] No saved state found, checking old save method');
                // they may be using the old save method
                const { data: oldSave, error: oldSaveError } = await this.client
                    .from('save_states')
                    .select('*')
                    .eq('user_id', this.userId);
                if (oldSaveError) {
                    log('[CCPorted State Manager] Error loading state: ' + oldSaveError);
                    throw oldSaveError;
                }
                if (oldSave.length === 0) {
                    log('[CCPorted State Manager] No saved state found (old or new)');
                    return;
                }
                log('[CCPorted State Manager] Old save found');
                // old data is of type text
                const decomp = await this.syncUtil.decompressOldData(oldSave[0].state);
                const timestamp = decomp.timestamp;
                log('[CCPorted State Manager] [old] Last save timestamp: ' + timestamp);
                const currentSave = localStorage.getItem('ccStateLastSave');
                log('[CCPorted State Manager] [old] Current save timestamp: ' + currentSave);
                if (!currentSave || timestamp > currentSave) {
                    log('[CCPorted State Manager] Game state has been updated');
                    log("[CCPorted State Manager] Importing state....");
                    const result = await this.syncUtil.importState(decomp, true);
                    if (result.success) {
                        localStorage.setItem('ccStateLastSave', timestamp, true);
                        log('[CCPorted State Manager] State loaded successfully');
                        await result.import();
                        location.reload();
                    } else {
                        log('[CCPorted State Manager] [310] Error loading state: ' + result.error);
                        throw result.error;
                    }
                } else {
                    log('[CCPorted State Manager] Transitioning to new save method');
                    const compressed = await this.syncUtil.compressData(decomp);
                    await this.saveToServer(compressed, timestamp);
                    log('[CCPorted State Manager] Old save transitioned');
                    log('[CCPorted State Manager] Deleting old save');
                    await this.client
                        .from('save_states')
                        .delete()
                        .eq('user_id', this.userId);
                    log('[CCPorted State Manager] Old save deleted');
                    return;
                }
            }
            const { data, error } = await this.client
                .storage
                .from('save_states')
                .download(this.stateFileName + '?timestampbuster=' + lastSave);
            if (error) {
                if (error.message.includes('Object not found')) {
                    log('[CCPorted State Manager] No saved state found');
                    return;
                }
                throw error;
            }
            log('[CCPorted State Manager] State downloaded successfully');
            const decomp = await this.syncUtil.decompressData(data);
            log(`[CCPorted State Manager] State decompressed successfully`);
            const timestamp = decomp.timestamp;
            log('[CCPorted State Manager] Last save timestamp: ' + timestamp);
            const currentSave = localStorage.getItem('ccStateLastSave');
            log('[CCPorted State Manager] Current save timestamp: ' + currentSave);
            if (!currentSave || timestamp > currentSave) {
                log('[CCPorted State Manager] Game state has been updated');
                localStorage.setItem('ccStateLastSave', timestamp, true);
                log('[CCPorted State Manager] Importing state....');
                const result = await this.syncUtil.importState(decomp, true);
                if (result.success) {
                    log('[CCPorted State Manager] State loaded successfully');
                    await result.import();
                    localStorage.setItem('ccStateLastSave', timestamp, true);
                    location.reload();
                } else {
                    log('[CCPorted State Manager] [310] Error loading state: ' + result.error);
                    throw result.error;
                }
            } else {
                log('[CCPorted State Manager] Game state is up to date');
            }
        } catch (error) {
            log('[CCPorted State Manager] [315] Error loading state: ' + error);
            throw error;
        }
    }
}

class Stats {
    constructor() {
        this.isOpen = false;
        this.initTime = new Date().getTime();
        this.isDragging = false;
        this.ableToDrag = false;
        this.logs = [];
        this.requests = [];
        this.interceptRequests = (localStorage.getItem('[ns_ccported]_statsConfig_interceptRequests') ? true : false);
        const [dom] = this.generateDom();
        this.dom = dom;
        this.workerLoaded = false;
        dom.style.display = "none";
        this.clientID = Math.random().toString(36).substring(2);
        this.contentBeforeLoad = {
            logs: [],
            requestsIntercepted: [],
        };
        this.customUpdates = {
            logs: (content) => {
                if (document.getElementById("cc_stats_logs")) {
                    document.getElementById("cc_stats_logs").innerHTML += content;
                } else {
                    this.contentBeforeLoad.logs.push(content);
                }
            },
            requestsIntercepted: (content) => {
                if (document.getElementById("cc_stats_requestsIntercepted")) {
                    document.getElementById("cc_stats_requestsIntercepted").innerHTML +=
                        content;
                } else {
                    this.contentBeforeLoad.requestsIntercepted.push(content);
                }
            },
        };
        this.tick();
        document.addEventListener("mousemove", (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.objectHovering = e.target;
        });
        window.addEventListener("load", () => {
            this.log("Window loaded");
            document.body.appendChild(dom);
            Object.entries(this.contentBeforeLoad).forEach(([key, value]) => {
                value.forEach((val) => {
                    this.customUpdates[key](val);
                });
            });
            const style = document.createElement("style");
            style.textContent = `
                .cc_stats_table_row:hover {
                    background-color: #333;
                }
                .cc_stats pre{
                    white-space: pre-wrap;
                    background-color: #222;
                    color: #fff;
                    border: 1px solid #fff;
                    border-radius: 6px;
                    padding: 5px;
                    max-height: 500px;
                    overflow-y: auto;

                }

                `;
            document.head.appendChild(style);
        });
        if (this.interceptRequests) {
            this.log(`Request interception is on. set [ns_ccported]_statsConfig_interceptRequests in localStorage to a falsy value to turn off.`)
            this.setupRequestInterception();
        } else {
            this.log(`Request interception is off. set [ns_ccported]_statsConfig_interceptRequests in localStorage to a true value to turn on.`)
        }
    }
    getPanel(panel = 0) {
        return this.dom.children[panel];
    }
    destroy() {
        this.dom.remove();
    }
    tick() {
        if (this.isOpen) {
            this.update();
            setTimeout(() => this.tick(), 100);
        }
    }
    open() {
        this.isOpen = true;
        this.dom.style.display = "flex";
        this.tick();
    }
    close() {
        this.isOpen = false;
        this.dom.style.display = "none";
    }
    generateDom() {
        const dom = document.createElement("div");
        dom.classList.add("cc_stats");
        dom.style.cssText = `
            position:fixed;
            top:0;
            left:0;
            opacity:0.8;
            z-index:10000;
            background-color:#002;
            background-color:rgba(0,0,0,0.8);
            color:#0ff;
            font-family:monospace;
            font-size:12px;
            padding:5px;
            display:flex;
            flex-direction: row;
            padding-bottom: 20px;
            align-items: flex-start;
            max-width: 100vw;
            max-height: 100vh;
            box-sizing: border-box;
            overflow: auto;
            `;
        //make it expandable
        document.addEventListener("mousemove", (e) => {
            if (this.isDragging) {
                dom.style.width = e.clientX + "px";
            }
            // 10 px from right edge of dom
            if (
                e.clientX > dom.getBoundingClientRect().right - 20 &&
                e.clientX < dom.getBoundingClientRect().right + 40
            ) {
                this.ableToDrag = true;
                // set cursor
                dom.style.cursor = "ew-resize";
            } else {
                this.ableToDrag = false;
                dom.style.cursor = "default";
            }
        });
        document.addEventListener("mousedown", (e) => {
            if (this.ableToDrag) {
                this.isDragging = true;
            }
        });
        document.addEventListener("mouseup", (e) => {
            this.isDragging = false;
        });
        const panels = {
            stats: [
                "time",
                "version",
                "requestInterceptionLoaded",
                "memory",
                "cpu",
                "user",
                "game",
                "lastTrackingTick",
                "lastAutoSync",
                "currentStateFrom",
                "mouse",
                "mouseCovering",
                "trackingData",
            ],
            logs: ["logs"],
            requests: ["requestsIntercepted"],
        };
        const formats = {
            stats: (content) => {
                return `<h1>${content.panel}</h1>
                    ${content.aspects
                        .map(
                            (aspect) =>
                                `<div><strong>${decamelize(
                                    aspect
                                )}:</strong> <span id="cc_stats_${aspect}"></span></div>`
                        )
                        .join("")}`;
            },
            logs: (content) => {
                return `<h1>${content.panel}</h1>
                    <button onclick="document.getElementById('cc_stats_logs').innerHTML = '';">Clear</button>
                    <pre style="white-space: pre-wrap;" id="cc_stats_logs"></pre>
                    <input type="text" placeholder="Eval" onkeydown="if(event.key === 'Enter') { window.ccPorted.stats.log('<',this.value);try{let o = eval(this.value);window.ccPorted.stats.log('>',o);}catch(err){window.ccPorted.stats.log(err)} this.value = '' }">`;
            },
            requests: (content) => {
                return `<h1>${content.panel}</h1>
                    <button onclick="fetch('/assets/images/ovo.jpg')">Test Request</button><button onclick="document.getElementById('cc_stats_requestsIntercepted').innerHTML = '';">Clear</button>
                    <button onclick="fetch('https://httpbin.org/post', {method: 'POST', body: JSON.stringify({test: 'test'})})">Test Post</button>
                    ${content.aspects
                        .map((aspect) => `<div id = "cc_stats_${aspect}"></div>`)
                        .join("")}`;
            },
        };

        // build everything:
        const panelHTMLs = [];
        Object.keys(panels).forEach((panel) => {
            const aspectsToRender = panels[panel];
            const content = {
                panel,
                aspects: aspectsToRender,
            };
            const finished = `<div id="${panel}" style="width: ${100 / Object.keys(panels).length
                }vw;max-height:100vh;overflow:scroll;padding:5px;box-sizing:border-box;">${formats[
                    panel
                ](content)}</div>`;
            panelHTMLs.push(finished);
        });
        dom.innerHTML = panelHTMLs.join("");
        return [dom];
    }
    timeAgo(date) {
        const now = Date.now();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
        if (seconds > 0) return `${seconds} second${seconds > 1 ? "s" : ""}`;
        return "just now";
    }
    formatTracking(tracking) {
        try {
            const table = document.createElement("table");
            table.style.borderCollapse = "collapse";

            const headerRow = document.createElement("tr");
            const headerPage = document.createElement("th");
            headerPage.style.border = "1px solid #0ff";
            headerPage.textContent = "Pages Visited";
            const headerCount = document.createElement("th");
            headerCount.style.border = "1px solid #0ff";
            headerCount.textContent = "Count";
            headerRow.appendChild(headerPage);
            headerRow.appendChild(headerCount);
            table.appendChild(headerRow);
            Object.entries(tracking.pages_visited || {}).forEach(([page, data]) => {
                const row = document.createElement("tr");
                row.style.border = "1px solid #0ff";
                row.style.cursor = "pointer";

                // add hover event
                const cellPage = document.createElement("td");
                cellPage.style.border = "1px solid #0ff";
                cellPage.textContent = page;
                const cellCount = document.createElement("td");
                cellCount.style.border = "1px solid #0ff";
                cellCount.textContent = data.count;
                row.appendChild(cellPage);
                row.appendChild(cellCount);
                table.appendChild(row);
            });

            const gamesTable = document.createElement("table");
            gamesTable.style.borderCollapse = "collapse";
            gamesTable.style.marginTop = "10px";

            const gamesHeaderRow = document.createElement("tr");
            const gamesHeaderGame = document.createElement("th");
            gamesHeaderGame.style.border = "1px solid #0ff";
            gamesHeaderGame.textContent = "Games Played";
            const gamesHeaderPlaytime = document.createElement("th");
            gamesHeaderPlaytime.style.border = "1px solid #0ff";
            gamesHeaderPlaytime.textContent = "Playtime";
            gamesHeaderRow.appendChild(gamesHeaderGame);
            gamesHeaderRow.appendChild(gamesHeaderPlaytime);
            gamesTable.appendChild(gamesHeaderRow);

            Object.entries(tracking.games || {}).forEach(([game, data]) => {
                const row = document.createElement("tr");
                row.style.border = "1px solid #0ff";
                row.style.cursor = "pointer";
                const cellGame = document.createElement("td");
                cellGame.style.border = "1px solid #0ff";
                cellGame.textContent = game;
                const cellPlaytime = document.createElement("td");
                cellPlaytime.style.border = "1px solid #0ff";
                cellPlaytime.textContent = `${data.playtime.toFixed(2)} minutes`;
                row.appendChild(cellGame);
                row.appendChild(cellPlaytime);
                gamesTable.appendChild(row);
            });

            return table.outerHTML + gamesTable.outerHTML;
        } catch (err) {
            return `Error when rendering tracking data: ${err}`;
        }
    }
    renderTableFromJSON(json) {
        if (!json) {
            this.log("No JSON to render");
            return "";
        }
        const table = document.createElement("table");
        table.style.borderCollapse = "collapse";
        const headerRow = document.createElement("tr");
        ["Key", "Value"].forEach((header) => {
            const th = document.createElement("th");
            th.style.border = "1px solid #0ff";
            th.textContent = header;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        Object.entries(json).forEach(([key, value]) => {
            if (key == undefined) return;
            if (value == undefined) return;
            if (value.length > 100) {
                value = value.slice(0, 100) + "...";
            }
            const row = document.createElement("tr");
            row.style.border = "1px solid #0ff";
            // make the row wrap
            row.style.wordWrap = "break-word";
            row.style.maxWidth = "100%";
            const cellKey = document.createElement("td");
            cellKey.style.maxWidth = "30%";
            const code = document.createElement("code");
            code.textContent = key;
            code.cssText =
                "background-color: #999; color: orange; border-radius:3px;";

            cellKey.appendChild(code);
            const cellValue = document.createElement("td");
            cellValue.style.maxWidth = "70%";
            cellValue.style.wordWrap = "break-word";
            cellValue.style.border = "1px solid #0ff";
            cellValue.textContent =
                typeof value == "object" ? JSON.stringify(value) : value;
            row.appendChild(cellKey);
            row.classList.add("cc_stats_table_row");
            cellValue.classList.add("cc_stats_table_cell");
            cellKey.classList.add("cc_stats_table_cell");
            row.appendChild(cellValue);
            table.appendChild(row);
        });
        table.style.width = "100%";
        table.style.overflow = "auto";
        table.style.wordBreak = "break-all";
        return table;
    }
    formatInformation(information, type) {
        const pre = document.createElement("pre");
        pre.style.whiteSpace = "pre-wrap";
        pre.style.maxHeight = "500px";
        pre.style.overflowY = "auto";
        pre.style.backgroundColor = "#222";
        pre.style.color = "#fff";
        pre.style.border = "1px solid #fff";
        pre.style.borderRadius = "6px";
        pre.style.padding = "5px";
        try {
            pre.textContent = JSON.stringify(JSON.parse(information), null, 2);
        } catch (err) {
            pre.textContent = information;
        } finally {
            return pre;
        }
    }
    async buildRequest(request) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");

        const url = new URL(request.url);
        const method = request.method;
        const headers = request.headers;
        const requestData = {
            "Body Used": request.bodyUsed,
            Cache: request.cache,
            Credentials: request.credentials,
            Destination: request.destination,
            Integrity: request.integrity,
            Keepalive: request.keepalive,
            Method: request.method,
            Mode: request.mode,
            Referrer: request.referrer,
            URL: request.url,
        };

        details.id = `cc_stats_request_${request.id}`;
        summary.title = request.url;
        summary.textContent = `[${new Date(request.timestamp).toLocaleTimeString()}] ${url.pathname}: (${method})`;

        const status = document.createElement("span");
        status.id = `cc_stats_request_${request.id}_status`;
        summary.appendChild(status);

        details.appendChild(summary);

        const headersDiv = document.createElement("div");
        const requestBody = document.createElement("div");
        const requestDataDiv = document.createElement("div");
        headersDiv.id = `cc_stats_request_${request.id}_headers`;
        requestBody.id = `cc_stats_request_${request.id}_body`;
        requestDataDiv.id = `cc_stats_request_${request.id}_requestData`;

        const headersTable = this.renderTableFromJSON(headers);
        const requestBodyPre = this.formatInformation(request.body, request.bodyType);
        const requestDataTable = this.renderTableFromJSON(requestData);

        const headersTitle = document.createElement("strong");
        headersTitle.textContent = "Request Headers:";
        headersDiv.appendChild(headersTitle);

        const requestBodyTitle = document.createElement("strong");
        requestBodyTitle.textContent = "Request Body:";
        requestBody.appendChild(requestBodyTitle);

        const requestDataTitle = document.createElement("strong");
        requestDataTitle.textContent = "Request Data:";
        requestDataDiv.appendChild(requestDataTitle);

        headersDiv.appendChild(headersTable);
        requestBody.appendChild(requestBodyPre);
        requestDataDiv.appendChild(requestDataTable);

        details.appendChild(headersDiv);
        details.appendChild(requestBody);
        details.appendChild(requestDataDiv);

        const responseDataDiv = document.createElement("div");
        responseDataDiv.id = `cc_stats_request_${request.id}_responseData`;
        details.appendChild(responseDataDiv);

        return details;
    }
    async finishRequest(response, detailsContext) {
        const responseHeaders = response.headers;
        const responseRaw = response.response;
        const responseFormat = response.responseFormat;

        const headersDiv = document.createElement("div");
        const responseDiv = document.createElement("div");

        headersDiv.id = `cc_stats_request_${response.id}_responseHeaders`;
        responseDiv.id = `cc_stats_request_${response.id}_response`;

        const headersTable = this.renderTableFromJSON(responseHeaders);
        const responsePre = this.formatInformation(responseRaw, responseFormat);

        const headersTitle = document.createElement("strong");
        headersTitle.textContent = "Response Headers:";
        headersDiv.appendChild(headersTitle);

        const responseTitle = document.createElement("strong");
        responseTitle.textContent = "Response:";
        responseDiv.appendChild(responseTitle);

        headersDiv.appendChild(headersTable);
        responseDiv.appendChild(responsePre);

        const responseDataDiv = this.contextualize(`cc_stats_request_${response.id}_responseData`, detailsContext)
        responseDataDiv.appendChild(headersDiv);
        responseDataDiv.appendChild(responseDiv);

        const requestBodyElement = this.contextualize(`cc_stats_request_${response.id}_body`, detailsContext)
        if (requestBodyElement) {
            requestBodyElement.appendChild(this.formatInformation(response.body, response.bodyType));
        }
        const requestStatus = this.contextualize(`cc_stats_request_${response.id}_status`, detailsContext)
        if (requestStatus) {
            requestStatus.textContent = response.status;
        }

        return;
    }
    contextualize(id, context) {
        if (context) {
            return context.querySelector("#" + id);
        } else {
            return document.getElementById(id);
        }
    }
    async formatRequest(request) {
        try {
            const id = request.id;
            const requestt = request.request;
            const type = requestt.type;
            switch (type) {
                case "request-start":
                    return (await this.buildRequest(requestt)).outerHTML;
                case "request-complete":
                    let element = document.getElementById(`cc_stats_request_${id}`);
                    if (!element) {
                        const details = await this.buildRequest(requestt);
                        this.finishRequest(requestt, details)

                        // add to requests
                        if (document.getElementById("cc_stats_requestsIntercepted")) {
                            document.getElementById("cc_stats_requestsIntercepted").appendChild(details);
                        }
                    } else {
                        this.finishRequest(requestt)
                    }
                    break;

                case "request-error":
                    if (document.getElementById(`cc_stats_request_${id}`)) {
                        document.getElementById(`cc_stats_request_${id}_status`).textContent =
                            requestt.status;
                        // add headers
                        document.getElementById(`cc_stats_request_${id}`).innerHTML += `
                            <div>Errored</div>
                        `;
                    }
                    return "";
                    break;
            }
            return "";
        } catch (err) {
            this.log(`Error formatting request (${request.id} - ${new URL(request.request.url).pathname}):`, err);
            this.log(err.stack)
        }
    }
    getMouse() {
        return [this.mouseX, this.mouseY];
    }
    setupRequestInterception() {
        // using /assets/scripts/sw_request_interceptor.js
        // service worker
        // client.js
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker
                    .register("/service-worker.js")
                    .then((registration) => {
                        this.workerLoaded = true;
                        this.log(
                            "Service Worker registered successfully:",
                            registration.scope
                        );
                    })
                    .catch((error) => {
                        console.error("Service Worker registration failed:", error);
                    });
            });

            // Listen for messages from the service worker
            navigator.serviceWorker.addEventListener("message", async (event) => {
                const data = event.data;
                const toPass = {
                    id: data.id,
                    request: data,
                };
                const formatted = await this.formatRequest(toPass);
                this.customUpdates.requestsIntercepted(formatted);
            });
        }
    }
    update() {
        const memoryUsage = this.getMemoryUsage();
        const cpuUsage = this.getCpuUsage();
        const user = window.ccPorted.user;
        const game = window.gameID;
        const lastTrackingTick = lastUpdate;
        const trackingData = window.ccPorted.trackingData || {};
        const lastAutoSync = window.ccPorted.stateSync?.lastSync || "N/A";
        const aspects = {
            time: `${new Date().toLocaleTimeString()} (${(
                (new Date().getTime() - this.initTime) /
                1000
            ).toFixed(3)} seconds up)`,
            version: window.ccPorted?.version,
            requestInterceptionLoaded: this.workerLoaded,
            memory: memoryUsage,
            cpu: cpuUsage,
            user: `${user ? user.id : "N/A"} (${user ? user.user_metadata.display_name : "Guest"
                })`,
            game: game || "N/A",
            lastTrackingTick: `${lastTrackingTick} (${this.timeAgo(
                lastTrackingTick
            )} ago)`,
            lastAutoSync: `${lastAutoSync} (${this.timeAgo(lastAutoSync)} ago)`,
            currentStateFrom:
                new Date(
                    parseInt(localStorage.getItem("ccStateLastSave"))
                ).toLocaleDateString() +
                " " +
                new Date(
                    parseInt(localStorage.getItem("ccStateLastSave"))
                ).toLocaleTimeString(),
            mouse: this.getMouse()[0] + "|" + this.getMouse()[1],
            mouseCovering: this.objectHovering
                ? this.objectHovering.tagName +
                "#" +
                this.objectHovering.id +
                "." +
                this.objectHovering.classList
                : "N/A",
            trackingData: this.formatTracking(trackingData),
        };
        try {
            Object.entries(aspects).forEach(([aspect, value]) => {
                const element = document.getElementById("cc_stats_" + aspect);
                if (Object.keys(this.customUpdates).includes(aspect)) {
                    return;
                }
                if (element) {
                    element.innerHTML = value;
                }
            });
        } catch (err) {
            this.log(err);
        }
    }
    getMemoryUsage() {
        const memory = window.performance.memory;
        if (!memory) return "N/A";
        return `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`;
    }
    getCpuUsage() {
        const cpu = window.performance.getEntriesByType("navigation")[0];
        if (!cpu) return "N/A";
        return `${cpu.duration.toFixed(2)} ms`;
    }
    log(...msg) {
        msg = msg.map((m) => {
            switch (typeof m) {
                case "object":
                    if (m === null) return "null";
                    switch (m.constructor) {
                        case Object:
                            return JSON.stringify(m);
                        case Array:
                            return JSON.stringify(m);
                        case Error:
                            return `<div style = "color:red">${m + "\n" + m.stack}</div>`;
                    }
                default:
                    return m;
            }
        });
        this.customUpdates.logs(
            `[${new Date().toLocaleTimeString()}] ${msg.join(" ")}\n`
        );
    }
}

init();
