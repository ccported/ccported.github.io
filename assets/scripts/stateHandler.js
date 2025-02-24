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
            if(key === 'ccStateLastSave') continue;
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
            log('[329]',state);
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
        console.log(stateBlob)
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
            }else{
                log('[CCPorted State Manager] Game state is up to date');
            }
        } catch (error) {
            log('[CCPorted State Manager] [315] Error loading state: ' + error);
            throw error;
        }
    }
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
