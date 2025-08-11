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
      const { $, h } = GuixuDOM;
      this.openModal('guixu-system-modal');
      const body = $('#guixu-system-modal .modal-body');
      if (!body) return;
      body.innerHTML =
        '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在连接归墟...</p>';

      try {
        const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
        const stat_data = messages?.[0]?.data?.stat_data;
        if (!stat_data) {
          body.innerHTML =
            '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法连接归墟。</p>';
          return;
        }

        const currentLife = GuixuHelpers.SafeGetValue(stat_data, '当前第x世', '1');
        const guixuSpace = GuixuHelpers.SafeGetValue(stat_data, '归墟空间', '空无一物');
        const currentChoice = GuixuHelpers.SafeGetValue(stat_data, '本世归墟选择', '无');
        const chargeTime = GuixuHelpers.SafeGetValue(stat_data, '归墟充能时间', '0');
        const shengli = GuixuHelpers.SafeGetValue(stat_data, '生理年龄', 'N/A');
        const shengliMax = GuixuHelpers.SafeGetValue(stat_data, '生理年龄上限', 'N/A');
        const xinli = GuixuHelpers.SafeGetValue(stat_data, '心理年龄', 'N/A');
        const xinliMax = GuixuHelpers.SafeGetValue(stat_data, '心理年龄上限', 'N/A');

          body.innerHTML = `
                <div class="panel-section">
                    <div class="attributes-list">
                        <div class="attribute-item"><span class="attribute-name">当前世数</span><span class="attribute-value">第 ${currentLife} 世</span></div>
                        <div class="attribute-item"><span class="attribute-name">生理年龄</span><span class="attribute-value">${shengli} / ${shengliMax}</span></div>
                        <div class="attribute-item"><span class="attribute-name">心理年龄</span><span class="attribute-value">${xinli} / ${xinliMax}</span></div>
                        <div class="attribute-item"><span class="attribute-name">归墟空间</span><span class="attribute-value">${guixuSpace}</span></div>
                        <div class="attribute-item"><span class="attribute-name">本世抉择</span><span class="attribute-value">${currentChoice}</span></div>
                        <div class="attribute-item" style="margin-top: 15px;"><span class="attribute-name">归墟充能</span><span class="attribute-value">${chargeTime}%</span></div>
                        <div class="details-progress-bar">
                            <div class="details-progress-fill" style="width: ${chargeTime}%; background: linear-gradient(90deg, #dc143c, #ff6b6b, #ffd700);"></div>
                        </div>
                    </div>
                </div>
                <div style="padding: 20px 10px; text-align: center;">
                     <button id="btn-trigger-guixu" class="interaction-btn primary-btn" style="width: 80%; padding: 12px; font-size: 16px;">归 墟</button>
                </div>
            `;

          // 为动态添加的按钮绑定事件
          $('#btn-trigger-guixu').addEventListener('click', () => {
              if (chargeTime >= 100) {
                this.showCustomConfirm('你确定要开启下一次轮回吗？所有未储存的记忆都将消散。', async () => {
                  try {
                    const command = '{{user}}选择归墟，世界将回到最初的锚点';
                    await this.handleAction(command); // 改为调用 handleAction
                    GuixuHelpers.showTemporaryMessage('轮回已开启...');
                    this.closeAllModals();
                  } catch (error) {
                    console.error('执行归墟指令时出错:', error);
                    GuixuHelpers.showTemporaryMessage('执行归墟指令失败！');
                  }
                });
              } else {
                GuixuHelpers.showTemporaryMessage('归墟充能进度不足');
              }
          });
        } catch (error) {
          console.error('加载归墟系统时出错:', error);
          body.innerHTML =
            '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载数据时出错。</p>';
        }
      },

      async showCharacterDetails() {
        const { $ } = GuixuDOM;
        this.openModal('character-details-modal');
        const body = $('#character-details-modal .modal-body');
        if (!body) return;
        body.innerHTML =
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在加载角色数据...</p>';

        try {
          const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
          const stat_data = messages?.[0]?.data?.stat_data;
          if (!stat_data) {
            body.innerHTML =
              '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法加载角色数据。</p>';
            return;
          }

          // 确保 this.baseAttributes 和装备加成是最新的
          this.updateDisplayedAttributes();

          // 从已渲染的左侧面板获取值，确保与显示一致
          const fali = $('#attr-fali').innerText;
          const shenhai = $('#attr-shenhai').innerText;
          const daoxin = $('#attr-daoxin').innerText;
          const kongsu = $('#attr-kongsu').innerText;
          const qiyun = $('#attr-qiyun').innerText;
          const shengli = $('#attr-shengli').innerText;
          const xinli = $('#attr-xinli').innerText;

          // 从 stat_data 获取新增的值
          const xiuxingjindu = GuixuHelpers.SafeGetValue(stat_data, '修为进度', '0');
          const xiuxingpingjing = GuixuHelpers.SafeGetValue(stat_data, '修为瓶颈', '无');

          // 构建HTML
          body.innerHTML = `
                <div class="panel-section">
                    <div class="section-title">核心属性 <span style="font-size: 10px; color: #8b7355;">(当前/上限)</span></div>
                    <div class="attributes-list">
                        <div class="attribute-item"><span class="attribute-name">法力</span><span class="attribute-value">${fali}</span></div>
                        <div class="attribute-item"><span class="attribute-name">神海</span><span class="attribute-value">${shenhai}</span></div>
                        <div class="attribute-item"><span class="attribute-name">道心</span><span class="attribute-value">${daoxin}</span></div>
                        <div class="attribute-item"><span class="attribute-name">空速</span><span class="attribute-value">${kongsu}</span></div>
                        <div class="attribute-item"><span class="attribute-name">气运</span><span class="attribute-value">${qiyun}</span></div>
                        <div class="attribute-item"><span class="attribute-name">生理年龄</span><span class="attribute-value">${shengli}</span></div>
                        <div class="attribute-item"><span class="attribute-name">心理年龄</span><span class="attribute-value">${xinli}</span></div>
                    </div>
                </div>
                <div class="panel-section">
                    <div class="section-title">修为详情</div>
                    <div class="attributes-list">
                        <div class="attribute-item">
                            <span class="attribute-name">修为进度</span>
                            <span class="attribute-value">${xiuxingjindu}%</span>
                        </div>
                        <div class="details-progress-bar">
                            <div class="details-progress-fill" style="width: ${xiuxingjindu}%;"></div>
                        </div>
                        <div class="attribute-item" style="margin-top: 8px;">
                            <span class="attribute-name">当前瓶颈</span>
                            <span class="attribute-value">${xiuxingpingjing}</span>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
          console.error('加载角色详情时出错:', error);
          body.innerHTML =
            '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载数据时出错。</p>';
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
        const { $ } = GuixuDOM;
        this.openModal('inventory-modal');
        const body = $('#inventory-modal .modal-body');
        if (!body) return;

        body.innerHTML =
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在清点行囊...</p>';

        try {
          const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
          if (!messages || messages.length === 0 || !messages[0].data || !messages[0].data.stat_data) {
            body.innerHTML =
              '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法获取背包数据。</p>';
            console.warn('无法从当前消息中加载 stat_data 用于背包。');
            return;
          }
          const stat_data = messages[0].data.stat_data;
          body.innerHTML = this.renderInventory(stat_data || {});
        } catch (error) {
          console.error('加载背包时出错:', error);
          body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载背包时出错: ${error.message}</p>`;
        }
      },

      async showRelationships() {
        const { $ } = GuixuDOM;
        this.openModal('relationships-modal');
        const body = $('#relationships-modal .modal-body');
        if (!body) return;

        body.innerHTML =
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在梳理人脉...</p>';

        try {
          const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
          if (!messages || messages.length === 0 || !messages[0].data || !messages[0].data.stat_data) {
            body.innerHTML =
              '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法获取人物关系数据。</p>';
            return;
          }
          const stat_data = messages[0].data.stat_data;
          let relationships = stat_data['人物关系列表']?.[0];

          // **关键修复**: 处理从mvu加载的数据可能是字符串化JSON的情况
          if (typeof relationships === 'string') {
            try {
              relationships = JSON.parse(relationships);
            } catch (e) {
              console.error('解析人物关系列表字符串失败:', e);
              relationships = []; // 解析失败则视为空数组
            }
          }

          body.innerHTML = this.renderRelationships(relationships || []);
        } catch (error) {
          console.error('加载人物关系时出错:', error);
          body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载人物关系时出错: ${error.message}</p>`;
        }
      },

      renderRelationships(relationships) {
        if (
          !Array.isArray(relationships) ||
          relationships.length === 0 ||
          relationships[0] === '$__META_EXTENSIBLE__$'
        ) {
          return '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">红尘俗世，暂无纠葛。</p>';
        }

        let html = '';
        relationships.forEach(rawRel => {
          try {
            const rel = typeof rawRel === 'string' ? JSON.parse(rawRel) : rawRel;

            const name = GuixuHelpers.SafeGetValue(rel, 'name', '未知之人');
            const tier = GuixuHelpers.SafeGetValue(rel, 'tier', '凡人');
            const level = GuixuHelpers.SafeGetValue(rel, '等级', '');
            const relationship = GuixuHelpers.SafeGetValue(rel, 'relationship', '萍水相逢');
            const description = GuixuHelpers.SafeGetValue(rel, 'description', '背景不详');
            const favorability = parseInt(GuixuHelpers.SafeGetValue(rel, 'favorability', 0), 10);
            const eventHistory = rel.event_history || [];

            const tierStyle = GuixuHelpers.getTierStyle(tier);
            const favorabilityPercent = Math.max(0, Math.min(100, (favorability / 200) * 100)); // 假设好感度上限为200
            const cultivationDisplay = level ? `${tier} ${level}` : tier;

            html += `
                        <div class="relationship-card">
                            <div class="relationship-body">
                                <p class="relationship-name" style="${tierStyle}">${name}</p>
                                <p>${description}</p>
                                
                                <div class="relationship-meta">
                                    <span>关系: ${relationship}</span>
                                    <span>修为: <span style="${tierStyle}">${cultivationDisplay}</span></span>
                                </div>

                                <p style="margin-top: 10px;">好感度: ${favorability}</p>
                                <div class="favorability-bar-container">
                                    <div class="favorability-bar-fill" style="width: ${favorabilityPercent}%;"></div>
                                </div>

                                ${
                                  Array.isArray(eventHistory) && eventHistory.length > 0
                                    ? `
                                <details class="event-history-details">
                                    <summary class="event-history-summary">过往交集</summary>
                                    <ul class="event-history-list">
                                        ${eventHistory.filter(event => event !== '$__META_EXTENSIBLE__$' && event !== '...').map(event => `<li>${event}</li>`).join('')}
                                    </ul>
                                </details>
                                `
                                    : ''
                                }
                            </div>
                        </div>
                    `;
          } catch (e) {
            console.error('解析人物关系失败:', rawRel, e);
          }
        });

        return (
          html ||
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">红尘俗世，暂无纠葛。</p>'
        );
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

      renderInventory(stat_data) {
        if (!stat_data || Object.keys(stat_data).length === 0) {
          return '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">背包数据为空。</p>';
        }

        const categories = [
          { title: '功法', key: '功法列表', equipable: true },
          { title: '武器', key: '武器列表', equipable: true },
          { title: '防具', key: '防具列表', equipable: true },
          { title: '饰品', key: '饰品列表', equipable: true },
          { title: '法宝', key: '法宝列表', equipable: true },
          { title: '丹药', key: '丹药列表', equipable: false },
          { title: '杂物', key: '其他列表', equipable: false },
        ];

        let html = '';

        categories.forEach(cat => {
          const rawItems = stat_data?.[cat.key]?.[0];

          html += `<details class="inventory-category" open>`;
          html += `<summary class="inventory-category-title">${cat.title}</summary>`;

          if (Array.isArray(rawItems) && rawItems.length > 0 && rawItems[0] !== '$__META_EXTENSIBLE__$') {
            html += '<div class="inventory-item-list">';
            
            // --- 新增：解析并按品阶排序物品 ---
            const parsedItems = [];
            rawItems.forEach(rawItem => {
              try {
                // **关键修复**: 在处理前检查 rawItem 是否为 null 或 undefined
                if (!rawItem) {
                    console.warn(`在分类 "${cat.title}" 中发现一个空的物品条目，已跳过。`);
                    return; // 跳过这个无效的条目
                }
                const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
                if (item && typeof item === 'object') {
                  parsedItems.push(item);
                }
              } catch (e) {
                console.error('解析背包物品失败:', rawItem, e);
              }
            });

            // 按品阶排序物品（神品 > 仙品 > ... > 凡品）
            const sortedItems = GuixuHelpers.sortByTier(parsedItems, (item) =>
              GuixuHelpers.SafeGetValue(item, 'tier', '凡品')
            );

            sortedItems.forEach(item => {
              try {
                // 确保传递给前端的数据是完整的
                const itemJson = JSON.stringify(item).replace(/'/g, "'");

                const name = GuixuHelpers.SafeGetValue(item, 'name', '未知物品');
                const id = GuixuHelpers.SafeGetValue(item, 'id', null);
                const tier = GuixuHelpers.SafeGetValue(item, 'tier', '无');
                const hasQuantity = item.hasOwnProperty('quantity');
                const quantity = parseInt(GuixuHelpers.SafeGetValue(item, 'quantity', 1), 10);
                const description = GuixuHelpers.SafeGetValue(
                  item,
                  'description',
                  GuixuHelpers.SafeGetValue(item, 'effect', '无描述'),
                );

                // **BUG修复**: 计算显示数量时，减去待处理队列中的使用和丢弃数量
                const pendingUses = this.pendingActions
                  .filter(action => action.action === 'use' && action.itemName === name)
                  .reduce((total, action) => total + action.quantity, 0);
                const pendingDiscards = this.pendingActions
                  .filter(action => action.action === 'discard' && action.itemName === name)
                  .reduce((total, action) => total + action.quantity, 0);
                const displayQuantity = quantity - pendingUses - pendingDiscards;

                // 如果物品数量为0或负数，跳过渲染（实现前端乐观隐藏）
                if (hasQuantity && displayQuantity <= 0) {
                  return; // 跳过这个物品的渲染
                }

                // 对于装备类物品，如果在待丢弃队列中，也跳过渲染
                if (!hasQuantity && pendingDiscards > 0) {
                  return; // 跳过这个物品的渲染
                }

                const tierStyle = GuixuHelpers.getTierStyle(tier);
                const tierDisplay =
                  tier !== '无' ? `<span style="${tierStyle} margin-right: 15px;">品阶: ${tier}</span>` : '';
                const quantityDisplay = hasQuantity ? `<span class="item-quantity">数量: ${displayQuantity}</span>` : '';

                // **关键修复**: 检查物品是否已被装备
                const isEquipped = id ? Object.values(this.equippedItems).some(equippedItem => equippedItem && equippedItem.id === id) : false;
                let actionButton = '';

                if (cat.title === '功法') {
                  const isEquippedAsMain =
                    id && this.equippedItems.zhuxiuGongfa && this.equippedItems.zhuxiuGongfa.id === id;
                  const isEquippedAsAux =
                    id && this.equippedItems.fuxiuXinfa && this.equippedItems.fuxiuXinfa.id === id;

                  if (isEquippedAsMain) {
                    actionButton = `
                            <button class="item-unequip-btn" data-slot-id="equip-zhuxiuGongfa" style="margin-left: 5px;">卸下</button>
                            <button class="item-equip-btn" data-equip-type="fuxiu" style="margin-left: 5px; opacity: 0.5; cursor: not-allowed;" disabled>辅修</button>
                        `;
                  } else if (isEquippedAsAux) {
                    actionButton = `
                            <button class="item-equip-btn" data-equip-type="zhuxiu" style="margin-left: 5px; opacity: 0.5; cursor: not-allowed;" disabled>主修</button>
                            <button class="item-unequip-btn" data-slot-id="equip-fuxiuXinfa" style="margin-left: 5px;">卸下</button>
                        `;
                  } else {
                    actionButton = `
                            <button class="item-equip-btn" data-equip-type="zhuxiu" style="margin-left: 5px;">主修</button>
                            <button class="item-equip-btn" data-equip-type="fuxiu" style="margin-left: 5px;">辅修</button>
                        `;
                  }
                } else if (cat.equipable) {
                  if (isEquipped) {
                    const slotKey = Object.keys(this.equippedItems).find(
                      key => this.equippedItems[key] && this.equippedItems[key].id === id,
                    );
                    actionButton = `<button class="item-unequip-btn" data-slot-id="equip-${slotKey}">卸下</button>`;
                  } else {
                    actionButton = `<button class="item-equip-btn">装备</button>`;
                  }
                } else if (cat.title === '丹药' || cat.title === '杂物') {
                  if (displayQuantity <= 0) {
                      actionButton = `<button class="item-use-btn" disabled>已用完</button>`;
                  } else {
                      actionButton = `<button class="item-use-btn">使用</button>`;
                  }
                }

                // 为所有物品添加丢弃按钮
                if (cat.title === '丹药' || cat.title === '杂物') {
                  // 有数量的物品，需要输入数量
                  actionButton += `<button class="item-discard-btn" style="margin-left: 5px; background: #8b0000; border-color: #ff6b6b;">丢弃</button>`;
                } else {
                  // 装备类物品，直接丢弃
                  actionButton += `<button class="item-discard-btn" style="margin-left: 5px; background: #8b0000; border-color: #ff6b6b;">丢弃</button>`;
                }

                let itemDetailsHtml = this.renderItemDetailsForInventory(item);

                html += `
                                <div class="inventory-item" data-item-details='${itemJson}' data-category='${
                  cat.title
                }'>
                                    <div class="item-header">
                                        <div class="item-name-desc">
                                            <span class="item-name" style="${tierStyle}">${name}</span>
                                            <div class="item-description">${description}</div>
                                        </div>
                                        <div class="item-meta" style="text-align: right; white-space: nowrap; display: flex; align-items: center;">
                                            ${tierDisplay}
                                            ${quantityDisplay}
                                            ${actionButton}
                                        </div>
                                    </div>
                                    ${itemDetailsHtml ? `<div class="item-details">${itemDetailsHtml}</div>` : ''}
                                </div>
                            `;
              } catch (e) {
                console.error('解析背包物品失败:', item, e);
                html += `<div class="inventory-item"><p class="item-description">物品数据格式错误</p></div>`;
              }
            });
            html += '</div>';
          } else {
            html += '<div class="inventory-item-list"><p class="empty-category-text">空空如也</p></div>';
          }
          html += `</details>`;
        });

        return html;
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
        const { $ } = GuixuDOM;
        this.openModal('command-center-modal');
        const body = $('#command-center-modal .modal-body');
        if (!body) return;

        if (this.pendingActions.length === 0) {
          body.innerHTML =
            '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">暂无待执行的指令。</p>';
          return;
        }

        let html = '<ul class="command-center-actions">';
        this.pendingActions.forEach(cmd => {
          let actionText = '';
          switch (cmd.action) {
            case 'equip':
              actionText = `[装备] ${cmd.itemName} 到 ${cmd.category}`;
              break;
            case 'unequip':
              actionText = `[卸下] ${cmd.itemName} 从 ${cmd.category}`;
              break;
            case 'use':
              actionText = `[使用] ${cmd.itemName} x ${cmd.quantity}`;
              break;
            case 'discard':
              if (cmd.quantity && cmd.quantity > 1) {
                actionText = `[丢弃] ${cmd.itemName} x ${cmd.quantity}`;
              } else {
                actionText = `[丢弃] ${cmd.itemName}`;
              }
              break;
          }
          html += `<li class="command-center-action-item">${actionText}</li>`;
        });
        html += '</ul>';
        body.innerHTML = html;
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
        const { $ } = GuixuDOM;
        this.openModal('extracted-content-modal');
        const journeyEl = $('#extracted-journey');
        const pastLivesEl = $('#extracted-past-lives');
        const variablesEl = $('#extracted-variable-changes');
        const sentPromptEl = $('#sent-prompt-display');

        if (sentPromptEl) {
          sentPromptEl.textContent = this.lastSentPrompt || '尚未发送任何内容';
        }
        if (journeyEl) {
          journeyEl.textContent = this.lastExtractedJourney || '未提取到内容';
        }
        if (pastLivesEl) {
          pastLivesEl.textContent = this.lastExtractedPastLives || '未提取到内容';
        }
        if (variablesEl) {
          variablesEl.textContent = this.lastExtractedVariables || '本次无变量改变';
        }
        const novelModeEl = $('#extracted-novel-mode');
        const novelModeBtn = $('#btn-write-novel-mode');
        if (novelModeEl && novelModeBtn) {
          // 新逻辑：始终显示提取到的内容。按钮可用性仅取决于内容是否存在。
          novelModeEl.textContent = this.lastExtractedNovelText || '当前AI回复中未提取到正文内容。';
          novelModeBtn.disabled = !this.lastExtractedNovelText;

          // 更新标签文本以提供关于自动写入状态的即时反馈
          const label = document.querySelector('label[for="novel-mode-enabled-checkbox"]');
          if (label) {
            const statusText = this.isNovelModeEnabled ? '开启' : '关闭';
            label.title = `点击切换自动写入状态，当前为：${statusText}`;
          }
        }

        // 新增：处理提取的角色卡
        const characterCardEl = $('#extracted-character-card');
        const characterCardBtn = $('#btn-write-character-card');
        if (characterCardEl && characterCardBtn) {
          characterCardEl.textContent = this.lastExtractedCharacterCard || '未提取到角色卡内容。';
          characterCardBtn.disabled = !this.lastExtractedCharacterCard;
        }
      },

      async showJourney() {
        const { $ } = GuixuDOM;
        this.openModal('history-modal');
        this.loadUnifiedIndex(); // 确保输入框显示正确的序号
        const titleEl = $('#history-modal-title');
        if (titleEl) titleEl.textContent = '本世历程';

        // 新增：向模态框头部注入修剪相关的UI
        const actionsContainer = $('#history-modal-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;" title="启用后，每次自动写入“本世历程”时，都会自动修剪旧的自动化系统内容。">
                    <input type="checkbox" id="auto-trim-checkbox" style="cursor: pointer;">
                    <label for="auto-trim-checkbox" class="auto-write-label" style="font-size: 12px;">自动修剪</label>
                </div>
                <button id="btn-show-trim-modal" class="interaction-btn" style="padding: 4px 8px; font-size: 12px;">手动修剪</button>
            `;
            // 确保复选框状态与内存中的状态同步
            const autoTrimCheckbox = $('#auto-trim-checkbox');
            if (autoTrimCheckbox && typeof this.isAutoTrimEnabled !== 'undefined') {
                autoTrimCheckbox.checked = this.isAutoTrimEnabled;
            }
        }

        const body = $('#history-modal-body');
        if (!body) return;

        body.innerHTML =
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在读取命运之卷...</p>';
        try {
          const bookName = GuixuConstants.LOREBOOK.NAME;
          const index = this.unifiedIndex;
          const journeyKey = index > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.JOURNEY}(${index})` : GuixuConstants.LOREBOOK.ENTRIES.JOURNEY;
          const allEntries = await GuixuAPI.getLorebookEntries(bookName);
          // **问题3修复**: 对比时去除两端空格，增加匹配健壮性
          const journeyEntry = allEntries.find(entry => entry.comment.trim() === journeyKey.trim());

          if (!journeyEntry) {
            console.warn(`在世界书 "${bookName}" 中未找到标题为 "${journeyKey}" 的条目。`);
          }
          body.innerHTML = this.renderJourneyFromContent(journeyEntry);
          // 绑定点击事件监听器
          this.bindJourneyListeners();
        } catch (error) {
          console.error('读取"本世历程"时出错:', error);
          body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">读取记忆时出现错误：${error.message}</p>`;
        }
      },

      async showPastLives() {
        const { $ } = GuixuDOM;
        this.openModal('history-modal');
        this.loadUnifiedIndex(); // 确保输入框显示正确的序号
        const titleEl = $('#history-modal-title');
        if (titleEl) titleEl.textContent = '往世涟漪';

        const body = $('#history-modal-body');
        if (!body) return;

        body.innerHTML =
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在回溯时光长河...</p>';
        try {
          const bookName = GuixuConstants.LOREBOOK.NAME;
          const index = this.unifiedIndex;
          const pastLivesKey = index > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES}(${index})` : GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES;
          const allEntries = await GuixuAPI.getLorebookEntries(bookName);
          // **问题3修复**: 对比时去除两端空格，增加匹配健壮性
          const pastLivesEntry = allEntries.find(entry => entry.comment.trim() === pastLivesKey.trim());

          if (!pastLivesEntry) {
            console.warn(`在世界书 "${bookName}" 中未找到标题为 "${pastLivesKey}" 的条目。`);
          }

          body.innerHTML = this.renderPastLives(pastLivesEntry);
        } catch (error) {
          console.error('读取“往世涟漪”时出错:', error);
          body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">回溯时光长河时出现错误：${error.message}</p>`;
        }
      },

      // --- Rendering Logic for Dynamic Content (Lorebooks) ---
      parsePastLifeEntry(contentString) {
        if (!contentString || typeof contentString !== 'string') return {};
        try {
          const data = {};
          const lines = contentString.trim().split('\n');
          lines.forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 2) {
              const key = parts[0].trim();
              const value = parts.slice(1).join('|').trim();
              data[key] = value;
            }
          });
          return data;
        } catch (e) {
          console.error('解析往世涟漪条目失败:', e);
          return {};
        }
      },

      renderJourneyFromContent(entry) {
        if (!entry || !entry.content)
          return '<p style="text-align:center; color:#8b7355; font-size:12px;">此生尚未留下任何印记。</p>';

        const events = GuixuHelpers.parseJourneyEntry(entry.content);
        if (events.length === 0)
          return '<p style="text-align:center; color:#8b7355; font-size:12px;">内容格式有误，无法解析事件。</p>';

        events.sort((a, b) => (parseInt(a.序号, 10) || 0) - (parseInt(b.序号, 10) || 0));

        let html = '<div class="timeline-container"><div class="timeline-line"></div>';
        events.forEach((eventData, index) => {
          const eventId = `event-${entry.uid}-${index}`;
          const date = eventData['日期'] || '未知时间';
          const title = eventData['标题'] || '无标题';
          const location = eventData['地点'] || '未知地点';
          const description = eventData['描述'] || '无详细描述。';
          const characters = eventData['人物'] || '';
          const relationships = eventData['人物关系'] || '';
          const importantInfo = eventData['重要信息'] || '';
          const hiddenPlot = eventData['暗线与伏笔'] || '';
          const autoSystem = eventData['自动化系统'] || '';

          const tagsHtml = (eventData['标签'] || '')
            .split('|')
            .map(tag => tag.trim())
            .filter(tag => tag)
            .map(tag => `<span class="tag-item">${tag}</span>`)
            .join('');

          // 基本信息（默认显示）
          const basicInfo = `
            <div class="timeline-header">
              <div class="timeline-date">${date}</div>
              <div class="timeline-tags">${tagsHtml}</div>
            </div>
            <div class="timeline-title">${title}</div>
            <div class="timeline-location" style="font-size: 12px; color: #8b7355; margin: 5px 0;">地点：${location}</div>
            <div class="timeline-description">${description}</div>
          `;

          // 详细信息（需要点击3次才显示）
          const detailedInfo = `
            <div class="timeline-detailed-info" id="detailed-${eventId}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(201, 170, 113, 0.3);">
              ${characters ? `<div class="detail-section"><strong>人物：</strong>${characters}</div>` : ''}
              ${relationships ? `<div class="detail-section"><strong>人物关系：</strong>${relationships}</div>` : ''}
              ${importantInfo ? `<div class="detail-section"><strong>重要信息：</strong>${importantInfo}</div>` : ''}
              ${hiddenPlot ? `<div class="detail-section"><strong>暗线与伏笔：</strong>${hiddenPlot}</div>` : ''}
              ${autoSystem ? `<div class="detail-section"><strong>自动化系统：</strong><pre style="white-space: pre-wrap; font-size: 11px; color: #a09c91;">${autoSystem}</pre></div>` : ''}
            </div>
          `;

          html += `
            <div class="timeline-event" data-event-id="${eventId}" data-click-count="0" style="cursor: pointer;">
              <div class="timeline-content">
                ${basicInfo}
                ${detailedInfo}
              </div>
            </div>`;
        });
        html += '</div>';
        return html;
      },

      renderPastLives(entry) {
        if (!entry || !entry.content)
          return '<p style="text-align:center; color:#8b7355; font-size:12px;">未发现任何往世的痕迹。</p>';

        const pastLifeBlocks = entry.content
          .trim()
          .split(/第x世\|/g)
          .slice(1);
        if (pastLifeBlocks.length === 0)
          return '<p style="text-align:center; color:#8b7355; font-size:12px;">内容格式有误，无法解析往世记录。</p>';

        let html = '<div class="timeline-container"><div class="timeline-line"></div>';
        pastLifeBlocks.forEach(block => {
          const fullContent = `第x世|${block}`;
          const data = this.parsePastLifeEntry(fullContent);
          const title = `第${data['第x世'] || '?'}世`;

          html += `
                    <div class="timeline-event">
                        <div class="timeline-content">
                            <div class="timeline-title">${title}</div>
                            <div class="past-life-details">
                                <div class="detail-item"><strong>事件脉络:</strong> ${
                                  data['事件脉络'] || '不详'
                                }</div>
                                <div class="detail-item"><strong>本世概述:</strong> ${
                                  data['本世概述'] || '不详'
                                }</div>
                                <div class="detail-item"><strong>本世成就:</strong> ${
                                  data['本世成就'] || '无'
                                }</div>
                                <div class="detail-item"><strong>获得物品:</strong> ${
                                  data['本世获得物品'] || '无'
                                }</div>
                                <div class="detail-item"><strong>人物关系:</strong> ${
                                  data['本世人物关系网'] || '无'
                                }</div>
                                <div class="detail-item"><strong>死亡原因:</strong> ${
                                  data['死亡原因'] || '不详'
                                }</div>
                                <div class="detail-item"><strong>本世总结:</strong> ${
                                  data['本世总结'] || '无'
                                }</div>
                                <div class="detail-item"><strong>本世评价:</strong> ${
                                  data['本世评价'] || '无'
                                }</div>
                            </div>
                        </div>
                    </div>`;
        });
        html += '</div>';
        return html;
      },

      async renderPastLifeDetails(bookName) {
        const { $ } = GuixuDOM;
        const detailsContainer = $('#past-life-details');
        if (!detailsContainer) return;
        detailsContainer.style.display = 'block';
        detailsContainer.innerHTML =
          '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在读取此世记忆...</p>';
        try {
          const entries = await GuixuAPI.getLorebookEntries(bookName, 'summary');
          if (entries && entries.length > 0) {
            const summaryData = JSON.parse(entries[0].content);
            detailsContainer.innerHTML = `
                        <h4>${bookName} - 结局总览</h4>
                        <p><strong>最终境界:</strong> ${summaryData.finalStats.境界}</p>
                        <p><strong>存活时间:</strong> ${summaryData.finalStats.存活时间}</p>
                        <p><strong>主要成就:</strong> ${summaryData.achievements.join('、 ')}</p>
                        <p><strong>最终悔憾:</strong> ${summaryData.regrets}</p>
                        <p><strong>关键事件:</strong></p>
                        <ul style="padding-left: 20px;">${summaryData.keyEvents
                          .map(e => `<li>${e}</li>`)
                          .join('')}</ul>`;
          } else {
            detailsContainer.innerHTML =
              '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">未能找到此世的结局总览。</p>';
          }
        } catch (error) {
          console.error(`Error fetching details for ${bookName}:`, error);
          detailsContainer.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">读取此世记忆时出错：${error.message}</p>`;
        }
      },

      // --- Dynamic Event Listeners for Lorebook content ---
      bindJourneyListeners() {
        const { $ } = GuixuDOM;
        // 为本世历程事件绑定点击监听器
        const timelineContainer = $('.timeline-container');
        if (timelineContainer) {
          timelineContainer.addEventListener('click', (e) => {
            const timelineEvent = e.target.closest('.timeline-event');
            if (timelineEvent) {
              this.handleJourneyEventClick(timelineEvent);
            }
          });
        }
      },

      handleJourneyEventClick(eventElement) {
        const { $ } = GuixuDOM;
        // 修复参数顺序：应先传选择器，再传上下文
        const detailedInfo = $('.timeline-detailed-info', eventElement);
        if (!detailedInfo) return;

        // 简化为单击切换展开/收起，恢复重构前交互
        const isHidden = getComputedStyle(detailedInfo).display === 'none';
        detailedInfo.style.display = isHidden ? 'block' : 'none';
        eventElement.style.cursor = 'pointer';
        // 重置点击计数，避免三击逻辑导致无响应
        eventElement.dataset.clickCount = '0';
      },

      async handleRewind(eventId, eventTitle) {
        // “回溯”按钮相关逻辑已移除
      },

      // 此函数不再需要，提取逻辑已合并到 loadAndDisplayCurrentScene
      processAIResponse() {
        // 空函数或可直接删除
      },

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
