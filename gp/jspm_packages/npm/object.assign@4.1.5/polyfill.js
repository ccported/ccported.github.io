/* */ 
'use strict';
var implementation = require('./implementation');
var lacksProperEnumerationOrder = function() {
  if (!Object.assign) {
    return false;
  }
  var str = 'abcdefghijklmnopqrst';
  var letters = str.split('');
  var map = {};
  for (var i = 0; i < letters.length; ++i) {
    map[letters[i]] = letters[i];
  }
  var obj = Object.assign({}, map);
  var actual = '';
  for (var k in obj) {
    actual += k;
  }
  return str !== actual;
};
var assignHasPendingExceptions = function() {
  if (!Object.assign || !Object.preventExtensions) {
    return false;
  }
  var thrower = Object.preventExtensions({1: 2});
  try {
    Object.assign(thrower, 'xy');
  } catch (e) {
    return thrower[1] === 'y';
  }
  return false;
};
module.exports = function getPolyfill() {
  if (!Object.assign) {
    return implementation;
  }
  if (lacksProperEnumerationOrder()) {
    return implementation;
  }
  if (assignHasPendingExceptions()) {
    return implementation;
  }
  return Object.assign;
};
