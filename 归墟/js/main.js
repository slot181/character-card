// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
// 阶段四：新的主入口 main.js（全面接管，准备移除 guixu.js）
/* global eventOn, tavern_events */

(function (window) {
  'use strict';

  // 依赖检查（非致命，仅提示）
  function hasDeps() {
    const ok =
      window.GuixuDOM &&
      window.GuixuHelpers &&
      window.GuixuConstants &&
      window.GuixuAPI &&
      window.GuixuState &&
      window.GuixuAttributeService;
    if (!ok) console.warn('[归墟] main.js 依赖未完全加载：请确保 constants/dom/helpers/TavernAPI/services 已按顺序加载。');
    return ok;
  }

  const GuixuMain = {
    _initialized: false,

    init() {
      if (this._initialized) return;
      this._initialized = true;

      console.info('[归墟] GuixuMain: 启动主入口。');
      hasDeps();

      // 启动服务轮询
      this.ensureServices();

      // 顶层事件绑定
      this.bindTopLevelListeners();

      // 初始数据加载与渲染
      this.updateDynamicData().catch(err => console.error('[归墟] 初次加载失败:', err));
    },

    ensureServices() {
      try {
        if (window.GuixuState) {
          if (typeof window.GuixuState.startAutoTogglePolling === 'function') window.GuixuState.startAutoTogglePolling();
          if (typeof window.GuixuState.startAutoSavePolling === 'function') window.GuixuState.startAutoSavePolling();
          if (typeof window.GuixuState.startAutoWritePolling === 'function') window.GuixuState.startAutoWritePolling();
          if (typeof window.GuixuState.startNovelModeAutoWritePolling === 'function') window.GuixuState.startNovelModeAutoWritePolling();
        }
      } catch (e) {
        console.warn('[归墟] GuixuMain.ensureServices 警告:', e);
      }
    },

    bindTopLevelListeners() {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

      // 视图切换
      $('#view-toggle-btn')?.addEventListener('click', () => {
        const container = $('.guixu-root-container');
        const btn = $('#view-toggle-btn');
        const isMobile = !container?.classList.contains('mobile-view');
        if (container && btn) {
          if (isMobile) {
            container.classList.add('mobile-view');
            btn.textContent = '💻';
            btn.title = '切换到桌面视图';
          } else {
            container.classList.remove('mobile-view');
            btn.textContent = '📱';
            btn.title = '切换到移动视图';
          }
        }
      });

      // 右侧按钮 -> 组件入口
      $('#btn-inventory')?.addEventListener('click', () => window.InventoryComponent?.show?.());
      $('#btn-relationships')?.addEventListener('click', () => window.RelationshipsComponent?.show?.());
      $('#btn-command-center')?.addEventListener('click', () => window.CommandCenterComponent?.show?.());
      $('#btn-character-details')?.addEventListener('click', () => window.CharacterDetailsComponent?.show?.());
      $('#btn-guixu-system')?.addEventListener('click', () => window.GuixuSystemComponent?.show?.());
      $('#btn-show-extracted')?.addEventListener('click', () => window.ExtractedContentComponent?.show?.());
      $('#btn-save-load-manager')?.addEventListener('click', () => window.GuixuActionService?.showSaveLoadManager?.());

      // 世界线回顾
      $('#btn-view-journey-main')?.addEventListener('click', () => window.JourneyComponent?.show?.());
      $('#btn-view-past-lives-main')?.addEventListener('click', () => window.PastLivesComponent?.show?.());

      // 存档管理入口
      $('#btn-clear-all-saves')?.addEventListener('click', () => window.GuixuActionService?.clearAllSaves?.());
      $('#btn-import-save')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
      $('#import-file-input')?.addEventListener('change', (e) => window.GuixuActionService?.handleFileImport?.(e));

      // 统一序号输入
      $('#unified-index-input')?.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          window.GuixuState.update('unifiedIndex', val);
          window.GuixuHelpers.showTemporaryMessage(`世界书读写序号已更新为 ${val}`);
        } else {
          e.target.value = window.GuixuState.getState().unifiedIndex || 1;
        }
      });

      // 自动开关世界书
      $('#auto-toggle-lorebook-checkbox')?.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        window.GuixuState.update('isAutoToggleLorebookEnabled', isEnabled);
        window.GuixuHelpers.showTemporaryMessage(`自动开关世界书已${isEnabled ? '开启' : '关闭'}`);
        if (isEnabled) window.GuixuState.startAutoTogglePolling();
        else window.GuixuState.stopAutoTogglePolling?.();
      });

      // 自动存档
      $('#auto-save-checkbox')?.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        window.GuixuState.update('isAutoSaveEnabled', isEnabled);
        window.GuixuHelpers.showTemporaryMessage(`自动存档已${isEnabled ? '开启' : '关闭'}`);
        if (isEnabled) window.GuixuState.startAutoSavePolling();
        else window.GuixuState.stopAutoSavePolling?.();
      });

      // 快速发送
      $('#btn-quick-send')?.addEventListener('click', async () => {
        const input = $('#quick-send-input');
        const userMessage = input?.value?.trim() || '';
        await this.handleAction(userMessage);
      });

      // 当前指令面板
      $('#btn-quick-commands')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const popup = $('#quick-command-popup');
        if (!popup) return;
        if (popup.style.display === 'block') this.hideQuickCommands();
        else this.showQuickCommands();
      });

      document.addEventListener('click', (e) => {
        const popup = $('#quick-command-popup');
        const button = $('#btn-quick-commands');
        if (popup && button && popup.style.display === 'block') {
          if (!popup.contains(e.target) && !button.contains(e.target)) this.hideQuickCommands();
        }
      });

      // 角色面板装备槽：悬浮提示/点击卸下
      const characterPanel = $('.character-panel');
      if (characterPanel) {
        characterPanel.addEventListener('mouseover', (e) => {
          const slot = e.target.closest('.equipment-slot');
          if (!slot || !slot.classList.contains('equipped')) return;
          this.showEquipmentTooltip(slot, e);
        });
        characterPanel.addEventListener('mouseout', (e) => {
          const slot = e.target.closest('.equipment-slot');
          if (!slot) return;
          this.hideEquipmentTooltip();
        });
        characterPanel.addEventListener('click', async (e) => {
          const slot = e.target.closest('.equipment-slot');
          if (!slot || !slot.classList.contains('equipped')) return;
          // 复用 InventoryComponent 的卸载逻辑
          if (window.InventoryComponent?.unequipItem) {
            await window.InventoryComponent.unequipItem(slot.id, false);
          }
        });
      }

      // 历程修剪弹窗事件
      const trimModal = $('#trim-journey-modal');
      if (trimModal) {
        trimModal.addEventListener('click', (e) => {
          if (e.target.id === 'btn-confirm-trim') this.trimJourneyAutomation();
          if (e.target.id === 'btn-cancel-trim' || e.target.closest('.modal-close-btn')) {
            trimModal.style.display = 'none';
          }
        });
        // 打开时同步序号
        const idxEl = $('#trim-journey-index-input');
        if (idxEl) {
          const idx = window.GuixuState?.getState?.().unifiedIndex || 1;
          idxEl.value = String(idx);
        }
      }
    },

    async updateDynamicData() {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      try {
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        if (Array.isArray(messages) && messages.length > 0 && messages[0].data) {
          const rawState = messages[0].data;
          const normalizedState = (window.GuixuActionService && typeof window.GuixuActionService.normalizeMvuState === 'function')
            ? window.GuixuActionService.normalizeMvuState(rawState)
            : rawState;

          window.GuixuState.update('currentMvuState', normalizedState);
          this.renderUI(normalizedState.stat_data);

          // 同步填充右下角提取区文本
          await this.loadAndDisplayCurrentScene();
        } else {
          console.warn('[归墟] 当前聊天中未找到 mvu data。');
        }

        // 同步 UI 复选框状态
        const state = window.GuixuState.getState();
        const autoWriteCheckbox = $('#auto-write-checkbox');
        if (autoWriteCheckbox) autoWriteCheckbox.checked = !!state.isAutoWriteEnabled;
        const novelModeCheckbox = $('#novel-mode-enabled-checkbox');
        if (novelModeCheckbox) novelModeCheckbox.checked = !!state.isNovelModeEnabled;
        const autoToggleCheckbox = $('#auto-toggle-lorebook-checkbox');
        if (autoToggleCheckbox) autoToggleCheckbox.checked = !!state.isAutoToggleLorebookEnabled;
        const autoSaveCheckbox = $('#auto-save-checkbox');
        if (autoSaveCheckbox) autoSaveCheckbox.checked = !!state.isAutoSaveEnabled;
      } catch (error) {
        console.error('[归墟] 更新动态数据时出错:', error);
      }
    },

    renderUI(data) {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      if (!data) return;

      const updateText = (id, value, style = '') => {
        const el = document.getElementById(id);
        if (el) {
          el.innerText = value ?? '';
          if (style) el.setAttribute('style', style);
        }
      };

      // 顶部状态
      const jingjieValue = window.GuixuHelpers.SafeGetValue(data, '当前境界.0', '...');
      const match = jingjieValue.match(/^(\S{2})/);
      const jingjieTier = match ? match[1] : '';
      const jingjieStyle = window.GuixuHelpers.getTierStyle(jingjieTier);
      updateText('val-jingjie', jingjieValue, jingjieStyle);

      updateText('val-jinian', window.GuixuHelpers.SafeGetValue(data, '当前时间纪年', '...'));

      const charge = window.GuixuHelpers.SafeGetValue(data, '归墟充能时间', '0');
      updateText('val-guixu-charge-text', `${charge}%`);
      const chargeFill = $('#bar-guixu-charge .guixu-fill');
      if (chargeFill) chargeFill.style.width = `${charge}%`;

      // 左侧面板（属性/天赋/灵根/装备）
      if (window.GuixuAttributeService?.updateDisplay) {
        window.GuixuAttributeService.updateDisplay();
      }
      this.loadEquipmentFromMVU(data);

      // 状态效果
      const statusWrapper = document.getElementById('status-effects-wrapper');
      if (statusWrapper) {
        const statuses = window.GuixuAPI.lodash.get(data, '当前状态.0', []);
        if (Array.isArray(statuses) && statuses.length > 0 && statuses[0] !== '$__META_EXTENSIBLE__$') {
          statusWrapper.innerHTML = statuses
            .map(s => {
              let statusText = '未知状态';
              if (typeof s === 'string') statusText = s;
              else if (typeof s === 'object' && s !== null) {
                statusText = window.GuixuHelpers.SafeGetValue(s, 'name', '未知状态');
              }
              return `<div class="status-effect"><div class="effect-icon"></div><span>${statusText}</span></div>`;
            })
            .join('');
        } else {
          statusWrapper.innerHTML =
            '<div class="status-effect"><div class="effect-icon"></div><span>当前无状态效果</span></div>';
        }
      }
    },

    loadEquipmentFromMVU(data) {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      const equipmentMap = {
        武器: 'wuqi',
        主修功法: 'zhuxiuGongfa',
        辅修心法: 'fuxiuXinfa',
        防具: 'fangju',
        饰品: 'shipin',
        法宝栏1: 'fabao1',
      };
      const defaultTextMap = {
        wuqi: '武器',
        fangju: '防具',
        shipin: '饰品',
        fabao1: '法宝',
        zhuxiuGongfa: '主修功法',
        fuxiuXinfa: '辅修心法',
      };

      for (const [mvuKey, slotKey] of Object.entries(equipmentMap)) {
        const slot = $(`#equip-${slotKey}`);
        if (!slot) continue;

        const itemArray = window.GuixuAPI.lodash.get(data, mvuKey, null);
        const item = Array.isArray(itemArray) && itemArray.length > 0 ? itemArray[0] : null;

        if (item && typeof item === 'object') {
          const tier = window.GuixuHelpers.SafeGetValue(item, 'tier', '凡品');
          const tierStyle = window.GuixuHelpers.getTierStyle(tier);
          slot.textContent = window.GuixuHelpers.SafeGetValue(item, 'name');
          slot.setAttribute('style', tierStyle);
          slot.classList.add('equipped');
          slot.dataset.itemDetails = JSON.stringify(item).replace(/'/g, "'");
        } else {
          slot.textContent = defaultTextMap[slotKey];
          slot.classList.remove('equipped');
          slot.removeAttribute('style');
          delete slot.dataset.itemDetails;
        }
      }
    },

    async handleAction(userMessage = '') {
      try {
        const { newMvuState, aiResponse } = await window.GuixuActionService.handleAction(userMessage);
        // 更新 UI
        this.renderUI(newMvuState.stat_data);
        await this.loadAndDisplayCurrentScene(aiResponse);
        // 清理输入与待处理指令
        const input = document.getElementById('quick-send-input');
        if (input) input.value = '';
        window.GuixuState.update('pendingActions', []);
        window.GuixuHelpers.showTemporaryMessage('伟大梦星已回应。');
      } catch (error) {
        console.error('[归墟] 处理动作时出错:', error);
        window.GuixuHelpers.showTemporaryMessage(`和伟大梦星沟通失败: ${error.message}`);
      } finally {
        // 再次同步最新数据（兜底）
        await this.updateDynamicData();
      }
    },

    async loadAndDisplayCurrentScene(messageContent = null) {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      const gameTextDisplay = document.getElementById('game-text-display');
      if (!gameTextDisplay) return;

      try {
        let contentToParse = messageContent;

        if (contentToParse === null) {
          const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
          if (!messages || messages.length === 0) return;
          const lastAiMessage = [...messages].reverse().find(m => m.role === 'assistant');
          if (lastAiMessage) contentToParse = lastAiMessage.message;
        }

        if (contentToParse) {
          const displayText = this._getDisplayText(contentToParse);
          gameTextDisplay.innerHTML = this.formatMessageContent(displayText);

          // 同步提取内容到 State
          window.GuixuState.update('lastExtractedNovelText', this._extractLastTagContent('gametxt', contentToParse));
          window.GuixuState.update('lastExtractedJourney', this._extractLastTagContent('本世历程', contentToParse));
          window.GuixuState.update('lastExtractedPastLives', this._extractLastTagContent('往世涟漪', contentToParse));
          window.GuixuState.update('lastExtractedVariables', this._extractLastTagContent('UpdateVariable', contentToParse, true));
          window.GuixuState.update('lastExtractedCharacterCard', this._extractLastTagContent('角色提取', contentToParse));
        }
      } catch (error) {
        console.error('[归墟] 加载并显示当前场景时出错:', error);
        gameTextDisplay.innerHTML = '<gametxt>加载场景时出错。</gametxt>';
      }
    },

    formatMessageContent(text) {
      if (!text) return '';
      let processedText = text.replace(/\\n/g, '<br />');
      processedText = processedText.replace(/(“[^”]+”|「[^」]+」)/g, match => `<span class="text-language">${match}</span>`);
      processedText = processedText.replace(/\*([^*]+)\*/g, (m, p1) => `<span class="text-psychology">${p1}</span>`);
      processedText = processedText.replace(/【([^】\d]+[^】]*)】/g, (m, p1) => `<span class="text-scenery">${p1}</span>`);
      return processedText;
    },

    _extractLastTagContent(tagName, text, ignoreCase = false) {
      return window.GuixuHelpers.extractLastTagContent(tagName, text, ignoreCase);
    },
    _getDisplayText(text) {
      return this._extractLastTagContent('gametxt', text) || (text || '');
    },

    // Quick Commands
    showQuickCommands() {
      const popup = document.getElementById('quick-command-popup');
      if (!popup) return;
      const state = window.GuixuState.getState();
      const cmds = state?.pendingActions || [];
      if (cmds.length === 0) {
        popup.innerHTML = '<div class="quick-command-empty">暂无待执行的指令</div>';
      } else {
        let listHtml = '<ul class="quick-command-list">';
        cmds.forEach(cmd => {
          let actionText = '';
          switch (cmd.action) {
            case 'equip':
              actionText = `装备 [${cmd.itemName}] 到 [${cmd.category}] 槽位。`;
              break;
            case 'unequip':
              actionText = `卸下 [${cmd.itemName}] 从 [${cmd.category}] 槽位。`;
              break;
            case 'use':
              actionText = `使用 ${cmd.quantity} 个 [${cmd.itemName}]。`;
              break;
            case 'discard':
              actionText = cmd.quantity && cmd.quantity > 1
                ? `丢弃 ${cmd.quantity} 个 [${cmd.itemName}]。`
                : `丢弃 [${cmd.itemName}]。`;
              break;
          }
          listHtml += `<li class="quick-command-item">${actionText}</li>`;
        });
        listHtml += '</ul>';
        popup.innerHTML = listHtml;
      }
      popup.style.display = 'block';
    },

    hideQuickCommands() {
      const popup = document.getElementById('quick-command-popup');
      if (popup) popup.style.display = 'none';
    },

    // 装备槽 Tooltip（使用 GuixuRenderers）
    showEquipmentTooltip(element, event) {
      const tooltip = document.getElementById('equipment-tooltip');
      const itemDataString = element?.dataset?.itemDetails;
      if (!tooltip || !itemDataString) return;

      try {
        const item = JSON.parse(itemDataString.replace(/'/g, "'"));
        const html = window.GuixuRenderers?.renderTooltipContent
          ? window.GuixuRenderers.renderTooltipContent(item)
          : `<div class="tooltip-title">${window.GuixuHelpers.SafeGetValue(item, 'name')}</div>`;
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = event.pageX + 15;
        let top = event.pageY + 15;

        if (left + tooltipRect.width > viewportWidth) {
          left = event.pageX - tooltipRect.width - 15;
        }
        if (top + tooltipRect.height > viewportHeight) {
          top = event.pageY - tooltipRect.height - 15;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      } catch (e) {
        console.error('[归墟] 解析装备Tooltip数据失败:', e);
      }
    },

    hideEquipmentTooltip() {
      const tooltip = document.getElementById('equipment-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    },

    // 通用自定义确认弹窗（优先使用自带模态，其次回退到浏览器 confirm）
    showCustomConfirm(message, onOk, onCancel) {
      try {
        const overlay = document.getElementById('custom-confirm-modal');
        const msgEl = document.getElementById('custom-confirm-message');
        const okBtn = document.getElementById('custom-confirm-btn-ok');
        const cancelBtn = document.getElementById('custom-confirm-btn-cancel');

        if (!overlay || !okBtn || !cancelBtn) {
          if (confirm(message)) {
            if (typeof onOk === 'function') onOk();
          } else {
            if (typeof onCancel === 'function') onCancel();
          }
          return;
        }

        if (msgEl) {
          msgEl.textContent = String(message ?? '');
        }

        function cleanup() {
          overlay.style.display = 'none';
          okBtn.removeEventListener('click', okHandler);
          cancelBtn.removeEventListener('click', cancelHandler);
        }
        function okHandler() {
          cleanup();
          if (typeof onOk === 'function') onOk();
        }
        function cancelHandler() {
          cleanup();
          if (typeof onCancel === 'function') onCancel();
        }

        okBtn.addEventListener('click', okHandler, { once: true });
        cancelBtn.addEventListener('click', cancelHandler, { once: true });

        overlay.style.display = 'flex';
      } catch (e) {
        console.error('[归墟] 自定义确认弹窗失败:', e);
        if (confirm(message)) {
          if (typeof onOk === 'function') onOk();
        } else {
          if (typeof onCancel === 'function') onCancel();
        }
      }
    },

    async trimJourneyAutomation() {
      try {
        const idxEl = document.getElementById('trim-journey-index-input');
        const targetIndex = idxEl ? parseInt(idxEl.value, 10) : (window.GuixuState?.getState?.().unifiedIndex || 1);
        const bookName = window.GuixuConstants.LOREBOOK.NAME;
        const key = targetIndex > 1
          ? `${window.GuixuConstants.LOREBOOK.ENTRIES.JOURNEY}(${targetIndex})`
          : window.GuixuConstants.LOREBOOK.ENTRIES.JOURNEY;

        const entries = await window.GuixuAPI.getLorebookEntries(bookName);
        const entry = entries.find(e => (e.comment || '').trim() === key.trim());
        if (!entry) {
          window.GuixuHelpers.showTemporaryMessage('未找到本世历程条目，无法修剪');
          return;
        }

        const trimmed = window.GuixuLorebookService?.getTrimmedJourneyContent
          ? window.GuixuLorebookService.getTrimmedJourneyContent(entry.content || '')
          : (entry.content || '');

        if (trimmed !== entry.content) {
          await window.GuixuAPI.setLorebookEntries(bookName, [{ uid: entry.uid, content: trimmed }]);
          window.GuixuHelpers.showTemporaryMessage('已修剪自动化系统内容');
        } else {
          window.GuixuHelpers.showTemporaryMessage('无需修剪');
        }
      } catch (e) {
        console.error('[归墟] trimJourneyAutomation 失败:', e);
        window.GuixuHelpers.showTemporaryMessage('修剪失败');
      }
    },
  };

  // 导出全局
  window.GuixuMain = GuixuMain;

  // SillyTavern 环境入口
  if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events.APP_READY) {
    eventOn(tavern_events.APP_READY, () => GuixuMain.init());
  } else {
    // 兜底：非 ST 环境/本地调试
    document.addEventListener('DOMContentLoaded', () => GuixuMain.init());
  }
})(window);
