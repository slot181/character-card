/**
 * 归墟 - 日志工具
 * 提供统一的日志接口，便于后续替换实现或加前缀过滤。
 * 挂载到 window.GuixuLog
 */
(function (global) {
  'use strict';

  var PREFIX = '[归墟]';

  function safeConsole(method) {
    try {
      return console && typeof console[method] === 'function' ? console[method].bind(console) : function () {};
    } catch (e) {
      return function () {};
    }
  }

  var log = safeConsole('log');
  var info = safeConsole('info');
  var warn = safeConsole('warn');
  var error = safeConsole('error');
  var debug = safeConsole('debug');

  var GuixuLog = {
    prefix: PREFIX,
    log: function () {
      try { log.apply(null, [PREFIX].concat([].slice.call(arguments))); } catch (e) {}
    },
    info: function () {
      try { info.apply(null, [PREFIX].concat([].slice.call(arguments))); } catch (e) {}
    },
    warn: function () {
      try { warn.apply(null, [PREFIX].concat([].slice.call(arguments))); } catch (e) {}
    },
    error: function () {
      try { error.apply(null, [PREFIX].concat([].slice.call(arguments))); } catch (e) {}
    },
    debug: function () {
      try { debug.apply(null, [PREFIX].concat([].slice.call(arguments))); } catch (e) {}
    },
    withScope: function (scope) {
      var scoped = '[' + (scope || 'scope') + ']';
      return {
        log: function () { try { log.apply(null, [PREFIX, scoped].concat([].slice.call(arguments))); } catch (e) {} },
        info: function () { try { info.apply(null, [PREFIX, scoped].concat([].slice.call(arguments))); } catch (e) {} },
        warn: function () { try { warn.apply(null, [PREFIX, scoped].concat([].slice.call(arguments))); } catch (e) {} },
        error: function () { try { error.apply(null, [PREFIX, scoped].concat([].slice.call(arguments))); } catch (e) {} },
        debug: function () { try { debug.apply(null, [PREFIX, scoped].concat([].slice.call(arguments))); } catch (e) {} },
      };
    }
  };

  try { Object.freeze(GuixuLog); } catch (e) {}

  global.GuixuLog = GuixuLog;
})(window);
