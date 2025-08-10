/**
 * 归墟 - DOM 操作工具集
 * 提供创建、查询和操作DOM元素的辅助函数。
 * 挂载到 window.GuixuDOM
 */
(function (global) {
  'use strict';

  /**
   * 创建一个带有可选属性、子元素和事件监听器的HTML元素。
   * @param {string} tag - HTML标签名 (例如, 'div', 'button').
   * @param {object} [options] - 配置对象.
   * @param {string} [options.id] - 元素的ID.
   * @param {string[]} [options.classNames] - 包含CSS类名的数组.
   * @param {object} [options.attributes] - 键值对形式的HTML属性 (例如, { 'data-id': '123' }).
   * @param {string} [options.text] - 元素的文本内容.
   * @param {string} [options.html] - 元素的innerHTML内容.
   * @param {HTMLElement[]} [options.children] - 子元素数组.
   * @param {object} [options.events] - 键值对形式的事件监听器 (例如, { click: (e) => console.log(e) }).
   * @returns {HTMLElement} 创建的HTML元素.
   */
  function h(tag, options = {}) {
    const el = document.createElement(tag);

    if (options.id) el.id = options.id;
    if (options.classNames) el.classList.add(...options.classNames);
    if (options.attributes) {
      for (const key in options.attributes) {
        el.setAttribute(key, options.attributes[key]);
      }
    }
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    if (options.children) {
      options.children.forEach(child => {
        if (child) el.appendChild(child);
      });
    }
    if (options.events) {
      for (const eventName in options.events) {
        el.addEventListener(eventName, options.events[eventName]);
      }
    }
    return el;
  }

  /**
   * 查询单个DOM元素，类似于 `document.querySelector`.
   * @param {string} selector - CSS选择器.
   * @param {HTMLElement|Document} [parent=document] - 在哪个父元素下查询.
   * @returns {HTMLElement|null} 找到的第一个元素或null.
   */
  function $(selector, parent = document) {
    return parent.querySelector(selector);
  }

  /**
   * 查询所有匹配的DOM元素，类似于 `document.querySelectorAll`.
   * @param {string} selector - CSS选择器.
   * @param {HTMLElement|Document} [parent=document] - 在哪个父元素下查询.
   * @returns {NodeListOf<HTMLElement>} 包含所有找到的元素的NodeList.
   */
  function $$(selector, parent = document) {
    return parent.querySelectorAll(selector);
  }

  /**
   * 移除一个元素的所有子节点。
   * @param {HTMLElement} el - 要清空子节点的父元素.
   */
  function empty(el) {
    if (el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }
  }

  const api = { h, $, $$, empty };
  try { Object.freeze(api); } catch (e) {}

  global.GuixuDOM = api;

})(window);
