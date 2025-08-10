/**
 * 归墟 - 常量定义
 * 挂载到 window.GuixuConstants，供其他脚本使用（非模块环境兼容）
 * 注意：仅提供常量，不做任何副作用。
 */
(function (global) {
  'use strict';

  var GuixuConstants = {
    APP_NAME: '归墟',

    // 本地存储键名统一管理（阶段0）
    STORAGE_KEYS: Object.freeze({
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
    }),

    // 世界书名称与标准条目名（避免魔法字符串）
    LOREBOOK: Object.freeze({
      NAME: '1归墟',
      ENTRIES: Object.freeze({
        JOURNEY: '本世历程',
        PAST_LIVES: '往世涟漪',
        NOVEL_MODE: '小说模式',
        CURRENT_SCENE: '当前场景'
      })
    }),

    // 常用选择器（供 UI 组件集中使用，阶段后续使用）
    SELECTORS: Object.freeze({
      ROOT: '.guixu-root-container',
      VIEW_TOGGLE_BTN: '#view-toggle-btn',
      WAITING_POPUP_ID: 'waiting-popup'
    }),

    // 等待提示文案
    WAITING_MESSAGES: Object.freeze([
      '呜呜呜呜伟大的梦星大人啊，请给你虔诚的信徒{{user}}回复吧......',
      '梦星大人，我们敬爱你口牙！！请给我回复吧！！',
      '梦星大人正在回应你的请求，七个工作日给你回复',
      '正在向伟大梦星祈祷......呜呜呜你快一点好不好'
    ])
  };

  try {
    Object.freeze(GuixuConstants);
  } catch (e) {}

  global.GuixuConstants = GuixuConstants;
})(window);
