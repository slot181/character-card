/* js/components/settings.js */
/* 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享 */
(function (window) {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  const DEFAULTS = Object.freeze({
    backgroundUrl: '',
    bgMaskOpacity: 0.7,
    storyFontSize: 14,
  });

  function clamp(num, min, max) {
    const n = Number(num);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  const SettingsComponent = {
    _bound: false,

    show() {
      const overlay = $('#settings-modal');
      if (!overlay) return;
      this.ensureBound();
      this.loadFromState();
      overlay.style.display = 'flex';
    },

    hide() {
      const overlay = $('#settings-modal');
      if (overlay) overlay.style.display = 'none';
    },

    ensureBound() {
      if (this._bound) return;
      this._bound = true;

      const overlay = $('#settings-modal');
      const bgUrlInput = $('#pref-bg-url');
      const bgUploadBtn = $('#pref-bg-upload');
      const bgClearBtn = $('#pref-bg-clear');
      const maskRange = $('#pref-bg-mask');
      const maskVal = $('#pref-bg-mask-val');
      const fontRange = $('#pref-story-font-size');
      const fontVal = $('#pref-story-font-size-val');
      const btnReset = $('#pref-reset-defaults');
      const btnApply = $('#pref-apply');
      const btnSaveClose = $('#pref-save-close');

      // 实时预览：输入时仅应用到DOM变量，不保存
      bgUrlInput?.addEventListener('input', () => {
        this.applyPreview(this.readValues());
      });

      maskRange?.addEventListener('input', () => {
        const v = clamp(maskRange.value, 0, 0.8);
        maskVal.textContent = v.toFixed(2);
        this.applyPreview(this.readValues());
      });

      fontRange?.addEventListener('input', () => {
        const v = clamp(fontRange.value, 12, 20);
        fontVal.textContent = `${Math.round(v)}px`;
        this.applyPreview(this.readValues());
      });

      // 本地上传 -> 转 base64 存到 URL 输入框
      bgUploadBtn?.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            bgUrlInput.value = String(reader.result || '');
            this.applyPreview(this.readValues());
          };
          reader.readAsDataURL(file);
        });
        document.body.appendChild(fileInput);
        fileInput.click();
        // 清理
        setTimeout(() => fileInput.remove(), 1000);
      });

      // 清除背景
      bgClearBtn?.addEventListener('click', () => {
        bgUrlInput.value = '';
        this.applyPreview(this.readValues());
      });

      // 恢复默认
      btnReset?.addEventListener('click', () => {
        this.syncUI(DEFAULTS);
        this.applyPreview(DEFAULTS);
      });

      // 应用（不保存，仅一次性应用）
      btnApply?.addEventListener('click', () => {
        const prefs = this.readValues();
        window.GuixuMain?.applyUserPreferences?.(prefs);
      });

      // 保存并关闭（写入状态 + 应用）
      btnSaveClose?.addEventListener('click', () => {
        const prefs = this.readValues();
        try {
          window.GuixuState?.update?.('userPreferences', prefs);
        } catch (e) {
          console.warn('[归墟][设置中心] 保存 userPreferences 失败:', e);
        }
        window.GuixuMain?.applyUserPreferences?.(prefs);
        this.hide();
      });

      // 关闭按钮由全局委托处理（main.js 中的 .modal-close-btn 委托），此处无需重复绑定
      // 点击遮罩空白关闭同样由全局委托处理
      overlay?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          btnSaveClose?.click();
        }
      });
    },

    loadFromState() {
      const state = window.GuixuState?.getState?.() || {};
      const prefs = Object.assign({}, DEFAULTS, state.userPreferences || {});
      this.syncUI(prefs);
      // 打开时不强制应用，因为主入口会在 init 时已应用一次；如需预览，用户可调整滑块/输入或点击“应用”
    },

    syncUI(prefs) {
      const bgUrlInput = $('#pref-bg-url');
      const maskRange = $('#pref-bg-mask');
      const maskVal = $('#pref-bg-mask-val');
      const fontRange = $('#pref-story-font-size');
      const fontVal = $('#pref-story-font-size-val');

      if (bgUrlInput) bgUrlInput.value = String(prefs.backgroundUrl || '');
      if (maskRange) maskRange.value = String(clamp(prefs.bgMaskOpacity, 0, 0.8));
      if (maskVal) maskVal.textContent = String(clamp(prefs.bgMaskOpacity, 0, 0.8).toFixed(2));
      if (fontRange) fontRange.value = String(clamp(prefs.storyFontSize, 12, 20));
      if (fontVal) fontVal.textContent = `${Math.round(clamp(prefs.storyFontSize, 12, 20))}px`;
    },

    readValues() {
      const bgUrlInput = $('#pref-bg-url');
      const maskRange = $('#pref-bg-mask');
      const fontRange = $('#pref-story-font-size');
      const backgroundUrl = (bgUrlInput?.value || '').trim();
      const bgMaskOpacity = clamp(maskRange?.value || DEFAULTS.bgMaskOpacity, 0, 0.8);
      const storyFontSize = Math.round(clamp(fontRange?.value || DEFAULTS.storyFontSize, 12, 20));
      return { backgroundUrl, bgMaskOpacity, storyFontSize };
    },

    applyPreview(prefs) {
      // 仅作为预览，不写入状态
      window.GuixuMain?.applyUserPreferences?.(prefs);
    },
  };

  window.SettingsComponent = SettingsComponent;
})(window);
