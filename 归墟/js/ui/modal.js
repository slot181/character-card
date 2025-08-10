/**
 * 归墟 - 基础模态框组件
 * 提供一个可复用的模态框结构，包含头部、内容和关闭逻辑。
 * 挂载到 window.GuixuModal
 */
(function (global) {
  'use strict';

  var DOM = global.GuixuDOM;
  if (!DOM) {
    console.error('[归墟] Modal 组件无法初始化：缺少核心依赖（DOM）。');
    return;
  }
  var h = DOM.h;

  class Modal {
    constructor(id, title, options = {}) {
      this.id = id;
      this.title = title;
      this.options = options;
      this.el = this._create();
      this._bindEvents();
    }

    _create() {
      return h('div', {
        id: this.id,
        classNames: ['modal-overlay'],
        children: [
          h('div', {
            classNames: ['modal-content'],
            children: [
              h('div', {
                classNames: ['modal-header'],
                children: [
                  h('h2', { classNames: ['modal-title'], text: this.title }),
                  h('button', { classNames: ['modal-close-btn'], html: '&times;' })
                ]
              }),
              h('div', { classNames: ['modal-body'] }),
              ...(this.options.footer ? [h('div', { classNames: ['modal-footer'], children: this.options.footer })] : [])
            ]
          })
        ]
      });
    }

    _bindEvents() {
      const closeBtn = DOM.$('.modal-close-btn', this.el);
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hide());
      }
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el) {
          this.hide();
        }
      });
    }

    show() {
      document.body.appendChild(this.el);
      this.el.style.display = 'flex';
      if (typeof this.options.onShow === 'function') {
        this.options.onShow(this);
      }
    }

    hide() {
      this.el.style.display = 'none';
      if (this.el.parentNode === document.body) {
        document.body.removeChild(this.el);
      }
      if (typeof this.options.onHide === 'function') {
        this.options.onHide(this);
      }
    }

    getBody() {
      return DOM.$('.modal-body', this.el);
    }

    updateTitle(newTitle) {
      const titleEl = DOM.$('.modal-title', this.el);
      if (titleEl) {
        titleEl.textContent = newTitle;
      }
    }

    renderBody(content) {
      const body = this.getBody();
      DOM.empty(body);
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        body.appendChild(content);
      }
    }
  }

  global.GuixuModal = Modal;

})(window);
