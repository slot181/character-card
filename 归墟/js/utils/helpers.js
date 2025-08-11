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
     * 仅返回颜色样式（用于物品/天赋/灵根），未匹配到则退回默认颜色。
     */
    getTierColorStyle(tier) {
      const colorMap = {
        凡品: 'color: #9e9e9e;',
        下品: 'color: #8bc34a;',
        中品: 'color: #4caf50;',
        上品: 'color: #00bcd4;',
        极品: 'color: #2196f3;',
        天品: 'color: #9c27b0;',
        仙品: 'color: #ffd700;',
        神品: 'background: linear-gradient(90deg, #ff6b6b, #ffd93d); -webkit-background-clip: text; background-clip: text; color: transparent;'
      };
      // 若物品品阶未匹配，则尝试按境界走 getTierStyle，然后回退默认
      return colorMap[tier] || this.getTierStyle(tier) || 'color: #e0dcd1;';
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
      // 移除已存在的消息
      const existingMsg = document.querySelector('.temp-message-popup');
      if (existingMsg) existingMsg.remove();

      // 创建消息元素
      const msgElement = document.createElement('div');
      msgElement.className = 'temp-message-popup';
      msgElement.textContent = message;
      msgElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(26, 26, 46, 0.95);
        color: #c9aa71;
        border: 1px solid #c9aa71;
        border-radius: 8px;
        padding: 15px 25px;
        z-index: 10001;
        font-size: 14px;
        font-weight: 600;
        font-family: "Microsoft YaHei", sans-serif;
        box-shadow: 0 0 20px rgba(201, 170, 113, 0.3);
        text-align: center;
        pointer-events: none;
        white-space: nowrap;
      `;
      
      // 添加到归墟容器或body
      const container = document.querySelector('.guixu-root-container') || document.body;
      container.appendChild(msgElement);

      // 自动移除
      setTimeout(() => {
        if (msgElement && msgElement.parentNode) {
          msgElement.remove();
        }
      }, duration);
    },

    /**
     * 解析“本世历程”或类似格式的字符串为事件对象数组。
     * @param {string} contentString - 包含事件的字符串。
     * @returns {object[]} 解析后的事件对象数组。
     */
    parseJourneyEntry(contentString) {
      if (!contentString?.trim()) return [];
      
      const eventBlocks = contentString.trim().split(/\n\n+/);
      
      return eventBlocks.map(block => {
          const event = {};
          const lines = block.trim().split('\n');
          let currentKey = null;

          lines.forEach(line => {
              const separatorIndex = line.indexOf('|');
              if (separatorIndex !== -1) {
                  const key = line.substring(0, separatorIndex).trim();
                  const value = line.substring(separatorIndex + 1);
                  if (key) {
                      event[key] = value.trim();
                      currentKey = key;
                  }
              } else if (currentKey && event[currentKey] !== undefined) {
                  event[currentKey] += '\n' + line;
              }
          });
          return event;
      }).filter(event => event && Object.keys(event).length > 0 && (event['序号'] || event['第x世']));
    },
    /**
     * 提取文本中指定标签的最后一次内容。
     * 例如：extractLastTagContent('gametxt', aiText)
     */
    extractLastTagContent(tagName, text, ignoreCase = false) {
      try {
        if (!tagName || !text) return null;
        const flags = ignoreCase ? 'gi' : 'g';
        const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, flags);
        let match;
        let lastContent = null;
        while ((match = pattern.exec(text)) !== null) {
          lastContent = match[1];
        }
        return lastContent ? String(lastContent).trim() : null;
      } catch (e) {
        console.error('[归墟] extractLastTagContent 解析失败:', e);
        return null;
      }
    },

    /**
     * 本地兜底：从 AI 文本中解析 _.set('路径', 旧值, 新值); 并应用到旧的 MVU 状态，返回新的状态。
     * 注意：该函数仅作为 mag_invoke_mvu 失败时的降级方案，力求“不抛错、尽量更新”。
     */
    applyUpdateFallback(text, oldState) {
      try {
        if (!text || !oldState || typeof oldState !== 'object') return null;

        // 深拷贝，避免直接修改引用
        const newState = JSON.parse(JSON.stringify(oldState));
        if (!newState.stat_data || typeof newState.stat_data !== 'object') {
          newState.stat_data = {};
        }

        // 匹配所有 _.set('path', old, new);
        const regex = /_.set\s*\(\s*(['"])(.*?)\1\s*,\s*([\s\S]*?)\s*,\s*([\s\S]*?)\s*\)\s*;/g;
        let match;
        let applied = 0;

        const parseValue = (token) => {
          if (typeof token !== 'string') return token;
          const t = token.trim();
          // 字符串字面量
          const strMatch = t.match(/^(['"])([\s\S]*?)\1$/);
          if (strMatch) return strMatch[2];

          // 尝试 JSON.parse（可解析数字/对象/数组/布尔/null）
          try {
            return JSON.parse(t);
          } catch (_) {
            // 再尝试数字
            const num = Number(t);
            if (!Number.isNaN(num)) return num;
            // 兜底为原始字符串
            return t;
          }
        };

        const setByPath = (rootObj, path, value) => {
          const parts = String(path).split('.').filter(Boolean);
          let node = rootObj.stat_data;
          for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i];
            if (!node[key] || typeof node[key] !== 'object') {
              node[key] = {};
            }
            node = node[key];
          }
          const leaf = parts[parts.length - 1];

          const existing = node[leaf];
          if (Array.isArray(existing)) {
            const desc = existing.length > 1 ? existing[1] : undefined;
            node[leaf] = typeof desc !== 'undefined' ? [value, desc] : [value];
          } else {
            node[leaf] = [value];
          }
        };

        while ((match = regex.exec(text)) !== null) {
          const path = match[2];
          const newToken = match[4];
          const newValue = parseValue(newToken);
          try {
            setByPath(newState, path, newValue);
            applied++;
          } catch (e) {
            console.warn('[归墟] applyUpdateFallback 单条更新失败:', path, e);
          }
        }

        return applied > 0 ? newState : null;
      } catch (e) {
        console.error('[归墟] applyUpdateFallback 执行失败:', e);
        return null;
      }
    }
  };
  
  global.GuixuHelpers = Object.freeze(Helpers);

})(window);
