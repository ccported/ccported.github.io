/* */ 
"format cjs";
(function(process) {
  (function(global, factory) {
    if (typeof define === "function" && define.amd) {
      define('asyncStorage', ['module', 'exports', '../utils/isIndexedDBValid', '../utils/createBlob', '../utils/idb', '../utils/promise', '../utils/executeCallback', '../utils/executeTwoCallbacks', '../utils/normalizeKey', '../utils/getCallback'], factory);
    } else if (typeof exports !== "undefined") {
      factory(module, exports, require('../utils/isIndexedDBValid'), require('../utils/createBlob'), require('../utils/idb'), require('../utils/promise'), require('../utils/executeCallback'), require('../utils/executeTwoCallbacks'), require('../utils/normalizeKey'), require('../utils/getCallback'));
    } else {
      var mod = {exports: {}};
      factory(mod, mod.exports, global.isIndexedDBValid, global.createBlob, global.idb, global.promise, global.executeCallback, global.executeTwoCallbacks, global.normalizeKey, global.getCallback);
      global.asyncStorage = mod.exports;
    }
  })(this, function(module, exports, _isIndexedDBValid, _createBlob, _idb, _promise, _executeCallback, _executeTwoCallbacks, _normalizeKey, _getCallback) {
    'use strict';
    Object.defineProperty(exports, "__esModule", {value: true});
    var _isIndexedDBValid2 = _interopRequireDefault(_isIndexedDBValid);
    var _createBlob2 = _interopRequireDefault(_createBlob);
    var _idb2 = _interopRequireDefault(_idb);
    var _promise2 = _interopRequireDefault(_promise);
    var _executeCallback2 = _interopRequireDefault(_executeCallback);
    var _executeTwoCallbacks2 = _interopRequireDefault(_executeTwoCallbacks);
    var _normalizeKey2 = _interopRequireDefault(_normalizeKey);
    var _getCallback2 = _interopRequireDefault(_getCallback);
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : {default: obj};
    }
    var DETECT_BLOB_SUPPORT_STORE = 'local-forage-detect-blob-support';
    var supportsBlobs = void 0;
    var dbContexts = {};
    var toString = Object.prototype.toString;
    var READ_ONLY = 'readonly';
    var READ_WRITE = 'readwrite';
    function _binStringToArrayBuffer(bin) {
      var length = bin.length;
      var buf = new ArrayBuffer(length);
      var arr = new Uint8Array(buf);
      for (var i = 0; i < length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      return buf;
    }
    function _checkBlobSupportWithoutCaching(idb) {
      return new _promise2.default(function(resolve) {
        var txn = idb.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
        var blob = (0, _createBlob2.default)(['']);
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');
        txn.onabort = function(e) {
          e.preventDefault();
          e.stopPropagation();
          resolve(false);
        };
        txn.oncomplete = function() {
          var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
          var matchedEdge = navigator.userAgent.match(/Edge\//);
          resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
        };
      }).catch(function() {
        return false;
      });
    }
    function _checkBlobSupport(idb) {
      if (typeof supportsBlobs === 'boolean') {
        return _promise2.default.resolve(supportsBlobs);
      }
      return _checkBlobSupportWithoutCaching(idb).then(function(value) {
        supportsBlobs = value;
        return supportsBlobs;
      });
    }
    function _deferReadiness(dbInfo) {
      var dbContext = dbContexts[dbInfo.name];
      var deferredOperation = {};
      deferredOperation.promise = new _promise2.default(function(resolve, reject) {
        deferredOperation.resolve = resolve;
        deferredOperation.reject = reject;
      });
      dbContext.deferredOperations.push(deferredOperation);
      if (!dbContext.dbReady) {
        dbContext.dbReady = deferredOperation.promise;
      } else {
        dbContext.dbReady = dbContext.dbReady.then(function() {
          return deferredOperation.promise;
        });
      }
    }
    function _advanceReadiness(dbInfo) {
      var dbContext = dbContexts[dbInfo.name];
      var deferredOperation = dbContext.deferredOperations.pop();
      if (deferredOperation) {
        deferredOperation.resolve();
        return deferredOperation.promise;
      }
    }
    function _rejectReadiness(dbInfo, err) {
      var dbContext = dbContexts[dbInfo.name];
      var deferredOperation = dbContext.deferredOperations.pop();
      if (deferredOperation) {
        deferredOperation.reject(err);
        return deferredOperation.promise;
      }
    }
    function _getConnection(dbInfo, upgradeNeeded) {
      return new _promise2.default(function(resolve, reject) {
        dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();
        if (dbInfo.db) {
          if (upgradeNeeded) {
            _deferReadiness(dbInfo);
            dbInfo.db.close();
          } else {
            return resolve(dbInfo.db);
          }
        }
        var dbArgs = [dbInfo.name];
        if (upgradeNeeded) {
          dbArgs.push(dbInfo.version);
        }
        var openreq = _idb2.default.open.apply(_idb2.default, dbArgs);
        if (upgradeNeeded) {
          openreq.onupgradeneeded = function(e) {
            var db = openreq.result;
            try {
              db.createObjectStore(dbInfo.storeName);
              if (e.oldVersion <= 1) {
                db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
              }
            } catch (ex) {
              if (ex.name === 'ConstraintError') {
                console.warn('The database "' + dbInfo.name + '"' + ' has been upgraded from version ' + e.oldVersion + ' to version ' + e.newVersion + ', but the storage "' + dbInfo.storeName + '" already exists.');
              } else {
                throw ex;
              }
            }
          };
        }
        openreq.onerror = function(e) {
          e.preventDefault();
          reject(openreq.error);
        };
        openreq.onsuccess = function() {
          var db = openreq.result;
          db.onversionchange = function(e) {
            e.target.close();
          };
          resolve(db);
          _advanceReadiness(dbInfo);
        };
      });
    }
    function _getOriginalConnection(dbInfo) {
      return _getConnection(dbInfo, false);
    }
    function _getUpgradedConnection(dbInfo) {
      return _getConnection(dbInfo, true);
    }
    function _isUpgradeNeeded(dbInfo, defaultVersion) {
      if (!dbInfo.db) {
        return true;
      }
      var isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
      var isDowngrade = dbInfo.version < dbInfo.db.version;
      var isUpgrade = dbInfo.version > dbInfo.db.version;
      if (isDowngrade) {
        if (dbInfo.version !== defaultVersion) {
          console.warn('The database "' + dbInfo.name + '"' + " can't be downgraded from version " + dbInfo.db.version + ' to version ' + dbInfo.version + '.');
        }
        dbInfo.version = dbInfo.db.version;
      }
      if (isUpgrade || isNewStore) {
        if (isNewStore) {
          var incVersion = dbInfo.db.version + 1;
          if (incVersion > dbInfo.version) {
            dbInfo.version = incVersion;
          }
        }
        return true;
      }
      return false;
    }
    function _encodeBlob(blob) {
      return new _promise2.default(function(resolve, reject) {
        var reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = function(e) {
          var base64 = btoa(e.target.result || '');
          resolve({
            __local_forage_encoded_blob: true,
            data: base64,
            type: blob.type
          });
        };
        reader.readAsBinaryString(blob);
      });
    }
    function _decodeBlob(encodedBlob) {
      var arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
      return (0, _createBlob2.default)([arrayBuff], {type: encodedBlob.type});
    }
    function _isEncodedBlob(value) {
      return value && value.__local_forage_encoded_blob;
    }
    function _fullyReady(callback) {
      var self = this;
      var promise = self._initReady().then(function() {
        var dbContext = dbContexts[self._dbInfo.name];
        if (dbContext && dbContext.dbReady) {
          return dbContext.dbReady;
        }
      });
      (0, _executeTwoCallbacks2.default)(promise, callback, callback);
      return promise;
    }
    function _tryReconnect(dbInfo) {
      _deferReadiness(dbInfo);
      var dbContext = dbContexts[dbInfo.name];
      var forages = dbContext.forages;
      for (var i = 0; i < forages.length; i++) {
        var forage = forages[i];
        if (forage._dbInfo.db) {
          forage._dbInfo.db.close();
          forage._dbInfo.db = null;
        }
      }
      dbInfo.db = null;
      return _getOriginalConnection(dbInfo).then(function(db) {
        dbInfo.db = db;
        if (_isUpgradeNeeded(dbInfo)) {
          return _getUpgradedConnection(dbInfo);
        }
        return db;
      }).then(function(db) {
        dbInfo.db = dbContext.db = db;
        for (var i = 0; i < forages.length; i++) {
          forages[i]._dbInfo.db = db;
        }
      }).catch(function(err) {
        _rejectReadiness(dbInfo, err);
        throw err;
      });
    }
    function createTransaction(dbInfo, mode, callback, retries) {
      if (retries === undefined) {
        retries = 1;
      }
      try {
        var tx = dbInfo.db.transaction(dbInfo.storeName, mode);
        callback(null, tx);
      } catch (err) {
        if (retries > 0 && (!dbInfo.db || err.name === 'InvalidStateError' || err.name === 'NotFoundError')) {
          return _promise2.default.resolve().then(function() {
            if (!dbInfo.db || err.name === 'NotFoundError' && !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) && dbInfo.version <= dbInfo.db.version) {
              if (dbInfo.db) {
                dbInfo.version = dbInfo.db.version + 1;
              }
              return _getUpgradedConnection(dbInfo);
            }
          }).then(function() {
            return _tryReconnect(dbInfo).then(function() {
              createTransaction(dbInfo, mode, callback, retries - 1);
            });
          }).catch(callback);
        }
        callback(err);
      }
    }
    function createDbContext() {
      return {
        forages: [],
        db: null,
        dbReady: null,
        deferredOperations: []
      };
    }
    function _initStorage(options) {
      var self = this;
      var dbInfo = {db: null};
      if (options) {
        for (var i in options) {
          dbInfo[i] = options[i];
        }
      }
      var dbContext = dbContexts[dbInfo.name];
      if (!dbContext) {
        dbContext = createDbContext();
        dbContexts[dbInfo.name] = dbContext;
      }
      dbContext.forages.push(self);
      if (!self._initReady) {
        self._initReady = self.ready;
        self.ready = _fullyReady;
      }
      var initPromises = [];
      function ignoreErrors() {
        return _promise2.default.resolve();
      }
      for (var j = 0; j < dbContext.forages.length; j++) {
        var forage = dbContext.forages[j];
        if (forage !== self) {
          initPromises.push(forage._initReady().catch(ignoreErrors));
        }
      }
      var forages = dbContext.forages.slice(0);
      return _promise2.default.all(initPromises).then(function() {
        dbInfo.db = dbContext.db;
        return _getOriginalConnection(dbInfo);
      }).then(function(db) {
        dbInfo.db = db;
        if (_isUpgradeNeeded(dbInfo, self._defaultConfig.version)) {
          return _getUpgradedConnection(dbInfo);
        }
        return db;
      }).then(function(db) {
        dbInfo.db = dbContext.db = db;
        self._dbInfo = dbInfo;
        for (var k = 0; k < forages.length; k++) {
          var forage = forages[k];
          if (forage !== self) {
            forage._dbInfo.db = dbInfo.db;
            forage._dbInfo.version = dbInfo.version;
          }
        }
      });
    }
    function getItem(key, callback) {
      var self = this;
      key = (0, _normalizeKey2.default)(key);
      var promise = new _promise2.default(function(resolve, reject) {
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_ONLY, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var req = store.get(key);
              req.onsuccess = function() {
                var value = req.result;
                if (value === undefined) {
                  value = null;
                }
                if (_isEncodedBlob(value)) {
                  value = _decodeBlob(value);
                }
                resolve(value);
              };
              req.onerror = function() {
                reject(req.error);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function iterate(iterator, callback) {
      var self = this;
      var promise = new _promise2.default(function(resolve, reject) {
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_ONLY, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var req = store.openCursor();
              var iterationNumber = 1;
              req.onsuccess = function() {
                var cursor = req.result;
                if (cursor) {
                  var value = cursor.value;
                  if (_isEncodedBlob(value)) {
                    value = _decodeBlob(value);
                  }
                  var result = iterator(value, cursor.key, iterationNumber++);
                  if (result !== void 0) {
                    resolve(result);
                  } else {
                    cursor.continue();
                  }
                } else {
                  resolve();
                }
              };
              req.onerror = function() {
                reject(req.error);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function setItem(key, value, callback) {
      var self = this;
      key = (0, _normalizeKey2.default)(key);
      var promise = new _promise2.default(function(resolve, reject) {
        var dbInfo;
        self.ready().then(function() {
          dbInfo = self._dbInfo;
          if (toString.call(value) === '[object Blob]') {
            return _checkBlobSupport(dbInfo.db).then(function(blobSupport) {
              if (blobSupport) {
                return value;
              }
              return _encodeBlob(value);
            });
          }
          return value;
        }).then(function(value) {
          createTransaction(self._dbInfo, READ_WRITE, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              if (value === null) {
                value = undefined;
              }
              var req = store.put(value, key);
              transaction.oncomplete = function() {
                if (value === undefined) {
                  value = null;
                }
                resolve(value);
              };
              transaction.onabort = transaction.onerror = function() {
                var err = req.error ? req.error : req.transaction.error;
                reject(err);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function removeItem(key, callback) {
      var self = this;
      key = (0, _normalizeKey2.default)(key);
      var promise = new _promise2.default(function(resolve, reject) {
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_WRITE, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var req = store.delete(key);
              transaction.oncomplete = function() {
                resolve();
              };
              transaction.onerror = function() {
                reject(req.error);
              };
              transaction.onabort = function() {
                var err = req.error ? req.error : req.transaction.error;
                reject(err);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function clear(callback) {
      var self = this;
      var promise = new _promise2.default(function(resolve, reject) {
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_WRITE, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var req = store.clear();
              transaction.oncomplete = function() {
                resolve();
              };
              transaction.onabort = transaction.onerror = function() {
                var err = req.error ? req.error : req.transaction.error;
                reject(err);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function length(callback) {
      var self = this;
      var promise = new _promise2.default(function(resolve, reject) {
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_ONLY, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var req = store.count();
              req.onsuccess = function() {
                resolve(req.result);
              };
              req.onerror = function() {
                reject(req.error);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function key(n, callback) {
      var self = this;
      var promise = new _promise2.default(function(resolve, reject) {
        if (n < 0) {
          resolve(null);
          return;
        }
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_ONLY, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var advanced = false;
              var req = store.openKeyCursor();
              req.onsuccess = function() {
                var cursor = req.result;
                if (!cursor) {
                  resolve(null);
                  return;
                }
                if (n === 0) {
                  resolve(cursor.key);
                } else {
                  if (!advanced) {
                    advanced = true;
                    cursor.advance(n);
                  } else {
                    resolve(cursor.key);
                  }
                }
              };
              req.onerror = function() {
                reject(req.error);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function keys(callback) {
      var self = this;
      var promise = new _promise2.default(function(resolve, reject) {
        self.ready().then(function() {
          createTransaction(self._dbInfo, READ_ONLY, function(err, transaction) {
            if (err) {
              return reject(err);
            }
            try {
              var store = transaction.objectStore(self._dbInfo.storeName);
              var req = store.openKeyCursor();
              var keys = [];
              req.onsuccess = function() {
                var cursor = req.result;
                if (!cursor) {
                  resolve(keys);
                  return;
                }
                keys.push(cursor.key);
                cursor.continue();
              };
              req.onerror = function() {
                reject(req.error);
              };
            } catch (e) {
              reject(e);
            }
          });
        }).catch(reject);
      });
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    function dropInstance(options, callback) {
      callback = _getCallback2.default.apply(this, arguments);
      var currentConfig = this.config();
      options = typeof options !== 'function' && options || {};
      if (!options.name) {
        options.name = options.name || currentConfig.name;
        options.storeName = options.storeName || currentConfig.storeName;
      }
      var self = this;
      var promise;
      if (!options.name) {
        promise = _promise2.default.reject('Invalid arguments');
      } else {
        var isCurrentDb = options.name === currentConfig.name && self._dbInfo.db;
        var dbPromise = isCurrentDb ? _promise2.default.resolve(self._dbInfo.db) : _getOriginalConnection(options).then(function(db) {
          var dbContext = dbContexts[options.name];
          var forages = dbContext.forages;
          dbContext.db = db;
          for (var i = 0; i < forages.length; i++) {
            forages[i]._dbInfo.db = db;
          }
          return db;
        });
        if (!options.storeName) {
          promise = dbPromise.then(function(db) {
            _deferReadiness(options);
            var dbContext = dbContexts[options.name];
            var forages = dbContext.forages;
            db.close();
            for (var i = 0; i < forages.length; i++) {
              var forage = forages[i];
              forage._dbInfo.db = null;
            }
            var dropDBPromise = new _promise2.default(function(resolve, reject) {
              var req = _idb2.default.deleteDatabase(options.name);
              req.onerror = function() {
                var db = req.result;
                if (db) {
                  db.close();
                }
                reject(req.error);
              };
              req.onblocked = function() {
                console.warn('dropInstance blocked for database "' + options.name + '" until all open connections are closed');
              };
              req.onsuccess = function() {
                var db = req.result;
                if (db) {
                  db.close();
                }
                resolve(db);
              };
            });
            return dropDBPromise.then(function(db) {
              dbContext.db = db;
              for (var i = 0; i < forages.length; i++) {
                var _forage = forages[i];
                _advanceReadiness(_forage._dbInfo);
              }
            }).catch(function(err) {
              (_rejectReadiness(options, err) || _promise2.default.resolve()).catch(function() {});
              throw err;
            });
          });
        } else {
          promise = dbPromise.then(function(db) {
            if (!db.objectStoreNames.contains(options.storeName)) {
              return;
            }
            var newVersion = db.version + 1;
            _deferReadiness(options);
            var dbContext = dbContexts[options.name];
            var forages = dbContext.forages;
            db.close();
            for (var i = 0; i < forages.length; i++) {
              var forage = forages[i];
              forage._dbInfo.db = null;
              forage._dbInfo.version = newVersion;
            }
            var dropObjectPromise = new _promise2.default(function(resolve, reject) {
              var req = _idb2.default.open(options.name, newVersion);
              req.onerror = function(err) {
                var db = req.result;
                db.close();
                reject(err);
              };
              req.onupgradeneeded = function() {
                var db = req.result;
                db.deleteObjectStore(options.storeName);
              };
              req.onsuccess = function() {
                var db = req.result;
                db.close();
                resolve(db);
              };
            });
            return dropObjectPromise.then(function(db) {
              dbContext.db = db;
              for (var j = 0; j < forages.length; j++) {
                var _forage2 = forages[j];
                _forage2._dbInfo.db = db;
                _advanceReadiness(_forage2._dbInfo);
              }
            }).catch(function(err) {
              (_rejectReadiness(options, err) || _promise2.default.resolve()).catch(function() {});
              throw err;
            });
          });
        }
      }
      (0, _executeCallback2.default)(promise, callback);
      return promise;
    }
    var asyncStorage = {
      _driver: 'asyncStorage',
      _initStorage: _initStorage,
      _support: (0, _isIndexedDBValid2.default)(),
      iterate: iterate,
      getItem: getItem,
      setItem: setItem,
      removeItem: removeItem,
      clear: clear,
      length: length,
      key: key,
      keys: keys,
      dropInstance: dropInstance
    };
    exports.default = asyncStorage;
    module.exports = exports['default'];
  });
})(require('process'));
