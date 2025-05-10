window.ccPorted = window.ccPorted || {};
(() => {
    const COGNITO_DOMAIN = "https://us-west-2lg1qptg2n.auth.us-west-2.amazoncognito.com";
    const CLIENT_ID = "4d6esoka62s46lo4d398o3sqpi";
    const REDIRECT_URI = `${window.location.origin}`;
    const tGameID = treat(window.gameID || window.ccPorted.gameID);
    const link = document.createElement("link");
    const framed = pageInFrame();
    const gameIDExtractRG = /\/(game_\w+)\//;
    const gameIDExtract = gameIDExtractRG.exec(window.location.pathname);
    const parentOrigin = (framed && document.location.ancestorOrigins.length > 0) ? new URL(document.location.ancestorOrigins[0]).origin : null;
    const gameID = (typeof window.ccPorted.gameID != "undefined" && window.ccPorted.gameID != "undefined") ? window.ccPorted.gameID : false || window.gameID || ((gameIDExtract) ? gameIDExtract[1] : "Unknown Game");

    class Leaderboard {
        constructor(gameID) {
            if (!gameID) {
                throw new Error("Game ID is required");
            }
            this.gameID = gameID;
            this.cached = [];
            this.loading = false;
            this.needsRefresh = false;
            this.score = 0;
        }
        async loadScores() {
            if (this.loading && this.cached.length > 0) {
                return this.cached;
            }
            if (this.cached.length > 0 && !this.needsRefresh) {
                return this.cached;
            }
            await window.ccPorted.awsPromise;
            this.loading = true;
            try {
                const data = await window.ccPorted.query({
                    TableName: "leaderboard",
                    IndexName: "gameID-score-index",
                    Limit: 10,
                    ScanIndexForward: false,
                    KeyConditionExpression: "gameID = :gameID AND score > :score",
                    ExpressionAttributeValues: {
                        ":gameID": this.gameID,
                        ":score": 0
                    }
                });
                this.loading = false;
                var rp = false;
                var scores = data.Items.map((row, i) => {
                    if (row.userID == 'guest' || row.userID == window.ccPorted?.user?.sub) {
                        rp = true;
                    }
                    return {
                        score: row.score,
                        id: row.userID,
                        display_name: row.displayName,
                        rank: i + 1
                    }

                });
                if (this.guestScore != undefined) {
                    scores.push({ score: this.guestScore, display_name: 'Guest', userID: 'guest' });
                    scores.sort((a, b) => b.score - a.score);
                }
                this.cached = scores;
                this.needsRefresh = false;
                return scores;
            } catch (e) {
                console.log("[LEADERBOARD] Error getting scores", e);
            }
        }
        addGuestScore(score) {
            this.guestScore = score;
            if (this.cached.length > 0) {
                this.cached.push({ score: score, display_name: 'Guest', userID: 'guest' });
                this.cached.sort((a, b) => b.score - a.score);
            }
        }
        formatScore(score) {
            // 1000 -> 1K
            // 1000000 -> 1M
            // 1234567 -> 1.23M
            // thousand, million, billion, trillion, quadrilion, quintillion, sextillion, septillion, octillion, nonillion, decillion, undecillion, duodecillion
            if (score < 1000) {
                return score;
            } else if (score < 1_000_000) {
                return (score / 1000).toFixed(2) + 'K';
            } else if (score < 1000000000) {
                return (score / 1_000_000).toFixed(2) + 'M';
            } else if (score < 1_000_000_000_000) {
                return (score / 1_000_000_000).toFixed(2) + 'B';
            } else if (score < 1_000_000_000_000_000) {
                return (score / 1_000_000_000_000).toFixed(2) + 'T';
            } else if (score < 1_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000).toFixed(2) + 'Q';
            } else if (score < 1_000_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000_000).toFixed(2) + 'QQ';
            } else if (score < 1_000_000_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000_000_000).toFixed(2) + 'S';
            } else if (score < 1_000_000_000_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000_000_000_000).toFixed(2) + 'SS';
            } else if (score < 1_000_000_000_000_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000_000_000_000_000).toFixed(2) + 'O';
            } else if (score < 1_000_000_000_000_000_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000_000_000_000_000_000).toFixed(2) + 'N';
            } else if (score / 1_000_000_000_000_000_000_000_000_000_000_000) {
                return (score / 1_000_000_000_000_000_000_000_000_000_000_000).toFixed(2) + 'D';
            } else {
                return score.toExponential(2);
            }
        }
        async addScore(score) {
            log("adding score");
            if (!window.ccPorted.user) {
                return this.addGuestScore(score);
            }
            try {
                // find old score
                const data = await window.ccPorted.query({
                    TableName: "leaderboard",
                    KeyConditionExpression: "gameID = :gameID AND userID = :userID",
                    ExpressionAttributeValues: {
                        ":gameID": this.gameID,
                        ":userID": window.ccPorted.user.sub
                    },
                    Limit: 1
                });
                const oldScore = data.Items;
                // update score if new score is higher
                if (oldScore && oldScore.length > 0) {
                    if (oldScore[0].score >= score) {
                        log("Old score is higher");
                        this.score = { score: score, userID: window.ccPorted.user.sub, displayName: window.ccPorted.user.attributes["preferred_username"] || window.ccPorted.user["cognito:username"] || "Anonymous" };
                        return;
                    }
                }
                const newData = { gameID: this.gameID, userID: window.ccPorted.user.sub, score: score, displayName: window.ccPorted.user.attributes["preferred_username"] || window.ccPorted.user["cognito:username"] || "Anonymous" };
                const params = {
                    TableName: 'leaderboard',
                    Key: {
                        gameID: this.gameID,
                        userID: window.ccPorted.user.sub
                    },
                    UpdateExpression: 'set score = :s, displayName = :d',
                    ExpressionAttributeValues: {
                        ':s': score,
                        ':d': newData.displayName
                    }
                }
                await window.ccPorted.documentClient.update(params).promise();
                log("Score updated");
                this.needsRefresh = true;
            } catch (e) {
                console.error(e);
                log(e);
            }
        }
        clearCache() {
            this.cached = [];
        }
    }
    window.ccPorted.Leaderboard = Leaderboard;
    window.ccPorted.getUserTokens = () => {
        return {
            accessToken: localStorage.getItem("[ns_ccported]_accessToken"),
            idToken: localStorage.getItem("[ns_ccported]_idToken"),
            refreshToken: localStorage.getItem("[ns_ccported]_refreshToken")
        };
    }
    window.ccPorted.downloadFile = async (key) => {
        await window.ccPorted.awsPromise;
        return new Promise((resolve, reject) => {
            window.ccPorted.s3Client.getObject({
                Bucket: 'ccporteduserobjects',
                Key: `${window.ccPorted.user.sub}/${key}`
            }, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
    window.ccPorted.uploadFile = async (file, key, customparams = {}) => {
        await window.ccPorted.awsPromise;
        return new Promise((resolve, reject) => {
            const uploadParams = {
                Bucket: 'ccporteduserobjects',
                Key: `${window.ccPorted.user.sub}/${key}`,
                Body: file,
                ContentType: file.type,
                PartSize: 5 * 1024 * 1024, // 5MB parts for large files
                QueueSize: 10, // Upload parts concurrently
                ...customparams
            };

            window.ccPorted.s3Client.upload(uploadParams, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    };
    window.ccPorted.updateUser = async (attributes) => {
        await window.ccPorted.awsPromise;
        return new Promise((resolve, reject) => {
            window.ccPorted.identityProvider.updateUserAttributes({
                AccessToken: window.ccPorted.getUserTokens().accessToken,
                UserAttributes: Object.entries(attributes).map(([Name, Value]) => {
                    return {
                        Name,
                        Value
                    }
                })
            }, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
    window.ccPorted.query = async (...args) => {
        await window.ccPorted.awsPromise;
        const [partitionKeyName, partitionKey, tableName, otherData] = args;
        if (typeof partitionKeyName == "object") {
            return new Promise((resolve, reject) => {
                window.ccPorted.documentClient.query(partitionKeyName, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
        }
        return new Promise((resolve, reject) => {
            const params = {
                TableName: tableName,
                KeyConditionExpression: `${partitionKeyName} = :partitionKey`,
                ExpressionAttributeValues: {
                    ":partitionKey": partitionKey,
                },
                ...otherData
            }
            window.ccPorted.documentClient.query(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
    window.ccPorted.getUser = () => {
        if (window.ccPorted.user) {
            return user;
        } else {
            return window.ccPorted.userPromise;
        }
    }
    window.ccPorted.awsPromise = new Promise(async (resolve, reject) => {
        try {
            await initializeAWS();
            resolve(window.ccPorted);
        } catch (err) {
            reject(err);
        }
    });
    window.ccPorted.userPromise = new Promise(async (resolve, reject) => {
        await window.ccPorted.awsPromise;
        const userData = window.ccPorted.user;
        if (userData) {
            const loggedInReplacable = document.querySelector('.loggedInReplacable');
            if (loggedInReplacable) {
                loggedInReplacable.textContent = userData["cognito:username"];
                loggedInReplacable.href = "/profile/";
            }
            resolve(userData);
        } else {
            console.log("No user data found, returning null");
            resolve(null);
        }
    });

    function log(...args) {
        console.log(`[${gameID}]: `, ...args);
    }
    function treat(text) {
        if (!text) return null;
        return text.split(".").join("-");
    }
    function pageInFrame() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
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
    function refreshAWSCredentials() {
        return new Promise((resolve, reject) => {
            AWS.config.credentials.expired = true;
            AWS.config.credentials.refresh((error) => {
                if (error) {
                    reject(error);
                    log("Failed to refresh credentials:", error);
                } else {
                    log("Credentials refreshed successfully");
                    resolve();
                }
            });
        });
    }
    function parseJwt(token) {
        try {
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            return JSON.parse(atob(base64));
        } catch (e) {
            console.error("Invalid JWT token:", e);
            return null;
        }
    }
    function isTokenExpired(tokenData) {
        if (!tokenData || !tokenData.exp) return true;
        const expiryTime = tokenData.exp * 1000;
        return Date.now() >= expiryTime;
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
                            // check global namespace first
                            if (originalLocalStorage.getItem(`[ns_ccported]_${key}`)) {
                                return originalLocalStorage.setItem(`[ns_ccported]_${key}`, value);
                            }
                            // check game namespace
                            if (originalLocalStorage.getItem(`${namespace}_${key}`)) {
                                return originalLocalStorage.setItem(`${namespace}_${key}`, value);
                            }
                            // check if it's already namespaced
                            if (namespaceRegex.test(key)) {
                                return originalLocalStorage.setItem(key, value);
                            }
                            // if not, set it in the game's namespace
                            return originalLocalStorage.setItem(`${namespace}_${key}`, value);
                        }
                    case 'getItem':
                        return function (key) {
                            // check global namespace first
                            if (originalLocalStorage.getItem(`[ns_ccported]_${key}`)) {
                                return originalLocalStorage.getItem(`[ns_ccported]_${key}`);
                            }
                            // check game namespace
                            if (originalLocalStorage.getItem(`${namespace}_${key}`)) {
                                return originalLocalStorage.getItem(`${namespace}_${key}`);
                            }
                            // check if it's already namespaced
                            if (namespaceRegex.test(key)) {
                                return originalLocalStorage.getItem(key);
                            }
                            // return obj if not found
                            return originalLocalStorage.getItem(`${namespace}_${key}`);
                        }
                    case 'removeItem':
                        return function (key) {
                            // check global namespace first
                            if (originalLocalStorage.getItem(`[ns_ccported]_${key}`)) {
                                return originalLocalStorage.removeItem(`[ns_ccported]_${key}`);
                            }
                            // check game namespace
                            if (originalLocalStorage.getItem(`${namespace}_${key}`)) {
                                return originalLocalStorage.removeItem(`${namespace}_${key}`);
                            }
                            // check if it's already namespaced
                            if (namespaceRegex.test(key)) {
                                return originalLocalStorage.removeItem(key);
                            }
                            // no perms, just return
                            return;
                        }
                    case 'clear':
                        return function (global = false) {
                            if (global) {
                                return originalLocalStorage.clear();
                            }
                            // Only clear items for this game
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
                            // Get all keys for this game
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
                        // probably trying to access property stored in localStorage
                        // check if it's in the global namespace
                        if (originalLocalStorage.getItem(`[ns_ccported]_${prop}`)) {
                            return originalLocalStorage.getItem(`[ns_ccported]_${prop}`);
                        }
                        // check if it's in the game's namespace
                        if (originalLocalStorage.getItem(`${namespace}_${prop}`)) {
                            return originalLocalStorage.getItem(`${namespace}_${prop}`);
                        }
                        // check if it's already namespaced
                        if (namespaceRegex.test(prop)) {
                            return originalLocalStorage.getItem(prop);
                        }
                }
            },
            set: function (target, prop, value) {
                // check to see if overwriting getters
                ['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length', 'globalLength'].forEach((method) => {
                    if (prop === method) {
                        throw new Error(`Cannot overwrite localStorage method ${method}`);
                    }
                });
                // probably trying to set a property in localStorage
                // check if it's in the global namespace
                if (originalLocalStorage.getItem(`[ns_ccported]_${prop}`)) {
                    return originalLocalStorage.setItem(`[ns_ccported]_${prop}`, value);
                }
                // check if it's in the game's namespace
                if (originalLocalStorage.getItem(`${namespace}_${prop}`)) {
                    return originalLocalStorage.setItem(`${namespace}_${prop}`, value);
                }
                // check if it's already namespaced
                if (namespaceRegex.test(prop)) {
                    return originalLocalStorage.setItem(prop, value);
                }
                // if not, set it in the game's namespace
                return originalLocalStorage.setItem(`${namespace}_${prop}`, value);
            }
        });

        // Create IndexedDB proxy
        const indexedDBProxy = new Proxy(window.indexedDB, {
            get: function (target, prop) {
                if (prop === 'open') {
                    return function (dbName, version) {
                        // check if db is already namespaced or global
                        const isNamespaced = namespaceRegex.test(dbName);
                        if (isNamespaced) {
                            return originalIndexedDB.open(dbName, version);
                        }
                        if (dbName.startsWith("[ns_ccported]_")) {
                            return originalIndexedDB.open(dbName, version);
                        }
                        // Namespace the database name
                        const namespacedDBName = `${namespace}_${dbName}`;

                        // Create a promise to check existing databases
                        const checkDatabases = async () => {
                            try {
                                const databases = await originalIndexedDB.databases();
                                const oldDBExists = databases.some(db => db.name === dbName);
                                console.log(`Checking for database '${dbName}': ${oldDBExists}`);
                                return oldDBExists;
                            } catch (error) {
                                console.error('Error checking databases:', error);
                                return false;
                            }
                        };

                        // First try to open the namespaced database
                        const request = originalIndexedDB.open(namespacedDBName, version);

                        request.onerror = function (event) {
                            console.error(`Error opening database ${namespacedDBName}:`, event.target.error);
                        };

                        // Handle the case where the namespaced DB needs setup
                        request.onupgradeneeded = function (event) {
                            console.log(`Upgrade needed for ${namespacedDBName}`);
                            const newDB = event.target.result;

                            // Immediately check for old database
                            checkDatabases().then(oldDBExists => {
                                if (oldDBExists) {
                                    console.log(`Found old database '${dbName}', initiating transfer`);
                                    const oldDBRequest = originalIndexedDB.open(dbName);

                                    oldDBRequest.onerror = function (event) {
                                        console.error(`Error opening old database ${dbName}:`, event.target.error);
                                    };

                                    oldDBRequest.onsuccess = function (event) {
                                        const oldDB = event.target.result;
                                        console.log(`Successfully opened old database '${dbName}'`);
                                        console.log('Object stores found:', Array.from(oldDB.objectStoreNames));

                                        // Get all object store names from old DB
                                        const storeNames = Array.from(oldDB.objectStoreNames);

                                        if (storeNames.length === 0) {
                                            console.log(`No object stores found in old database '${dbName}'`);
                                            oldDB.close();
                                            return;
                                        }

                                        // Transfer each object store
                                        storeNames.forEach(storeName => {
                                            console.log(`Transferring object store: ${storeName}`);
                                            try {
                                                const transaction = oldDB.transaction(storeName, 'readonly');
                                                const store = transaction.objectStore(storeName);
                                                const getAllRequest = store.getAll();

                                                getAllRequest.onsuccess = function () {
                                                    try {
                                                        // Create new store in namespaced DB if it doesn't exist
                                                        if (!newDB.objectStoreNames.contains(storeName)) {
                                                            console.log(`Creating new object store: ${storeName}`);
                                                            const newStore = newDB.createObjectStore(storeName,
                                                                store.keyPath ? { keyPath: store.keyPath } :
                                                                    { autoIncrement: store.autoIncrement });

                                                            // Copy indexes
                                                            Array.from(store.indexNames).forEach(indexName => {
                                                                const index = store.index(indexName);
                                                                newStore.createIndex(indexName, index.keyPath, {
                                                                    unique: index.unique,
                                                                    multiEntry: index.multiEntry
                                                                });
                                                            });
                                                        }

                                                        // Transfer data
                                                        const newTransaction = newDB.transaction(storeName, 'readwrite');
                                                        const newStore = newTransaction.objectStore(storeName);
                                                        const items = getAllRequest.result;
                                                        console.log(`Transferring ${items.length} items for store ${storeName}`);

                                                        items.forEach(item => {
                                                            try {
                                                                newStore.add(item);
                                                            } catch (error) {
                                                                console.error(`Error adding item to ${storeName}:`, error);
                                                            }
                                                        });

                                                        newTransaction.oncomplete = function () {
                                                            console.log(`Completed transfer for store: ${storeName}`);
                                                        };

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
                                                    console.log(`Old database transaction complete for: ${storeName}`);
                                                    // Only delete the old database after all transfers are complete
                                                    if (storeName === storeNames[storeNames.length - 1]) {
                                                        oldDB.close();
                                                        const deleteRequest = originalIndexedDB.deleteDatabase(dbName);
                                                        deleteRequest.onsuccess = function () {
                                                            console.log(`Successfully deleted old database: ${dbName}`);
                                                        };
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
                                } else {
                                    console.log(`No old database found for '${dbName}'`);
                                }
                            });
                        };

                        return request;
                    };
                } else if (prop === 'deleteDatabase') {
                    return function (dbName) {
                        // Check if the database is already namespaced
                        if (namespaceRegex.test(dbName)) {
                            return originalIndexedDB.deleteDatabase(dbName);
                        }
                        // Namespace the database name
                        const namespacedDBName = `${namespace}_${dbName}`;
                        return originalIndexedDB.deleteDatabase(namespacedDBName);
                    };
                } else if (prop === 'databases') {
                    // remove the current namespace name from the list of databases
                    // eg: [ns_slope]_/idbfs -> /idbfs
                    return async function () {
                        const databases = await originalIndexedDB.databases();
                        return databases.map(db => {
                            db.name = db.name.replace(namespace + "_", '');
                            return db;
                        });
                    };
                } else {
                    // For all other properties, bind them to the original indexedDB if they're functions
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
                console.log(`Manually migrating database: ${dbName}`);

                return new Promise((resolve, reject) => {
                    const request = originalIndexedDB.open(namespacedDBName, version || 1);

                    request.onerror = function (event) {
                        console.error(`Error opening namespaced database ${namespacedDBName}:`, event.target.error);
                        reject(event.target.error);
                    };

                    request.onsuccess = function (event) {
                        const newDB = event.target.result;
                        console.log(`Successfully opened namespaced database '${namespacedDBName}'`);

                        // Open the old database
                        const oldDBRequest = originalIndexedDB.open(dbName);

                        oldDBRequest.onerror = function (event) {
                            console.error(`Error opening old database ${dbName}:`, event.target.error);
                            reject(event.target.error);
                        };

                        oldDBRequest.onsuccess = function (event) {
                            const oldDB = event.target.result;
                            console.log(`Successfully opened old database '${dbName}'`);

                            const storeNames = Array.from(oldDB.objectStoreNames);
                            console.log('Object stores found:', storeNames);

                            if (storeNames.length === 0) {
                                console.log(`No object stores found in old database '${dbName}'`);
                                oldDB.close();
                                resolve();
                                return;
                            }

                            // Keep track of completed stores
                            let completedStores = 0;

                            // Create a version change request to set up stores if needed
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

                                // Transfer data for each store
                                storeNames.forEach(storeName => {
                                    console.log(`Transferring object store: ${storeName}`);
                                    try {
                                        const transaction = oldDB.transaction(storeName, 'readonly');
                                        const store = transaction.objectStore(storeName);
                                        const getAllRequest = store.getAll();

                                        getAllRequest.onsuccess = function () {
                                            try {
                                                const items = getAllRequest.result;
                                                console.log(`Transferring ${items.length} items for store ${storeName}`);

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
                                                    console.log(`Completed transfer for store: ${storeName}`);
                                                    completedStores++;

                                                    // Check if all stores are completed
                                                    if (completedStores === storeNames.length) {
                                                        console.log('All stores transferred successfully');
                                                        oldDB.close();
                                                        upgradedDB.close();

                                                        // Delete the old database
                                                        const deleteRequest = originalIndexedDB.deleteDatabase(dbName);
                                                        deleteRequest.onsuccess = function () {
                                                            console.log(`Successfully deleted old database: ${dbName}`);
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
                console.log(`No old database found for '${dbName}'`);
                return Promise.resolve();
            }
        }
        return function setupGameEnvironment() {
            // Override storage APIs in the game's context
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
    async function getTokensFromParent(timeout = 5000) {
        return new Promise((resolve, reject) => {
            // Create a unique request ID to match responses
            const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);

            // Set up message handler
            const messageHandler = (event) => {
                // Only accept messages from the parent origin
                if (event.origin !== parentOrigin) return;

                const data = event.data;

                // Verify this is a response to our specific request
                if (data.requestId === requestId) {
                    // Clean up the event listener
                    window.removeEventListener("message", messageHandler);

                    // Handle the different response types
                    if (data.action === "SET_TOKENS") {
                        const tokens = data.content;

                        // Store tokens in localStorage with consistent naming
                        localStorage.setItem("[ns_ccported]_accessToken", tokens.accessToken);
                        localStorage.setItem("[ns_ccported]_idToken", tokens.idToken);
                        localStorage.setItem("[ns_ccported]_refreshToken", tokens.refreshToken);

                        resolve(tokens);
                    } else if (data.action === "NO_USER") {
                        console.log("No user found in parent, initializing unauthenticated.");
                        resolve(null);
                    } else if (data.action === "UNKNOWN_ACTION") {
                        console.log("Unknown action received from parent:", data.action);
                        // always soft resolve
                        resolve();
                    }
                }
            };

            // Add event listener
            window.addEventListener("message", messageHandler);

            // Send request to parent
            window.parent.postMessage({
                action: "GET_TOKENS",
                requestId: requestId,
                fromInternal: true
            }, parentOrigin);

            // Set timeout
            setTimeout(() => {
                window.removeEventListener("message", messageHandler);
                reject(new Error("Timeout getting tokens from parent"));
            }, timeout);
        });
    }
    async function initializeUnathenticated() {
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'us-west-2:8ffe94a1-9042-4509-8e65-4efe16e61e3e'
        });
        await refreshAWSCredentials();
        log('Configured AWS SDK with unauthenticated credentials');
        return null;
    }
    async function initializeAuthenticated(idToken, accessToken, refreshToken) {

        // Decode token
        let userData = parseJwt(idToken);
        // Check if token is expired
        if (isTokenExpired(userData)) {
            log("ID token expired, attempting refresh...");
            const newTokens = await refreshTokens(refreshToken);
            if (!newTokens) {
                console.error("Failed to refresh token. User must log in again.");
                return initializeUnathenticated();
            }
            userData = parseJwt(newTokens.id_token);
        }
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'us-west-2:8ffe94a1-9042-4509-8e65-4efe16e61e3e',
            RoleSessionName: userData.sub
        });
        const surl = "cognito-idp.us-west-2.amazonaws.com/us-west-2_lg1qptg2n";
        AWS.config.credentials.params.Logins =
            AWS.config.credentials.params.Logins || {};
        AWS.config.credentials.params.Logins[surl] = idToken;
        await refreshAWSCredentials();
        const otherData = await window.ccPorted.identityProvider.getUser({
            AccessToken: accessToken
        }).promise();
        log("User attributes recieved")
        const userDataJSON = otherData.UserAttributes.reduce((acc, { Name, Value }) => {
            acc[Name] = Value;
            return acc;
        }, {});
        const user = {
            ...userData,
            attributes: userDataJSON
        };
        return user;
    }
    async function initializeAWS() {
        var user = null;
        window.ccPorted["awsReady"] = false;
        if (typeof AWS == "undefined") {
            log("AWS SDK not loaded, loading...");
            const sdk = document.createElement("script");
            sdk.src = "https://sdk.amazonaws.com/js/aws-sdk-2.1030.0.min.js";
            document.head.appendChild(sdk);
            await new Promise((r, rr) => {
                log("Waiting for AWS SDK to load...");
                sdk.onload = r;
            });
            log("AWS SDK loaded");
        }
        window.ccPorted.AWS = AWS;
        AWS.config.update({ region: "us-west-2" });
        window.ccPorted["identityProvider"] = new AWS.CognitoIdentityServiceProvider({
            region: 'us-west-2'
        });
        if (!framed) {
            let idToken = localStorage.getItem("[ns_ccported]_idToken");
            let accessToken = localStorage.getItem("[ns_ccported]_accessToken");
            let refreshToken = localStorage.getItem("[ns_ccported]_refreshToken");
            if (!idToken || !accessToken) {
                console.warn("No valid tokens found. Checking for auth code...");
                const authCode = new URLSearchParams(window.location.search).get("code");

                if (authCode) {
                    console.log("Auth code found. Exchanging for tokens...");
                    const tokens = await exchangeAuthCodeForTokens(authCode);
                    if (!tokens) {
                        console.error("Failed to exchange auth code for tokens.");
                        user = await initializeUnathenticated();
                    } else {
                        idToken = tokens.id_token;
                        accessToken = tokens.access_token;
                        refreshToken = tokens.refresh_token;

                        user = await initializeAuthenticated(idToken, accessToken, refreshToken);
                    }
                } else {
                    console.warn("No auth code found in URL. User may need to log in.");
                    user = await initializeUnathenticated();
                }
            } else {
                log("Tokens found. Initializing user...");
                user = await initializeAuthenticated(idToken, accessToken, refreshToken);
            }
        } else {
            try {
                const tokens = await getTokensFromParent();
                if (!tokens || tokens == null) {
                    console.warn("No tokens received from parent. Initializing unauthenticated.");
                    user = await initializeUnathenticated();
                } else {
                    const { idToken, accessToken, refreshToken } = tokens;

                    if (!idToken || !accessToken) {
                        console.log("Invalid tokens received, initializing unauthenticated.");
                        user = await initializeUnathenticated();
                    } else {
                        user = await initializeAuthenticated(idToken, accessToken, refreshToken);
                    }
                }
            } catch (error) {
                console.error("Authentication error:", error.message);
                user = await initializeUnathenticated();
            }
        }
        window.ccPorted["s3Client"] = new AWS.S3({
            region: "us-west-2",
        });
        window.ccPorted["documentClient"] = new AWS.DynamoDB.DocumentClient({
            region: "us-west-2"
        });
        window.ccPorted["awsReady"] = true;
        window.ccPorted["user"] = user;
        window.ccPorted.getUser = () => user;

    }
    async function exchangeAuthCodeForTokens(authCode) {
        try {
            const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: CLIENT_ID,
                    redirect_uri: REDIRECT_URI,
                    code: authCode
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error_description || "Failed to exchange auth code");

            // Store tokens in localStorage
            localStorage.setItem("[ns_ccported]_accessToken", data.access_token);
            localStorage.setItem("[ns_ccported]_idToken", data.id_token);
            localStorage.setItem("[ns_ccported]_refreshToken", data.refresh_token);
            window.history.replaceState({}, document.title, REDIRECT_URI); // Remove auth code from URL

            return data;
        } catch (error) {
            console.error("Error exchanging auth code:", error);
            return null;
        }
    }
    async function refreshTokens(refreshToken) {
        if (!refreshToken) {
            console.warn("No refresh token available.");
            return null;
        }

        try {
            const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    client_id: CLIENT_ID,
                    refresh_token: refreshToken
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error || "Token refresh failed");

            // Store new tokens
            localStorage.setItem("[ns_ccported]_accessToken", data.access_token);
            localStorage.setItem("[ns_ccported]_idToken", data.id_token);

            console.log("Tokens refreshed successfully");
            return data;
        } catch (error) {
            console.error("Error refreshing token:", error);
            return null;
        }
    }


    if (!window.ccPorted.config || typeof window.ccPorted.config?.sandboxStorage == "undefined" || window.ccPorted.config.sandboxStorage) {
        createGameStorageSandbox(window.gameID || "ccported")();
    }

    link.href = "/assets/styles/master.css";
    link.setAttribute("rel", "stylesheet");
    document.head.appendChild(link);

})();
