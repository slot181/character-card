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
    uiResolutionPreset: 'keep',
    uiCustomWidth: 900,
    uiCustomHeight: 600,
  });

  function clamp(num, min, max) {
    const n = Number(num);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  const BG_PREFIX = String(window.GuixuConstants?.BACKGROUND?.PREFIX || '归墟背景/');

  const SettingsComponent = {
    _bound: false,
    _bgEntriesCache: [],
    _selectedComment: '',

    show() {
      const overlay = $('#settings-modal');
      if (!overlay) return;
      this.ensureBound();
      this.loadFromState();
      // 打开时加载世界书背景列表
      this.refreshBackgroundList().finally(() => {
        overlay.style.display = 'flex';
      });
    },

    hide() {
      const overlay = $('#settings-modal');
      if (overlay) overlay.style.display = 'none';
    },

    ensureBound() {
      if (this._bound) return;
      this._bound = true;

      const overlay = $('#settings-modal');
      const bgSelect = $('#pref-bg-select');
      const bgUploadBtn = $('#pref-bg-upload');
      const bgDeleteBtn = $('#pref-bg-delete');
      const bgClearBtn = $('#pref-bg-clear');
      const previewEl = $('#pref-bg-preview');

      const maskRange = $('#pref-bg-mask');
      const maskVal = $('#pref-bg-mask-val');
      const fontRange = $('#pref-story-font-size');
      const fontVal = $('#pref-story-font-size-val');
      const btnReset = $('#pref-reset-defaults');
      const btnApply = $('#pref-apply');
      const btnSaveClose = $('#pref-save-close');
      const fitSelect = $('#pref-bg-fit-mode');

      // 新增：分辨率控件
      const resPreset = $('#pref-ui-res-preset');
      const resW = $('#pref-ui-res-width');
      const resH = $('#pref-ui-res-height');

      // 选择变化 -> 预览
      bgSelect?.addEventListener('change', async () => {
        const comment = String(bgSelect.value || '');
        this._selectedComment = comment;
        await this.updatePreviewByComment(comment);
        this.applyPreview(this.readValues());
      });

      // 背景适配方式变化 -> 预览
      fitSelect?.addEventListener('change', () => {
        this.applyPreview(this.readValues());
      });

      // 遮罩/字号实时预览
      maskRange?.addEventListener('input', () => {
        const v = clamp(maskRange.value, 0, 0.8);
        if (maskVal) maskVal.textContent = v.toFixed(2);
        this.applyPreview(this.readValues());
      });
      fontRange?.addEventListener('input', () => {
        const v = clamp(fontRange.value, 12, 20);
        if (fontVal) fontVal.textContent = `${Math.round(v)}px`;
        this.applyPreview(this.readValues());
      });

      // 分辨率预设切换
      const toggleCustomEnabled = () => {
        const enable = String(resPreset?.value || 'keep') === 'custom';
        if (resW) resW.disabled = !enable;
        if (resH) resH.disabled = !enable;
      };
      resPreset?.addEventListener('change', () => {
        const preset = String(resPreset.value || 'keep');
        // 预设时同步显示数值（仅展示，不会强制保存）
        if (preset !== 'custom' && preset !== 'keep') {
          const m = preset.match(/^(\d+)x(\d+)$/);
          if (m) {
            if (resW) resW.value = m[1];
            if (resH) resH.value = m[2];
          }
        }
        toggleCustomEnabled();
        this.applyPreview(this.readValues());
      });
      // 自定义宽高变化时应用预览（仅当处于自定义模式）
      const onCustomSizeInput = () => {
        if (String(resPreset?.value || 'keep') === 'custom') {
          this.applyPreview(this.readValues());
        }
      };
      resW?.addEventListener('input', onCustomSizeInput);
      resH?.addEventListener('input', onCustomSizeInput);

      // 本地上传 -> 压缩 -> 新建世界书条目（不覆盖）
      bgUploadBtn?.addEventListener('click', () => this.uploadBackground());

      // 删除当前选择的背景（从世界书中删除该条目）
      bgDeleteBtn?.addEventListener('click', async () => {
        const comment = String(bgSelect?.value || '');
        if (!comment) {
          try { window.GuixuHelpers?.showTemporaryMessage?.('请先从下拉框选择要删除的背景'); } catch(_) {}
          return;
        }
        const confirmDelete = (onOk) => {
          if (typeof window.GuixuMain?.showCustomConfirm === 'function') {
            window.GuixuMain.showCustomConfirm(`确定要删除背景「${comment}」吗？此操作不可撤销。`, onOk, () => {});
          } else {
            if (confirm(`确定要删除背景「${comment}」吗？此操作不可撤销。`)) onOk();
          }
        };
        confirmDelete(async () => {
          try {
            await this.deleteBackgroundEntry(comment);
            try { window.GuixuHelpers?.showTemporaryMessage?.('背景已删除'); } catch(_) {}
            // 刷新列表并清空选择
            await this.refreshBackgroundList();
            if (bgSelect) bgSelect.value = '';
            this._selectedComment = '';
            await this.updatePreviewByComment('');
            this.applyPreview(this.readValues());
          } catch (e) {
            console.warn('[归墟][设置中心] 删除背景失败：', e);
            try { window.GuixuHelpers?.showTemporaryMessage?.('删除失败'); } catch(_) {}
          }
        });
      });

      // 清除背景（不删除世界书条目，仅清空当前选择）
      bgClearBtn?.addEventListener('click', async () => {
        if (bgSelect) bgSelect.value = '';
        this._selectedComment = '';
        await this.updatePreviewByComment('');
        this.applyPreview(this.readValues());
      });

      // 恢复默认
      btnReset?.addEventListener('click', async () => {
        this.syncUI(DEFAULTS);
        await this.updatePreviewByComment('');
        this.applyPreview(DEFAULTS);
      });

      // 应用（不保存，仅一次性应用）
      btnApply?.addEventListener('click', () => {
        const prefs = this.readValues();
        window.GuixuMain?.applyUserPreferences?.(prefs);
        try { window.GuixuHelpers?.showTemporaryMessage?.('已应用设置（未保存）'); } catch (_) {}
      });

      // 保存并关闭（写入状态 + 应用 + 漫游持久化）
      btnSaveClose?.addEventListener('click', async () => {
        const prefs = this.readValues();
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
        const btnSaveCloseNow = $('#pref-save-close');
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          btnSaveCloseNow?.click();
        }
      });

      // 初始化预览容器样式兜底（若CSS未定义）
      if (previewEl && !previewEl.style.minHeight) {
        previewEl.style.minHeight = '120px';
        previewEl.style.background = 'rgba(0,0,0,0.3)';
        previewEl.style.border = '1px solid #8b7355';
        previewEl.style.borderRadius = '4px';
        previewEl.style.backgroundSize = 'cover';
        previewEl.style.backgroundPosition = 'center';
        previewEl.style.backgroundRepeat = 'no-repeat';
      }
    },

    loadFromState() {
      const state = window.GuixuState?.getState?.() || {};
      const prefs = Object.assign({}, DEFAULTS, state.userPreferences || {});
      this.syncUI(prefs);
    },

    syncUI(prefs) {
      const maskRange = $('#pref-bg-mask');
      const maskVal = $('#pref-bg-mask-val');
      const fontRange = $('#pref-story-font-size');
      const fontVal = $('#pref-story-font-size-val');
      const fitSelect = $('#pref-bg-fit-mode');
      const bgSelect = $('#pref-bg-select');
      const resPreset = $('#pref-ui-res-preset');
      const resW = $('#pref-ui-res-width');
      const resH = $('#pref-ui-res-height');

      // 当前选择从 prefs 解析（lorebook://COMMENT）
      const urlVal = String(prefs.backgroundUrl || '');
      let selectedComment = '';
      if (urlVal.startsWith('lorebook://')) {
        selectedComment = urlVal.slice('lorebook://'.length);
      }

      if (fitSelect) fitSelect.value = String(prefs.bgFitMode || 'cover');
      if (maskRange) maskRange.value = String(clamp(prefs.bgMaskOpacity, 0, 0.8));
      if (maskVal) maskVal.textContent = String(clamp(prefs.bgMaskOpacity, 0, 0.8).toFixed(2));
      if (fontRange) fontRange.value = String(clamp(prefs.storyFontSize, 12, 20));
      if (fontVal) fontVal.textContent = `${Math.round(clamp(prefs.storyFontSize, 12, 20))}px`;

      this._selectedComment = selectedComment;

      // 在刷新列表后设值更稳妥，这里先预置选中值
      if (bgSelect) {
        bgSelect.value = selectedComment || '';
      }

      // 分辨率设置回显
      const preset = String(prefs.uiResolutionPreset || 'keep');
      if (resPreset) resPreset.value = preset;
      let showW = Number(prefs.uiCustomWidth || 900);
      let showH = Number(prefs.uiCustomHeight || 600);
      const m = preset.match?.(/^(\d+)x(\d+)$/);
      if (m) {
        showW = parseInt(m[1], 10);
        showH = parseInt(m[2], 10);
      } else if (preset === 'keep') {
        showW = 900; showH = 600;
      }
      if (resW) resW.value = String(showW);
      if (resH) resH.value = String(showH);
      // 启用/禁用自定义输入
      const enable = preset === 'custom';
      if (resW) resW.disabled = !enable;
      if (resH) resH.disabled = !enable;
    },

    readValues() {
      const maskRange = $('#pref-bg-mask');
      const fontRange = $('#pref-story-font-size');
      const bgMaskOpacity = clamp(maskRange?.value || DEFAULTS.bgMaskOpacity, 0, 0.8);
      const storyFontSize = Math.round(clamp(fontRange?.value || DEFAULTS.storyFontSize, 12, 20));
      const bgFitMode = String(($('#pref-bg-fit-mode')?.value) || DEFAULTS.bgFitMode);

      const selectedComment = String($('#pref-bg-select')?.value || this._selectedComment || '');
      const backgroundUrl = selectedComment ? `lorebook://${selectedComment}` : '';

      // 分辨率
      const uiResolutionPreset = String($('#pref-ui-res-preset')?.value || DEFAULTS.uiResolutionPreset);
      let uiCustomWidth = Number($('#pref-ui-res-width')?.value || DEFAULTS.uiCustomWidth);
      let uiCustomHeight = Number($('#pref-ui-res-height')?.value || DEFAULTS.uiCustomHeight);
      uiCustomWidth = Math.max(300, Math.min(7680, isFinite(uiCustomWidth) ? uiCustomWidth : DEFAULTS.uiCustomWidth));
      uiCustomHeight = Math.max(200, Math.min(4320, isFinite(uiCustomHeight) ? uiCustomHeight : DEFAULTS.uiCustomHeight));

      return { backgroundUrl, bgMaskOpacity, storyFontSize, bgFitMode, uiResolutionPreset, uiCustomWidth, uiCustomHeight };
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

    // 加载以“归墟背景/”为前缀的所有世界书条目
    async loadBackgroundEntries() {
      const bookName = window.GuixuConstants?.LOREBOOK?.NAME;
      if (!bookName || !window.GuixuAPI) return [];
      const entries = await window.GuixuAPI.getLorebookEntries(bookName);
      const list = Array.isArray(entries) ? entries.filter(e => (e.comment || '').startsWith(BG_PREFIX)) : [];
      this._bgEntriesCache = list;
      return list;
    },

    // 刷新下拉列表并同步当前选中项
    async refreshBackgroundList() {
      const entries = await this.loadBackgroundEntries();
      this.populateSelectOptions(entries, this._selectedComment);
      await this.updatePreviewByComment(this._selectedComment);
    },

    // 将 entries 渲染到选择框
    populateSelectOptions(entries, selectedComment = '') {
      const sel = $('#pref-bg-select');
      if (!sel) return;
      sel.innerHTML = '';
      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '（未选择）';
      sel.appendChild(optNone);

      entries.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.comment || '';
        // 标签使用去前缀后的名字，找不到则用完整 comment
        let label = opt.value.startsWith(BG_PREFIX) ? opt.value.slice(BG_PREFIX.length) : opt.value;
        if (!label) label = opt.value;
        opt.textContent = label;
        sel.appendChild(opt);
      });

      sel.value = selectedComment || '';
    },

    // 将选中的 comment 的缩略图设置到预览框
    async updatePreviewByComment(comment) {
      const previewEl = $('#pref-bg-preview');
      if (!previewEl) return;
      if (!comment) {
        previewEl.style.backgroundImage = '';
        return;
      }
      const target = this._bgEntriesCache.find(e => (e.comment || '') === comment);
      const dataUrl = target?.content || '';
      previewEl.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
    },

    // 上传并创建新世界书条目（不会覆盖已有）
    async uploadBackground() {
      try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        const once = () => new Promise((resolve) => {
          fileInput.addEventListener('change', () => resolve(), { once: true });
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        await once();

        const file = fileInput.files?.[0];
        setTimeout(() => fileInput.remove(), 1000);
        if (!file) return;

        try { window.GuixuHelpers?.showTemporaryMessage?.('正在读取并压缩图片...'); } catch(_) {}

        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const compressed = await this.compressDataUrl(dataUrl, { maxWidth: 1920, maxHeight: 1080, quality: 0.82, mime: 'image/webp' });

        const bookName = window.GuixuConstants?.LOREBOOK?.NAME;
        if (!bookName || !window.GuixuAPI) throw new Error('世界书API不可用');

        // 生成唯一 comment：归墟背景/<文件名或时间戳>(-n)
        const baseName = (file.name || `背景_${Date.now()}`).replace(/\.[^.]+$/, '');
        const entries = await this.loadBackgroundEntries();
        const existingComments = new Set(entries.map(e => e.comment || ''));
        const uniqueComment = this.makeUniqueComment(baseName, existingComments);

        await window.GuixuAPI.createLorebookEntries(bookName, [{
          comment: uniqueComment,
          content: compressed,
          keys: [uniqueComment],
          enabled: false,
          position: 'before_character_definition',
          order: 6
        }]);

        try { window.GuixuHelpers?.showTemporaryMessage?.('背景上传成功'); } catch(_) {}

        // 刷新列表并选中新条目
        await this.refreshBackgroundList();
        const sel = $('#pref-bg-select');
        if (sel) sel.value = uniqueComment;
        this._selectedComment = uniqueComment;
        await this.updatePreviewByComment(uniqueComment);
        this.applyPreview(this.readValues());
      } catch (e) {
        console.warn('[归墟][设置中心] 上传背景失败：', e);
        try { window.GuixuHelpers?.showTemporaryMessage?.('上传失败'); } catch(_) {}
      }
    },

    // 删除指定 comment 的条目
    async deleteBackgroundEntry(comment) {
      const bookName = window.GuixuConstants?.LOREBOOK?.NAME;
      if (!bookName || !window.GuixuAPI || !comment) return;

      // 找 uid
      const entries = await window.GuixuAPI.getLorebookEntries(bookName);
      const target = entries.find(e => (e.comment || '') === comment);
      if (!target) throw new Error('未找到对应条目');
      await window.GuixuAPI.deleteLorebookEntries(bookName, [target.uid]);
    },

    // 基于现有 comment 集合生成唯一 comment
    makeUniqueComment(baseName, existingComments) {
      const sanitize = (s) => String(s || '').trim().replace(/[\/\\?%*:|"<>]/g, '_');
      const base = `${BG_PREFIX}${sanitize(baseName)}`;
      if (!existingComments.has(base)) return base;
      let i = 2;
      while (true) {
        const candidate = `${base}-${i}`;
        if (!existingComments.has(candidate)) return candidate;
        i += 1;
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
