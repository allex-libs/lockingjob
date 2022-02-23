function createLib (execlib) {
  'use strict';
  var ret = {};
  require('./creator')(execlib, ret);
  return ret;
}
module.exports = createLib;
