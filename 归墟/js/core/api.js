/**
 * 归墟 - 外部 API 统一封装
 * 将 SillyTavern / TavernHelper / 事件系统 封装为稳定接口
 * 挂载到 window.GuixuAPI
 *
 * 设计要点：
 * - 所有方法尽量不抛异常，内部捕获并通过日志输出，返回安全的默认值
 * - 在环境未就绪时，给出友好提示，避免整段脚本崩溃
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('API') : console;

  function _exists(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function _safe(fn, fallback) {
    try {
      var r = fn();
      return r === undefined ? fallback : r;
    } catch (e) {
      try { Log.error('API call failed:', e && e.message ? e.message : e); } catch (_) {}
      return fallback;
    }
  }

  function _env() {
    return {
      TavernHelper: global.TavernHelper,
      eventOn: global.eventOn,
      eventEmit: global.eventEmit,
      tavern_events: global.tavern_events,
      getChatMessages: global.getChatMessages,
      getCurrentMessageId: global.getCurrentMessageId,
      _: global._
    };
  }

  function isEnvironmentReady() {
    var env = _env();
    return !!(env.TavernHelper && env.eventOn && env.tavern_events && env.getChatMessages && env.getCurrentMessageId && env._);
  }

  var GuixuAPI = {
    isEnvironmentReady: isEnvironmentReady,

    // 事件相关
    on: function (eventType, listener) {
      return _safe(function () {
        if (!_env().eventOn) return;
        _env().eventOn(eventType, listener);
      });
    },

    emit: function (eventType) {
      var args = Array.prototype.slice.call(arguments, 1);
      return _safe(function () {
        if (!_env().eventEmit) return;
        return _env().eventEmit.apply(null, [eventType].concat(args));
      });
    },

    tavernEvents: function () {
      return _safe(function () {
        return _env().tavern_events || {};
      }, {});
    },

    // 聊天消息/上下文
    getCurrentMessageId: function () {
      return _safe(function () {
        if (!_env().getCurrentMessageId) return -1;
        return _env().getCurrentMessageId();
      }, -1);
    },

    getChatMessages: function (range, option) {
      return _safe(function () {
        if (!_env().getChatMessages) return [];
        return _env().getChatMessages(range, option) || [];
      }, []);
    },

    setChatMessages: function (chatMessages, option) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.setChatMessages) return;
        return _env().TavernHelper.setChatMessages(chatMessages, option || { refresh: 'none' });
      });
    },

    // 生成（调用模型）
    generate: function (config) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.generate) return '';
        return _env().TavernHelper.generate(config || {});
      }, '');
    },

    // 世界书
    getLorebookEntries: function (bookName) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.getLorebookEntries) return [];
        return _env().TavernHelper.getLorebookEntries(bookName);
      }, []);
    },

    setLorebookEntries: function (bookName, entries) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.setLorebookEntries) return [];
        return _env().TavernHelper.setLorebookEntries(bookName, entries);
      }, []);
    },

    createLorebookEntries: function (bookName, entries) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.createLorebookEntries) return { entries: [], new_uids: [] };
        return _env().TavernHelper.createLorebookEntries(bookName, entries);
      }, { entries: [], new_uids: [] });
    },

    deleteLorebookEntries: function (bookName, uids) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.deleteLorebookEntries) return { entries: [], delete_occurred: false };
        return _env().TavernHelper.deleteLorebookEntries(bookName, uids);
      }, { entries: [], delete_occurred: false });
    },

    // 变量/MVU相关（若后续需要更多可在此集中）
    getVariables: function (option) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.getVariables) return {};
        return _env().TavernHelper.getVariables(option || {});
      }, {});
    },

    updateVariablesWith: function (updater, option) {
      return _safe(function () {
        if (!_exists(_env(), 'TavernHelper') || !_env().TavernHelper.updateVariablesWith) return {};
        return _env().TavernHelper.updateVariablesWith(updater, option || {});
      }, {});
    }
  };

  try { Object.freeze(GuixuAPI); } catch (e) {}

  global.GuixuAPI = GuixuAPI;
})(window);
