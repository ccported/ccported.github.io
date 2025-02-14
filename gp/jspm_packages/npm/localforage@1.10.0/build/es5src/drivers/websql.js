/* */ 
"format cjs";
(function(global, factory) {
  if (typeof define === "function" && define.amd) {
    define('webSQLStorage', ['module', 'exports', '../utils/isWebSQLValid', '../utils/serializer', '../utils/promise', '../utils/executeCallback', '../utils/normalizeKey', '../utils/getCallback'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, exports, require('../utils/isWebSQLValid'), require('../utils/serializer'), require('../utils/promise'), require('../utils/executeCallback'), require('../utils/normalizeKey'), require('../utils/getCallback'));
  } else {
    var mod = {exports: {}};
    factory(mod, mod.exports, global.isWebSQLValid, global.serializer, global.promise, global.executeCallback, global.normalizeKey, global.getCallback);
    global.webSQLStorage = mod.exports;
  }
})(this, function(module, exports, _isWebSQLValid, _serializer, _promise, _executeCallback, _normalizeKey, _getCallback) {
  'use strict';
  Object.defineProperty(exports, "__esModule", {value: true});
  var _isWebSQLValid2 = _interopRequireDefault(_isWebSQLValid);
  var _serializer2 = _interopRequireDefault(_serializer);
  var _promise2 = _interopRequireDefault(_promise);
  var _executeCallback2 = _interopRequireDefault(_executeCallback);
  var _normalizeKey2 = _interopRequireDefault(_normalizeKey);
  var _getCallback2 = _interopRequireDefault(_getCallback);
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {default: obj};
  }
  function createDbTable(t, dbInfo, callback, errorCallback) {
    t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName + ' ' + '(id INTEGER PRIMARY KEY, key unique, value)', [], callback, errorCallback);
  }
  function _initStorage(options) {
    var self = this;
    var dbInfo = {db: null};
    if (options) {
      for (var i in options) {
        dbInfo[i] = typeof options[i] !== 'string' ? options[i].toString() : options[i];
      }
    }
    var dbInfoPromise = new _promise2.default(function(resolve, reject) {
      try {
        dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
      } catch (e) {
        return reject(e);
      }
      dbInfo.db.transaction(function(t) {
        createDbTable(t, dbInfo, function() {
          self._dbInfo = dbInfo;
          resolve();
        }, function(t, error) {
          reject(error);
        });
      }, reject);
    });
    dbInfo.serializer = _serializer2.default;
    return dbInfoPromise;
  }
  function tryExecuteSql(t, dbInfo, sqlStatement, args, callback, errorCallback) {
    t.executeSql(sqlStatement, args, callback, function(t, error) {
      if (error.code === error.SYNTAX_ERR) {
        t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name = ?", [dbInfo.storeName], function(t, results) {
          if (!results.rows.length) {
            createDbTable(t, dbInfo, function() {
              t.executeSql(sqlStatement, args, callback, errorCallback);
            }, errorCallback);
          } else {
            errorCallback(t, error);
          }
        }, errorCallback);
      } else {
        errorCallback(t, error);
      }
    }, errorCallback);
  }
  function getItem(key, callback) {
    var self = this;
    key = (0, _normalizeKey2.default)(key);
    var promise = new _promise2.default(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName + ' WHERE key = ? LIMIT 1', [key], function(t, results) {
            var result = results.rows.length ? results.rows.item(0).value : null;
            if (result) {
              result = dbInfo.serializer.deserialize(result);
            }
            resolve(result);
          }, function(t, error) {
            reject(error);
          });
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
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName, [], function(t, results) {
            var rows = results.rows;
            var length = rows.length;
            for (var i = 0; i < length; i++) {
              var item = rows.item(i);
              var result = item.value;
              if (result) {
                result = dbInfo.serializer.deserialize(result);
              }
              result = iterator(result, item.key, i + 1);
              if (result !== void 0) {
                resolve(result);
                return;
              }
            }
            resolve();
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function _setItem(key, value, callback, retriesLeft) {
    var self = this;
    key = (0, _normalizeKey2.default)(key);
    var promise = new _promise2.default(function(resolve, reject) {
      self.ready().then(function() {
        if (value === undefined) {
          value = null;
        }
        var originalValue = value;
        var dbInfo = self._dbInfo;
        dbInfo.serializer.serialize(value, function(value, error) {
          if (error) {
            reject(error);
          } else {
            dbInfo.db.transaction(function(t) {
              tryExecuteSql(t, dbInfo, 'INSERT OR REPLACE INTO ' + dbInfo.storeName + ' ' + '(key, value) VALUES (?, ?)', [key, value], function() {
                resolve(originalValue);
              }, function(t, error) {
                reject(error);
              });
            }, function(sqlError) {
              if (sqlError.code === sqlError.QUOTA_ERR) {
                if (retriesLeft > 0) {
                  resolve(_setItem.apply(self, [key, originalValue, callback, retriesLeft - 1]));
                  return;
                }
                reject(sqlError);
              }
            });
          }
        });
      }).catch(reject);
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function setItem(key, value, callback) {
    return _setItem.apply(this, [key, value, callback, 1]);
  }
  function removeItem(key, callback) {
    var self = this;
    key = (0, _normalizeKey2.default)(key);
    var promise = new _promise2.default(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName + ' WHERE key = ?', [key], function() {
            resolve();
          }, function(t, error) {
            reject(error);
          });
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
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName, [], function() {
            resolve();
          }, function(t, error) {
            reject(error);
          });
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
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'SELECT COUNT(key) as c FROM ' + dbInfo.storeName, [], function(t, results) {
            var result = results.rows.item(0).c;
            resolve(result);
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function key(n, callback) {
    var self = this;
    var promise = new _promise2.default(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName + ' WHERE id = ? LIMIT 1', [n + 1], function(t, results) {
            var result = results.rows.length ? results.rows.item(0).key : null;
            resolve(result);
          }, function(t, error) {
            reject(error);
          });
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
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName, [], function(t, results) {
            var keys = [];
            for (var i = 0; i < results.rows.length; i++) {
              keys.push(results.rows.item(i).key);
            }
            resolve(keys);
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function getAllStoreNames(db) {
    return new _promise2.default(function(resolve, reject) {
      db.transaction(function(t) {
        t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'", [], function(t, results) {
          var storeNames = [];
          for (var i = 0; i < results.rows.length; i++) {
            storeNames.push(results.rows.item(i).name);
          }
          resolve({
            db: db,
            storeNames: storeNames
          });
        }, function(t, error) {
          reject(error);
        });
      }, function(sqlError) {
        reject(sqlError);
      });
    });
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
      promise = new _promise2.default(function(resolve) {
        var db;
        if (options.name === currentConfig.name) {
          db = self._dbInfo.db;
        } else {
          db = openDatabase(options.name, '', '', 0);
        }
        if (!options.storeName) {
          resolve(getAllStoreNames(db));
        } else {
          resolve({
            db: db,
            storeNames: [options.storeName]
          });
        }
      }).then(function(operationInfo) {
        return new _promise2.default(function(resolve, reject) {
          operationInfo.db.transaction(function(t) {
            function dropTable(storeName) {
              return new _promise2.default(function(resolve, reject) {
                t.executeSql('DROP TABLE IF EXISTS ' + storeName, [], function() {
                  resolve();
                }, function(t, error) {
                  reject(error);
                });
              });
            }
            var operations = [];
            for (var i = 0,
                len = operationInfo.storeNames.length; i < len; i++) {
              operations.push(dropTable(operationInfo.storeNames[i]));
            }
            _promise2.default.all(operations).then(function() {
              resolve();
            }).catch(function(e) {
              reject(e);
            });
          }, function(sqlError) {
            reject(sqlError);
          });
        });
      });
    }
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  var webSQLStorage = {
    _driver: 'webSQLStorage',
    _initStorage: _initStorage,
    _support: (0, _isWebSQLValid2.default)(),
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
  exports.default = webSQLStorage;
  module.exports = exports['default'];
});
