window.ccPorted = window.ccPorted || {};
(() => {
    const COGNITO_DOMAIN = "https://us-west-2lg1qptg2n.auth.us-west-2.amazoncognito.com";
    const CLIENT_ID = "4d6esoka62s46lo4d398o3sqpi";
    const REDIRECT_URI = `${window.location.origin}`;
    const tGameID = treat(window.gameID || window.ccPorted.gameID);
    const link = document.createElement("link");
    const script = document.currentScript;
    const seenPopup = (localStorage.getItem("ccported-popup") == "yes");
    const framed = pageInIframe();
    const glocation = (!framed) ? window.location.hostname : document.location.ancestorOrigins[0];
    const gameIDExtractRG = /\/(game_\w+)\//;
    const gameIDExtract = gameIDExtractRG.exec(window.location.pathname);
    const parentOrigin = (framed && document.location.ancestorOrigins.length > 0) ? new URL(document.location.ancestorOrigins[0]).origin : null;
    const gameID = (typeof window.ccPorted.gameID != "undefined" && window.ccPorted.gameID != "undefined") ? window.ccPorted.gameID : false || window.gameID || ((gameIDExtract) ? gameIDExtract[1] : "Unknown Game");

    let trackingInterval = null;
    let lastUpdate = Date.now();
    let waitingForCreds = true;

    class ServerToggle {
        constructor(currentServer, switchCallback) {
            this.servers = [];
            this.currentServerIndex = 0;
            this.initialServerIndex = currentServer;
            this.uiVisible = false;
            this.uiElement = null;
            this.wheelElement = null;
            this.serverStatusCache = {};
            this.itemHeight = 60; // Height of each server item
            this.visibleItems = 5; // Number of visible items in the wheel
            this.switchCallback = switchCallback;
            this.isOnServer = null;
            this.init();
        }

        async init() {
            await this.loadServers();
            const serverIndex = this.servers.findIndex(server => server.address.trim() == window.Location.hostname);
            if(serverIndex !== -1 && this.initialServerIndex == -1){
                this.initialServerIndex = serverIndex;
            } else if (this.initialServerIndex == -1){
                this.initialServerIndex = 0;
            }
            this.isOnServer = serverIndex;
            this.createUI();
            this.setupKeyboardListeners();
            for(var i = 0; i < this.initialServerIndex; i++){
                this.nextServer(true);
            }
        }
        async getServerText() {
            try {
                const res = await fetch("/servers.txt");
                if (!res.ok) {
                    return "Failed to load,error";
                }
                const text = await res.text();
                return text;
            } catch (e) {
                return "Failed to load,error"
            }
        }
        async loadServers() {
            const serversText = await this.getServerText();

            this.servers = serversText.split('\n').map((line,i) => {
                const [address, friendlyName] = line.split(',');
                return {
                    address,
                    friendlyName,
                    index: i,
                    isLive: null // Will be populated when checked
                };
            });

            // Check status of all servers initially
            await Promise.all(this.servers.map(server => this.checkServerStatus(server)));
        }

        async checkServerStatus(server) {
            try {
                const res = await fetch(`https://${server.address}/blocked_res.txt`);
                if (res.ok) {
                    const text = await res.text();
                    if (text.indexOf("===NOT_BLOCKED===") !== -1) {
                        server.isLive = true;
                    } else {
                        server.isLive = false;
                    }
                } else {
                    server.isLive = false;
                }
                // Cache the result
                this.serverStatusCache[server.address] = {
                    isLive: server.isLive,
                    timestamp: Date.now()
                };

                // Update UI if it's visible
                if (this.uiVisible) {
                    this.updateUI();
                }


                return server.isLive;
            } catch (error) {
                console.error(`Error checking server status for ${server.address}:`, error);
                server.isLive = false;
                return false;
            }
        }

        createUI() {
            // Create UI container
            this.uiElement = document.createElement('div');
            this.uiElement.className = 'server-toggle-wheel';
            document.body.appendChild(this.uiElement);

            const h2 = document.createElement("h2");
            h2.appendChild(document.createTextNode("Server Toggle"));
            this.uiElement.appendChild(h2);

            const instruction = document.createElement("p");
            instruction.innerHTML = "User CTRL + [ and ] to cycle between servers.";
            this.uiElement.appendChild(instruction);

            // Create wheel container
            const wheelContainer = document.createElement('div');
            wheelContainer.className = 'wheel-container';
            this.uiElement.appendChild(wheelContainer);

            // Create wheel element
            this.wheelElement = document.createElement('div');
            this.wheelElement.className = 'wheel';
            wheelContainer.appendChild(this.wheelElement);

            // Apply styles programmatically
            const styles = `
                .server-toggle-wheel {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: rgba(0, 0, 0, 0.8);
                    color: white;
                    border-radius: 10px;
                    font-family: Arial, sans-serif;
                    z-index: 9999;
                    display: none;
                    width: 340px;
                    padding-left: 50px;
                    padding-right: 50px;
                    height: 450px;
                    perspective: 1000px;
                    box-sizing: border-box;
                }
                .server-toggle-wheel h2 {
                    color: white;
                }
                .server-toggle-wheel p {
                    font-size: 9pt;
                    color: #ccc;
                }
                .wheel-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                    transform-style: preserve-3d;
                    perspective: 1000px;
                }
                .wheel {
                    position: absolute;
                    width: 100%;
                    height: 70%;
                    left: 0;
                    top: 0;
                    transform-style: preserve-3d;
                    transition: transform 0.3s cubic-bezier(0.215, 0.610, 0.355, 1.000);
                }
                .server-item {
                    position: absolute;
                    width: 100%;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-sizing: border-box;
                    transition: all 0.3s ease;
                    backface-visibility: hidden;
                    padding: 5px;
                    opacity: 0.4;
                }
                .server-item.selected {
                    opacity: 1;
                    background-color: #555;
                }
                .server-info-container {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    flex-grow: 1;
                }
                .server-name {
                    display: block;
                    width: 100%;
                    text-align: center;
                    font-weight: bold;
                    font-size: 18px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .server-address {
                    font-size: 12px;
                    color: #aaa;
                    font-style: italic;
                }
                .server-status {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);
        }

        updateUI() {
            if (!this.wheelElement) return;

            // Clear current wheel
            this.wheelElement.innerHTML = '';

            const totalServers = this.servers.length;

            // Create server items
            this.servers.forEach((server, index) => {
                const serverElement = document.createElement('div');
                serverElement.className = `server-item ${index === this.currentServerIndex ? 'selected' : ''}`;

                // Calculate position in the wheel
                const angleDelta = index - this.currentServerIndex;
                const angleInRadians = (angleDelta * Math.PI) / 8; // Adjust divisor for curvature

                // Calculate the Y position
                const y = angleDelta * this.itemHeight;

                // Calculate the Z translation and rotation based on the angle
                const z = 100 * Math.cos(angleInRadians);
                const rotationX = -angleInRadians * (180 / Math.PI); // Convert to degrees

                // Apply transforms
                serverElement.style.transform = `translateY(${y}px) translateZ(${z}px) rotateX(${rotationX}deg)`;
                serverElement.style.top = `calc(50% - ${this.itemHeight / 2}px)`;

                // Adjust opacity based on distance from center
                const opacity = Math.max(0.2, 1 - Math.abs(angleDelta) * 0.2);
                serverElement.style.opacity = opacity;

                // Server info container (name and address)
                const serverInfoContainer = document.createElement('div');
                serverInfoContainer.className = 'server-info-container';

                // Server name
                const nameElement = document.createElement('div');
                nameElement.className = 'server-name';
                nameElement.textContent = server.friendlyName;

                // Add name and address to the info container
                serverInfoContainer.appendChild(nameElement);

                // Status indicator
                const statusElement = document.createElement('div');
                statusElement.className = 'server-status';
                const statusColor = server.isLive
                    ? '#4CAF50' // Green
                    : '#F44336'; // Red
                serverInfoContainer.style.color = statusColor;
                // Append elements
                serverElement.appendChild(serverInfoContainer);


                this.wheelElement.appendChild(serverElement);
            });

            // Position the wheel
            this.updateWheelPosition();

            // Refresh all server statuses
            this.servers.forEach(server => {
                // Only refresh if the cached status is older than 30 seconds
                const cached = this.serverStatusCache[server.address];
                if (!cached || (Date.now() - cached.timestamp > 30000)) {
                    this.checkServerStatus(server);
                }
            });
        }

        updateWheelPosition() {
            if (!this.wheelElement) return;

            // No need to set the transform here - each item has its own transform
            // based on its position relative to the current index
        }

        showUI() {
            if (!this.uiElement) return;

            this.uiVisible = true;
            this.uiElement.style.display = 'block';
            this.updateUI();
        }

        hideUI() {
            if (!this.uiElement) return;

            this.uiVisible = false;
            this.uiElement.style.display = 'none';
        }

        nextServer(hideUI = false) {
            this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
            if(!hideUI) this.showUI();
        }

        prevServer() {
            this.currentServerIndex = (this.currentServerIndex - 1 + this.servers.length) % this.servers.length;
            this.showUI();
        }

        setupKeyboardListeners() {
            // Track if Ctrl key is pressed
            let ctrlPressed = false;
            let uiOpen = false;

            document.addEventListener('keydown', (event) => {
                // Check if Ctrl key is pressed
                if (event.key === 'Control') {
                    ctrlPressed = true;
                }

                if (ctrlPressed) {
                    if (event.key === ']') {
                        event.preventDefault();
                        uiOpen = true;
                        this.nextServer();
                    } else if (event.key === '[') {
                        event.preventDefault();
                        uiOpen = true;
                        this.prevServer();
                    }
                }
            });

            // Hide UI when Ctrl key is released
            document.addEventListener('keyup', (event) => {
                if (event.key === 'Control' && uiOpen) {
                    ctrlPressed = false;
                    this.hideUI();
                    uiOpen = false;
                    this.switchCallback(this.getCurrentServer())
                }
            });
        }

        getCurrentServer() {
            return this.servers[this.currentServerIndex];
        }

        static updateCurrentServerDisplay() {
            const currentServer = this.getCurrentServer();
            const currentServerInfoElement = document.getElementById('current-server-info');

            if (currentServerInfoElement && currentServer) {
                currentServerInfoElement.innerHTML = `
        <div><strong>Name:</strong> ${currentServer.friendlyName}</div>
        <div><strong>Address:</strong> ${currentServer.address}</div>
        <div class="status ${currentServer.isLive ? 'live' : 'offline'}">
          Status: ${currentServer.isLive ? '✓ Online' : '✗ Offline'}
        </div>
      `;
            }
        }
    }
    window.ccPorted.serverToggle = new ServerToggle(-1, (server) => {
        if(framed){
            log("SENDING SWITCH_SERVER");
            parent.postMessage({action: 'SWITCH_SERVER', server: server}, parentOrigin);
        }
    });
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
    class StateSyncUtility {
        constructor() {
            this.compressionEnabled = typeof CompressionStream !== 'undefined';
            this.keyBlackList = ["[ns_ccported]_ccStateLastSave", "[ns_ccported]_statsConfig_interceptRequests", "[ns_ccported]_accessToken", "[ns_ccported]_idToken", "[ns_ccported]_refreshToken"];
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
        // Decompress data from Readalbe stream
        async decompressData(uint8array) {
            const stream = new Blob([uint8array]).stream()
            if (!this.compressionEnabled) {
                const text = await new Response(stream).text();
                return JSON.parse(text);
            }
            const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
            return new Response(decompressed).text().then(JSON.parse);

            /*
            if (!this.compressionEnabled) {
                const text = await new Response(stream).text();
                return JSON.parse(text);
            }
    
            const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
            return new Response(decompressed).text().then(JSON.parse);
            */
        }

        // Optimized localStorage data collection
        getLocalStorageData() {
            log(`[CCPorted State Manager] Getting local storage data.... (length: ${localStorage.globalLength})`)
            const data = {};
            for (let i = 0; i < localStorage.globalLength; i++) {
                const key = localStorage.key(i, true);
                if (this.keyBlackList.includes(key)) continue;
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
            const tempValues = {}
            for (const key of this.keyBlackList) {
                console.log(key);
                tempValues[key] = localStorage.getItem(key);
            }
            console.log(tempValues);
            localStorage.clear(true);
            Object.entries(data).forEach(([key, value]) => {
                if (this.keyBlackList.includes(key)) return;
                localStorage.setItem(key, value);
            });
            for (const key of this.keyBlackList) {
                localStorage.setItem(key, tempValues[key]);
            }
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
        constructor(userId) {
            this.userId = userId;
            this.syncUtil = new StateSyncUtility();
            this.client = new window.ccPorted.AWS.S3({
                region: 'us-west-2'
            });
            this.stateFileName = `save_state.state`;
            this.lastSync = 0;
            this.initialize();
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
                await window.ccPorted.uploadFile(stateBlob, this.stateFileName, { ContentType: "application/octet-stream" });
                log('[CCPorted State Manager] State uploaded successfully');
                await window.ccPorted.updateUser({
                    'custom:last_save_state': timestamp.toString()
                })
                log('[CCPorted State Manager] User attributes updated successfully');

            } catch (error) {
                log('[CCPorted State Manager] Error saving state: ' + error);
                throw error;
            }
        }

        async loadFromServer() {
            try {
                log("Starting load from server")
                const lastSave = window.ccPorted.user.attributes["custom:last_save_state"] || 0;
                const params = {
                    Bucket: 'ccporteduserobjects',
                    Key: `${window.ccPorted.user.sub}/${this.stateFileName}`,
                }
                const data = await this.client.getObject(params).promise();
                log('[CCPorted State Manager] State downloaded successfully');
                const decomp = await this.syncUtil.decompressData(data.Body);
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
                if (error.code?.includes('NoSuchKey')) {
                    log('[CCPorted State Manager] No save state found');
                    return;
                }
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
                if (this.interceptRequests) {
                    this.log(`Request interception is on. set [ns_ccported]_statsConfig_interceptRequests in localStorage to a falsy value to turn off.`)
                    this.setupRequestInterception();
                } else {
                    this.log(`Request interception is off. set [ns_ccported]_statsConfig_interceptRequests in localStorage to a true value to turn on.`)
                }
            });
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
                user: `${user ? user.sub : "N/A"} (${user ? user["cognito:username"] : "Guest"
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

    window.addEventListener("beforeunload", cleanupTracking);
    window.addEventListener("load", () => {
        init();
        const login = document.querySelector('.loggedInReplacable');
        if (login) {
            login.addEventListener('click', (e) => {
                if (login.textContent === "Login") {
                    e.preventDefault();
                    const redirect = window.location.origin;
                    const scopes = ["email", "openid", "phone", "aws.cognito.signin.user.admin"];
                    const baseURL = "https://us-west-2lg1qptg2n.auth.us-west-2.amazoncognito.com/login";
                    const clientID = "4d6esoka62s46lo4d398o3sqpi";
                    const responseType = "code";
                    window.location.href = `${baseURL}?client_id=${clientID}&response_type=${responseType}&scope=${scopes.join("+")}&redirect_uri=${redirect}`;
                    return false;
                }
            })
        }
    });
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
                ...customparams
            }
            window.ccPorted.s3Client.upload(uploadParams, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            })
        });
    }
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
            reject("Failed to initialize user.");
        }
    });

    function log(...args) {
        console.log(`[${gameID}]: `, ...args);
        if (window.ccPorted.stats) {
            window.ccPorted.stats.log(...args);
        }
    }
    function shuffle(array) {
        let currentIndex = array.length;

        // While there remain elements to shuffle...
        while (currentIndex != 0) {

            // Pick a remaining element...
            let randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
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
    function decamelize(string) {
        // string are in camelcase
        // should end up as "Camel Case"
        let denormalized = "";
        for (let i = 0; i < string.length; i++) {
            if (string[i] === string[i].toUpperCase() && ((string[i + 1] && string[i + 1] === string[i + 1].toUpperCase()) || !string[i + 1])) {
                denormalized += " " + string[i];
            } else {
                denormalized += string[i];
            }
        }
        // capitalize first character
        denormalized = denormalized[0].toUpperCase() + denormalized.slice(1);
        return denormalized;
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
        z-index: 99999;
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
    function toggleStats() {
        if (window.ccPorted.stats.isOpen) {
            window.ccPorted.stats.close();
        } else {
            window.ccPorted.stats.open();
        }
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
        trackingInterval = setInterval(trackingTick, 5 * 60 * 1000); // 5 minutes
    }
    function cleanupTracking() {
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }

        // Save final tracking update
        if (window.ccPorted.trackingData) {
            trackingTick();
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
    function pageInIframe() {
        return (window.location !== window.parent.location);
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
    function installGTAG() {
        log("Installing GTAG");
        if (window.gtag) {
            log("GTAG already installed, starting init");
            init();
            return Promise.resolve();
        } else {
            log("GTAG not installed, loading script");
            const script = document.createElement("script");
            const gID = `G-DJDL65P9Y4`;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${gID}`;
            document.head.appendChild(script);
            const loadPromise = new Promise((r, rr) => {
                script.onload = () => {
                    log("GTAG script loaded");
                    window.dataLayer = window.dataLayer || [];
                    function gtag() { dataLayer.push(arguments); }
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', gID);
                    log("GTAG installed, starting init");
                    initEmit();
                    r();
                }
            });
            return loadPromise;
        }

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
                        reject(new Error("No authenticated user in parent"));
                    } else if (data.action === "UNKNOWN_ACTION") {
                        reject(new Error("Unknown action"));
                    }
                }
            };

            // Add event listener
            window.addEventListener("message", messageHandler);

            // Send request to parent
            window.parent.postMessage({
                action: "GET_TOKENS",
                requestId: requestId
            }, parentOrigin);

            // Set timeout
            setTimeout(() => {
                window.removeEventListener("message", messageHandler);
                reject(new Error("Timeout getting tokens from parent"));
            }, timeout);
        });
    }
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
                return null;
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
        let idToken = localStorage.getItem("[ns_ccported]_idToken");
        let accessToken = localStorage.getItem("[ns_ccported]_accessToken");
        let refreshToken = localStorage.getItem("[ns_ccported]_refreshToken");
        let user = null;
        if (!idToken || !accessToken) {
            console.warn("No valid tokens found. Checking for auth code...");
            const authCode = new URLSearchParams(window.location.search).get("code");

            if (authCode) {
                console.log("Auth code found. Exchanging for tokens...");
                const tokens = await exchangeAuthCodeForTokens(authCode);
                if (!tokens) {
                    console.error("Failed to exchange auth code for tokens.");
                    return null;
                }
                idToken = tokens.id_token;
                accessToken = tokens.access_token;
                refreshToken = tokens.refresh_token;

                user = await initializeAuthenticated(idToken, accessToken, refreshToken);
            } else {
                console.warn("No auth code found in URL. User may need to log in.");
                if (framed) {
                    try {
                        const tokens = await getTokensFromParent();
                        const { idToken, accessToken, refreshToken } = tokens;

                        if (!idToken || !accessToken) {
                            console.log("Invalid tokens received, initializing unauthenticated.");
                            user = await initializeUnathenticated();
                        } else {
                            user = await initializeAuthenticated(idToken, accessToken, refreshToken);
                        }
                    } catch (error) {
                        console.error("Authentication error:", error.message);
                        user = await initializeUnathenticated();
                    }
                } else {
                    console.log("No parent to recieve tokens from... initializing unauthenticated");
                    user = await initializeUnathenticated();
                }
            }
        } else {
            log("Tokens found. Initializing user...");
            user = await initializeAuthenticated(idToken, accessToken, refreshToken);

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
    async function saveTrackingData() {
        try {
            await window.ccPorted.updateUser({
                'custom:tracking_data': JSON.stringify(window.ccPorted.trackingData)
            })
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
    async function trackingTick() {
        const now = Date.now();
        const timeDiff = now - lastUpdate;
        lastUpdate = now;

        // Convert ms to minutes
        let minutesElapsedX = timeDiff / 60000;
        const minutesElapsed =
            Math.round((minutesElapsedX + Number.EPSILON) * 100) / 100;
        if (minutesElapsed > 0 && tGameID) {
            if (!window.ccPorted.trackingData.games[tGameID]) {
                window.ccPorted.trackingData.games[tGameID] = { playtime: 0 };
            }

            // Update game-specific playtime
            const currentPlaytime =
                getDeepValue(window.ccPorted.trackingData, `games.${tGameID}.playtime`) ||
                0;
            updateTracking(
                `games.${tGameID}.playtime`,
                currentPlaytime + minutesElapsed
            );

            // Update total playtime
            const totalPlaytime = window.ccPorted.trackingData.total_playtime || 0;
            updateTracking("total_playtime", totalPlaytime + minutesElapsed);
        }
        await saveTrackingData();
    }
    async function handleUserLoggedIn() {
        // Fetch tracking data if user exists
        if (!window.ccPorted.user) return;
        if (window.ccPorted.user.attributes["custom:tracking_data"]) {
            console.log(window.ccPorted.user.attributes["custom:tracking_data"].length)
            window.ccPorted.trackingData = JSON.parse(
                window.ccPorted.user.attributes["custom:tracking_data"]
            );
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
            window.ccPorted.user.sub,
        );
    }
    async function init() {
        if (window.ccPorted.user) {
            handleUserLoggedIn();
        } else if (window.ccPorted.userPromise) {
            try {
                const user = await window.ccPorted.userPromise;
                if (user) {
                    window.ccPorted.user = user;
                    handleUserLoggedIn();
                }
            } catch (e) {
                log("User appears to be logged out.")
            }
        }
    }
    async function initEmit() {
        emit();
        setInterval(emit, 1000 * 60 * 10);
    }

    installGTAG();

    shortcut([17, 81], toggleStats);
    if(!window.ccPorted.config || typeof window.ccPorted.config?.sandboxStorage == "undefined" || window.ccPorted.config.sandboxStorage){
        createGameStorageSandbox(window.gameID || "ccported")();
    }

    link.href = "/assets/styles/master.css";
    link.setAttribute("rel", "stylesheet");
    document.head.appendChild(link);

    const stats = new Stats();
    window.ccPorted.stats = stats;
})();
