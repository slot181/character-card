/**
 * 归墟 - 安全取值工具
 * SafeGetValue(obj, path, defaultValue)
 * 支持点路径与数组索引（例如：'当前境界.0'）
 * - 若命中值为数组：若非空返回第一个元素（贴合现有MVU数据结构习惯）；否则返回默认值
 * - 若命中值为布尔或数字：保持原样
 * - 其他类型：转为字符串返回
 * 挂载到 window.GuixuSafeGet
 */
(function (global) {
  'use strict';

  function SafeGetValue(obj, path, defaultValue) {
    try {
      if (obj === undefined || obj === null) return defaultValue;
      var keys = Array.isArray(path) ? path : String(path).split('.');
      var cur = obj;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (cur === undefined || cur === null) return defaultValue;
        if (typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, k)) {
          return defaultValue;
        }
        cur = cur[k];
      }
      if (cur === undefined || cur === null) return defaultValue;
      if (Array.isArray(cur)) {
        if (cur.length > 0) {
          var v = cur[0];
          if (typeof v === 'boolean' || typeof v === 'number') return v;
          return String(v);
        }
        return defaultValue;
      }
      if (typeof cur === 'boolean' || typeof cur === 'number') return cur;
      if (typeof cur === 'string') return cur;
      try { return JSON.stringify(cur); } catch (e) { return String(cur); }
    } catch (e) {
      return defaultValue;
    }
  }

  var api = { SafeGetValue: SafeGetValue };
  try { Object.freeze(api); } catch (e) {}

  global.GuixuSafeGet = api;
})(window);
