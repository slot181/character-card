// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
// --- SillyTavern Global API ---
// These are provided by the SillyTavern environment at runtime.
  // We will check for their existence before using them.
  /* global TavernHelper, eventOn, tavern_events, getChatMessages, getCurrentMessageId, _ */

  // --- Main Application Logic ---
  (function () {
    'use strict';

    // --- API Availability Check ---
    if (
      typeof TavernHelper === 'undefined' ||
      typeof eventOn === 'undefined' ||
      typeof tavern_events === 'undefined' ||
      typeof getChatMessages === 'undefined' ||
      typeof getCurrentMessageId === 'undefined' ||
      typeof _ === 'undefined'
    ) {
      console.error('TavernHelper API, event system, or lodash not found.');
      document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML =
          '<h1 style="color: red; text-align: center;">错误：SillyTavern 环境 API 未找到或版本不兼容</h1><p style="color:grey; text-align:center;">请确保已安装并启用 TavernHelper 扩展。</p>';
      });
      return;
    }

// --- Core Application Object for UI Interactions ---
// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
const GuixuManager = {
  listenersBound: false, // 新增：防止事件监听器重复绑定的标志
  // 所有状态和核心逻辑已移至 /js/services/ 目录下的模块中
  // GuixuManager 现在主要作为UI协调器

  // --- 新增：将 Manager 的字段代理到 GuixuState，保证旧代码不崩 ---
  get pendingActions() { return GuixuState.getState().pendingActions; },
  set pendingActions(v) { GuixuState.update('pendingActions', Array.isArray(v) ? v : []); },

  get equippedItems() { return GuixuState.getState().equippedItems; },

  get unifiedIndex() { return GuixuState.getState().unifiedIndex; },
  set unifiedIndex(v) { if (typeof v === 'number' && v > 0) GuixuState.update('unifiedIndex', v); },

  get isAutoTrimEnabled() { return GuixuState.getState().isAutoTrimEnabled; },
  get isNovelModeEnabled() { return GuixuState.getState().isNovelModeEnabled; },

  get currentMvuState() { return GuixuState.getState().currentMvuState; },
  set currentMvuState(v) { GuixuState.update('currentMvuState', v); },

  get lastExtractedJourney() { return GuixuState.getState().lastExtractedJourney; },
  set lastExtractedJourney(v) { GuixuState.update('lastExtractedJourney', v); },

  get lastExtractedPastLives() { return GuixuState.getState().lastExtractedPastLives; },
  set lastExtractedPastLives(v) { GuixuState.update('lastExtractedPastLives', v); },

  get lastExtractedNovelText() { return GuixuState.getState().lastExtractedNovelText; },
  set lastExtractedNovelText(v) { GuixuState.update('lastExtractedNovelText', v); },

  get lastExtractedCharacterCard() { return GuixuState.getState().lastExtractedCharacterCard; },
  set lastExtractedCharacterCard(v) { GuixuState.update('lastExtractedCharacterCard', v); },

  get lastExtractedVariables() { return GuixuState.getState().lastExtractedVariables; },
  set lastExtractedVariables(v) { GuixuState.update('lastExtractedVariables', v); },

  get lastSentPrompt() { return GuixuState.getState().lastSentPrompt; },
  set lastSentPrompt(v) { GuixuState.update('lastSentPrompt', v); },

  // 兼容旧调用的保存函数
  saveEquipmentState() { GuixuState.update('equippedItems', this.equippedItems); },
  savePendingActions() { GuixuState.update('pendingActions', this.pendingActions); },

  // 辅助函数缺失补齐
  _extractLastTagContent(tagName, text, ignoreCase = false) {
    return GuixuHelpers.extractLastTagContent(tagName, text, ignoreCase);
  },
  _getDisplayText(text) {
    return this._extractLastTagContent('gametxt', text) || (text || '');
  },
  loadUnifiedIndex() {
    const el = GuixuDOM.$('#unified-index-input');
    if (el) el.value = String(this.unifiedIndex || 1);
  },
  async trimJourneyAutomation() {
    try {
      const idxEl = GuixuDOM.$('#trim-journey-index-input');
      const targetIndex = idxEl ? parseInt(idxEl.value, 10) : this.unifiedIndex;
      const bookName = GuixuConstants.LOREBOOK.NAME;
      const key = targetIndex > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.JOURNEY}(${targetIndex})` : GuixuConstants.LOREBOOK.ENTRIES.JOURNEY;
      const entries = await GuixuAPI.getLorebookEntries(bookName);
      const entry = entries.find(e => e.comment === key);
      if (!entry) {
        this.showTemporaryMessage('未找到本世历程条目，无法修剪');
        return;
      }
      const trimmed = GuixuLorebookService.getTrimmedJourneyContent(entry.content || '');
      if (trimmed !== entry.content) {
        await GuixuAPI.setLorebookEntries(bookName, [{ uid: entry.uid, content: trimmed }]);
        this.showTemporaryMessage('已修剪自动化系统内容');
      } else {
        this.showTemporaryMessage('无需修剪');
      }
    } catch (e) {
      console.error('trimJourneyAutomation 失败:', e);
      this.showTemporaryMessage('修剪失败');
    }
  },

  showTrimJourneyModal() {
    const { $ } = GuixuDOM;
    this.openModal('trim-journey-modal');
    const idxEl = $('#trim-journey-index-input');
    if (idxEl) {
      idxEl.value = String(this.unifiedIndex || 1);
    }
  },

      showWaitingMessage() {
        const { h, $ } = GuixuDOM;
        this.hideWaitingMessage(); // Ensure only one is visible
        const message = GuixuConstants.WAITING_MESSAGES[Math.floor(Math.random() * GuixuConstants.WAITING_MESSAGES.length)];
        
        const msgElement = h('div', { id: 'waiting-popup', className: 'waiting-popup' }, [
          h('div', { className: 'waiting-spinner' }),
          h('span', {}, [message])
        ]);

        const container = $('.guixu-root-container');
        if (container) {
            container.appendChild(msgElement);
        }
      },

      hideWaitingMessage() {
        const { $ } = GuixuDOM;
        const existingMsg = $('#waiting-popup');
        if (existingMsg) {
            existingMsg.remove();
        }
      },

      // --- 新增：视图切换核心功能 ---
      toggleViewMode() {
        const { $ } = GuixuDOM;
        const newMode = !GuixuState.getState().isMobileView;
        GuixuState.update('isMobileView', newMode);
        
        const container = $('.guixu-root-container');
        const btn = $('#view-toggle-btn');
        if (container && btn) {
          if (newMode) {
            container.classList.add('mobile-view');
            btn.textContent = '💻'; // 切换到桌面图标
            btn.title = '切换到桌面视图';
          } else {
            container.classList.remove('mobile-view');
            btn.textContent = '📱'; // 切换到手机图标
            btn.title = '切换到移动视图';
          }
        }
      },


      formatMessageContent(text) {
        if (!text) return '';
        // 首先，处理换行符。AI响应似乎使用文字“\\n”。
        let processedText = text.replace(/\\n/g, '<br />');

        // 语言: “...” 或 「...」 -> 保留引号, 应用样式
        processedText = processedText.replace(/(“[^”]+”|「[^」]+」)/g, match => {
          return `<span class="text-language">${match}</span>`;
        });

        // 心理: *...* -> 移除星号, 应用样式
        processedText = processedText.replace(/\*([^*]+)\*/g, (match, p1) => {
          return `<span class="text-psychology">${p1}</span>`;
        });

        // 景物: 【...】 -> 移除括号, 应用样式, 且不匹配纯数字内容
        processedText = processedText.replace(/【([^】\d]+[^】]*)】/g, (match, p1) => {
          return `<span class="text-scenery">${p1}</span>`;
        });

        return processedText;
      },

      async init() {
    console.log('归墟UI交互管理器初始化...');
    // GuixuState 会在加载时自动初始化
    this.bindStaticListeners();
    this.applyRandomBackground();
    await this.updateDynamicData(); // Initial data load
    this.updateCheckboxesFromState(); // 从State更新UI复选框
    this.startPollingServices(); // 启动所有轮询服务
    // 新增：在初始化时，也从localStorage加载一次装备状态，确保刷新后UI正确
    const savedEquippedItems = GuixuState.getState().equippedItems;
    if (savedEquippedItems) {
        Object.keys(savedEquippedItems).forEach(slotKey => {
            const item = savedEquippedItems[slotKey];
            const slotElement = GuixuDOM.$(`#equip-${slotKey}`);
            if (item && slotElement) {
                const tier = GuixuHelpers.SafeGetValue(item, 'tier', '凡品');
                const tierStyle = GuixuHelpers.getTierStyle(tier);
                slotElement.textContent = GuixuHelpers.SafeGetValue(item, 'name');
                slotElement.setAttribute('style', tierStyle);
                slotElement.classList.add('equipped');
                slotElement.dataset.itemDetails = JSON.stringify(item).replace(/'/g, "'");
            }
        });
        this.updateDisplayedAttributes();
    }
  },

  // --- 新增：服务层集成 ---
  updateCheckboxesFromState() {
    const { $ } = GuixuDOM;
    const state = GuixuState.getState();
    const autoWriteCheckbox = $('#auto-write-checkbox');
    if (autoWriteCheckbox) autoWriteCheckbox.checked = state.isAutoWriteEnabled;

    const novelModeCheckbox = $('#novel-mode-enabled-checkbox');
    if (novelModeCheckbox) novelModeCheckbox.checked = state.isNovelModeEnabled;

    const autoToggleCheckbox = $('#auto-toggle-lorebook-checkbox');
    if (autoToggleCheckbox) autoToggleCheckbox.checked = state.isAutoToggleLorebookEnabled;

    const autoSaveCheckbox = $('#auto-save-checkbox');
    if (autoSaveCheckbox) autoSaveCheckbox.checked = state.isAutoSaveEnabled;
    
    const autoTrimCheckbox = $('#auto-trim-checkbox');
    if (autoTrimCheckbox) autoTrimCheckbox.checked = state.isAutoTrimEnabled;
  },

  startPollingServices() {
    // 启动所有需要轮询的服务
    GuixuState.startAutoTogglePolling();
    GuixuState.startAutoSavePolling();
    GuixuState.startAutoWritePolling();
  },

      // --- Data Handling ---
      async updateDynamicData() {
        try {
          // 加载核心mvu数据
          const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
          if (messages && messages.length > 0 && messages[0].data) {
            // 缓存完整的 mvu 状态（加入去重规范化，避免重复项）
            const rawState = messages[0].data;
            const normalizedState = (window.GuixuActionService && typeof window.GuixuActionService.normalizeMvuState === 'function')
              ? window.GuixuActionService.normalizeMvuState(rawState)
              : rawState;
            this.currentMvuState = normalizedState;
            this.renderUI(normalizedState.stat_data);
          } else {
            console.warn('无法从当前消息中加载 mvu data。');
          }

          // 新增：加载并显示当前场景正文
          // 此函数现在处理自己的文本格式化。
          await this.loadAndDisplayCurrentScene();
        } catch (error) {
          console.error('更新归墟动态数据时出错:', error);
        }
      },

      // 新增：统一的UI渲染函数
      renderUI(data) {
        const { $, $$ } = GuixuDOM;
        if (!data) {
          console.warn('RenderUI 调用失败：没有提供数据。');
          return;
        }
        const updateText = (id, value, style = '') => {
          const el = $(`#${id}`);
          if (el) {
            el.innerText = value;
            if (style) {
              el.setAttribute('style', style);
            }
          }
        };

      // BUGFIX: Per the variable definition, the actual value is the first element of the array.
      const jingjieValue = GuixuHelpers.SafeGetValue(data, '当前境界.0', '...');
      const match = jingjieValue.match(/^(\S{2})/);
      const jingjieTier = match ? match[1] : '';
      const jingjieStyle = GuixuHelpers.getTierStyle(jingjieTier);
      updateText('val-jingjie', jingjieValue, jingjieStyle);
      updateText('val-jinian', GuixuHelpers.SafeGetValue(data, '当前时间纪年'));
      const charge = GuixuHelpers.SafeGetValue(data, '归墟充能时间', '0');
      updateText('val-guixu-charge-text', `${charge}%`);
      
      // **问题2修复**: 直接设置填充元素的宽度，而不是通过CSS变量
      const chargeFill = $('#bar-guixu-charge .guixu-fill');
      if (chargeFill) chargeFill.style.width = `${charge}%`;

        // 此处不再需要填充 this.baseAttributes，因为 updateDisplayedAttributes 会直接从 stat_data 读取
        
        this.updateTalentAndLinggen(data);
        this.loadEquipmentFromMVU(data);
        this.updateDisplayedAttributes(); // 核心渲染函数

        const statusWrapper = $('#status-effects-wrapper');
        if (statusWrapper) {
      const statuses = GuixuAPI.lodash.get(data, '当前状态.0', []);
      if (Array.isArray(statuses) && statuses.length > 0 && statuses[0] !== '$__META_EXTENSIBLE__$') {
        statusWrapper.innerHTML = statuses
          .map(s => {
            let statusText = '未知状态';
            if (typeof s === 'string') {
              statusText = s;
            } else if (typeof s === 'object' && s !== null) {
              statusText = GuixuHelpers.SafeGetValue(s, 'name', '未知状态');
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

      // --- Event Listeners for Buttons and Modals ---
      bindStaticListeners() {
        const { $, $$ } = GuixuDOM;
        if (this.listenersBound) return;

        $('#view-toggle-btn')?.addEventListener('click', () => this.toggleViewMode());
        
        $('#unified-index-input')?.addEventListener('change', (e) => {
            const newIndex = parseInt(e.target.value, 10);
            if (!isNaN(newIndex) && newIndex > 0) {
                GuixuState.update('unifiedIndex', newIndex);
                this.showTemporaryMessage(`世界书读写序号已更新为 ${newIndex}`);
                if (GuixuState.getState().isAutoToggleLorebookEnabled) {
                    GuixuState.startAutoTogglePolling();
                }
            } else {
                e.target.value = GuixuState.getState().unifiedIndex;
            }
        });

        $('#auto-toggle-lorebook-checkbox')?.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            GuixuState.update('isAutoToggleLorebookEnabled', isEnabled);
            this.showTemporaryMessage(`自动开关世界书已${isEnabled ? '开启' : '关闭'}`);
            if (isEnabled) {
              GuixuState.startAutoTogglePolling();
            } else {
              GuixuState.stopAutoTogglePolling();
            }
        });

        $('#btn-inventory')?.addEventListener('click', () => this.showInventory());
        $('#btn-relationships')?.addEventListener('click', () => this.showRelationships());
        $('#btn-command-center')?.addEventListener('click', () => this.showCommandCenter());
        $('#btn-character-details')?.addEventListener('click', () => this.showCharacterDetails());
        $('#btn-guixu-system')?.addEventListener('click', () => this.showGuixuSystem());
        $('#btn-show-extracted')?.addEventListener('click', () => this.showExtractedContent());
        $('#btn-view-journey-main')?.addEventListener('click', () => this.showJourney());
        $('#btn-view-past-lives-main')?.addEventListener('click', () => this.showPastLives());
        $('#btn-save-load-manager')?.addEventListener('click', () => GuixuActionService.showSaveLoadManager());
        $('#btn-clear-all-saves')?.addEventListener('click', () => GuixuActionService.clearAllSaves());
        $('#btn-import-save')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
        $('#import-file-input')?.addEventListener('change', (e) => GuixuActionService.handleFileImport(e));
        
        $('#auto-save-checkbox')?.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            GuixuState.update('isAutoSaveEnabled', isEnabled);
            this.showTemporaryMessage(`自动存档已${isEnabled ? '开启' : '关闭'}`);
            if (isEnabled) {
                GuixuState.startAutoSavePolling();
            } else {
                GuixuState.stopAutoSavePolling();
            }
        });

        $('#btn-write-journey')?.addEventListener('click', () => GuixuLorebookService.write(GuixuConstants.LOREBOOK.ENTRIES.JOURNEY, GuixuState.getState().lastExtractedJourney));
        $('#btn-write-past-lives')?.addEventListener('click', () => GuixuLorebookService.write(GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES, GuixuState.getState().lastExtractedPastLives));
        $('#btn-write-novel-mode')?.addEventListener('click', () => GuixuLorebookService.write(GuixuConstants.LOREBOOK.ENTRIES.NOVEL_MODE, GuixuState.getState().lastExtractedNovelText));
        $('#btn-write-character-card')?.addEventListener('click', () => GuixuLorebookService.writeCharacterCard(GuixuState.getState().lastExtractedCharacterCard));

        const autoWriteCheckbox = $('#auto-write-checkbox');
        if (autoWriteCheckbox) {
          autoWriteCheckbox.addEventListener('change', e => {
            const isEnabled = e.target.checked;
            GuixuState.update('isAutoWriteEnabled', isEnabled);
            this.showTemporaryMessage(`自动写入历程/涟漪已${isEnabled ? '开启' : '关闭'}`);
            if (isEnabled) {
              GuixuState.startAutoWritePolling();
            } else {
              GuixuState.stopAutoWritePolling();
            }
          });
        }

        const novelModeCheckbox = $('#novel-mode-enabled-checkbox');
        if (novelModeCheckbox) {
          novelModeCheckbox.addEventListener('change', e => {
            const isEnabled = e.target.checked;
            GuixuState.update('isNovelModeEnabled', isEnabled);
            this.showTemporaryMessage(`小说模式自动写入已${isEnabled ? '开启' : '关闭'}`);
            if (isEnabled) {
              GuixuState.startNovelModeAutoWritePolling();
            } else {
              GuixuState.stopNovelModeAutoWritePolling();
            }
            const label = $('label[for="novel-mode-enabled-checkbox"]');
            if (label) {
              label.textContent = `开启小说模式`;
            }
            if ($('#extracted-content-modal').style.display === 'flex') {
              this.showExtractedContent();
            }
          });
        }

        $('#btn-execute-commands')?.addEventListener('click', () => this.executePendingActions());
        $('#btn-clear-commands')?.addEventListener('click', () => this.clearPendingActions());
        $('#btn-refresh-storage')?.addEventListener('click', () => this.refreshLocalStorage());

        $$('.modal-close-btn').forEach(btn => btn.addEventListener('click', () => this.closeAllModals()));
        $$('.modal-overlay').forEach(overlay => {
          overlay.addEventListener('click', e => {
            if (e.target === overlay) this.closeAllModals();
          });
        });

        const inventoryModalBody = $('#inventory-modal .modal-body');
        if (inventoryModalBody) {
          inventoryModalBody.addEventListener('click', e => {
            const target = e.target;
            const itemElement = target.closest('.inventory-item');
            if (!itemElement) return;
            const itemData = JSON.parse(itemElement.dataset.itemDetails.replace(/'/g, "'") || '{}');
            const category = itemElement.dataset.category;

            if (target.classList.contains('item-equip-btn')) {
              if (target.dataset.equipType === 'zhuxiu') this.equipItem(itemData, category, target, 'zhuxiuGongfa');
              else if (target.dataset.equipType === 'fuxiu') this.equipItem(itemData, category, target, 'fuxiuXinfa');
              else this.equipItem(itemData, category, target);
            } else if (target.classList.contains('item-use-btn')) {
              this.useItem(itemData, target);
            } else if (target.classList.contains('item-unequip-btn')) {
              const slotId = target.dataset.slotId;
              const slotElement = $(`#${slotId}`);
              if (slotElement) this.unequipItem(slotId, slotElement, true, true);
            } else if (target.classList.contains('item-discard-btn')) {
              this.discardItem(itemData, category, itemElement);
            }
          });
        }

        const characterPanel = $('.character-panel');
        if (characterPanel) {
          characterPanel.addEventListener('mouseover', e => {
            const slot = e.target.closest('.equipment-slot');
            if (slot && slot.classList.contains('equipped')) this.showEquipmentTooltip(slot, e);
          });
          characterPanel.addEventListener('mouseout', e => {
            const slot = e.target.closest('.equipment-slot');
            if (slot) this.hideEquipmentTooltip();
          });
          characterPanel.addEventListener('click', e => {
            const slot = e.target.closest('.equipment-slot');
            if (slot && slot.classList.contains('equipped')) this.unequipItem(slot.id, slot, true, false);
          });
        }

        $('#btn-quick-send')?.addEventListener('click', () => this.executeQuickSend());
        $('#btn-quick-commands')?.addEventListener('click', e => {
          e.stopPropagation();
          this.toggleQuickCommands();
        });

        document.addEventListener('click', e => {
          const popup = $('#quick-command-popup');
          const button = $('#btn-quick-commands');
          if (popup && button && popup.style.display === 'block') {
            if (!popup.contains(e.target) && !button.contains(e.target)) {
              this.hideQuickCommands();
            }
          }
        });

        const historyModal = $('#history-modal');
        if (historyModal) {
            historyModal.addEventListener('click', e => {
                if (e.target.id === 'btn-show-trim-modal') this.showTrimJourneyModal();
            });
            historyModal.addEventListener('change', e => {
                if (e.target.id === 'auto-trim-checkbox') {
                    const isEnabled = e.target.checked;
                    GuixuState.update('isAutoTrimEnabled', isEnabled);
                    this.showTemporaryMessage(`自动修剪已${isEnabled ? '开启' : '关闭'}`);
                }
            });
        }

        const trimModal = $('#trim-journey-modal');
        if (trimModal) {
            trimModal.addEventListener('click', e => {
                if (e.target.id === 'btn-confirm-trim') this.trimJourneyAutomation();
                if (e.target.id === 'btn-cancel-trim' || e.target.closest('.modal-close-btn')) this.closeAllModals();
            });
        }

        this.listenersBound = true;
      },

      // --- Modal Control ---
      async showGuixuSystem() {
        if (window.GuixuSystemComponent && typeof window.GuixuSystemComponent.show === 'function') {
          return window.GuixuSystemComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('guixu-system-modal');
        const body = $('#guixu-system-modal .modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">归墟系统组件未加载。</p>';
        }
      },

      async showCharacterDetails() {
        if (window.CharacterDetailsComponent && typeof window.CharacterDetailsComponent.show === 'function') {
          return window.CharacterDetailsComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('character-details-modal');
        const body = $('#character-details-modal .modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">角色详情组件未加载。</p>';
        }
      },

      openModal(modalId) {
        const { $, $$ } = GuixuDOM;
        this.closeAllModals();
        const modal = $(`#${modalId}`);
        if (modal) modal.style.display = 'flex';
      },

      closeAllModals() {
        const { $$ } = GuixuDOM;
        $$('.modal-overlay').forEach(modal => {
          modal.style.display = 'none';
        });
      },

      showCustomConfirm(message, onConfirm) {
        const { $ } = GuixuDOM;
        const modal = $('#custom-confirm-modal');
        const messageEl = $('#custom-confirm-message');
        const okBtn = $('#custom-confirm-btn-ok');
        const cancelBtn = $('#custom-confirm-btn-cancel');

        if (!modal || !messageEl || !okBtn || !cancelBtn) return;

        messageEl.textContent = message;

        // 使用 .cloneNode(true) 来移除旧的事件监听器
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);

        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newOkBtn.addEventListener('click', () => {
          this.closeAllModals();
          if (typeof onConfirm === 'function') {
            onConfirm();
          }
        });

        newCancelBtn.addEventListener('click', () => {
          this.closeAllModals();
        });

        this.openModal('custom-confirm-modal');
      },

      // --- Feature Implementations (now simplified) ---
      async showInventory() {
        if (window.InventoryComponent && typeof window.InventoryComponent.show === 'function') {
          return window.InventoryComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('inventory-modal');
        const body = $('#inventory-modal .modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">背包组件未加载。</p>';
        }
      },

      async showRelationships() {
        if (window.RelationshipsComponent && typeof window.RelationshipsComponent.show === 'function') {
          return window.RelationshipsComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('relationships-modal');
        const body = $('#relationships-modal .modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">人物关系组件未加载。</p>';
        }
      },


      updateTalentAndLinggen(data) {
        const { $ } = GuixuDOM;
        const container = $('#talent-linggen-list');
        if (!container) return;
        container.innerHTML = '';

        let html = '';

        // 1. 处理灵根列表 - 添加品阶排序
        const linggenList = GuixuAPI.lodash.get(data, '灵根列表.0', []);
        if (Array.isArray(linggenList) && linggenList.length > 0 && linggenList[0] !== '$__META_EXTENSIBLE__$') {
          // 解析并排序灵根
          const parsedLinggenList = [];
          linggenList.forEach(rawLinggen => {
            try {
              const linggen = typeof rawLinggen === 'string' ? JSON.parse(rawLinggen) : rawLinggen;
              if (linggen && typeof linggen === 'object') {
                parsedLinggenList.push(linggen);
              }
            } catch (e) {
              console.error('解析灵根失败:', rawLinggen, e);
            }
          });

          // 按品阶排序灵根（神品 > 仙品 > ... > 凡品）
          const sortedLinggenList = GuixuHelpers.sortByTier(parsedLinggenList, (linggen) =>
            GuixuHelpers.SafeGetValue(linggen, '品阶', '凡品')
          );

          sortedLinggenList.forEach(linggen => {
            const name = GuixuHelpers.SafeGetValue(linggen, '名称', '未知灵根');
            const tier = GuixuHelpers.SafeGetValue(linggen, '品阶', '凡品');
            const description = GuixuHelpers.SafeGetValue(linggen, '描述', '无描述');
            const tierStyle = GuixuHelpers.getTierColorStyle(tier);
            const itemDetailsHtml = this.renderItemDetailsForInventory(linggen);

            html += `
                 <details class="details-container">
                     <summary>
                         <span class="attribute-name">灵根</span>
                         <span class="attribute-value" style="${tierStyle}">【${tier}】 ${name}</span>
                     </summary>
                     <div class="details-content">
                         <p>${description}</p>
                         ${itemDetailsHtml ? `<div class="item-details">${itemDetailsHtml}</div>` : ''}
                     </div>
                 </details>
             `;
          });
        } else {
             html += `
               <div class="attribute-item">
                   <span class="attribute-name">灵根</span>
                   <span class="attribute-value">未觉醒</span>
               </div>
           `;
        }

        // 2. 处理天赋列表 - 添加品阶排序
        const tianfuList = GuixuAPI.lodash.get(data, '天赋列表.0', []);
        if (Array.isArray(tianfuList) && tianfuList.length > 0 && tianfuList[0] !== '$__META_EXTENSIBLE__$') {
          // 解析并排序天赋
          const parsedTianfuList = [];
          tianfuList.forEach(rawTianfu => {
            try {
              const tianfu = typeof rawTianfu === 'string' ? JSON.parse(rawTianfu) : rawTianfu;
              if (tianfu && typeof tianfu === 'object') {
                parsedTianfuList.push(tianfu);
              }
            } catch (e) {
              console.error('解析天赋失败:', rawTianfu, e);
            }
          });

          // 按品阶排序天赋（神品 > 仙品 > ... > 凡品）
          const sortedTianfuList = GuixuHelpers.sortByTier(parsedTianfuList, (tianfu) =>
            GuixuHelpers.SafeGetValue(tianfu, 'tier', '凡品')
          );

          sortedTianfuList.forEach(tianfu => {
            const name = GuixuHelpers.SafeGetValue(tianfu, 'name', '未知天赋');
            const tier = GuixuHelpers.SafeGetValue(tianfu, 'tier', '凡品');
            const description = GuixuHelpers.SafeGetValue(tianfu, 'description', '无描述');
            const tierStyle = GuixuHelpers.getTierColorStyle(tier);
            const itemDetailsHtml = this.renderItemDetailsForInventory(tianfu);

            html += `
                     <details class="details-container">
                         <summary>
                             <span class="attribute-name">天赋</span>
                             <span class="attribute-value" style="${tierStyle}">【${tier}】 ${name}</span>
                         </summary>
                         <div class="details-content">
                             <p>${description}</p>
                             ${itemDetailsHtml ? `<div class="item-details">${itemDetailsHtml}</div>` : ''}
                         </div>
                     </details>
                 `;
          });
        } else {
          html += `
               <div class="attribute-item">
                   <span class="attribute-name">天赋</span>
                   <span class="attribute-value">未觉醒</span>
               </div>
           `;
        }

        container.innerHTML = html;
      },


      // --- Tooltip and Equip Logic (重构后) ---
      renderTooltipContent(item) {
        // 根据最新的变量结构解析
        const tierStyle = GuixuHelpers.getTierStyle(GuixuHelpers.SafeGetValue(item, 'tier'));
        const level = GuixuHelpers.SafeGetValue(item, 'level', '');
        const tierDisplay = level
          ? `${GuixuHelpers.SafeGetValue(item, 'tier', '凡品')} ${level}`
          : GuixuHelpers.SafeGetValue(item, 'tier', '凡品');

        let attributesHtml = '';
        const attributes = item.attributes_bonus; // 直接使用新key
        if (typeof attributes === 'object' && attributes !== null && Object.keys(attributes).length > 0) {
          attributesHtml += `<div class="tooltip-section-title">固定加成</div>`;
          for (const [key, value] of Object.entries(attributes)) {
            attributesHtml += `<p><strong>${key}:</strong> ${value > 0 ? '+' : ''}${value}</p>`;
          }
        }

        const percentBonuses = item['百分比加成'];
        if (typeof percentBonuses === 'object' && percentBonuses !== null && Object.keys(percentBonuses).length > 0) {
          attributesHtml += `<div class="tooltip-section-title" style="margin-top: 5px;">百分比加成</div>`;
          for (const [key, value] of Object.entries(percentBonuses)) {
             attributesHtml += `<p><strong>${key}:</strong> +${value}</p>`;
          }
        }

        let effectsHtml = '';
        const effects = item.special_effects; // 直接使用新key
        if (Array.isArray(effects) && effects.length > 0) {
          effectsHtml += `<div class="tooltip-section-title">特殊词条</div>`;
          effectsHtml += effects.filter(eff => eff !== '$__META_EXTENSIBLE__$').map(eff => `<p>${eff}</p>`).join('');
        }

        return `
                <div class="tooltip-title" style="${tierStyle}">${GuixuHelpers.SafeGetValue(item, 'name')}</div>
                <p><strong>品阶:</strong> ${tierDisplay}</p>
                <p><i>${GuixuHelpers.SafeGetValue(item, 'description', '无描述')}</i></p>
                ${
                  attributesHtml
                    ? `<div class="tooltip-section tooltip-attributes">${attributesHtml}</div>`
                    : ''
                }
                ${effectsHtml ? `<div class="tooltip-section">${effectsHtml}</div>` : ''}
            `;
      },

      showEquipmentTooltip(element, event) {
        const { $ } = GuixuDOM;
        const tooltip = $('#equipment-tooltip');
        const itemDataString = element.dataset.itemDetails;
        if (!tooltip || !itemDataString) return;

        try {
          const item = JSON.parse(itemDataString.replace(/'/g, "'"));
          tooltip.innerHTML = this.renderTooltipContent(item);
          tooltip.style.display = 'block';

          // **关键修复**: 调整Tooltip位置以防止超出视口
          const tooltipRect = tooltip.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          let left = event.pageX + 15;
          let top = event.pageY + 15;

          // 如果Tooltip超出右边界，则显示在鼠标左侧
          if (left + tooltipRect.width > viewportWidth) {
            left = event.pageX - tooltipRect.width - 15;
          }

          // 如果Tooltip超出下边界，则显示在鼠标上侧
          if (top + tooltipRect.height > viewportHeight) {
            top = event.pageY - tooltipRect.height - 15;
          }

          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        } catch (e) {
          console.error('解析装备Tooltip数据失败:', e);
        }
      },

      hideEquipmentTooltip() {
        const { $ } = GuixuDOM;
        const tooltip = $('#equipment-tooltip');
        if (tooltip) tooltip.style.display = 'none';
      },

      renderItemDetailsForInventory(item) {
        let attributesHtml = '';
        const attributes = item.attributes_bonus;
        if (typeof attributes === 'object' && attributes !== null && Object.keys(attributes).length > 0) {
          attributesHtml += '<div class="tooltip-section-title" style="margin-top: 5px;">固定加成</div>';
          for (const [key, value] of Object.entries(attributes)) {
            attributesHtml += `<p><strong>${key}:</strong> ${value > 0 ? '+' : ''}${value}</p>`;
          }
        }

        const percentBonuses = item['百分比加成'];
        if (typeof percentBonuses === 'object' && percentBonuses !== null && Object.keys(percentBonuses).length > 0) {
          attributesHtml += '<div class="tooltip-section-title" style="margin-top: 5px;">百分比加成</div>';
          for (const [key, value] of Object.entries(percentBonuses)) {
             attributesHtml += `<p><strong>${key}:</strong> +${value}</p>`;
          }
        }

        let effectsHtml = '';
        let effects = item.special_effects;

        // 关键修复：处理 special_effects 可能是字符串（用\n分隔）或数组两种情况
        if (typeof effects === 'string' && effects.trim() !== '') {
            effects = effects.split('\n').map(e => e.trim()).filter(e => e);
        }

        if (Array.isArray(effects) && effects.length > 0) {
          effectsHtml += `<div class="tooltip-section-title" style="margin-top: 5px;">特殊词条</div>`;
          effectsHtml += effects.filter(eff => eff !== '$__META_EXTENSIBLE__$').map(eff => `<p>${eff}</p>`).join('');
        }

        return `${attributesHtml}${effectsHtml}`;
      },

      equipItem(item, category, buttonElement, equipType = null) {
        const { $ } = GuixuDOM;
        const itemId = GuixuHelpers.SafeGetValue(item, 'id');
        if (!itemId || itemId === 'N/A') {
          GuixuHelpers.showTemporaryMessage('物品无ID，无法装备。');
          return;
        }

        // Bug修复：检查功法是否已被装备在另一个槽位
        if (category === '功法') {
          const isEquippedAsMain = this.equippedItems.zhuxiuGongfa && this.equippedItems.zhuxiuGongfa.id === itemId;
          const isEquippedAsAux = this.equippedItems.fuxiuXinfa && this.equippedItems.fuxiuXinfa.id === itemId;

          if (
            (equipType === 'fuxiuXinfa' && isEquippedAsMain) ||
            (equipType === 'zhuxiuGongfa' && isEquippedAsAux)
          ) {
            GuixuHelpers.showTemporaryMessage('该功法已被装备在另一槽位。');
            return;
          }
        }

        const categoryMap = { 武器: 'wuqi', 防具: 'fangju', 饰品: 'shipin', 法宝: 'fabao1', 功法: equipType };
        const slotKey = categoryMap[category];

        if (!slotKey) {
          GuixuHelpers.showTemporaryMessage('错误的装备分类或类型。');
          return;
        }

        // **关键修复**: 检查物品是否已装备在其他槽位，如果是，则先卸载
        const currentlyEquippedSlot = Object.keys(this.equippedItems).find(
          key => this.equippedItems[key] && this.equippedItems[key].id === itemId,
        );
        if (currentlyEquippedSlot && currentlyEquippedSlot !== slotKey) {
          const oldSlotElement = $(`#equip-${currentlyEquippedSlot}`);
          if (oldSlotElement) {
            this.unequipItem(`equip-${currentlyEquippedSlot}`, oldSlotElement, false); // 静默卸载
          }
        }

        const slotElement = $(`#equip-${slotKey}`);
        if (!slotElement) return;

        // 如果该槽位已有装备，先执行卸载操作
        const oldItemId = this.equippedItems[slotKey];
        if (oldItemId) {
          this.unequipItem(`equip-${slotKey}`, slotElement, false);
        }

        // 更新前端状态和UI（乐观更新）
        this.equippedItems[slotKey] = item; // **逻辑修正**: 存储完整对象
        const tier = GuixuHelpers.SafeGetValue(item, 'tier', '凡品');
        const tierStyle = GuixuHelpers.getTierStyle(tier);
        slotElement.textContent = GuixuHelpers.SafeGetValue(item, 'name');
        slotElement.setAttribute('style', tierStyle);
        slotElement.classList.add('equipped');
        slotElement.dataset.itemDetails = JSON.stringify(item).replace(/'/g, "'");

        // 更新背包UI，使其能反映最新状态
        if (buttonElement.closest('#inventory-modal')) {
          this.showInventory();
        }

        // 添加到指令队列（优化：先移除旧指令，再添加新指令）
        const itemName = GuixuHelpers.SafeGetValue(item, 'name');
        const defaultTextMap = {
          wuqi: '武器',
          fangju: '防具',
          shipin: '饰品',
          fabao1: '法宝',
          zhuxiuGongfa: '主修功法',
          fuxiuXinfa: '辅修心法',
        };
        const slotFriendlyName = defaultTextMap[slotKey] || category;
        this.pendingActions = this.pendingActions.filter(action => action.itemName !== itemName);
        this.pendingActions.push({
          action: 'equip',
          itemName: itemName,
          category: slotFriendlyName,
        });

        GuixuHelpers.showTemporaryMessage(`已装备 ${GuixuHelpers.SafeGetValue(item, 'name')}`);
        this.updateDisplayedAttributes();
        this.saveEquipmentState(); // 保存状态
        this.savePendingActions(); // 保存指令状态
      },

      unequipItem(slotId, slotElement, showMessage = true, refreshInventoryUI = true) {
        const slotKey = slotId.replace('equip-', '');
        const defaultTextMap = {
          wuqi: '武器',
          fangju: '防具',
          shipin: '饰品',
          fabao1: '法宝',
          zhuxiuGongfa: '主修功法',
          fuxiuXinfa: '辅修心法',
        };

        const itemDataString = slotElement.dataset.itemDetails;
        if (!itemDataString) return; // 如果没有物品，则不执行任何操作

        let itemName = '一件装备';
        let itemId = null;
        try {
          const item = JSON.parse(itemDataString.replace(/'/g, "'"));
          itemName = GuixuHelpers.SafeGetValue(item, 'name');
          itemId = GuixuHelpers.SafeGetValue(item, 'id');
        } catch (e) {
          console.error('卸载时解析物品数据失败', e);
        }

        // 清理前端状态和UI
        this.equippedItems[slotKey] = null;
        slotElement.textContent = defaultTextMap[slotKey] || '空';
        slotElement.classList.remove('equipped');
        slotElement.removeAttribute('style');
        delete slotElement.dataset.itemDetails;

        // **关键修复**: 不再进行复杂的局部DOM更新，而是直接重新渲染整个背包以确保UI同步
        if (refreshInventoryUI) {
          this.showInventory();
        }

        // 添加到指令队列（优化：先移除旧指令，再添加新指令）
        this.pendingActions = this.pendingActions.filter(action => action.itemName !== itemName);
        this.pendingActions.push({
          action: 'unequip',
          itemName: itemName,
          category: defaultTextMap[slotKey],
        });

        if (showMessage) {
          GuixuHelpers.showTemporaryMessage(`已卸下 ${itemName}`);
        }
        this.updateDisplayedAttributes();
        this.saveEquipmentState(); // 保存状态
        this.savePendingActions(); // 保存指令状态
        // 注意：showInventory() 已经包含了关闭模态框再打开的过程，所以UI会刷新
      },

      loadEquipmentFromMVU(data) {
        const { $ } = GuixuDOM;
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

          // mvu中的装备数据通常是 [ { item_object } ] 的形式
          // **局部修复**: 直接使用 _.get 获取装备数组，避免 SafeGetValue 将其错误地转为字符串
          const itemArray = GuixuAPI.lodash.get(data, mvuKey, null);
          const item = Array.isArray(itemArray) && itemArray.length > 0 ? itemArray[0] : null;

          if (item && typeof item === 'object') {
            const tier = GuixuHelpers.SafeGetValue(item, 'tier', '凡品');
            const tierStyle = GuixuHelpers.getTierStyle(tier);
            // **逻辑修正**: 此处不再主动修改 this.equippedItems
            // this.equippedItems 的状态由 localStorage 和 equip/unequip 动作管理
            // this.equippedItems[slotKey] = item;
            slot.textContent = GuixuHelpers.SafeGetValue(item, 'name');
            slot.setAttribute('style', tierStyle);
            slot.classList.add('equipped');
            slot.dataset.itemDetails = JSON.stringify(item).replace(/'/g, "'");
          } else {
            // this.equippedItems[slotKey] = null; // **关键修复**: 此函数不应修改核心状态，只渲染从mvu得到的数据
            slot.textContent = defaultTextMap[slotKey];
            slot.classList.remove('equipped');
            slot.removeAttribute('style');
            delete slot.dataset.itemDetails;
          }
        }
      },

      updateDisplayedAttributes() {
        // 核心逻辑已移至 GuixuAttributeService
        GuixuAttributeService.updateDisplay();
      },

      showTemporaryMessage(message, duration = 2000) {
        GuixuHelpers.showTemporaryMessage(message, duration);
      },

      showCommandCenter() {
        if (window.CommandCenterComponent && typeof window.CommandCenterComponent.show === 'function') {
          return window.CommandCenterComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('command-center-modal');
        const body = $('#command-center-modal .modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">指令中心组件未加载。</p>';
        }
      },

      clearPendingActions() {
        this.pendingActions = [];
        this.showCommandCenter(); // 重新渲染指令中心以显示空状态
        this.showTemporaryMessage('指令已清空');
        this.savePendingActions();
      },

      refreshLocalStorage() {
        this.showCustomConfirm('这是为了刷新上一个聊天缓存数据，如果不是打开新聊天，请不要点击', () => {
          try {
            localStorage.removeItem('guixu_equipped_items');
            localStorage.removeItem('guixu_pending_actions');
            localStorage.removeItem('guixu_auto_write_enabled');
            this.showTemporaryMessage('缓存已清除，页面即将刷新...');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } catch (e) {
            console.error('清除本地存储失败:', e);
            this.showTemporaryMessage('清除缓存失败！');
          }
        });
      },

      async executePendingActions() {
        // 指令中心执行时，不带用户输入
        await this.handleAction();
      },

      useItem(item, buttonElement) {
        const itemName = GuixuHelpers.SafeGetValue(item, 'name');
        if (itemName === 'N/A') {
          GuixuHelpers.showTemporaryMessage('物品信息错误，无法使用。');
          return;
        }

        // **BUG修复**: 不再手动操作DOM，而是通过刷新背包来更新UI
        // 检查待定队列中的数量，以防止用户超额使用
        const originalQuantity = parseInt(GuixuHelpers.SafeGetValue(item, 'quantity', 0), 10);
        const pendingUses = this.pendingActions
          .filter(action => action.action === 'use' && action.itemName === itemName)
          .reduce((total, action) => total + action.quantity, 0);

        if (originalQuantity - pendingUses <= 0) {
          GuixuHelpers.showTemporaryMessage(`${itemName} 已用完或已在指令队列中。`);
          return;
        }

        // 更新指令队列
        const existingAction = this.pendingActions.find(
          action => action.action === 'use' && action.itemName === itemName,
        );

        if (existingAction) {
          existingAction.quantity++;
        } else {
          this.pendingActions.push({
            action: 'use',
            itemName: itemName,
            quantity: 1,
          });
        }

        GuixuHelpers.showTemporaryMessage(`已将 [使用 ${itemName}] 加入指令队列`);
        this.savePendingActions();

        // 通过重新渲染整个背包来保证UI一致性
        this.showInventory();
      },

      discardItem(item, category, itemElement) {
        const itemName = GuixuHelpers.SafeGetValue(item, 'name');
        if (itemName === 'N/A') {
          GuixuHelpers.showTemporaryMessage('物品信息错误，无法丢弃。');
          return;
        }

        const hasQuantity = item.hasOwnProperty('quantity');
        
        if (hasQuantity && (category === '丹药' || category === '杂物')) {
          // 有数量的物品，需要输入丢弃数量
          this.promptDiscardQuantity(item, category, itemElement);
        } else {
          // 装备类物品，直接确认丢弃
          this.confirmDiscardItem(item, category, itemElement, 1);
        }
      },

      async promptDiscardQuantity(item, category, itemElement) {
        const { h, $ } = GuixuDOM;
        const itemName = GuixuHelpers.SafeGetValue(item, 'name');
        const currentQuantity = parseInt(GuixuHelpers.SafeGetValue(item, 'quantity', 0), 10);
        
        const pendingUses = this.pendingActions
          .filter(action => action.action === 'use' && action.itemName === itemName)
          .reduce((total, action) => total + action.quantity, 0);
        const pendingDiscards = this.pendingActions
          .filter(action => action.action === 'discard' && action.itemName === itemName)
          .reduce((total, action) => total + action.quantity, 0);
        const availableQuantity = currentQuantity - pendingUses - pendingDiscards;

        if (availableQuantity <= 0) {
          GuixuHelpers.showTemporaryMessage(`${itemName} 没有可丢弃的数量。`);
          return;
        }

        return new Promise((resolve) => {
          const container = $('.guixu-root-container');
          if (!container) return resolve();

          const input = h('input', {
            type: 'number', id: 'discard-quantity-input', min: '1', max: availableQuantity, value: '1',
            style: 'width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #8b7355; color: #e0dcd1; border-radius: 4px; font-size: 14px; margin-bottom: 20px;'
          });

          const confirmBtn = h('button', {
            id: 'discard-quantity-confirm', 
            className: 'interaction-btn', 
            textContent: '确认丢弃',
            style: 'padding: 10px 8px; background: #8b0000; border: 1px solid #ff6b6b; color: #fff; border-radius: 5px; font-size: 12px; font-family: "Microsoft YaHei", sans-serif; cursor: pointer;',
            onclick: () => {
              const quantity = parseInt(input.value, 10);
              if (isNaN(quantity) || quantity <= 0 || quantity > availableQuantity) {
                this.showTemporaryMessage('请输入有效的丢弃数量');
                return;
              }
              modal.remove();
              this.confirmDiscardItem(item, category, itemElement, quantity);
              resolve();
            }
          });

          const cancelBtn = h('button', {
            id: 'discard-quantity-cancel', 
            className: 'interaction-btn', 
            textContent: '取消',
            style: 'padding: 10px 8px; background: linear-gradient(45deg, #1a1a2e, #2d1b3d); border: 1px solid #c9aa71; border-radius: 5px; color: #c9aa71; font-size: 12px; font-family: "Microsoft YaHei", sans-serif; cursor: pointer;',
            onclick: () => {
              modal.remove();
              resolve();
            }
          });

          const modal = h('div', { className: 'modal-overlay', style: 'display: flex; z-index: 2000; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); justify-content: center; align-items: center;' }, [
            h('div', { className: 'modal-content', style: 'background: rgba(26, 26, 46, 0.95); border: 1px solid #c9aa71; border-radius: 8px; padding: 20px; width: 400px; height: auto; max-height: none; box-shadow: 0 0 20px rgba(201, 170, 113, 0.3);' }, [
              h('div', { className: 'modal-header', style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(201, 170, 113, 0.5); padding-bottom: 10px; margin-bottom: 15px;' }, [h('h2', { className: 'modal-title', style: 'font-size: 18px; color: #c9aa71; margin: 0;' }, ['丢弃物品'])]),
              h('div', { className: 'modal-body', style: 'padding: 20px; color: #e0dcd1;' }, [
                h('p', { style: 'margin-bottom: 15px; color: #c9aa71;' }, ['请输入要丢弃的 ', h('strong', {}, [itemName]), ' 数量：']),
                h('p', { style: 'font-size: 12px; color: #8b7355; margin-bottom: 10px;' }, [`当前可丢弃数量：${availableQuantity}`]),
                input,
                h('div', { style: 'display: flex; gap: 10px; justify-content: flex-end;' }, [cancelBtn, confirmBtn])
              ])
            ])
          ]);

          container.appendChild(modal);
          setTimeout(() => input.focus(), 100);
        });
      },

      confirmDiscardItem(item, category, itemElement, quantity = 1) {
        const itemName = GuixuHelpers.SafeGetValue(item, 'name');
        const hasQuantity = item.hasOwnProperty('quantity');
        
        let confirmMessage;
        if (hasQuantity) {
          confirmMessage = `确定要丢弃 ${quantity} 个 ${itemName} 吗？此操作不可恢复。`;
        } else {
          confirmMessage = `确定要丢弃 ${itemName} 吗？此操作不可恢复。`;
        }

        this.showCustomConfirm(confirmMessage, () => {
          // 添加到指令队列
          this.pendingActions.push({
            action: 'discard',
            itemName: itemName,
            category: category,
            quantity: quantity
          });

          this.savePendingActions();
          
          // 前端乐观显示：刷新背包以反映变化
          this.showInventory();
          
          if (hasQuantity) {
            GuixuHelpers.showTemporaryMessage(`已将 [丢弃 ${quantity} 个 ${itemName}] 加入指令队列`);
          } else {
            GuixuHelpers.showTemporaryMessage(`已将 [丢弃 ${itemName}] 加入指令队列`);
          }
        });
      },

      showExtractedContent() {
        if (window.ExtractedContentComponent && typeof window.ExtractedContentComponent.show === 'function') {
          return window.ExtractedContentComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('extracted-content-modal');
        const body = $('#extracted-content-modal .modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">查看提取内容组件未加载。</p>';
        }
      },

      async showJourney() {
        if (window.JourneyComponent && typeof window.JourneyComponent.show === 'function') {
          return window.JourneyComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('history-modal');
        const body = $('#history-modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">本世历程组件未加载。</p>';
        }
      },

      async showPastLives() {
        if (window.PastLivesComponent && typeof window.PastLivesComponent.show === 'function') {
          return window.PastLivesComponent.show();
        }
        // 组件未加载时的回退处理
        const { $ } = GuixuDOM;
        this.openModal('history-modal');
        const body = $('#history-modal-body');
        if (body) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">往世涟漪组件未加载。</p>';
        }
      },

      // --- Rendering Logic for Dynamic Content (Lorebooks) ---








      // --- 写入世界书的调用已移至 ActionService 和 StateService ---


      async loadAndDisplayCurrentScene(messageContent = null) {
        const { $ } = GuixuDOM;
        const gameTextDisplay = $('#game-text-display');
        if (!gameTextDisplay) return;

        try {
          let contentToParse = messageContent;

          // 如果没有直接提供内容，则从聊天记录中获取
          if (contentToParse === null) {
            const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
            if (!messages || messages.length === 0) return;
            const lastAiMessage = [...messages].reverse().find(m => m.role === 'assistant');
            if (lastAiMessage) {
              contentToParse = lastAiMessage.message;
            }
          }

          if (contentToParse) {
            // 1. 更新主界面正文 (使用新的健壮的提取函数)
            const displayText = this._getDisplayText(contentToParse);
            gameTextDisplay.innerHTML = this.formatMessageContent(displayText);

            // 2. 同步提取所有标签内容到变量，用于“查看提取内容”模态框
            this.lastExtractedNovelText = this._extractLastTagContent('gametxt', contentToParse);
            this.lastExtractedJourney = this._extractLastTagContent('本世历程', contentToParse);
            this.lastExtractedPastLives = this._extractLastTagContent('往世涟漪', contentToParse);
            this.lastExtractedVariables = this._extractLastTagContent('UpdateVariable', contentToParse, true); // ignore case
            this.lastExtractedCharacterCard = this._extractLastTagContent('角色提取', contentToParse);
          }
        } catch (error) {
          console.error(`[归墟] 加载并显示当前场景时出错:`, error);
          gameTextDisplay.innerHTML = `<gametxt>加载场景时出错。</gametxt>`;
        }
      },



       // --- Misc ---
       applyRandomBackground() {
        const { $ } = GuixuDOM;
        const backgrounds = [
          'https://i.postimg.cc/ZqvGBxxF/rgthree-compare-temp-hxqke-00004.png',
          'https://i.postimg.cc/fRP4RrmR/rgthree-compare-temp-hxqke-00002.png',
        ];
        const bgUrl = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        const container = $('.guixu-root-container');
        if (container) container.style.backgroundImage = `url('${bgUrl}')`;
      },

      async executeQuickSend() {
        const { $ } = GuixuDOM;
        const input = $('#quick-send-input');
        if (!input) return;
        const userMessage = input.value.trim();
        await this.handleAction(userMessage);
      },

      // 新增：处理所有动作的核心函数

      async handleAction(userMessage = '') {
        this.showWaitingMessage();
        try {
            const { newMvuState, aiResponse } = await GuixuActionService.handleAction(userMessage);

            // 更新UI
            this.renderUI(newMvuState.stat_data);
            await this.loadAndDisplayCurrentScene(aiResponse);

            // 清理工作
            const input = GuixuDOM.$('#quick-send-input');
            if (input) input.value = '';
            GuixuState.update('pendingActions', []);
            this.closeAllModals();
            this.showTemporaryMessage('伟大梦星已回应。');

        } catch (error) {
            console.error('处理动作时出错:', error);
            this.showTemporaryMessage(`和伟大梦星沟通失败: ${error.message}`);
        } finally {
            this.hideWaitingMessage();
            // 最终确保UI同步
            await this.updateDynamicData();
        }
      },

      // --- 新增：快速指令列表相关函数 ---
      toggleQuickCommands() {
        const { $ } = GuixuDOM;
        const popup = $('#quick-command-popup');
        if (!popup) return;

        if (popup.style.display === 'block') {
          this.hideQuickCommands();
        } else {
          this.showQuickCommands();
        }
      },

      showQuickCommands() {
        const { $ } = GuixuDOM;
        const popup = $('#quick-command-popup');
        if (!popup) return;

        if (this.pendingActions.length === 0) {
          popup.innerHTML = '<div class="quick-command-empty">暂无待执行的指令</div>';
        } else {
          let listHtml = '<ul class="quick-command-list">';
          this.pendingActions.forEach(cmd => {
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
                if (cmd.quantity && cmd.quantity > 1) {
                  actionText = `丢弃 ${cmd.quantity} 个 [${cmd.itemName}]。`;
                } else {
                  actionText = `丢弃 [${cmd.itemName}]。`;
                }
                break;
            }
            // 列表项不再需要data-command属性
            listHtml += `<li class="quick-command-item">${actionText}</li>`;
          });
          listHtml += '</ul>';
          popup.innerHTML = listHtml;
        }
        popup.style.display = 'block';
      },

      hideQuickCommands() {
        const { $ } = GuixuDOM;
        const popup = $('#quick-command-popup');
        if (popup) {
          popup.style.display = 'none';
        }
      },


      // Save/Load functionality has been removed as it's not part of the UI coordinator's responsibility.
    };
    
     // --- Entry Point ---
     // 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
    // 导出到全局，供 ActionService/State 等模块访问
    window.GuixuManager = GuixuManager;
    eventOn(tavern_events.APP_READY, () => {
      GuixuManager.init();
    });

    // 事件监听已在 GuixuManager.init() 中处理，此处不再需要
  })();
