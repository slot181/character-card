/**
 * 归墟 - 本地存储封装
 * 统一 localStorage 读写，集中键名管理与默认值策略。
 * 挂载到 window.GuixuStorage
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('Storage') : console;
  var C = global.GuixuConstants;
  var KEYS = C && C.STORAGE_KEYS ? C.STORAGE_KEYS : {
    VIEW_MODE: 'guixu_view_mode',
    AUTO_WRITE_ENABLED: 'guixu_auto_write_enabled',
    NOVEL_MODE_ENABLED: 'guixu_novel_mode_enabled',
    EQUIPPED_ITEMS: 'guixu_equipped_items',
    PENDING_ACTIONS: 'guixu_pending_actions',
    UNIFIED_INDEX: 'guixu_unified_index',
    AUTO_TOGGLE_LOREBOOK_ENABLED: 'guixu_auto_toggle_enabled',
    AUTO_SAVE_ENABLED: 'guixu_auto_save_enabled',
    MULTI_SAVE_DATA: 'guixu_multi_save_data',
    AUTO_TRIM_ENABLED: 'guixu_auto_trim_enabled'
  };

  function safeParse(value, fallback) {
    if (value === undefined || value === null) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    // 尝试解析数字
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      var num = Number(value);
      if (!isNaN(num)) return num;
    }
    // 尝试 JSON
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try { return JSON.parse(value); } catch (e) { /* ignore */ }
    }
    return value;
  }

  var Storage = {
    keys: KEYS,

    getRaw: function (key) {
      try { return localStorage.getItem(key); } catch (e) { Log && Log.error('getRaw error', e); return null; }
    },

    setRaw: function (key, value) {
      try { localStorage.setItem(key, String(value)); } catch (e) { Log && Log.error('setRaw error', e); }
    },

    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) { Log && Log.error('remove error', e); }
    },

    get: function (key, defaultValue) {
      var raw = this.getRaw(key);
      if (raw === null || raw === undefined) return defaultValue;
      return safeParse(raw, defaultValue);
    },

    set: function (key, value) {
      try {
        if (typeof value === 'object') {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, String(value));
        }
      } catch (e) { Log && Log.error('set error', e); }
    },

    // 语义化便捷 API
    getViewMode: function () {
      return this.get(this.keys.VIEW_MODE, 'desktop'); // 默认桌面
    },
    setViewMode: function (mode) {
      this.set(this.keys.VIEW_MODE, mode === 'mobile' ? 'mobile' : 'desktop');
    },

    getAutoWriteEnabled: function () {
      // 默认开启
      var val = this.get(this.keys.AUTO_WRITE_ENABLED, null);
      return val === null ? true : !!val;
    },
    setAutoWriteEnabled: function (enabled) {
      this.set(this.keys.AUTO_WRITE_ENABLED, !!enabled);
    },

    getNovelModeEnabled: function () {
      // 默认关闭
      return !!this.get(this.keys.NOVEL_MODE_ENABLED, false);
    },
    setNovelModeEnabled: function (enabled) {
      this.set(this.keys.NOVEL_MODE_ENABLED, !!enabled);
    },

    getEquippedItems: function () {
      return this.get(this.keys.EQUIPPED_ITEMS, {
        wuqi: null, fangju: null, shipin: null, fabao1: null, zhuxiuGongfa: null, fuxiuXinfa: null
      }) || {};
    },
    setEquippedItems: function (obj) {
      this.set(this.keys.EQUIPPED_ITEMS, obj || {});
    },

    getPendingActions: function () {
      return this.get(this.keys.PENDING_ACTIONS, []) || [];
    },
    setPendingActions: function (arr) {
      this.set(this.keys.PENDING_ACTIONS, Array.isArray(arr) ? arr : []);
    },

    getUnifiedIndex: function () {
      var n = this.get(this.keys.UNIFIED_INDEX, 1);
      n = parseInt(n, 10);
      return isNaN(n) || n <= 0 ? 1 : n;
    },
    setUnifiedIndex: function (n) {
      n = parseInt(n, 10);
      if (isNaN(n) || n <= 0) n = 1;
      this.set(this.keys.UNIFIED_INDEX, n);
    },

    getAutoToggleLorebookEnabled: function () {
      return !!this.get(this.keys.AUTO_TOGGLE_LOREBOOK_ENABLED, false);
    },
    setAutoToggleLorebookEnabled: function (enabled) {
      this.set(this.keys.AUTO_TOGGLE_LOREBOOK_ENABLED, !!enabled);
    },

    getAutoSaveEnabled: function () {
      return !!this.get(this.keys.AUTO_SAVE_ENABLED, false);
    },
    setAutoSaveEnabled: function (enabled) {
      this.set(this.keys.AUTO_SAVE_ENABLED, !!enabled);
    },

    getMultiSaveData: function () {
      return this.get(this.keys.MULTI_SAVE_DATA, {}) || {};
    },
    setMultiSaveData: function (obj) {
      this.set(this.keys.MULTI_SAVE_DATA, obj || {});
    },

    getAutoTrimEnabled: function () {
      return !!this.get(this.keys.AUTO_TRIM_ENABLED, false);
    },
    setAutoTrimEnabled: function (enabled) {
      this.set(this.keys.AUTO_TRIM_ENABLED, !!enabled);
    }
  };

  try { Object.freeze(Storage); } catch (e) {}

  global.GuixuStorage = Storage;
})(window);
