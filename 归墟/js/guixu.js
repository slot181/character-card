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
      // 追踪已装备物品的状态
      // **逻辑修正**: equippedItems 现在存储完整的物品对象，而不仅仅是ID
      equippedItems: {
        wuqi: null,
        fangju: null,
        shipin: null,
        fabao1: null,
        zhuxiuGongfa: null,
        fuxiuXinfa: null,
      },
      currentMvuState: null, // 新增：用于缓存当前最新的mvu状态
      pendingActions: [], // 购物车/指令队列
      baseAttributes: {}, // 存储从mvu加载的原始属性
      calculatedMaxAttributes: {}, // 新增：用于缓存计算后的属性上限
      lastExtractedJourney: null,
      lastExtractedPastLives: null,
      lastExtractedNovelText: null, // 新增：用于存储提取的原始正文
      lastExtractedCharacterCard: null, // 新增：用于存储提取的角色卡
      lastExtractedVariables: null, // 新增：用于存储变量改变
      lastWrittenJourney: null,
      lastWrittenPastLives: null,
      lastWrittenNovelText: null,
      lastSentPrompt: null, // 新增：用于存储发送给AI的完整提示
      isNovelModeEnabled: false, // 新增：小说模式开关状态
      isAutoWriteEnabled: true, // 默认开启自动写入
      autoWriteIntervalId: null, // 用于存储轮询计时器ID
      novelModeAutoWriteIntervalId: null, // 新增：小说模式的自动写入轮询ID
      isMobileView: false, // 新增：追踪移动视图状态
      unifiedIndex: 1, // 新增：统一的读写序号
      isAutoToggleLorebookEnabled: false, // 新增：自动开关世界书状态
      autoToggleIntervalId: null, // 新增：轮询计时器ID
      isAutoSaveEnabled: false, // 新增：自动存档状态
      autoSaveIntervalId: null, // 新增：自动存档计时器ID
      isAutoTrimEnabled: false, // 新增：自动修剪状态
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
        this.isMobileView = !this.isMobileView;
        const container = $('.guixu-root-container');
        const btn = $('#view-toggle-btn');
        if (container && btn) {
          if (this.isMobileView) {
            container.classList.add('mobile-view');
            btn.textContent = '💻'; // 切换到桌面图标
            btn.title = '切换到桌面视图';
          } else {
            container.classList.remove('mobile-view');
            btn.textContent = '📱'; // 切换到手机图标
            btn.title = '切换到移动视图';
          }
        }
        this.saveViewMode();
      },

      saveViewMode() {
        try {
          localStorage.setItem('guixu_view_mode', this.isMobileView ? 'mobile' : 'desktop');
        } catch (e) {
          console.error('保存视图模式失败:', e);
        }
      },

      loadViewMode() {
        const { $ } = GuixuDOM;
        try {
          const savedMode = localStorage.getItem('guixu_view_mode');
          // 仅当保存的模式为 'mobile' 时，才在加载时切换到移动视图
          if (savedMode === 'mobile') {
            this.isMobileView = true; // 设置初始状态
            const container = $('.guixu-root-container');
            const btn = $('#view-toggle-btn');
            if (container && btn) {
              container.classList.add('mobile-view');
              btn.textContent = '💻';
              btn.title = '切换到桌面视图';
            }
          } else {
            this.isMobileView = false; // 确保默认是桌面视图
          }
        } catch (e) {
          console.error('加载视图模式失败:', e);
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
        this.bindStaticListeners();
        this.applyRandomBackground();
        await this.updateDynamicData(); // Initial data load
        this.loadAutoWriteState(); // 加载自动写入状态
        this.loadNovelModeState(); // 加载小说模式状态
        this.loadEquipmentState(); // 加载已装备物品状态
        this.loadPendingActions(); // 加载待处理指令
        this.loadViewMode(); // 新增：加载用户保存的视图模式
        this.loadUnifiedIndex(); // 新增：加载统一的读写序号
        this.loadAutoToggleState(); // 新增：加载自动开关状态
        this.loadAutoSaveState(); // 新增：加载自动存档状态
        this.loadAutoTrimState(); // 新增：加载自动修剪状态

          // 已移除 MESSAGE_SWIPED 事件监听器，以避免与核心mvu脚本冲突。
        // UI刷新现在通过 handleAction 内部的主动调用来完成。
      },

      // --- Data Handling ---
      async updateDynamicData() {
        try {
          // 加载核心mvu数据
          const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
          if (messages && messages.length > 0 && messages[0].data) {
            // 缓存完整的 mvu 状态，而不仅仅是 stat_data
            this.currentMvuState = messages[0].data;
            this.renderUI(this.currentMvuState.stat_data);
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
                this.unifiedIndex = newIndex;
                this.saveUnifiedIndex();
                this.showTemporaryMessage(`世界书读写序号已更新为 ${newIndex}`);
                if (this.isAutoToggleLorebookEnabled) {
                    this.startAutoTogglePolling();
                }
            } else {
                e.target.value = this.unifiedIndex;
            }
        });

        $('#auto-toggle-lorebook-checkbox')?.addEventListener('change', (e) => {
            this.isAutoToggleLorebookEnabled = e.target.checked;
            this.saveAutoToggleState();
            this.showTemporaryMessage(`自动开关世界书已${this.isAutoToggleLorebookEnabled ? '开启' : '关闭'}`);
            if (this.isAutoToggleLorebookEnabled) {
              this.startAutoTogglePolling();
            } else {
              this.stopAutoTogglePolling();
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
        $('#btn-save-load-manager')?.addEventListener('click', () => this.showSaveLoadManager());
        $('#btn-clear-all-saves')?.addEventListener('click', () => this.clearAllSaves());
        $('#btn-import-save')?.addEventListener('click', () => $('#import-file-input')?.click());
        $('#import-file-input')?.addEventListener('change', (e) => this.handleFileImport(e));
        
        $('#auto-save-checkbox')?.addEventListener('change', (e) => {
            this.isAutoSaveEnabled = e.target.checked;
            this.saveAutoSaveState();
            this.showTemporaryMessage(`自动存档已${this.isAutoSaveEnabled ? '开启' : '关闭'}`);
            if (this.isAutoSaveEnabled) {
                this.startAutoSavePolling();
            } else {
                this.stopAutoSavePolling();
            }
        });

        $('#btn-write-journey')?.addEventListener('click', () => this.writeJourneyToLorebook());
        $('#btn-write-past-lives')?.addEventListener('click', () => this.writePastLivesToLorebook());
        $('#btn-write-novel-mode')?.addEventListener('click', () => this.writeNovelModeToLorebook());
        $('#btn-write-character-card')?.addEventListener('click', () => this.writeCharacterCardToLorebook());

        const autoWriteCheckbox = $('#auto-write-checkbox');
        if (autoWriteCheckbox) {
          autoWriteCheckbox.addEventListener('change', e => {
            this.isAutoWriteEnabled = e.target.checked;
            this.saveAutoWriteState(this.isAutoWriteEnabled);
            this.showTemporaryMessage(`自动写入历程/涟漪已${this.isAutoWriteEnabled ? '开启' : '关闭'}`);
            if (this.isAutoWriteEnabled) {
              this.startAutoWritePolling();
            } else {
              this.stopAutoWritePolling();
            }
          });
        }

        const novelModeCheckbox = $('#novel-mode-enabled-checkbox');
        if (novelModeCheckbox) {
          novelModeCheckbox.addEventListener('change', e => {
            this.isNovelModeEnabled = e.target.checked;
            this.saveNovelModeState(this.isNovelModeEnabled);
            this.showTemporaryMessage(`小说模式自动写入已${this.isNovelModeEnabled ? '开启' : '关闭'}`);
            if (this.isNovelModeEnabled) {
              this.startNovelModeAutoWritePolling();
            } else {
              this.stopNovelModeAutoWritePolling();
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
                    this.isAutoTrimEnabled = e.target.checked;
                    this.saveAutoTrimState();
                    this.showTemporaryMessage(`自动修剪已${this.isAutoTrimEnabled ? '开启' : '关闭'}`);
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

            const name = GuixuHelpers.safeGetValue(rel, 'name', '未知之人');
            const tier = GuixuHelpers.safeGetValue(rel, 'tier', '凡人');
            const level = GuixuHelpers.safeGetValue(rel, '等级', '');
            const relationship = GuixuHelpers.safeGetValue(rel, 'relationship', '萍水相逢');
            const description = GuixuHelpers.safeGetValue(rel, 'description', '背景不详');
            const favorability = parseInt(GuixuHelpers.safeGetValue(rel, 'favorability', 0), 10);
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
            GuixuHelpers.safeGetValue(linggen, '品阶', '凡品')
          );

          sortedLinggenList.forEach(linggen => {
            const name = GuixuHelpers.safeGetValue(linggen, '名称', '未知灵根');
            const tier = GuixuHelpers.safeGetValue(linggen, '品阶', '凡品');
            const description = GuixuHelpers.safeGetValue(linggen, '描述', '无描述');
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
            GuixuHelpers.safeGetValue(tianfu, 'tier', '凡品')
          );

          sortedTianfuList.forEach(tianfu => {
            const name = GuixuHelpers.safeGetValue(tianfu, 'name', '未知天赋');
            const tier = GuixuHelpers.safeGetValue(tianfu, 'tier', '凡品');
            const description = GuixuHelpers.safeGetValue(tianfu, 'description', '无描述');
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
              GuixuHelpers.safeGetValue(item, 'tier', '凡品')
            );

            sortedItems.forEach(item => {
              try {
                // 确保传递给前端的数据是完整的
                const itemJson = JSON.stringify(item).replace(/'/g, "'");

                const name = GuixuHelpers.safeGetValue(item, 'name', '未知物品');
                const id = GuixuHelpers.safeGetValue(item, 'id', null);
                const tier = GuixuHelpers.safeGetValue(item, 'tier', '无');
                const hasQuantity = item.hasOwnProperty('quantity');
                const quantity = parseInt(GuixuHelpers.safeGetValue(item, 'quantity', 1), 10);
                const description = GuixuHelpers.safeGetValue(
                  item,
                  'description',
                  GuixuHelpers.safeGetValue(item, 'effect', '无描述'),
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
        const tierStyle = GuixuHelpers.getTierStyle(GuixuHelpers.safeGetValue(item, 'tier'));
        const level = GuixuHelpers.safeGetValue(item, 'level', '');
        const tierDisplay = level
          ? `${GuixuHelpers.safeGetValue(item, 'tier', '凡品')} ${level}`
          : GuixuHelpers.safeGetValue(item, 'tier', '凡品');

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
                <div class="tooltip-title" style="${tierStyle}">${GuixuHelpers.safeGetValue(item, 'name')}</div>
                <p><strong>品阶:</strong> ${tierDisplay}</p>
                <p><i>${GuixuHelpers.safeGetValue(item, 'description', '无描述')}</i></p>
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
        const itemId = GuixuHelpers.safeGetValue(item, 'id');
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
        const tier = GuixuHelpers.safeGetValue(item, 'tier', '凡品');
        const tierStyle = GuixuHelpers.getTierStyle(tier);
        slotElement.textContent = GuixuHelpers.safeGetValue(item, 'name');
        slotElement.setAttribute('style', tierStyle);
        slotElement.classList.add('equipped');
        slotElement.dataset.itemDetails = JSON.stringify(item).replace(/'/g, "'");

        // 更新背包UI，使其能反映最新状态
        if (buttonElement.closest('#inventory-modal')) {
          this.showInventory();
        }

        // 添加到指令队列（优化：先移除旧指令，再添加新指令）
        const itemName = GuixuHelpers.safeGetValue(item, 'name');
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

        GuixuHelpers.showTemporaryMessage(`已装备 ${GuixuHelpers.safeGetValue(item, 'name')}`);
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
          itemName = GuixuHelpers.safeGetValue(item, 'name');
          itemId = GuixuHelpers.safeGetValue(item, 'id');
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
          // **局部修复**: 直接使用 _.get 获取装备数组，避免 safeGetValue 将其错误地转为字符串
          const itemArray = GuixuAPI.lodash.get(data, mvuKey, null);
          const item = Array.isArray(itemArray) && itemArray.length > 0 ? itemArray[0] : null;

          if (item && typeof item === 'object') {
            const tier = GuixuHelpers.safeGetValue(item, 'tier', '凡品');
            const tierStyle = GuixuHelpers.getTierStyle(tier);
            // **逻辑修正**: 此处不再主动修改 this.equippedItems
            // this.equippedItems 的状态由 localStorage 和 equip/unequip 动作管理
            // this.equippedItems[slotKey] = item;
            slot.textContent = GuixuHelpers.safeGetValue(item, 'name');
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
        // 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
        // 根据新的变量结构重写属性计算逻辑
        if (!this.currentMvuState || !this.currentMvuState.stat_data) {
          console.warn('无法更新属性：mvu状态不可用。');
          return;
        }

        const stat_data = this.currentMvuState.stat_data;
        const baseAttrs = {
          fali: parseInt(GuixuHelpers.safeGetValue(stat_data, '基础法力', 0), 10),
          shenhai: parseInt(GuixuHelpers.safeGetValue(stat_data, '基础神海', 0), 10),
          daoxin: parseInt(GuixuHelpers.safeGetValue(stat_data, '基础道心', 0), 10),
          kongsu: parseInt(GuixuHelpers.safeGetValue(stat_data, '基础空速', 0), 10),
          qiyun: parseInt(GuixuHelpers.safeGetValue(stat_data, '基础气运', 0), 10),
        };

        const totalFlatBonuses = { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 };
        const totalPercentBonuses = { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 };
        const attributeMapping = { 法力: 'fali', 神海: 'shenhai', 道心: 'daoxin', 空速: 'kongsu', 气运: 'qiyun' };

        const processBonuses = (item) => {
          if (!item || typeof item !== 'object') return;
          
          const flatBonuses = item.attributes_bonus;
          if (flatBonuses && typeof flatBonuses === 'object') {
            for (const [attrName, bonusValue] of Object.entries(flatBonuses)) {
              const attrKey = attributeMapping[attrName];
              if (attrKey) {
                totalFlatBonuses[attrKey] += parseInt(bonusValue, 10) || 0;
              }
            }
          }
          
          const percentBonuses = item['百分比加成'];
          if (percentBonuses && typeof percentBonuses === 'object') {
             for (const [attrName, bonusValue] of Object.entries(percentBonuses)) {
                const attrKey = attributeMapping[attrName];
                if (attrKey) {
                    totalPercentBonuses[attrKey] += parseFloat(String(bonusValue).replace('%','')) / 100 || 0;
                }
            }
          }
        };

        // 1. 收集所有加成来源
        Object.values(this.equippedItems).forEach(processBonuses);
        const tianfuList = GuixuAPI.lodash.get(stat_data, '天赋列表.0', []);
        if (Array.isArray(tianfuList)) {
          tianfuList.forEach(tianfu => {
            if (typeof tianfu === 'object' && tianfu !== null) processBonuses(tianfu);
          });
        }
        // 修改：处理灵根列表而非单个灵根
        const linggenListData = GuixuAPI.lodash.get(stat_data, '灵根列表.0', []);
        if (Array.isArray(linggenListData)) {
          linggenListData.forEach(rawLinggen => {
            try {
              if (!rawLinggen || rawLinggen === '$__META_EXTENSIBLE__$') return;
              const linggen = typeof rawLinggen === 'string' ? JSON.parse(rawLinggen) : rawLinggen;
              if (linggen && typeof linggen === 'object') {
                processBonuses(linggen);
              }
            } catch (e) {
              console.error('处理灵根加成时解析失败:', rawLinggen, e);
            }
          });
        }

        // 2. 计算最终上限: 上限 = (基础 + Σ固定) * (1 + Σ百分比)
        const calculatedMaxAttrs = {
          fali: Math.floor((baseAttrs.fali + totalFlatBonuses.fali) * (1 + totalPercentBonuses.fali)),
          shenhai: Math.floor((baseAttrs.shenhai + totalFlatBonuses.shenhai) * (1 + totalPercentBonuses.shenhai)),
          daoxin: Math.floor((baseAttrs.daoxin + totalFlatBonuses.daoxin) * (1 + totalPercentBonuses.daoxin)),
          kongsu: Math.floor((baseAttrs.kongsu + totalFlatBonuses.kongsu) * (1 + totalPercentBonuses.kongsu)),
          qiyun: Math.floor((baseAttrs.qiyun + totalFlatBonuses.qiyun) * (1 + totalPercentBonuses.qiyun)),
        };
        
        // 新增：缓存计算结果，供其他函数使用
        this.calculatedMaxAttributes = calculatedMaxAttrs;

        // 3. 获取当前值，并确保不超过新计算的上限
        const currentAttrs = {
            fali: Math.min(parseInt(GuixuHelpers.safeGetValue(stat_data, '当前法力', 0), 10), calculatedMaxAttrs.fali),
            shenhai: Math.min(parseInt(GuixuHelpers.safeGetValue(stat_data, '当前神海', 0), 10), calculatedMaxAttrs.shenhai),
            daoxin: Math.min(parseInt(GuixuHelpers.safeGetValue(stat_data, '当前道心', 0), 10), calculatedMaxAttrs.daoxin),
            kongsu: Math.min(parseInt(GuixuHelpers.safeGetValue(stat_data, '当前空速', 0), 10), calculatedMaxAttrs.kongsu),
        };

        // 4. 更新UI
        const { $ } = GuixuDOM;
        $('#attr-fali').innerText = `${currentAttrs.fali} / ${calculatedMaxAttrs.fali}`;
        $('#attr-shenhai').innerText = `${currentAttrs.shenhai} / ${calculatedMaxAttrs.shenhai}`;
        $('#attr-daoxin').innerText = `${currentAttrs.daoxin} / ${calculatedMaxAttrs.daoxin}`;
        $('#attr-kongsu').innerText = `${currentAttrs.kongsu} / ${calculatedMaxAttrs.kongsu}`;
        $('#attr-qiyun').innerText = calculatedMaxAttrs.qiyun;
        
        // 年龄等非计算属性直接更新
        $('#attr-shengli').innerText = `${GuixuHelpers.safeGetValue(stat_data, '生理年龄')} / ${GuixuHelpers.safeGetValue(stat_data, '生理年龄上限')}`;
        $('#attr-xinli').innerText = `${GuixuHelpers.safeGetValue(stat_data, '心理年龄')} / ${GuixuHelpers.safeGetValue(stat_data, '心理年龄上限')}`;
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
        const itemName = GuixuHelpers.safeGetValue(item, 'name');
        if (itemName === 'N/A') {
          GuixuHelpers.showTemporaryMessage('物品信息错误，无法使用。');
          return;
        }

        // **BUG修复**: 不再手动操作DOM，而是通过刷新背包来更新UI
        // 检查待定队列中的数量，以防止用户超额使用
        const originalQuantity = parseInt(GuixuHelpers.safeGetValue(item, 'quantity', 0), 10);
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
        const itemName = GuixuHelpers.safeGetValue(item, 'name');
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
        const itemName = GuixuHelpers.safeGetValue(item, 'name');
        const currentQuantity = parseInt(GuixuHelpers.safeGetValue(item, 'quantity', 0), 10);
        
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
            id: 'discard-quantity-confirm', className: 'interaction-btn', textContent: '确认丢弃',
            style: 'background: #8b0000; border-color: #ff6b6b;',
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
            id: 'discard-quantity-cancel', className: 'interaction-btn', textContent: '取消',
            onclick: () => {
              modal.remove();
              resolve();
            }
          });

          const modal = h('div', { className: 'modal-overlay', style: 'display: flex; z-index: 2000;' }, [
            h('div', { className: 'modal-content', style: 'width: 400px; height: auto; max-height: none;' }, [
              h('div', { className: 'modal-header' }, [h('h2', { className: 'modal-title' }, ['丢弃物品'])]),
              h('div', { className: 'modal-body', style: 'padding: 20px;' }, [
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
        const itemName = GuixuHelpers.safeGetValue(item, 'name');
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
        }).filter(event => event && Object.keys(event).length > 0 && event['序号']);
      },

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

        const events = this.parseJourneyEntry(entry.content);
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
        const detailedInfo = $(eventElement, '.timeline-detailed-info');
        
        // 检查详细信息是否已经显示
        if (detailedInfo && detailedInfo.style.display === 'block') {
          // 如果已显示，则隐藏
          detailedInfo.style.display = 'none';
          eventElement.style.cursor = 'pointer';
          // 重置点击计数，允许重新开始3次点击
          eventElement.dataset.clickCount = '0';
        } else {
          // 如果未显示，继续原有的3次点击逻辑
          const currentCount = parseInt(eventElement.dataset.clickCount || '0', 10);
          const newCount = currentCount + 1;
          eventElement.dataset.clickCount = newCount;

          // 当点击3次时显示详细信息
          if (newCount >= 3) {
            if (detailedInfo) {
              detailedInfo.style.display = 'block';
            }
            
            // 保持点击样式，允许再次点击隐藏
            eventElement.style.cursor = 'pointer';
          }
        }
      },

      async handleRewind(eventId, eventTitle) {
        // “回溯”按钮相关逻辑已移除
      },

      // 此函数不再需要，提取逻辑已合并到 loadAndDisplayCurrentScene
      processAIResponse() {
        // 空函数或可直接删除
      },

      // --- 新增：写入世界书的核心逻辑 ---
      // 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
      async writeJourneyToLorebook(silent = false) {
        const content = this.lastExtractedJourney;
        await this.writeToLorebook('本世历程', content, silent);
      },

      async writePastLivesToLorebook(silent = false) {
        const content = this.lastExtractedPastLives;
        await this.writeToLorebook('往世涟漪', content, silent);
      },

      async writeNovelModeToLorebook(silent = false) {
        const content = this.lastExtractedNovelText;
        await this.writeToLorebook('小说模式', content, silent);
      },

      // 最终版：重构写入逻辑，支持动态索引和条目创建
      async writeToLorebook(baseEntryKey, contentToWrite, silent = false) {
        if (!contentToWrite || contentToWrite.trim() === '') {
          if (!silent) this.showTemporaryMessage('没有可写入的内容。');
          return;
        }

        const index = this.unifiedIndex;
        const finalEntryKey = index > 1 ? `${baseEntryKey}(${index})` : baseEntryKey;
        const bookName = GuixuConstants.LOREBOOK.NAME;
        let reformattedContent = contentToWrite.trim();
        let buttonId;

        // 内容格式化
        if (baseEntryKey === '本世历程' || baseEntryKey === '往世涟漪') {
            const journeyFields = ['序号', '日期', '标题', '描述', '标签', '自动化系统'];
            const pastLivesFields = ['第x世', '事件脉络', '本世概述', '本世成就', '本世获得物品', '本世人物关系网', '死亡原因', '本世总结', '本世评价'];
            const fields = baseEntryKey === '本世历程' ? journeyFields : pastLivesFields;
            const parsedData = this.parseJourneyEntry(contentToWrite)[0] || {};
            
            if (Object.keys(parsedData).length === 0) {
                if (!silent) this.showTemporaryMessage(`无法解析“${baseEntryKey}”的内容。`);
                return;
            }
            reformattedContent = fields.map(key => (parsedData[key] ? `${key}|${parsedData[key]}` : null)).filter(Boolean).join('\n');
            buttonId = baseEntryKey === '本世历程' ? 'btn-write-journey' : 'btn-write-past-lives';
        } else if (baseEntryKey === '小说模式') {
            buttonId = 'btn-write-novel-mode';
        }

        const button = document.getElementById(buttonId);
        if (button && !silent) button.textContent = '写入中...';

        try {
            const allEntries = await GuixuAPI.getLorebookEntries(bookName);
            let targetEntry = allEntries.find(entry => entry.comment === finalEntryKey);

            if (targetEntry) { // 条目已存在，检查重复并追加
                const existingContent = targetEntry.content || '';
                let isDuplicate = false;

                if (baseEntryKey === '本世历程') {
                    const getSeq = (text) => {
                        if (!text) return null;
                        const match = text.match(/^序号\|(\d+)/);
                        return match ? match[1] : null;
                    };
                    const newEventSeq = getSeq(reformattedContent);
                    if (newEventSeq) {
                        const existingSequences = existingContent.split('\n\n').map(block => getSeq(block.trim())).filter(seq => seq !== null);
                        if (existingSequences.includes(newEventSeq)) {
                            isDuplicate = true;
                        }
                    }
                } else { // 小说模式及其他，使用内容包含检查
                    if (existingContent.includes(reformattedContent.trim())) {
                        isDuplicate = true;
                    }
                }

                if (isDuplicate) {
                    if (!silent) this.showTemporaryMessage('内容已存在，无需重复写入。');
                    return;
                }

                let updatedContent = existingContent + (existingContent ? '\n\n' : '') + reformattedContent;
                
                // 核心修复：在合并内容后、写入之前执行修剪
                if (baseEntryKey === '本世历程' && this.isAutoTrimEnabled) {
                    console.log('[归墟] 自动修剪已开启，正在处理合并后的内容...');
                    updatedContent = this._getTrimmedJourneyContent(updatedContent);
                }

                await GuixuAPI.setLorebookEntries(bookName, [{ uid: targetEntry.uid, content: updatedContent }]);
                if (!silent) this.showTemporaryMessage(`已成功追加内容到“${finalEntryKey}”。`);

            } else { // 条目不存在，创建它
                if (!silent) this.showTemporaryMessage(`条目 "${finalEntryKey}" 不存在，正在创建...`);
                const baseEntryTemplate = allEntries.find(entry => entry.comment === baseEntryKey);
                const newEntryData = {
                    comment: finalEntryKey,
                    content: reformattedContent, // 初始内容就是新内容
                    keys: baseEntryTemplate ? [...baseEntryTemplate.keys, finalEntryKey] : [finalEntryKey],
                    enabled: false,
                    ... (baseEntryTemplate ? { selective: baseEntryTemplate.selective, constant: baseEntryTemplate.constant, position: baseEntryTemplate.position, case_sensitive: baseEntryTemplate.case_sensitive } : {})
                };
                await GuixuAPI.createLorebookEntries(bookName, [newEntryData]);
                if (!silent) this.showTemporaryMessage(`已成功创建并写入到“${finalEntryKey}”。`);
            }

            // 更新状态变量以防轮询重复写入
            if (baseEntryKey === '本世历程') this.lastWrittenJourney = contentToWrite;
            if (baseEntryKey === '往世涟漪') this.lastWrittenPastLives = contentToWrite;
            if (baseEntryKey === '小说模式') this.lastWrittenNovelText = contentToWrite;

        } catch (error) {
            console.error(`写入世界书 "${finalEntryKey}" 时出错:`, error);
            if (!silent) this.showTemporaryMessage(`写入失败: ${error.message}`);
        } finally {
            if (button && !silent) {
                button.textContent = '写入世界书';
            }
        }
      },

      async writeCharacterCardToLorebook() {
        const { $ } = GuixuDOM;
        const content = this.lastExtractedCharacterCard;
        if (!content) {
          this.showTemporaryMessage('没有可写入的角色内容。');
          return;
        }

        const button = $('#btn-write-character-card');
        if (button) button.textContent = '写入中...';

        try {
          const lines = content.trim().split('\n');
          const characterData = {};
          lines.forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 2) {
              const key = parts[0].trim();
              const value = parts.slice(1).join('|').trim();
              characterData[key] = value;
            }
          });

          const characterName = characterData['姓名'];
          if (!characterName) {
            throw new Error('无法从提取内容中找到角色“姓名”。');
          }

          const bookName = GuixuConstants.LOREBOOK.NAME;
          const allEntries = await GuixuAPI.getLorebookEntries(bookName);
          const existingEntry = allEntries.find(entry => entry.comment === characterName);

          if (existingEntry) {
            this.showTemporaryMessage(`角色“${characterName}”已存在，请手动修改。`);
            if (button) button.textContent = '写入世界书';
            return;
          }

          await GuixuAPI.createLorebookEntries(bookName, [
            {
              comment: characterName,
              keys: [characterName],
              content: content.trim(),
              enabled: true,
            },
          ]);

          this.showTemporaryMessage(`已成功创建角色“${characterName}”。`);
          if (button) button.textContent = '写入成功';
          setTimeout(() => {
            if (button) button.textContent = '写入世界书';
          }, 2000);
        } catch (error) {
          console.error('写入角色卡到世界书时出错:', error);
          this.showTemporaryMessage(`写入失败: ${error.message}`);
          if (button) button.textContent = '写入失败';
        }
      },

      async updateCurrentSceneLorebook(sceneContent) {
        // 增加健壮性检查，防止写入空内容
        if (!sceneContent || sceneContent.trim() === '') {
          console.warn('[归墟] 尝试向“当前场景”写入空内容，操作已取消。');
          return;
        }
        const bookName = GuixuConstants.LOREBOOK.NAME;
        const sceneKey = GuixuConstants.LOREBOOK.ENTRIES.CURRENT_SCENE;
        try {
          const allEntries = await GuixuAPI.getLorebookEntries(bookName);
          const sceneEntry = allEntries.find(entry => entry.comment === sceneKey);

          if (!sceneEntry) {
            console.warn(
              `[归墟] 未找到世界书条目 "${sceneKey}"，无法更新场景正文。请在'${bookName}'世界书中创建它。`,
            );
            // 如果条目不存在，我们可以选择创建一个
            await GuixuAPI.createLorebookEntries(bookName, [
              {
                comment: sceneKey,
                content: sceneContent,
                keys: [],
              },
            ]);
            console.log(`[归墟] 已创建并更新 "${sceneKey}" 内容。`);
            return;
          }

          // 使用覆盖式更新
          await GuixuAPI.setLorebookEntries(bookName, [{ uid: sceneEntry.uid, content: sceneContent }]);
          console.log(`[归墟] 成功更新 "${sceneKey}" 内容。`);
        } catch (error) {
          console.error(`[归墟] 更新 "${sceneKey}" 时出错:`, error);
        }
      },

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

      // --- 新增：状态保存与自动写入逻辑 ---
      saveAutoWriteState(state) {
        try {
          localStorage.setItem('guixu_auto_write_enabled', state);
        } catch (e) {
          console.error('保存自动写入状态失败:', e);
        }
      },

      loadAutoWriteState() {
        const { $ } = GuixuDOM;
        try {
          const savedState = localStorage.getItem('guixu_auto_write_enabled');
          // 如果localStorage中没有保存过状态，则默认为true (开启)
          this.isAutoWriteEnabled = savedState === null ? true : savedState === 'true';
          const checkbox = $('#auto-write-checkbox');
          if (checkbox) {
            checkbox.checked = this.isAutoWriteEnabled;
          }
          // 根据加载的状态决定是否启动轮询
          if (this.isAutoWriteEnabled) {
            this.startAutoWritePolling();
          }
        } catch (e) {
          console.error('加载自动写入状态失败:', e);
          this.isAutoWriteEnabled = false;
        }
      },

      saveNovelModeState(state) {
        try {
          localStorage.setItem('guixu_novel_mode_enabled', state);
        } catch (e) {
          console.error('保存小说模式状态失败:', e);
        }
      },

      loadNovelModeState() {
        const { $ } = GuixuDOM;
        try {
          const savedState = localStorage.getItem('guixu_novel_mode_enabled');
          // 小说模式默认为 false (关闭)
          this.isNovelModeEnabled = savedState === 'true';
          const checkbox = $('#novel-mode-enabled-checkbox');
          if (checkbox) {
            checkbox.checked = this.isNovelModeEnabled;
          }
          // 根据加载的状态决定是否启动小说模式的轮询
          if (this.isNovelModeEnabled) {
            this.startNovelModeAutoWritePolling();
          }
        } catch (e) {
          console.error('加载小说模式状态失败:', e);
          this.isNovelModeEnabled = false;
        }
      },

      startAutoWritePolling() {
        this.stopAutoWritePolling();
        console.log('[归墟] 启动历程/涟漪自动写入轮询...');
        this.autoWriteIntervalId = setInterval(async () => {
            if (this.lastExtractedJourney && this.lastExtractedJourney !== this.lastWrittenJourney) {
                await this.writeJourneyToLorebook(true);
            }
            if (this.lastExtractedPastLives && this.lastExtractedPastLives !== this.lastWrittenPastLives) {
                await this.writePastLivesToLorebook(true);
            }
        }, 2000);
      },

      stopAutoWritePolling() {
        if (this.autoWriteIntervalId) {
          console.log('[归墟] 停止自动写入轮询。');
          clearInterval(this.autoWriteIntervalId);
          this.autoWriteIntervalId = null;
        }
      },

      // --- 新增：小说模式自动写入轮询 ---
      startNovelModeAutoWritePolling() {
        this.stopNovelModeAutoWritePolling();
        console.log('[归墟] 启动小说模式自动写入轮询...');
        this.novelModeAutoWriteIntervalId = setInterval(async () => {
            if (this.lastExtractedNovelText && this.lastExtractedNovelText !== this.lastWrittenNovelText) {
                await this.writeNovelModeToLorebook(true);
            }
        }, 2000);
      },

      stopNovelModeAutoWritePolling() {
        if (this.novelModeAutoWriteIntervalId) {
          console.log('[归墟] 停止小说模式自动写入轮询。');
          clearInterval(this.novelModeAutoWriteIntervalId);
          this.novelModeAutoWriteIntervalId = null;
        }
      },

      // --- 新增：装备状态保存与加载 ---
      saveEquipmentState() {
        try {
          localStorage.setItem('guixu_equipped_items', JSON.stringify(this.equippedItems));
        } catch (e) {
          console.error('保存装备状态失败:', e);
        }
      },

      // **逻辑重构**: 彻底简化的加载函数
      loadEquipmentState() {
        const { $ } = GuixuDOM;
        try {
          const savedState = localStorage.getItem('guixu_equipped_items');
          if (savedState) {
            const loadedItems = JSON.parse(savedState);
            if (!loadedItems) return;

            this.equippedItems = loadedItems;

            const defaultTextMap = {
              wuqi: '武器',
              fangju: '防具',
              shipin: '饰品',
              fabao1: '法宝',
              zhuxiuGongfa: '主修功法',
              fuxiuXinfa: '辅修心法',
            };

            // 直接用 localStorage 的数据渲染UI
            for (const slotKey in defaultTextMap) {
              const slotElement = $(`#equip-${slotKey}`);
              if (!slotElement) continue;

              const itemData = this.equippedItems[slotKey];

              if (itemData && typeof itemData === 'object') {
                const tier = this.SafeGetValue(itemData, 'tier', '凡品');
                const tierStyle = this.getTierStyle(tier);
                slotElement.textContent = this.SafeGetValue(itemData, 'name');
                slotElement.setAttribute('style', tierStyle);
                slotElement.classList.add('equipped');
                slotElement.dataset.itemDetails = JSON.stringify(itemData).replace(/'/g, "'");
              } else {
                slotElement.textContent = defaultTextMap[slotKey];
                slotElement.classList.remove('equipped');
                slotElement.removeAttribute('style');
                delete slotElement.dataset.itemDetails;
              }
            }
            this.updateDisplayedAttributes();
          }
        } catch (e) {
          console.error('加载装备状态失败:', e);
          localStorage.removeItem('guixu_equipped_items');
        }
      },

      savePendingActions() {
        try {
          localStorage.setItem('guixu_pending_actions', JSON.stringify(this.pendingActions));
        } catch (e) {
          console.error('保存指令队列状态失败:', e);
        }
      },

      loadPendingActions() {
        try {
          const savedActions = localStorage.getItem('guixu_pending_actions');
          if (savedActions) {
            this.pendingActions = JSON.parse(savedActions) || [];
          }
        } catch (e) {
          console.error('加载指令队列状态失败:', e);
          this.pendingActions = [];
          localStorage.removeItem('guixu_pending_actions');
        }
      },

      // --- 新增：统一读写序号存取 ---
      saveUnifiedIndex() {
        try {
          localStorage.setItem('guixu_unified_index', this.unifiedIndex);
        } catch (e) {
          console.error('保存统一读写序号失败:', e);
        }
      },

      loadUnifiedIndex() {
        const { $ } = GuixuDOM;
        try {
          const savedIndex = localStorage.getItem('guixu_unified_index');
          if (savedIndex) {
            this.unifiedIndex = parseInt(savedIndex, 10) || 1;
          }
          const input = $('#unified-index-input');
          if (input) {
            input.value = this.unifiedIndex;
          }
        } catch (e) {
          console.error('加载统一读写序号失败:', e);
          this.unifiedIndex = 1; // 出错时重置为1
        }
      },

       // --- 新增：自动开关世界书状态存取 ---
       saveAutoToggleState() {
         try {
           localStorage.setItem('guixu_auto_toggle_enabled', this.isAutoToggleLorebookEnabled);
         } catch (e) {
           console.error('保存自动开关状态失败:', e);
         }
       },

       loadAutoToggleState() {
         try {
           const savedState = localStorage.getItem('guixu_auto_toggle_enabled');
           this.isAutoToggleLorebookEnabled = savedState === 'true';
           const checkbox = document.getElementById('auto-toggle-lorebook-checkbox');
           if (checkbox) {
             checkbox.checked = this.isAutoToggleLorebookEnabled;
           }
           // 根据加载的状态决定是否启动轮询
            if (this.isAutoToggleLorebookEnabled) {
                this.startAutoTogglePolling();
            }
         } catch (e) {
           console.error('加载自动开关状态失败:', e);
           this.isAutoToggleLorebookEnabled = false;
         }
       },

      // --- 新增：自动开关世界书轮询逻辑 (V2: 增加条目自动创建) ---
      async updateAutoToggledEntries(andDisableAll = false) {
        const bookName = GuixuConstants.LOREBOOK.NAME;
        const index = this.unifiedIndex;
        const journeyKey = index > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.JOURNEY}(${index})` : GuixuConstants.LOREBOOK.ENTRIES.JOURNEY;
        const pastLivesKey = index > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES}(${index})` : GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES;

        try {
            let allEntries = await GuixuAPI.getLorebookEntries(bookName);
            const entriesToCreate = [];

            // --- 核心修复：检查并创建缺失的条目 ---
            const targetJourneyEntry = allEntries.find(e => e.comment === journeyKey);
            if (!targetJourneyEntry) {
                const baseTemplate = allEntries.find(e => e.comment === '本世历程');
                if (baseTemplate) {
                    // 最终修复V3：使用正确的属性并确保启用
                    const newJourneyEntry = { ...baseTemplate };
                    delete newJourneyEntry.uid;
                    newJourneyEntry.comment = journeyKey;
                    newJourneyEntry.content = '';
                    newJourneyEntry.keys = [...(baseTemplate.keys || []), journeyKey];
                    newJourneyEntry.enabled = true;
                    newJourneyEntry.position = 'before_character_definition';
                    newJourneyEntry.order = 20;
                    entriesToCreate.push(newJourneyEntry);
                }
            }

            const targetPastLivesEntry = allEntries.find(e => e.comment === pastLivesKey);
            if (!targetPastLivesEntry) {
                const baseTemplate = allEntries.find(e => e.comment === '往世涟漪');
                if (baseTemplate) {
                    // 最终修复V3：使用正确的属性并确保启用
                    const newPastLivesEntry = { ...baseTemplate };
                    delete newPastLivesEntry.uid;
                    newPastLivesEntry.comment = pastLivesKey;
                    newPastLivesEntry.content = '';
                    newPastLivesEntry.keys = [...(baseTemplate.keys || []), pastLivesKey];
                    newPastLivesEntry.enabled = true;
                    newPastLivesEntry.position = 'before_character_definition';
                    newPastLivesEntry.order = 19;
                    entriesToCreate.push(newPastLivesEntry);
                }
            }

            if (entriesToCreate.length > 0) {
                await GuixuAPI.createLorebookEntries(bookName, entriesToCreate);
                console.log(`[归墟自动开关] 已自动创建 ${entriesToCreate.length} 个新世界书条目。`);
                // 重新获取所有条目，以包含新创建的条目
                allEntries = await GuixuAPI.getLorebookEntries(bookName);
            }
            // --- 修复结束 ---

            const entriesToUpdate = [];
            for (const entry of allEntries) {
                const isJourneyEntry = entry.comment.startsWith('本世历程');
                const isPastLivesEntry = entry.comment.startsWith('往世涟漪');

                if (!isJourneyEntry && !isPastLivesEntry) {
                    continue;
                }

                const isTarget = entry.comment === journeyKey || entry.comment === pastLivesKey;
                const shouldBeEnabled = isTarget && !andDisableAll;

                if (entry.enabled !== shouldBeEnabled) {
                    entriesToUpdate.push({ uid: entry.uid, enabled: shouldBeEnabled });
                }
            }

            if (entriesToUpdate.length > 0) {
                await GuixuAPI.setLorebookEntries(bookName, entriesToUpdate);
                console.log(`[归墟自动开关] 更新了 ${entriesToUpdate.length} 个世界书条目状态。`);
            }
        } catch (error) {
            console.error('[归墟自动开关] 更新世界书条目状态时出错:', error);
        }
      },

      startAutoTogglePolling() {
          this.stopAutoTogglePolling(false); // 先停止任何可能存在的旧轮询, 但不禁用条目
          console.log('[归墟] 启动世界书自动开关轮询...');
          this.updateAutoToggledEntries(); // 立即执行一次
          this.autoToggleIntervalId = setInterval(() => this.updateAutoToggledEntries(), 5000); // 每5秒轮询一次
      },

      stopAutoTogglePolling(disableEntries = true) {
          if (this.autoToggleIntervalId) {
              console.log('[归墟] 停止世界书自动开关轮询。');
              clearInterval(this.autoToggleIntervalId);
              this.autoToggleIntervalId = null;
          }
          if (disableEntries) {
              // 停止时，确保所有相关条目都被禁用
              this.updateAutoToggledEntries(true);
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
          // 1. 整合输入
          let commandText = '';
          if (this.pendingActions.length > 0) {
              commandText += '[本轮行动指令]\n';
              this.pendingActions.forEach(cmd => {
                  let actionText = '';
                  switch (cmd.action) {
                      case 'equip': actionText = `装备 [${cmd.itemName}] 到 [${cmd.category}] 槽位。`; break;
                      case 'unequip': actionText = `卸下 [${cmd.itemName}] 从 [${cmd.category}] 槽位。`; break;
                      case 'use': actionText = `使用 ${cmd.quantity} 个 [${cmd.itemName}]。`; break;
                      case 'discard':
                        if (cmd.quantity && cmd.quantity > 1) {
                          actionText = `丢弃 ${cmd.quantity} 个 [${cmd.itemName}]。`;
                        } else {
                          actionText = `丢弃 [${cmd.itemName}]。`;
                        }
                        break;
                  }
                  commandText += `- ${actionText}\n`;
              });
          }

          if (!userMessage && !commandText) {
              this.showTemporaryMessage('请输入回复或添加指令后发送。');
              return;
          }

          // 2. 构建 GenerateConfig 对象
          const generateConfig = {
              injects: [],
              should_stream: false, // 我们一次性处理整个响应
          };

          // 将用户输入和指令合并为一个 user-role 注入
          let combinedContent = '';
          if (commandText) {
              combinedContent += commandText + '\n'; // 指令在前
          }
          if (userMessage) {
              combinedContent += `<行动选择>\n${userMessage}\n</行动选择>`;
          }

          if (combinedContent) {
              generateConfig.injects.push({
                  role: 'user',
                  content: combinedContent,
                  position: 'in_chat', // 插入到聊天记录中
                  depth: 0,
                  should_scan: true, // 允许扫描关键字
              });
          }

          this.lastSentPrompt = combinedContent; // 更新调试信息
          this.showWaitingMessage();

          try {
              // 3. 调用 generate，传入配置对象
              let aiResponse;
              try {
                  aiResponse = await GuixuAPI.generate(generateConfig);
              } catch (e) {
                  throw new Error(`TavernHelper.generate 调用失败: ${e.message}`);
              }

              // 诊断步骤：检查我们是否收到了有效的回复
              if (typeof aiResponse !== 'string') {
                  throw new Error('AI未返回有效文本，可能是API连接问题或空回复。');
              }
              console.log('[归墟] AI原始回复:', aiResponse);

              // 3. 修正：直接使用AI的完整回复作为更新脚本
              // 根据 function.ts 的源码，后端的 extractCommands 函数会自行扫描并解析完整字符串中的所有指令。
              // 前端不需要，也不应该进行任何形式的提取或清理。
              const updateScript = aiResponse;
              
              // 为了调试目的，我们仍然在“查看提取内容”模态框中显示完整的AI回复
              this.lastExtractedVariables = aiResponse;
              console.log('[归墟] 已将AI完整回复作为脚本发送给MVU:', updateScript);

              // 4. 调用 mag_invoke_mvu 处理变量更新
              if (updateScript && this.currentMvuState) {
                  const inputData = { old_variables: this.currentMvuState };
                  let mvuSucceeded = false;
                  try {
                      // 增加超时机制，防止 eventEmit 卡死
                      const mvuPromise = eventEmit('mag_invoke_mvu', updateScript, inputData);
                      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MVU event timeout')), 3000));
                      await Promise.race([mvuPromise, timeoutPromise]);

                      if (inputData.new_variables) {
                          console.log('[归墟] mvu 状态已更新:', inputData.new_variables);
                          this.currentMvuState = inputData.new_variables; // 更新缓存
                          this.renderUI(this.currentMvuState.stat_data); // 重新渲染UI
                          mvuSucceeded = true;
                      } else {
                          console.log('[归墟] mvu 未返回新状态，尝试前端备用方案。');
                      }
                  } catch (eventError) {
                      console.error('[归墟] 调用 mag_invoke_mvu 事件时发生错误或超时，尝试前端备用方案:', eventError);
                  }

                  if (!mvuSucceeded) {
                      const modifiedState = this._applyUpdateFallback(updateScript, this.currentMvuState);
                      if (modifiedState) {
                          this.currentMvuState = modifiedState;
                          this.renderUI(this.currentMvuState.stat_data);
                          console.log('[归墟-备用方案] 前端模拟更新成功。');
                      }
                  }
              } else {
                  console.log('[归墟] 未找到更新脚本或当前mvu状态为空，跳过mvu更新。');
              }
              
              await this.loadAndDisplayCurrentScene(aiResponse);

              // 5. 静默保存到第0层，实现同层游玩
              let messages;
              try {
                  messages = await GuixuAPI.getChatMessages('0');
              } catch (e) {
                  throw new Error(`getChatMessages('0') 调用失败: ${e.message}`);
              }

              if (messages && messages.length > 0) {
                  const messageZero = messages[0];
                  
                  // **关键修复**: 直接使用未经处理的原始AI响应，以支持同层游玩
                  messageZero.message = aiResponse;
                  messageZero.data = this.currentMvuState;
                  try {
                      await GuixuAPI.setChatMessages([messageZero], { refresh: 'none' });
                  } catch (e) {
                      throw new Error(`setChatMessages 调用失败: ${e.message}`);
                  }
                  console.log('[归墟] 已静默更新第0层。');
              } else {
                  console.error('[归墟] 未找到第0层消息，无法更新。');
              }

              // 6. 清理工作
              const input = $('#quick-send-input');
              if (input) input.value = '';
              this.pendingActions = [];
              this.savePendingActions();
              this.closeAllModals();
              this.showTemporaryMessage('伟大梦星已回应。');

          } catch (error) {
              console.error('处理动作时出错:', error);
              this.showTemporaryMessage(`和伟大梦星沟通失败: ${error.message}`);
          } finally {
              this.hideWaitingMessage();
              // 最终修复：在所有操作完成后，主动、可靠地刷新UI，避免任何事件冲突。
              await this.updateDynamicData();
              this.loadEquipmentState();
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

      // --- 核心重构：前端备用MVU处理器 ---
      // 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
      _applyUpdateFallback(script, currentMvuState) {
          if (!script || !currentMvuState) return null;
          
          const newState = _.cloneDeep(currentMvuState);
          let modified = false;

          const commands = this._extractCommands(script);

          for (const command of commands) {
              try {
                  const path = this._trimQuotes(command.args[0]);
                  
                  switch (command.command) {
                      case 'set': {
                          const newValueStr = command.args.length >= 2 ? command.args[1] : undefined;
                          if(newValueStr === undefined) continue;
                          let newValue = this._parseCommandValue(newValueStr);
                          
                          if (newValue instanceof Date) newValue = newValue.toISOString();

                          _.set(newState.stat_data, path, newValue);
                          modified = true;
                          break;
                      }
                      case 'add': {
                          const value = _.get(newState.stat_data, path);
                          const delta = this._parseCommandValue(command.args[1]);
                          if (typeof value === 'number' && typeof delta === 'number') {
                              _.set(newState.stat_data, path, value + delta);
                              modified = true;
                          }
                          break;
                      }
                      case 'remove': {
                          _.unset(newState.stat_data, path);
                          modified = true;
                          break;
                      }
                      case 'assign':
                      case 'insert': {
                          if (command.args.length === 2) {
                              // Handles _.assign('path', value)
                              const valueToAssign = this._parseCommandValue(command.args[1]);
                              const parentCollection = _.get(newState.stat_data, path);

                              // Special handling for our [data_array, "description"] structure
                              if (Array.isArray(parentCollection) && parentCollection.length === 2 && Array.isArray(parentCollection[0]) && typeof parentCollection[1] === 'string') {
                                  const innerArray = parentCollection[0];
                                  const description = parentCollection[1];
                                  const newInnerArray = innerArray.concat(Array.isArray(valueToAssign) ? valueToAssign : [valueToAssign]);
                                  const newParentArray = [newInnerArray, description];
                                  _.set(newState.stat_data, path, newParentArray);
                                  modified = true;
                              } else if (Array.isArray(parentCollection)) {
                                  // Standard immutable update for regular arrays
                                  const newCollection = parentCollection.concat(Array.isArray(valueToAssign) ? valueToAssign : [valueToAssign]);
                                  _.set(newState.stat_data, path, newCollection);
                                  modified = true;
                              } else if (_.isObject(parentCollection)) {
                                  // Merge for objects
                                  _.merge(parentCollection, valueToAssign);
                                  modified = true;
                              } else {
                                  // If path doesn't exist, just set it
                                  _.set(newState.stat_data, path, valueToAssign);
                                  modified = true;
                              }
                          } else if (command.args.length >= 3) {
                              // Handles _.assign('path', key, value)
                              const keyOrIndex = this._parseCommandValue(command.args[1]);
                              const valueToAssign = this._parseCommandValue(command.args[2]);
                              let collection = _.get(newState.stat_data, path);

                              if (Array.isArray(collection)) {
                                  if (typeof keyOrIndex === 'number') {
                                      const newCollection = [...collection]; // Create a shallow copy for immutability
                                      newCollection.splice(keyOrIndex, 0, valueToAssign);
                                      _.set(newState.stat_data, path, newCollection);
                                      modified = true;
                                  }
                              } else if (_.isObject(collection)) {
                                  _.set(collection, String(keyOrIndex), valueToAssign);
                                  modified = true;
                              } else {
                                  // If collection doesn't exist, create it
                                  const newCollection = {};
                                  _.set(newCollection, String(keyOrIndex), valueToAssign);
                                  _.set(newState.stat_data, path, newCollection);
                                  modified = true;
                              }
                          }
                          break;
                      }
                  }
              } catch (e) {
                  console.error(`[归墟-备用方案] 处理指令失败:`, command, e);
              }
          }

          return modified ? newState : null;
      },

      // --- 内部辅助函数，从 function.ts 移植 ---
      _trimQuotes(str) {
          if (typeof str !== 'string') return str;
          return str.replace(/^['"` ]*(.*?)['"` ]*$/, '$1');
      },
      
      _parseCommandValue(valStr) {
          if (typeof valStr !== 'string') return valStr;
          const trimmed = valStr.trim();
          if (trimmed === 'true') return true;
          if (trimmed === 'false') return false;
          if (trimmed === 'null') return null;
          if (trimmed === 'undefined') return undefined;
          try {
              return JSON.parse(trimmed);
          } catch (e) {
              if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                  try {
                      return new Function(`return ${trimmed};`)();
                  } catch (err) { /* continue */ }
              }
          }
          return this._trimQuotes(valStr);
      },

      _extractCommands(inputText) {
          const results = [];
          let i = 0;
          while (i < inputText.length) {
              const match = inputText.substring(i).match(/_\.(set|assign|remove|add|insert)\(/);
              if (!match || match.index === undefined) break;
              
              const commandType = match[1];
              const start = i + match.index;
              const openParen = start + match[0].length;
              const closeParen = this._findMatchingCloseParen(inputText, openParen);
              
              if (closeParen === -1) {
                  i = openParen;
                  continue;
              }
              
              let endPos = closeParen + 1;
              if (endPos >= inputText.length || inputText[endPos] !== ';') {
                  i = closeParen + 1;
                  continue;
              }
              endPos++;
              
              const paramsString = inputText.substring(openParen, closeParen);
              const params = this._parseParameters(paramsString);
              
              results.push({ command: commandType, args: params });
              i = endPos;
          }
          return results;
      },

      _findMatchingCloseParen(str, startPos) {
          let parenCount = 1;
          let inQuote = false;
          let quoteChar = '';
          for (let i = startPos; i < str.length; i++) {
              const char = str[i];
              if ((char === '"' || char === "'" || char === '`') && str[i - 1] !== '\\') {
                  if (!inQuote) {
                      inQuote = true;
                      quoteChar = char;
                  } else if (char === quoteChar) {
                      inQuote = false;
                  }
              }
              if (!inQuote) {
                  if (char === '(') parenCount++;
                  else if (char === ')') {
                      parenCount--;
                      if (parenCount === 0) return i;
                  }
              }
          }
          return -1;
      },

      _parseParameters(paramsString) {
          const params = [];
          let currentParam = '';
          let inQuote = false;
          let quoteChar = '';
          let bracketCount = 0;
          let braceCount = 0;
          let parenCount = 0;
          for (let i = 0; i < paramsString.length; i++) {
              const char = paramsString[i];
              if ((char === '"' || char === "'" || char === '`') && (i === 0 || paramsString[i - 1] !== '\\')) {
                  if (!inQuote) {
                      inQuote = true;
                      quoteChar = char;
                  } else if (char === quoteChar) {
                      inQuote = false;
                  }
              }
              if (!inQuote) {
                  if (char === '(') parenCount++;
                  if (char === ')') parenCount--;
                  if (char === '[') bracketCount++;
                  if (char === ']') bracketCount--;
                  if (char === '{') braceCount++;
                  if (char === '}') braceCount--;
              }
              if (char === ',' && !inQuote && parenCount === 0 && bracketCount === 0 && braceCount === 0) {
                  params.push(currentParam.trim());
                  currentParam = '';
                  continue;
              }
              currentParam += char;
          }
          if (currentParam.trim()) {
              params.push(currentParam.trim());
          }
          return params;
      },

      // --- 新增：文本净化辅助函数 ---
      _getDisplayText(aiResponse) {
        try {
          if (!aiResponse || typeof aiResponse !== 'string') return '';
          
          // 优先提取 <gametxt> 的内容
          const gameText = this._extractLastTagContent('gametxt', aiResponse);
          if (gameText !== null) {
              return gameText;
          }

          // 备用方案：如果找不到 <gametxt>，则移除所有已知的非显示标签
          let cleanedText = aiResponse;
          const tagsToRemove = ['本世历程', '往世涟漪', 'UpdateVariable', '角色提取', 'thinking'];
          
          tagsToRemove.forEach(tag => {
              // 移除 <tag>...</tag> 结构
              const regexWithContent = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
              cleanedText = cleanedText.replace(regexWithContent, '');
              // 移除自闭合的 <tag/> 结构
              const regexSelfClosing = new RegExp(`<${tag}\\s*\\/>`, 'gi');
              cleanedText = cleanedText.replace(regexSelfClosing, '');
          });

          return cleanedText.trim();
        } catch (e) {
          console.error("解析显示文本时出错:", e, "原始输入:", aiResponse);
          return "[摘要解析失败]";
        }
      },

      // --- 新增：可重用的、健壮的标签提取函数 ---
      _extractLastTagContent(tagName, text, ignoreCase = false) {
          if (!text || typeof text !== 'string') return null;

          const endTag = `</${tagName}>`;
          let searchPool = text;
          let endTagPattern = endTag;

          if (ignoreCase) {
              searchPool = text.toLowerCase();
              endTagPattern = endTag.toLowerCase();
          }

          const lastEndIndex = searchPool.lastIndexOf(endTagPattern);

          if (lastEndIndex !== -1) {
              const startTag = `<${tagName}>`;
              let startTagPattern = startTag;
              if (ignoreCase) {
                  startTagPattern = startTag.toLowerCase();
              }
              
              const lastStartIndex = searchPool.lastIndexOf(startTagPattern, lastEndIndex);

              if (lastStartIndex !== -1) {
                  const startIndex = lastStartIndex + startTag.length;
                  return text.substring(startIndex, lastEndIndex).trim();
              }
          }
          return null;
      },

      // --- 新增：多存档管理功能 ---
      showSaveLoadManager() {
        const { $ } = GuixuDOM;
        this.openModal('save-load-modal');
        const manualContainer = $('#save-slots-container');
        const autoContainer = $('#auto-save-slot-container');
        const autoSaveCheckbox = $('#auto-save-checkbox');

        if (!manualContainer || !autoContainer || !autoSaveCheckbox) return;

        autoSaveCheckbox.checked = this.isAutoSaveEnabled;

        let saves;
        try {
            saves = this.getSavesFromStorage();
        } catch (e) {
            console.error("解析整个存档文件失败:", e);
            manualContainer.innerHTML = `<div style="color: #ff6b6b; padding: 20px; text-align: center;"><p>错误：主存档文件已损坏。</p></div>`;
            autoContainer.innerHTML = '';
            return;
        }

        // --- 渲染自动存档 ---
        let autoHtml = '';
        const autoSlotIds = ['auto_save_slot_0', 'auto_save_slot_1'];
        autoSlotIds.forEach(slotId => {
            const saveData = saves[slotId];
            autoHtml += this.renderSlot(saveData, slotId, true);
        });
        autoContainer.innerHTML = autoHtml;

        // --- 渲染手动存档 ---
        let manualHtml = '';
        const totalSlots = 5;
        for (let i = 1; i <= totalSlots; i++) {
            const slotId = `slot_${i}`;
            const saveData = saves[slotId];
            manualHtml += this.renderSlot(saveData, slotId, false);
        }
        manualContainer.innerHTML = manualHtml;
        
        this.bindSaveSlotListeners();
      },

      // 新增：独立的槽位渲染函数
      renderSlot(saveData, slotId, isAutoSave) {
          let html = `<div class="save-slot" data-slot-id="${slotId}">`;
          html += `<div class="save-slot-info">`;

          let statDataForRender = null;
          if (saveData && typeof saveData.mvu_data === 'object' && saveData.mvu_data !== null) {
              statDataForRender = saveData.mvu_data.stat_data || saveData.mvu_data;
          }

          if (statDataForRender) {
              const date = new Date(saveData.timestamp).toLocaleString('zh-CN');
              const jingjie = GuixuHelpers.safeGetValue(statDataForRender, '当前境界.0', '未知');
              const jinian = GuixuHelpers.safeGetValue(statDataForRender, '当前时间纪年.0', '未知');
              const summary = this._getDisplayText(saveData.message_content);
              const saveName = saveData.save_name || (isAutoSave ? `自动存档 (${slotId.slice(-1)})` : `存档 ${slotId.split('_')[1]}`);
              
              html += `
                  <div class="slot-name">${saveName}</div>
                  <div class="slot-time">${date} - ${jingjie} - ${jinian}</div>
                  <div class="slot-summary">${summary ? summary.substring(0, 40) + '...' : '无正文记录'}</div>
              `;
          } else {
              const name = isAutoSave ? `自动存档 (${slotId.slice(-1)})` : `存档 ${slotId.split('_')[1]}`;
              html += `
                  <div class="slot-name">${name}</div>
                  <div class="slot-time" style="font-style: italic; color: #8b7355;">空存档位</div>
              `;
          }

          html += `</div><div class="save-slot-actions">`;
          if (isAutoSave) {
              html += `
                  <button class="interaction-btn btn-load-slot" style="padding: 8px 12px;" ${!saveData ? 'disabled' : ''}>读档</button>
                  <button class="interaction-btn btn-delete-slot" style="padding: 8px 12px; background: #8b0000;" ${!saveData ? 'disabled' : ''}>删除</button>
              `;
          } else {
              html += `
                  <button class="interaction-btn btn-save-slot" style="padding: 6px 10px; font-size: 12px;">存档</button>
                  <button class="interaction-btn btn-load-slot" style="padding: 6px 10px; font-size: 12px;" ${!saveData ? 'disabled' : ''}>读档</button>
                  <button class="interaction-btn btn-export-slot" style="padding: 6px 10px; font-size: 12px; background: #004d40;" ${!saveData ? 'disabled' : ''}>导出</button>
                  <button class="interaction-btn btn-delete-slot" style="padding: 6px 10px; font-size: 12px; background: #8b0000;" ${!saveData ? 'disabled' : ''}>删除</button>
              `;
          }
          html += `</div></div>`;
          return html;
      },

      bindSaveSlotListeners() {
        const { $ } = GuixuDOM;
        const container = $('#save-load-modal .modal-body');
        if (!container) {
          console.error('[归墟存档] 找不到存档模态框主体元素');
          return;
        }

        // 使用克隆节点的方式来确保每次都绑定新的、干净的事件监听器
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);

        console.log('[归墟存档] 绑定存档按钮事件监听器');
        newContainer.addEventListener('click', (e) => {
          const target = e.target;
          const slotDiv = target.closest('.save-slot');
          if (!slotDiv) return;
          
          const slotId = slotDiv.dataset.slotId;
          console.log('[归墟存档] 点击存档按钮，槽位:', slotId, '按钮类型:', target.className);

          if (target.classList.contains('btn-save-slot')) {
            console.log('[归墟存档] 执行存档操作');
            this.saveGame(slotId);
          } else if (target.classList.contains('btn-load-slot')) {
            console.log('[归墟存档] 执行读档操作');
            this.loadGame(slotId);
          } else if (target.classList.contains('btn-export-slot')) {
            console.log('[归墟存档] 执行导出操作');
            this.exportSave(slotId);
          } else if (target.classList.contains('btn-delete-slot')) {
            console.log('[归墟存档] 执行删除操作');
            this.deleteSave(slotId);
          }
        });
      },

      getSavesFromStorage() {
        try {
          const saves = localStorage.getItem('guixu_multi_save_data');
          return saves ? JSON.parse(saves) : {};
        } catch (e) {
          console.error("获取存档失败:", e);
          return {};
        }
      },

      async saveGame(slotId) {
        // **重构**: 此函数现在只处理手动存档，不再关心自动存档逻辑。
        const saveName = await this.promptForSaveName(slotId);
        if (!saveName) {
          this.showTemporaryMessage('存档已取消');
          return;
        }

        const allSaves = this.getSavesFromStorage();
        const slotExists = allSaves[slotId];

        const performSave = async () => {
          try {
            let currentMvuData = this.currentMvuState;
            let currentMessageContent = '';
            
            if (!currentMvuData) {
              const messages = await getChatMessages(getCurrentMessageId());
              if (!messages || messages.length === 0) throw new Error('无法获取当前消息数据。');
              currentMvuData = messages[0].data;
            }
            
            // 总是尝试获取最新的消息内容
            try {
                const messages = await getChatMessages(getCurrentMessageId());
                currentMessageContent = messages?.[0]?.message || '';
            } catch (e) {
                console.warn('[归墟存档] 获取最新消息内容失败:', e);
            }

            if (!currentMvuData || !currentMvuData.stat_data) {
              throw new Error('MVU数据不完整，无法存档。');
            }

            // 创建独立的世界书条目
            const bookName = '1归墟';
            const index = this.unifiedIndex;
            const journeyKey = index > 1 ? `本世历程(${index})` : '本世历程';
            const pastLivesKey = index > 1 ? `往世涟漪(${index})` : '往世涟漪';
            
            const saveJourneyEntryName = `${saveName}-本世历程`;
            const savePastLivesEntryName = `${saveName}-往世涟漪`;
            
            const lorebookEntries = {
              journey_entry_name: saveJourneyEntryName,
              past_lives_entry_name: savePastLivesEntryName
            };

            const allLorebookEntries = await GuixuAPI.getLorebookEntries(bookName);
            const journeyEntry = allLorebookEntries.find(entry => entry.comment === journeyKey);
            const pastLivesEntry = allLorebookEntries.find(entry => entry.comment === pastLivesKey);
            
            const entriesToCreate = [];
            entriesToCreate.push({
              comment: saveJourneyEntryName,
              content: journeyEntry?.content || '',
              keys: [saveJourneyEntryName], enabled: false, position: 'before_character_definition', order: 20
            });
            entriesToCreate.push({
              comment: savePastLivesEntryName,
              content: pastLivesEntry?.content || '',
              keys: [savePastLivesEntryName], enabled: false, position: 'before_character_definition', order: 19
            });
            
            await GuixuAPI.createLorebookEntries(bookName, entriesToCreate);
            
            const saveDataPayload = {
              timestamp: new Date().toISOString(),
              save_name: saveName,
              message_content: currentMessageContent,
              lorebook_entries: lorebookEntries,
              mvu_data: currentMvuData
            };

            allSaves[slotId] = saveDataPayload;
            localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
            this.showTemporaryMessage(`存档"${saveName}"已保存到存档位 ${slotId.split('_')[1]}`);
            this.showSaveLoadManager();
          } catch (error) {
            console.error('执行存档操作失败:', error);
            this.showTemporaryMessage(`存档失败: ${error.message}`);
          }
        };

        if (slotExists) {
          this.showCustomConfirm(`存档位 ${slotId.split('_')[1]} 已有数据，确定要覆盖吗？`, performSave);
        } else {
          await performSave();
        }
      },

      async loadGame(slotId) {
        const allSaves = this.getSavesFromStorage();
        const saveData = allSaves[slotId];
        
        if (!saveData) {
          this.showTemporaryMessage('没有找到存档文件。');
          return;
        }

        const saveName = saveData.save_name || `存档${slotId.split('_')[1]}`;
        this.showCustomConfirm(`确定要读取存档"${saveName}"吗？当前所有未保存的进度将会被覆盖。`, async () => {
          try {
            const messages = await getChatMessages(getCurrentMessageId());
            if (!messages || messages.length === 0) {
              this.showTemporaryMessage('错误：无法获取当前消息，无法读档。');
              return;
            }
            
            const messageZero = messages[0];
            const loadedData = saveData.mvu_data;
            const loadedMessageContent = saveData.message_content || '';

            messageZero.data = loadedData;
            messageZero.message = loadedMessageContent;

            // --- 新逻辑：从独立世界书恢复到当前序号 ---
            if (saveData.lorebook_entries) {
              const entries = saveData.lorebook_entries;
              const bookName = GuixuConstants.LOREBOOK.NAME;
              const currentIndex = this.unifiedIndex;
              const currentJourneyKey = currentIndex > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.JOURNEY}(${currentIndex})` : GuixuConstants.LOREBOOK.ENTRIES.JOURNEY;
              const currentPastLivesKey = currentIndex > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES}(${currentIndex})` : GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES;

              try {
                const allEntries = await GuixuAPI.getLorebookEntries(bookName);
                
                // 查找存档的独立世界书条目
                const saveJourneyEntry = allEntries.find(entry => entry.comment === entries.journey_entry_name);
                const savePastLivesEntry = allEntries.find(entry => entry.comment === entries.past_lives_entry_name);
                
                // 查找当前序号的世界书条目
                const currentJourneyEntry = allEntries.find(entry => entry.comment === currentJourneyKey);
                const currentPastLivesEntry = allEntries.find(entry => entry.comment === currentPastLivesKey);
                
                const entriesToUpdate = [];
                
                // 覆写本世历程 - 修复：允许空内容的恢复
                if (saveJourneyEntry) {
                  const contentToRestore = saveJourneyEntry.content || '';
                  if (currentJourneyEntry) {
                    // 更新现有条目
                    entriesToUpdate.push({
                      uid: currentJourneyEntry.uid,
                      content: contentToRestore
                    });
                    console.log(`[归墟读档] 更新本世历程条目，内容长度: ${contentToRestore.length}`);
                  } else {
                    // 创建新条目
                    await GuixuAPI.createLorebookEntries(bookName, [{
                      comment: currentJourneyKey,
                      content: contentToRestore,
                      keys: [currentJourneyKey],
                      enabled: true,
                      position: 'before_character_definition',
                      order: 20
                    }]);
                    console.log(`[归墟读档] 创建本世历程条目，内容长度: ${contentToRestore.length}`);
                  }
                }
                
                // 覆写往世涟漪 - 修复：允许空内容的恢复
                if (savePastLivesEntry) {
                  const contentToRestore = savePastLivesEntry.content || '';
                  if (currentPastLivesEntry) {
                    // 更新现有条目
                    entriesToUpdate.push({
                      uid: currentPastLivesEntry.uid,
                      content: contentToRestore
                    });
                    console.log(`[归墟读档] 更新往世涟漪条目，内容长度: ${contentToRestore.length}`);
                  } else {
                    // 创建新条目
                    await GuixuAPI.createLorebookEntries(bookName, [{
                      comment: currentPastLivesKey,
                      content: contentToRestore,
                      keys: [currentPastLivesKey],
                      enabled: true,
                      position: 'before_character_definition',
                      order: 19
                    }]);
                    console.log(`[归墟读档] 创建往世涟漪条目，内容长度: ${contentToRestore.length}`);
                  }
                }
                
                // 批量更新现有条目
                if (entriesToUpdate.length > 0) {
                  await GuixuAPI.setLorebookEntries(bookName, entriesToUpdate);
                }
                
                console.log(`[归墟读档] 已将存档"${saveName}"的世界书数据覆写到当前序号 ${currentIndex}`);
                
              } catch (e) {
                console.error("恢复世界书数据时出错:", e);
                this.showTemporaryMessage("警告：恢复世界书数据失败，但主数据已恢复。");
              }
            }
            // --- 新逻辑结束 ---

            await GuixuAPI.setChatMessages([messageZero], { refresh: 'all' });
            
            await this.loadAndDisplayCurrentScene(loadedMessageContent);
            await this.init();

            this.showTemporaryMessage(`读档"${saveName}"成功！`);
            this.closeAllModals();

          } catch (error) {
            console.error('读档失败:', error);
            this.showTemporaryMessage(`读档失败: ${error.message}`);
          }
        });
      },

      deleteSave(slotId) {
        const isAutoSave = slotId.startsWith('auto_');
        const slotName = isAutoSave
          ? (slotId === 'auto_save_slot_0' ? '自动存档(最新)' : '自动存档(上一次)')
          : `存档 ${slotId.split('_')[1]}`;

        this.showCustomConfirm(`确定要删除 "${slotName}" 吗？此操作不可恢复。`, async () => {
          try {
            const allSaves = this.getSavesFromStorage();
            const saveDataToDelete = allSaves[slotId];

            if (saveDataToDelete) {
              // 先删除关联的世界书条目
              await this.deleteLorebookBackup(saveDataToDelete);

              // 再从localStorage中删除存档
              delete allSaves[slotId];
              localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
              
              this.showTemporaryMessage(`"${slotName}" 已删除。`);
              this.showSaveLoadManager(); // 刷新UI
            }
          } catch (error) {
            console.error('删除存档失败:', error);
            this.showTemporaryMessage(`删除存档失败: ${error.message}`);
          }
        });
      },

      async deleteLorebookBackup(saveData) {
        if (!saveData || !saveData.lorebook_entries) return;

        const bookName = GuixuConstants.LOREBOOK.NAME;
        const { journey_entry_name, past_lives_entry_name } = saveData.lorebook_entries;

        try {
          const allEntries = await GuixuAPI.getLorebookEntries(bookName);
          const entriesToDelete = [];
          
          const journeyEntry = allEntries.find(e => e.comment === journey_entry_name);
          if (journeyEntry) entriesToDelete.push(journeyEntry.uid);
          
          const pastLivesEntry = allEntries.find(e => e.comment === past_lives_entry_name);
          if (pastLivesEntry) entriesToDelete.push(pastLivesEntry.uid);

          if (entriesToDelete.length > 0) {
            await GuixuAPI.deleteLorebookEntries(bookName, entriesToDelete);
            console.log(`[归墟删除] 已删除 ${entriesToDelete.length} 个关联的世界书条目。`);
          }
        } catch (error) {
          console.error('删除关联的世界书条目时出错:', error);
          // Do not re-throw, allow main deletion to proceed
          this.showTemporaryMessage('警告：删除关联的世界书条目失败。');
        }
      },

      clearAllSaves() {
        this.showCustomConfirm(`你确定要清除所有存档吗？这个操作会删除所有5个存档槽位的数据，且不可恢复。`, async () => {
          try {
            const allSaves = this.getSavesFromStorage();

            // 1. 遍历并删除所有关联的世界书条目
            for (const slotId in allSaves) {
              if (allSaves.hasOwnProperty(slotId)) {
                await this.deleteLorebookBackup(allSaves[slotId]);
              }
            }

            // 2. 清除localStorage中的主存档文件
            localStorage.removeItem('guixu_multi_save_data');
            
            this.showTemporaryMessage(`所有存档已清除。`);
            this.showSaveLoadManager(); // 刷新UI
          } catch (error) {
            console.error('清除所有存档失败:', error);
            this.showTemporaryMessage(`清除存档失败: ${error.message}`);
          }
        });
      },

      async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                const importedSave = JSON.parse(content);
                // Basic validation
                if (!importedSave.timestamp || !importedSave.mvu_data || !importedSave.save_name) {
                    throw new Error('存档文件格式无效或已损坏。');
                }
                // Prompt user to select a slot to overwrite
                const slotId = await this.promptForSlotSelection(importedSave.save_name);
                if (!slotId) {
                    this.showTemporaryMessage('导入已取消。');
                    return;
                }
                const allSaves = this.getSavesFromStorage();
                allSaves[slotId] = importedSave;
                localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
                this.showTemporaryMessage(`存档 "${importedSave.save_name}" 已成功导入到 ${slotId}。`);
                this.showSaveLoadManager(); // Refresh UI
            } catch (error) {
                console.error('导入存档失败:', error);
                this.showTemporaryMessage(`导入失败: ${error.message}`);
            }
        };
        reader.onerror = () => {
            this.showTemporaryMessage('读取文件时出错。');
        };
        reader.readAsText(file);
        // Reset file input to allow importing the same file again
        event.target.value = '';
      },

      async exportSave(slotId) {
        const allSaves = this.getSavesFromStorage();
        const saveData = allSaves[slotId];

        if (!saveData) {
          this.showTemporaryMessage('该存档位为空，无法导出。');
          return;
        }

        const saveName = saveData.save_name || `guixu_save_${slotId}`;
        const fileName = `${saveName.replace(/[^a-z0-9]/gi, '_')}.json`;
        
        this._downloadJSON(saveData, fileName);
        this.showTemporaryMessage(`正在导出存档 "${saveData.save_name}"...`);
      },

      _downloadJSON(data, fileName) {
        const { h } = GuixuDOM;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: fileName });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      async promptForSlotSelection(importName) {
        const { h, $ } = GuixuDOM;
        return new Promise(resolve => {
          const container = $('.guixu-root-container');
          if (!container) {
            console.error('[归墟存档] 找不到根容器');
            return resolve(null);
          }

          const slotButtons = [];
          for (let i = 1; i <= 5; i++) {
            slotButtons.push(
              h('button', {
                className: 'interaction-btn slot-select-btn',
                'data-slot-id': `slot_${i}`,
                textContent: `存档位 ${i}`,
              })
            );
          }

          const modal = h('div', { className: 'modal-overlay', style: 'display: flex; z-index: 2001;' }, [
            h('div', { className: 'modal-content', style: 'width: 450px; height: auto;' }, [
              h('div', { className: 'modal-header' }, [
                h('h2', { className: 'modal-title' }, ['选择导入位置'])
              ]),
              h('div', { className: 'modal-body', style: 'padding: 20px;' }, [
                h('p', { style: 'margin-bottom: 20px;' }, [`请选择一个存档位以导入 "${importName}":`]),
                h('div', { style: 'display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;' }, slotButtons),
                h('div', { style: 'text-align: right; margin-top: 25px;' }, [
                  h('button', { id: 'import-cancel-btn', className: 'interaction-btn', textContent: '取消' })
                ])
              ])
            ])
          ]);
          
          modal.addEventListener('click', (e) => {
              if (e.target.classList.contains('slot-select-btn')) {
                  const slotId = e.target.dataset.slotId;
                  modal.remove();
                  resolve(slotId);
              } else if (e.target.id === 'import-cancel-btn' || e.target === modal) {
                  modal.remove();
                  resolve(null);
              }
          });

          container.appendChild(modal);
        });
      },

      // --- 新增：存档命名输入框 ---
      async promptForSaveName(slotId) {
        const { h, $, $$ } = GuixuDOM;
        return new Promise((resolve) => {
          const container = $('.guixu-root-container');
          if (!container) {
            console.error('[归墟存档] 找不到根容器');
            return resolve(null);
          }

          const previewJourney = h('span', { id: 'preview-journey' }, ['存档名-本世历程']);
          const previewPastLives = h('span', { id: 'preview-past-lives' }, ['存档名-往世涟漪']);
          const input = h('input', {
            type: 'text',
            id: 'save-name-input',
            placeholder: '例如：突破金丹期',
            style: 'width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #8b7355; color: #e0dcd1; border-radius: 4px; font-size: 14px; margin-bottom: 15px;',
            oninput: () => {
              const name = input.value.trim() || '存档名';
              previewJourney.textContent = `${name}-本世历程`;
              previewPastLives.textContent = `${name}-往世涟漪`;
            },
            onkeypress: (e) => {
              if (e.key === 'Enter') confirmBtn.click();
            }
          });

          const confirmBtn = h('button', {
            id: 'save-name-confirm',
            className: 'interaction-btn primary-btn',
            textContent: '确认',
            onclick: () => {
              const saveName = input.value.trim();
              if (!saveName) {
                this.showTemporaryMessage('请输入存档名称');
                return;
              }
              modal.remove();
              resolve(saveName);
            }
          });

          const cancelBtn = h('button', {
            id: 'save-name-cancel',
            className: 'interaction-btn',
            textContent: '取消',
            onclick: () => {
              modal.remove();
              resolve(null);
            }
          });

          const modal = h('div', { className: 'modal-overlay', style: 'display: flex; z-index: 2000;' }, [
            h('div', { className: 'modal-content', style: 'width: 400px; height: auto; max-height: none;' }, [
              h('div', { className: 'modal-header' }, [h('h2', { className: 'modal-title' }, ['存档命名'])]),
              h('div', { className: 'modal-body', style: 'padding: 20px;' }, [
                h('p', { style: 'margin-bottom: 15px; color: #c9aa71;' }, [`请为存档位 ${slotId.split('_')[1]} 输入一个名称：`]),
                input,
                h('p', { style: 'font-size: 12px; color: #8b7355; margin-bottom: 20px;' }, [
                  '将创建世界书条目：', h('br'), '• ', previewJourney, h('br'), '• ', previewPastLives
                ]),
                h('div', { style: 'display: flex; gap: 10px; justify-content: flex-end;' }, [cancelBtn, confirmBtn])
              ])
            ])
          ]);

          container.appendChild(modal);
          setTimeout(() => input.focus(), 100);
        });
      },

      // --- 新增：自动存档核心逻辑 ---
      async performAutoSave() {
        console.log('[归墟] 检查是否需要自动存档...');
        if (!this.currentMvuState) {
          console.warn('[归墟] 自动存档跳过：无法获取当前mvu状态。');
          return;
        }

        try {
          const allSaves = this.getSavesFromStorage();
          const slot0 = allSaves['auto_save_slot_0'];

          // 检查当前状态是否与最新的自动存档相同
          if (slot0) {
            const currentStateString = JSON.stringify(this.currentMvuState.stat_data);
            const latestSaveStateString = JSON.stringify(slot0.mvu_data.stat_data);
            if (currentStateString === latestSaveStateString) {
              console.log('[归墟] 自动存档跳过：游戏状态自上次自动存档以来未发生变化。');
              return;
            }
          }

          console.log('[归墟] 状态已改变，执行双缓冲自动存档...');

          // 1. 将旧的 slot0 移动到 slot1 (如果存在)
          if (slot0) {
            // 删除旧的 slot1 的世界书备份
            const oldSlot1 = allSaves['auto_save_slot_1'];
            if (oldSlot1) {
              await this.deleteLorebookBackup(oldSlot1);
            }

            // 重命名 slot0 的世界书条目为 slot1 的名称
            const newSlot1SaveName = `自动存档(上一次) - ${new Date(slot0.timestamp).toLocaleString('sv-SE')}`;
            const newJourneyName = `${newSlot1SaveName}-本世历程`;
            const newPastLivesName = `${newSlot1SaveName}-往世涟漪`;

            await this.renameLorebookEntry(slot0.lorebook_entries.journey_entry_name, newJourneyName);
            await this.renameLorebookEntry(slot0.lorebook_entries.past_lives_entry_name, newPastLivesName);

            // 更新存档数据并移动到 slot1
            slot0.save_name = newSlot1SaveName;
            slot0.lorebook_entries.journey_entry_name = newJourneyName;
            slot0.lorebook_entries.past_lives_entry_name = newPastLivesName;
            allSaves['auto_save_slot_1'] = slot0;
          }

          // 2. 将当前状态存为新的 slot0
          const newSaveName = `自动存档(最新) - ${new Date().toLocaleString('sv-SE')}`;
          
          const currentMvuData = this.currentMvuState;
          let currentMessageContent = '';
          try {
            const messages = await getChatMessages(getCurrentMessageId());
            currentMessageContent = messages?.[0]?.message || '';
          } catch (e) { /* 忽略错误 */ }

          const bookName = '1归墟';
          const index = this.unifiedIndex;
          const journeyKey = index > 1 ? `本世历程(${index})` : '本世历程';
          const pastLivesKey = index > 1 ? `往世涟漪(${index})` : '往世涟漪';
          
          const saveJourneyEntryName = `${newSaveName}-本世历程`;
          const savePastLivesEntryName = `${newSaveName}-往世涟漪`;
          
          const lorebookEntries = {
            journey_entry_name: saveJourneyEntryName,
            past_lives_entry_name: savePastLivesEntryName
          };

          const allLorebookEntries = await TavernHelper.getLorebookEntries(bookName);
          const journeyEntry = allLorebookEntries.find(entry => entry.comment === journeyKey);
          const pastLivesEntry = allLorebookEntries.find(entry => entry.comment === pastLivesKey);
          
          const entriesToCreate = [];
          entriesToCreate.push({ comment: saveJourneyEntryName, content: journeyEntry?.content || '', keys: [saveJourneyEntryName], enabled: false, position: 'before_character_definition', order: 20 });
          entriesToCreate.push({ comment: savePastLivesEntryName, content: pastLivesEntry?.content || '', keys: [savePastLivesEntryName], enabled: false, position: 'before_character_definition', order: 19 });
          
          if (entriesToCreate.length > 0) {
            await TavernHelper.createLorebookEntries(bookName, entriesToCreate);
          }

          const saveDataPayload = {
            timestamp: new Date().toISOString(),
            save_name: newSaveName,
            message_content: currentMessageContent,
            lorebook_entries: lorebookEntries,
            mvu_data: currentMvuData
          };

          allSaves['auto_save_slot_0'] = saveDataPayload;
          
          // 3. 保存所有更改到localStorage
          localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
          
          this.showTemporaryMessage(`已自动存档`);
          if ($('#save-load-modal').style.display === 'flex') {
            this.showSaveLoadManager();
          }
        } catch (error) {
          console.error('自动存档失败:', error);
          this.showTemporaryMessage(`自动存档失败: ${error.message}`);
        }
      },

      saveAutoSaveState() {
        try {
          localStorage.setItem('guixu_auto_save_enabled', this.isAutoSaveEnabled);
        } catch (e) {
          console.error('保存自动存档状态失败:', e);
        }
      },

      loadAutoSaveState() {
        const { $ } = GuixuDOM;
        try {
          const savedState = localStorage.getItem('guixu_auto_save_enabled');
          // 如果localStorage中没有保存过状态，则默认为 false (关闭)
          this.isAutoSaveEnabled = savedState === 'true';
          console.log(`[归墟存档] 加载自动存档状态: ${this.isAutoSaveEnabled}`);

          const checkbox = $('#auto-save-checkbox');
          if (checkbox) {
            checkbox.checked = this.isAutoSaveEnabled;
          }

          // 根据加载的状态决定是否启动轮询
          if (this.isAutoSaveEnabled) {
            this.startAutoSavePolling();
          } else {
            this.stopAutoSavePolling(); // 确保在加载时状态为关闭时，轮询也一定是关闭的
          }
        } catch (e) {
          console.error('加载自动存档状态失败:', e);
          this.isAutoSaveEnabled = false;
        }
      },

      startAutoSavePolling() {
        this.stopAutoSavePolling();
        console.log('[归墟] 启动自动存档轮询 (10秒)...');
        this.autoSaveIntervalId = setInterval(() => {
          this.performAutoSave();
        }, 10000); // 10秒
      },

      stopAutoSavePolling() {
        if (this.autoSaveIntervalId) {
          console.log('[归墟] 停止自动存档轮询。');
          clearInterval(this.autoSaveIntervalId);
          this.autoSaveIntervalId = null;
        }
      },

      async renameLorebookEntry(oldName, newName) {
        if (!oldName || !newName || oldName === newName) return;
        const bookName = GuixuConstants.LOREBOOK.NAME;
        try {
          const allEntries = await GuixuAPI.getLorebookEntries(bookName);
          const oldEntry = allEntries.find(e => e.comment === oldName);
          if (!oldEntry) {
            console.warn(`[重命名] 未找到旧条目: ${oldName}`);
            return;
          }

          // 创建一个新条目，内容和属性与旧条目相同
          const newEntryData = { ...oldEntry };
          delete newEntryData.uid; // 删除uid以创建新条目
          newEntryData.comment = newName;
          newEntryData.keys = [newName]; // 更新关键字

          await GuixuAPI.createLorebookEntries(bookName, [newEntryData]);
          // 成功创建新条目后，删除旧条目
          await GuixuAPI.deleteLorebookEntries(bookName, [oldEntry.uid]);
          console.log(`[重命名] 成功将 "${oldName}" 重命名为 "${newName}"`);
        } catch (error) {
          console.error(`重命名世界书条目从 "${oldName}" 到 "${newName}" 时失败:`, error);
          // 这是一个关键操作，如果失败则抛出错误
          throw new Error(`重命名世界书条目失败: ${error.message}`);
        }
      },

      // --- 新增：自动化系统修剪功能 ---
      showTrimJourneyModal() {
        const { $ } = GuixuDOM;
        this.openModal('trim-journey-modal');
        const indexInput = $('#trim-journey-index-input');
        if (indexInput) {
            indexInput.value = this.unifiedIndex;
        }
      },

      async trimJourneyAutomation(isAuto = false) {
        const { $ } = GuixuDOM;
        const indexInput = $('#trim-journey-index-input');
        const index = indexInput ? parseInt(indexInput.value, 10) : this.unifiedIndex;
        
        if (isNaN(index) || index <= 0) {
            this.showTemporaryMessage('请输入有效的世界书序号。');
            return;
        }

        const bookName = GuixuConstants.LOREBOOK.NAME;
        const journeyKey = index > 1 ? `${GuixuConstants.LOREBOOK.ENTRIES.JOURNEY}(${index})` : GuixuConstants.LOREBOOK.ENTRIES.JOURNEY;

        if (!isAuto) {
            this.showWaitingMessage();
        }

        try {
            const allEntries = await GuixuAPI.getLorebookEntries(bookName);
            const journeyEntry = allEntries.find(entry => entry.comment === journeyKey);

            if (!journeyEntry || !journeyEntry.content) {
                throw new Error(`未找到或“${journeyKey}”内容为空。`);
            }

            const trimmedContent = this._getTrimmedJourneyContent(journeyEntry.content);

            if (journeyEntry.content === trimmedContent) {
               if (!isAuto) this.showTemporaryMessage('无需修剪，内容已是最新。');
               return;
            }

            await GuixuAPI.setLorebookEntries(bookName, [{ uid: journeyEntry.uid, content: trimmedContent }]);
            
            if (!isAuto) {
                this.showTemporaryMessage(`“${journeyKey}”已成功修剪。`);
                this.showJourney(); // 刷新历程模态框
            } else {
                console.log(`[自动修剪] “${journeyKey}”已成功修剪。`);
            }

        } catch (error) {
            console.error('修剪“本世历程”时出错:', error);
            if (!isAuto) this.showTemporaryMessage(`修剪失败: ${error.message}`);
        } finally {
            if (!isAuto) {
                this.hideWaitingMessage();
                this.closeAllModals();
            }
        }
      },

      _getTrimmedJourneyContent(fullContent) {
          if (!fullContent) return fullContent;
          const events = this.parseJourneyEntry(fullContent);
          if (events.length <= 2) {
              return fullContent; // 不需要修剪
          }

          let trimCount = 0;
          const updatedEvents = events.map((event, idx) => {
              // 保留最后两个事件的自动化信息
              if (idx < events.length - 2) {
                  if (event['自动化系统']) {
                      const newEvent = { ...event };
                      delete newEvent['自动化系统'];
                      trimCount++;
                      return newEvent;
                  }
              }
              return event;
          });

          if (trimCount === 0) {
              return fullContent; // 没有内容被改变
          }
          
          // 重构内容字符串
          return updatedEvents.map(event => {
              const lines = [];
              if (event['序号'] !== undefined) {
                  lines.push(`序号|${event['序号']}`);
              }
              for (const key in event) {
                  if (event.hasOwnProperty(key) && key !== '序号') {
                      lines.push(`${key}|${event[key]}`);
                  }
              }
              return lines.join('\n');
          }).join('\n\n');
      },

      saveAutoTrimState() {
        try {
          localStorage.setItem('guixu_auto_trim_enabled', this.isAutoTrimEnabled);
        } catch (e) {
          console.error('保存自动修剪状态失败:', e);
        }
      },

      loadAutoTrimState() {
        const { $ } = GuixuDOM;
        try {
          const savedState = localStorage.getItem('guixu_auto_trim_enabled');
          this.isAutoTrimEnabled = savedState === 'true';
          console.log(`[归墟] 加载自动修剪状态: ${this.isAutoTrimEnabled}`);
          const checkbox = $('#auto-trim-checkbox');
           if (checkbox) {
               checkbox.checked = this.isAutoTrimEnabled;
           }
        } catch (e) {
          console.error('加载自动修剪状态失败:', e);
          this.isAutoTrimEnabled = false;
        }
      },
    };
    
     // --- Entry Point ---
     // 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
    eventOn(tavern_events.APP_READY, () => {
      GuixuManager.init();
    });

    // 事件监听已在 GuixuManager.init() 中处理，此处不再需要
  })();
