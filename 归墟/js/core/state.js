/**
 * 归墟 - 全局状态管理
 * 集中管理应用状态，提供订阅/发布与与本地存储的联动。
 * 挂载到 window.GuixuState
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('State') : console;
  var Storage = global.GuixuStorage;

  // 简易事件总线
  var listeners = Object.create(null);
  function on(event, fn) {
    if (!event || typeof fn !== 'function') return;
    if (!listeners[event]) listeners[event] = [];
    if (listeners[event].indexOf(fn) === -1) listeners[event].push(fn);
  }
  function off(event, fn) {
    if (!event || !listeners[event]) return;
    if (!fn) { listeners[event] = []; return; }
    var i = listeners[event].indexOf(fn);
    if (i !== -1) listeners[event].splice(i, 1);
  }
  function emit(event, payload) {
    if (!event || !listeners[event]) return;
    try {
      listeners[event].forEach(function (fn) { try { fn(payload); } catch (e) { Log && Log.error('listener error', e); } });
    } catch (e) { Log && Log.error('emit error', e); }
  }

  // 初始状态从 Storage 加载（仅阶段1所需的通用配置）
  var state = {
    // UI/视图
    viewMode: (Storage && Storage.getViewMode()) || 'desktop',
    // 自动化与开关
    isAutoWriteEnabled: Storage ? Storage.getAutoWriteEnabled() : true,
    isNovelModeEnabled: Storage ? Storage.getNovelModeEnabled() : false,
    isAutoToggleLorebookEnabled: Storage ? Storage.getAutoToggleLorebookEnabled() : false,
    isAutoSaveEnabled: Storage ? Storage.getAutoSaveEnabled() : false,
    isAutoTrimEnabled: Storage ? Storage.getAutoTrimEnabled() : false,
    // 统一读写序号
    unifiedIndex: Storage ? Storage.getUnifiedIndex() : 1,
    // 装备/指令
    equippedItems: Storage ? Storage.getEquippedItems() : { wuqi: null, fangju: null, shipin: null, fabao1: null, zhuxiuGongfa: null, fuxiuXinfa: null },
    pendingActions: Storage ? Storage.getPendingActions() : [],
    // 运行态
    currentMvuState: null,
    calculatedMaxAttributes: {},
    // 计时器 id（集中管理）
    intervals: {
      autoWrite: null,
      novelMode: null,
      autoToggle: null,
      autoSave: null
    }
  };

  function get() {
    return state;
  }

  function setPartial(patch, options) {
    options = options || {};
    if (!patch || typeof patch !== 'object') return;
    var changed = {};
    Object.keys(patch).forEach(function (k) {
      if (state[k] !== patch[k]) {
        state[k] = patch[k];
        changed[k] = patch[k];
      }
    });

    // 与存储同步（仅对需要持久化的键）
    if (!options.skipPersist && Storage) {
      if ('viewMode' in changed) Storage.setViewMode(changed.viewMode);
      if ('isAutoWriteEnabled' in changed) Storage.setAutoWriteEnabled(changed.isAutoWriteEnabled);
      if ('isNovelModeEnabled' in changed) Storage.setNovelModeEnabled(changed.isNovelModeEnabled);
      if ('isAutoToggleLorebookEnabled' in changed) Storage.setAutoToggleLorebookEnabled(changed.isAutoToggleLorebookEnabled);
      if ('isAutoSaveEnabled' in changed) Storage.setAutoSaveEnabled(changed.isAutoSaveEnabled);
      if ('isAutoTrimEnabled' in changed) Storage.setAutoTrimEnabled(changed.isAutoTrimEnabled);
      if ('unifiedIndex' in changed) Storage.setUnifiedIndex(changed.unifiedIndex);
      if ('equippedItems' in changed) Storage.setEquippedItems(changed.equippedItems);
      if ('pendingActions' in changed) Storage.setPendingActions(changed.pendingActions);
    }

    if (Object.keys(changed).length) {
      emit('change', { changed: changed, full: state });
    }
  }

  // 语义化 setter
  var setters = {
    setViewMode: function (mode) { setPartial({ viewMode: mode === 'mobile' ? 'mobile' : 'desktop' }); },
    setAutoWriteEnabled: function (b) { setPartial({ isAutoWriteEnabled: !!b }); },
    setNovelModeEnabled: function (b) { setPartial({ isNovelModeEnabled: !!b }); },
    setAutoToggleLorebookEnabled: function (b) { setPartial({ isAutoToggleLorebookEnabled: !!b }); },
    setAutoSaveEnabled: function (b) { setPartial({ isAutoSaveEnabled: !!b }); },
    setAutoTrimEnabled: function (b) { setPartial({ isAutoTrimEnabled: !!b }); },
    setUnifiedIndex: function (n) {
      n = parseInt(n, 10);
      if (isNaN(n) || n <= 0) n = 1;
      setPartial({ unifiedIndex: n });
    },
    setEquippedItems: function (obj) { setPartial({ equippedItems: obj || {} }); },
    setPendingActions: function (arr) { setPartial({ pendingActions: Array.isArray(arr) ? arr : [] }); },
    setCurrentMvuState: function (m) { setPartial({ currentMvuState: m }, { skipPersist: true }); },
    setCalculatedMaxAttributes: function (m) { setPartial({ calculatedMaxAttributes: m || {} }, { skipPersist: true }); },

    // interval 管理（不持久化）
    setIntervalId: function (key, id) {
      if (!key || !state.intervals) return;
      var patch = { intervals: Object.assign({}, state.intervals) };
      patch.intervals[key] = id || null;
      setPartial(patch, { skipPersist: true });
    }
  };

  var GuixuState = {
    get: get,
    set: setPartial,
    on: on,
    off: off,
    emit: emit,
    // 语义化 setter 导出
    setViewMode: setters.setViewMode,
    setAutoWriteEnabled: setters.setAutoWriteEnabled,
    setNovelModeEnabled: setters.setNovelModeEnabled,
    setAutoToggleLorebookEnabled: setters.setAutoToggleLorebookEnabled,
    setAutoSaveEnabled: setters.setAutoSaveEnabled,
    setAutoTrimEnabled: setters.setAutoTrimEnabled,
    setUnifiedIndex: setters.setUnifiedIndex,
    setEquippedItems: setters.setEquippedItems,
    setPendingActions: setters.setPendingActions,
    setCurrentMvuState: setters.setCurrentMvuState,
    setCalculatedMaxAttributes: setters.setCalculatedMaxAttributes,
    setIntervalId: setters.setIntervalId
  };

  try { Object.freeze(GuixuState); } catch (e) {}

  global.GuixuState = GuixuState;
})(window);
