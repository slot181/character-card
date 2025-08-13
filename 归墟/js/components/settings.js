/* js/components/settings.js */
/* 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享 */
(function (window) {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  const DEFAULTS = Object.freeze({
    backgroundUrl: '',
    bgMaskOpacity: 0.7,
    storyFontSize: 14,
    bgFitMode: 'cover',
  });

  function clamp(num, min, max) {
    const n = Number(num);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  const SettingsComponent = {
    _bound: false,
    _uploadedDataUrl: '',
    _uploadedFileName: '',
    _pendingDeleteBackground: false,

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
      const fitSelect = $('#pref-bg-fit-mode');

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

      // 背景适配方式变化 -> 预览
      fitSelect?.addEventListener('change', () => {
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
          try { window.GuixuHelpers?.showTemporaryMessage?.('正在读取本地图片...'); } catch (_) {}
          const reader = new FileReader();
          reader.onload = () => {
            this._uploadedDataUrl = String(reader.result || '');
            this._uploadedFileName = file.name || '';
            if (bgUrlInput) bgUrlInput.value = `localfile:${this._uploadedFileName}`;
            this.applyPreview(this.readValues());
            try { window.GuixuHelpers?.showTemporaryMessage?.('图片已载入（未保存）'); } catch (_) {}
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
        if (bgUrlInput) bgUrlInput.value = '';
        this._uploadedDataUrl = '';
        this._uploadedFileName = '';
        this._pendingDeleteBackground = true;
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
        try { window.GuixuHelpers?.showTemporaryMessage?.('已应用设置（未保存）'); } catch (_) {}
      });

      // 保存并关闭（写入状态 + 应用）
      btnSaveClose?.addEventListener('click', async () => {
        let prefs = this.readValues();

        try {
          if (this._pendingDeleteBackground || !prefs.backgroundUrl) {
            await this.deleteBackgroundFromLorebookIfExists();
            prefs.backgroundUrl = '';
            this._uploadedDataUrl = '';
            this._uploadedFileName = '';
            this._pendingDeleteBackground = false;
            try { window.GuixuHelpers?.showTemporaryMessage?.('已清除背景并删除世界书主题'); } catch (_) {}
          } else {
            // 若为本地上传的 dataURL：压缩为更小的 WebP/JPEG，再写世界书，并改为 lorebook:// 引用
            prefs = await this.saveBackgroundToLorebookIfNeeded(prefs);
          }
        } catch (e) {
          console.warn('[归墟][设置中心] 背景保存/清除处理失败:', e);
        }

        try {
          window.GuixuState?.update?.('userPreferences', prefs);
        } catch (e) {
          console.warn('[归墟][设置中心] 保存 userPreferences 失败:', e);
        }
        window.GuixuMain?.applyUserPreferences?.(prefs);
        try {
          await this.persistToRoaming(prefs);
          try { window.GuixuHelpers?.showTemporaryMessage?.('设置已保存（本地+全局），刷新后仍生效'); } catch (_) {}
        } catch (e) {
          console.warn('[归墟][设置中心] 保存到全局变量失败，仅本地已保存:', e);
          try { window.GuixuHelpers?.showTemporaryMessage?.('设置已保存到本地（全局保存失败）'); } catch (_) {}
        }
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

      if (bgUrlInput) {
        const urlVal = String(prefs.backgroundUrl || '');
        bgUrlInput.value = urlVal.startsWith('data:') ? 'localfile:(已保存)' : urlVal;
      }
      const fitSelect = $('#pref-bg-fit-mode');
      if (fitSelect) {
        fitSelect.value = String(prefs.bgFitMode || 'cover');
      }
      if (maskRange) maskRange.value = String(clamp(prefs.bgMaskOpacity, 0, 0.8));
      if (maskVal) maskVal.textContent = String(clamp(prefs.bgMaskOpacity, 0, 0.8).toFixed(2));
      if (fontRange) fontRange.value = String(clamp(prefs.storyFontSize, 12, 20));
      if (fontVal) fontVal.textContent = `${Math.round(clamp(prefs.storyFontSize, 12, 20))}px`;
    },

    readValues() {
      const bgUrlInput = $('#pref-bg-url');
      const maskRange = $('#pref-bg-mask');
      const fontRange = $('#pref-story-font-size');
      const inputUrl = (bgUrlInput?.value || '').trim();
      let backgroundUrl = inputUrl;
      if (this._uploadedDataUrl) {
        if (!inputUrl || inputUrl.startsWith('localfile:')) {
          backgroundUrl = this._uploadedDataUrl;
        }
      }
      const bgMaskOpacity = clamp(maskRange?.value || DEFAULTS.bgMaskOpacity, 0, 0.8);
      const storyFontSize = Math.round(clamp(fontRange?.value || DEFAULTS.storyFontSize, 12, 20));
      const bgFitMode = String(($('#pref-bg-fit-mode')?.value) || DEFAULTS.bgFitMode);
      return { backgroundUrl, bgMaskOpacity, storyFontSize, bgFitMode };
    },

    applyPreview(prefs) {
      // 仅作为预览，不写入状态
      window.GuixuMain?.applyUserPreferences?.(prefs);
    },

    // 持久化到酒馆全局变量（跨设备漫游）
    async persistToRoaming(prefs) {
      if (!prefs) return;
      try {
        if (window.TavernHelper && typeof window.TavernHelper.insertOrAssignVariables === 'function') {
          await window.TavernHelper.insertOrAssignVariables(
            { Guixu: { userPreferences: prefs } },
            { type: 'global' }
          );
        }
      } catch (e) {
        throw e;
      }
    },

    // 若背景为 dataURL，则压缩为更小的 WebP/JPEG 后保存到世界书条目，改写为 lorebook:// 引用
    async saveBackgroundToLorebookIfNeeded(prefs) {
      try {
        if (!prefs || !prefs.backgroundUrl || typeof prefs.backgroundUrl !== 'string') return prefs;
        const bg = prefs.backgroundUrl.trim();
        if (!bg.startsWith('data:')) return prefs;

        try { window.GuixuHelpers?.showTemporaryMessage?.('正在上传背景到世界书...'); } catch (_) {}
        // 压缩到合理尺寸与质量，显著降低体积
        const compressed = await this.compressDataUrl(bg, { maxWidth: 1920, maxHeight: 1080, quality: 0.82, mime: 'image/webp' });

        const bookName = window.GuixuConstants?.LOREBOOK?.NAME;
        if (!bookName || !window.GuixuAPI) return prefs;

        const ENTRY = '归墟主题-背景图';
        // 查找是否已有条目
        const entries = await window.GuixuAPI.getLorebookEntries(bookName);
        const existing = entries.find(e => (e.comment || '') === ENTRY);

        if (existing) {
          await window.GuixuAPI.setLorebookEntries(bookName, [{ uid: existing.uid, content: compressed }]);
        } else {
          await window.GuixuAPI.createLorebookEntries(bookName, [{
            comment: ENTRY,
            content: compressed,
            keys: [ENTRY],
            enabled: false,
            position: 'before_character_definition',
            order: 5
          }]);
        }

        // 改写为 lorebook:// 引用，后续渲染时通过世界书读取
        const newPrefs = Object.assign({}, prefs, { backgroundUrl: `lorebook://${ENTRY}` });
        try { window.GuixuHelpers?.showTemporaryMessage?.('背景上传成功'); } catch (_) {}
        return newPrefs;
      } catch (e) {
        console.warn('[归墟][设置中心] saveBackgroundToLorebookIfNeeded 出错:', e);
        try { window.GuixuHelpers?.showTemporaryMessage?.('背景上传失败'); } catch (_) {}
        return prefs;
      }
    },

    // 删除世界书中的背景条目（若存在）
    async deleteBackgroundFromLorebookIfExists() {
      try {
        const bookName = window.GuixuConstants?.LOREBOOK?.NAME;
        if (!bookName || !window.GuixuAPI) return;
        const ENTRY = '归墟主题-背景图';
        const entries = await window.GuixuAPI.getLorebookEntries(bookName);
        const target = entries.find(e => (e.comment || '') === ENTRY);
        if (target) {
          await window.GuixuAPI.deleteLorebookEntries(bookName, [target.uid]);
        }
      } catch (e) {
        console.warn('[归墟][设置中心] deleteBackgroundFromLorebookIfExists 出错:', e);
      }
    },

    // 将 dataURL 压缩到指定尺寸/质量，尽量使用 WebP，回退 JPEG
    async compressDataUrl(dataUrl, { maxWidth = 1920, maxHeight = 1080, quality = 0.82, mime = 'image/webp' } = {}) {
      try {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = dataUrl;
        });
        let { width, height } = img;
        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let out = '';
        try {
          out = canvas.toDataURL(mime, quality);
        } catch (_) {
          out = '';
        }
        if (!out || out.length >= dataUrl.length) {
          // 回退到 JPEG，并比较大小，择优
          const jpeg = canvas.toDataURL('image/jpeg', quality);
          if (jpeg && jpeg.length < (out || '').length) out = jpeg;
          if (!out) out = jpeg || dataUrl;
        }
        return out;
      } catch (e) {
        console.warn('[归墟][设置中心] compressDataUrl 失败，回退原图:', e);
        return dataUrl;
      }
    },
  };

  window.SettingsComponent = SettingsComponent;
})(window);
