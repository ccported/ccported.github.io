/* */ 
"format cjs";
(function(global, factory) {
  if (typeof define === "function" && define.amd) {
    define('localStorageWrapper', ['module', 'exports', '../utils/isLocalStorageValid', '../utils/serializer', '../utils/promise', '../utils/executeCallback', '../utils/normalizeKey', '../utils/getCallback'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, exports, require('../utils/isLocalStorageValid'), require('../utils/serializer'), require('../utils/promise'), require('../utils/executeCallback'), require('../utils/normalizeKey'), require('../utils/getCallback'));
  } else {
    var mod = {exports: {}};
    factory(mod, mod.exports, global.isLocalStorageValid, global.serializer, global.promise, global.executeCallback, global.normalizeKey, global.getCallback);
    global.localStorageWrapper = mod.exports;
  }
})(this, function(module, exports, _isLocalStorageValid, _serializer, _promise, _executeCallback, _normalizeKey, _getCallback) {
  'use strict';
  Object.defineProperty(exports, "__esModule", {value: true});
  var _isLocalStorageValid2 = _interopRequireDefault(_isLocalStorageValid);
  var _serializer2 = _interopRequireDefault(_serializer);
  var _promise2 = _interopRequireDefault(_promise);
  var _executeCallback2 = _interopRequireDefault(_executeCallback);
  var _normalizeKey2 = _interopRequireDefault(_normalizeKey);
  var _getCallback2 = _interopRequireDefault(_getCallback);
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {default: obj};
  }
  function _getKeyPrefix(options, defaultConfig) {
    var keyPrefix = options.name + '/';
    if (options.storeName !== defaultConfig.storeName) {
      keyPrefix += options.storeName + '/';
    }
    return keyPrefix;
  }
  function checkIfLocalStorageThrows() {
    var localStorageTestKey = '_localforage_support_test';
    try {
      localStorage.setItem(localStorageTestKey, true);
      localStorage.removeItem(localStorageTestKey);
      return false;
    } catch (e) {
      return true;
    }
  }
  function _isLocalStorageUsable() {
    return !checkIfLocalStorageThrows() || localStorage.length > 0;
  }
  function _initStorage(options) {
    var self = this;
    var dbInfo = {};
    if (options) {
      for (var i in options) {
        dbInfo[i] = options[i];
      }
    }
    dbInfo.keyPrefix = _getKeyPrefix(options, self._defaultConfig);
    if (!_isLocalStorageUsable()) {
      return _promise2.default.reject();
    }
    self._dbInfo = dbInfo;
    dbInfo.serializer = _serializer2.default;
    return _promise2.default.resolve();
  }
  function clear(callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var keyPrefix = self._dbInfo.keyPrefix;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key.indexOf(keyPrefix) === 0) {
          localStorage.removeItem(key);
        }
      }
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function getItem(key, callback) {
    var self = this;
    key = (0, _normalizeKey2.default)(key);
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var result = localStorage.getItem(dbInfo.keyPrefix + key);
      if (result) {
        result = dbInfo.serializer.deserialize(result);
      }
      return result;
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function iterate(iterator, callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var keyPrefix = dbInfo.keyPrefix;
      var keyPrefixLength = keyPrefix.length;
      var length = localStorage.length;
      var iterationNumber = 1;
      for (var i = 0; i < length; i++) {
        var key = localStorage.key(i);
        if (key.indexOf(keyPrefix) !== 0) {
          continue;
        }
        var value = localStorage.getItem(key);
        if (value) {
          value = dbInfo.serializer.deserialize(value);
        }
        value = iterator(value, key.substring(keyPrefixLength), iterationNumber++);
        if (value !== void 0) {
          return value;
        }
      }
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function key(n, callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var result;
      try {
        result = localStorage.key(n);
      } catch (error) {
        result = null;
      }
      if (result) {
        result = result.substring(dbInfo.keyPrefix.length);
      }
      return result;
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function keys(callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var length = localStorage.length;
      var keys = [];
      for (var i = 0; i < length; i++) {
        var itemKey = localStorage.key(i);
        if (itemKey.indexOf(dbInfo.keyPrefix) === 0) {
          keys.push(itemKey.substring(dbInfo.keyPrefix.length));
        }
      }
      return keys;
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function length(callback) {
    var self = this;
    var promise = self.keys().then(function(keys) {
      return keys.length;
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function removeItem(key, callback) {
    var self = this;
    key = (0, _normalizeKey2.default)(key);
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      localStorage.removeItem(dbInfo.keyPrefix + key);
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function setItem(key, value, callback) {
    var self = this;
    key = (0, _normalizeKey2.default)(key);
    var promise = self.ready().then(function() {
      if (value === undefined) {
        value = null;
      }
      var originalValue = value;
      return new _promise2.default(function(resolve, reject) {
        var dbInfo = self._dbInfo;
        dbInfo.serializer.serialize(value, function(value, error) {
          if (error) {
            reject(error);
          } else {
            try {
              localStorage.setItem(dbInfo.keyPrefix + key, value);
              resolve(originalValue);
            } catch (e) {
              if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                reject(e);
              }
              reject(e);
            }
          }
        });
      });
    });
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  function dropInstance(options, callback) {
    callback = _getCallback2.default.apply(this, arguments);
    options = typeof options !== 'function' && options || {};
    if (!options.name) {
      var currentConfig = this.config();
      options.name = options.name || currentConfig.name;
      options.storeName = options.storeName || currentConfig.storeName;
    }
    var self = this;
    var promise;
    if (!options.name) {
      promise = _promise2.default.reject('Invalid arguments');
    } else {
      promise = new _promise2.default(function(resolve) {
        if (!options.storeName) {
          resolve(options.name + '/');
        } else {
          resolve(_getKeyPrefix(options, self._defaultConfig));
        }
      }).then(function(keyPrefix) {
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var key = localStorage.key(i);
          if (key.indexOf(keyPrefix) === 0) {
            localStorage.removeItem(key);
          }
        }
      });
    }
    (0, _executeCallback2.default)(promise, callback);
    return promise;
  }
  var localStorageWrapper = {
    _driver: 'localStorageWrapper',
    _initStorage: _initStorage,
    _support: (0, _isLocalStorageValid2.default)(),
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
  exports.default = localStorageWrapper;
  module.exports = exports['default'];
});
