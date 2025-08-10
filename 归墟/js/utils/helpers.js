/**
 * 归墟 - 通用辅助函数
 * 挂载到 window.GuixuHelpers
 */
(function (global) {
  'use strict';

  const Constants = global.GuixuConstants;
  if (!Constants) {
    console.error('[归墟] Helpers 模块无法初始化：缺少核心依赖（Constants）。');
    return;
  }

  const Helpers = {
    /**
     * 安全地从嵌套对象中获取值。
     * @param {object} obj - 目标对象.
     * @param {string|string[]} path - 访问路径.
     * @param {*} [defaultValue='N/A'] - 未找到时的默认值.
     * @returns {*} 获取到的值或默认值.
     */
    SafeGetValue(obj, path, defaultValue = 'N/A') {
      let keys = Array.isArray(path) ? path : path.split('.');
      let current = obj;
      for (let i = 0; i < keys.length; i++) {
        if (
          current === undefined ||
          current === null ||
          typeof current !== 'object' ||
          !current.hasOwnProperty(keys[i])
        ) {
          return defaultValue;
        }
        current = current[keys[i]];
      }
      if (current === undefined || current === null) {
        return defaultValue;
      }
      if (Array.isArray(current)) {
        if (current.length > 0) {
          const actualValue = current[0];
          if (typeof actualValue === 'boolean') return actualValue;
          return String(actualValue);
        } else {
          return defaultValue;
        }
      }
      if (typeof current === 'boolean') return current;
      return String(current);
    },

    /**
     * 根据品阶获取对应的CSS样式字符串。
     * @param {string} tier - 品阶名称.
     * @returns {string} CSS样式.
     */
    getTierStyle(tier) {
      const animatedStyle = 'background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: god-tier-animation 3s linear infinite; font-weight: bold;';
      const styles = {
        练气: 'color: #FFFFFF;',
        筑基: 'color: #66CDAA;',
        金丹: 'color: #FFD700;',
        元婴: `background: linear-gradient(90deg, #DA70D6, #BA55D3, #9932CC, #BA55D3, #DA70D6); ${animatedStyle}`,
        化神: `background: linear-gradient(90deg, #DC143C, #FF4500, #B22222, #FF4500, #DC143C); ${animatedStyle}`,
        合体: `background: linear-gradient(90deg, #C71585, #FF1493, #DB7093, #FF1493, #C71585); ${animatedStyle}`,
        飞升: `background: linear-gradient(90deg, #FF416C, #FF4B2B, #FF6B6B, #FF4B2B, #FF416C); ${animatedStyle}`,
        神桥: `background: linear-gradient(90deg, #cccccc, #ffffff, #bbbbbb, #ffffff, #cccccc); ${animatedStyle}`,
      };
      const baseStyle = 'font-style: italic;';
      return (styles[tier] || 'color: #e0dcd1;') + baseStyle;
    },

    /**
     * 获取品阶的排序值。
     * @param {string} tier - 品阶名称.
     * @returns {number} 排序值.
     */
    getTierOrder(tier) {
      return Constants.TIERS[tier] || 0;
    },

    /**
     * 根据品阶对物品数组进行排序。
     * @param {object[]} items - 物品数组.
     * @param {function} getTierFn - 从物品对象中获取品阶的函数.
     * @returns {object[]} 排序后的新数组.
     */
    sortByTier(items, getTierFn) {
      if (!Array.isArray(items)) return items;
      return [...items].sort((a, b) => {
        const tierA = getTierFn(a);
        const tierB = getTierFn(b);
        const orderA = this.getTierOrder(tierA);
        const orderB = this.getTierOrder(tierB);
        if (orderA === orderB) return 0;
        return orderB - orderA;
      });
    },

    /**
     * 显示一个临时消息弹窗。
     * @param {string} message - 要显示的消息.
     * @param {number} [duration=2000] - 显示时长（毫秒）.
     */
    showTemporaryMessage(message, duration = 2000) {
      const { $, h } = global.GuixuDOM;
      const existingMsg = $('.temp-message-popup');
      if (existingMsg) existingMsg.remove();

      const msgElement = h('div', {
        className: 'temp-message-popup',
        textContent: message,
        style: `
          position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
          background: rgba(45, 27, 61, 0.9); color: #c9aa71; padding: 10px 20px;
          border-radius: 5px; z-index: 2000; font-size: 14px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5); text-align: center;
          transition: opacity 0.5s ease-out;
        `
      });
      
      const container = $('.guixu-root-container');
      if (container) {
        container.appendChild(msgElement);
      }

      setTimeout(() => {
        msgElement.style.opacity = '0';
        setTimeout(() => msgElement.remove(), 500);
      }, duration - 500);
    },
  };

  global.GuixuHelpers = Object.freeze(Helpers);

})(window);
