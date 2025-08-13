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
      this.syncUserPreferencesFromRoaming().finally(() => this.applyUserPreferences());
      this.loadInputDraft();
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

      // 全屏切换
      $('#fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());
      // 全屏状态变化时更新按钮并重新应用视口缩放（退出/进入全屏时需要重算）
      document.addEventListener('fullscreenchange', () => { 
        this._updateFullscreenButtonState(); 
        this.applyUserPreferences(); 
      });
      // 初始化一次按钮状态
      this._updateFullscreenButtonState();

      // 右侧按钮 -> 组件入口
      $('#btn-inventory')?.addEventListener('click', () => window.InventoryComponent?.show?.());
      $('#btn-relationships')?.addEventListener('click', () => window.RelationshipsComponent?.show?.());
      $('#btn-command-center')?.addEventListener('click', () => window.CommandCenterComponent?.show?.());
      $('#btn-character-details')?.addEventListener('click', () => window.CharacterDetailsComponent?.show?.());
      $('#btn-guixu-system')?.addEventListener('click', () => window.GuixuSystemComponent?.show?.());
      $('#btn-show-extracted')?.addEventListener('click', () => window.ExtractedContentComponent?.show?.());
      $('#btn-save-load-manager')?.addEventListener('click', () => window.GuixuActionService?.showSaveLoadManager?.());
      $('#btn-settings')?.addEventListener('click', () => window.SettingsComponent?.show?.());
      $('#btn-view-statuses')?.addEventListener('click', () => window.StatusesComponent?.show?.());

      // 世界线回顾
      $('#btn-view-journey-main')?.addEventListener('click', () => window.JourneyComponent?.show?.());
      $('#btn-view-past-lives-main')?.addEventListener('click', () => window.PastLivesComponent?.show?.());

      // 存档管理入口
      $('#btn-clear-all-saves')?.addEventListener('click', () => window.GuixuActionService?.clearAllSaves?.());
      $('#btn-import-save')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
      $('#import-file-input')?.addEventListener('change', (e) => window.GuixuActionService?.handleFileImport?.(e));

      // 指令中心（组件未加载时的后备绑定）
      $('#btn-execute-commands')?.addEventListener('click', () => this.handleAction());
      $('#btn-clear-commands')?.addEventListener('click', () => {
        window.GuixuState.update('pendingActions', []);
        window.GuixuHelpers.showTemporaryMessage('指令已清空');
        // 立即刷新指令中心内容
        if (window.CommandCenterComponent?.show) {
          window.CommandCenterComponent.show();
        } else {
          const body = document.querySelector('#command-center-modal .modal-body');
          if (body) body.innerHTML = '<div class="quick-command-empty">暂无待执行的指令</div>';
        }
      });
      $('#btn-refresh-storage')?.addEventListener('click', () => this.refreshLocalStorage());

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

      // 输入缓存：实时保存草稿
      const quickInput = $('#quick-send-input');
      quickInput?.addEventListener('input', () => this.saveInputDraft());

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

        // 指令中心按钮事件（委托，解决动态渲染导致的失效）
        const t = e.target;
        if (t && (t.id === 'btn-execute-commands' || t.id === 'btn-clear-commands' || t.id === 'btn-refresh-storage')) {
          e.preventDefault();
          e.stopPropagation();
          if (t.id === 'btn-execute-commands') this.handleAction();
          else if (t.id === 'btn-clear-commands') {
            window.GuixuState.update('pendingActions', []);
            window.GuixuHelpers.showTemporaryMessage('指令已清空');
            // 立即刷新指令中心内容（委托情况）
            if (window.CommandCenterComponent?.show) {
              window.CommandCenterComponent.show();
            } else {
              const body = document.querySelector('#command-center-modal .modal-body');
              if (body) body.innerHTML = '<div class="quick-command-empty">暂无待执行的指令</div>';
            }
          } else if (t.id === 'btn-refresh-storage') {
            this.refreshLocalStorage();
          }
          return;
        }

        // 通用模态关闭委托：点击右上角X或遮罩空白处关闭
        const closeBtn = e.target.closest?.('.modal-close-btn');
        if (closeBtn) {
          const overlay = closeBtn.closest('.modal-overlay');
          if (overlay) {
            overlay.style.display = 'none';
          } else {
            window.GuixuBaseModal?.closeAll?.();
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // 点击遮罩空白处关闭（仅当直接点到 overlay 自身时）
        if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
          e.target.style.display = 'none';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      });

      // 按下 ESC 关闭最顶部模态
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const overlays = Array.from(document.querySelectorAll('.modal-overlay')).filter(el => getComputedStyle(el).display !== 'none');
          if (overlays.length > 0) {
            const top = overlays[overlays.length - 1];
            top.style.display = 'none';
            e.preventDefault();
            e.stopPropagation();
          }
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
        characterPanel.addEventListener('click', (e) => {
          const slot = e.target.closest('.equipment-slot');
          if (slot && slot.classList.contains('equipped')) {
            // 阻止点击事件，仅用于显示提示。
            e.preventDefault();
            window.GuixuHelpers.showTemporaryMessage('请在背包中卸下装备。');
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
      // 渲染天赋与灵根
      this.renderTalentsAndLinggen(data);
      this.loadEquipmentFromMVU(data);

      // 状态效果
      const statusWrapper = document.getElementById('status-effects-wrapper');
      if (statusWrapper) {
        const statuses = window.GuixuAPI.lodash.get(data, '当前状态.0', []);
        if (Array.isArray(statuses) && statuses.length > 0 && statuses[0] !== '$__META_EXTENSIBLE__$') {
          statusWrapper.innerHTML = statuses
            .map(s => {
              let name = '未知状态';
              let type = 'NEUTRAL';
              let title = '';
              if (typeof s === 'string') {
                name = s;
              } else if (typeof s === 'object' && s !== null) {
                name = window.GuixuHelpers.SafeGetValue(s, 'name', '未知状态');
                type = String(window.GuixuHelpers.SafeGetValue(s, 'type', 'NEUTRAL') || 'NEUTRAL').toUpperCase();
                const known = new Set(['BUFF', 'DEBUFF', 'NEUTRAL', 'AURA', 'TERRAIN']);
                if (!known.has(type)) type = 'NEUTRAL';
                const desc = window.GuixuHelpers.SafeGetValue(s, 'description', '');
                const dur = window.GuixuHelpers.SafeGetValue(s, 'duration', '');
                const durText = (dur || dur === 0) ? ` 持续: ${dur}h` : '';
                title = `${name}${durText}${desc ? ' - ' + desc : ''}`;
              }
              const cls = `status-effect status-effect--${type}`;
              const escAttr = (s) => String(s)
                .replace(/&/g, '&')
                .replace(/"/g, '"')
                .replace(/</g, '<')
                .replace(/>/g, '>');
              const safeTitle = escAttr(title);
              return `<div class="${cls}"${title ? ` title="${safeTitle}"` : ''}><div class="effect-icon"></div><span>${name}</span></div>`;
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

    renderTalentsAndLinggen(data) {
      const container = document.getElementById('talent-linggen-list');
      if (!container) return;
      let html = '';

      // 灵根列表
      try {
        const linggenList = window.GuixuAPI.lodash.get(data, '灵根列表.0', []);
        if (Array.isArray(linggenList) && linggenList.length > 0) {
          const parsed = [];
          const source = linggenList.filter(x => x !== '$__META_EXTENSIBLE__$');

          // 简易 YAML/文本解析器：将松散格式解析为对象，尽可能捕捉 attributes_bonus / 百分比加成 / special_effects
          const parseLooseLinggen = (text) => {
            try {
              if (typeof text !== 'string') return null;
              // 去掉列表前缀与制表缩进
              const lines = text
                .split('\n')
                .map(l => l.replace(/^\s*-\s*-\s*/, '').replace(/^\s*-\s*/, '').replace(/^\t+/, '').trim())
                .filter(l => l.length > 0);

              const obj = {};
              let mode = null; // 'effects' | 'flat' | 'percent'
              obj['attributes_bonus'] = {};
              obj['百分比加成'] = {};
              obj['special_effects'] = [];

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // 匹配 "key: value"
                const kv = line.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
                if (kv) {
                  const key = kv[1].trim();
                  const val = kv[2].trim();

                  // 进入分节模式
                  if (key === 'attributes_bonus' || key === '属性加成') {
                    mode = 'flat';
                    continue;
                  }
                  if (key === '百分比加成' || key === 'percent_bonus') {
                    mode = 'percent';
                    continue;
                  }
                  if (key === 'special_effects' || key === '特殊词条') {
                    mode = 'effects';
                    continue;
                  }

                  // 普通键值
                  mode = null;
                  if (key === '名称' || key.toLowerCase() === 'name' || key === '灵根名称' || key === 'title') {
                    obj['名称'] = val;
                  } else if (key === '品阶' || key.toLowerCase() === 'tier' || key === '等级' || key.toLowerCase() === 'rank') {
                    obj['品阶'] = val;
                  } else if (key === '描述' || key.toLowerCase() === 'description' || key === '说明') {
                    obj['描述'] = val;
                  } else if (key === 'id' || key.toLowerCase() === 'uid') {
                    obj['id'] = val;
                  } else {
                    // 其他未知键，直接挂到对象根部
                    obj[key] = val;
                  }
                  continue;
                }

                // 分节模式下的条目
                if (mode === 'effects') {
                  // 以 "- " 开头的当作词条
                  const em = line.replace(/^\-\s*/, '').trim();
                  if (em) obj['special_effects'].push(em);
                  continue;
                }
                if (mode === 'flat' || mode === 'percent') {
                  // 形如 "神海: 4" 或 "神海: 10%"
                  const kv2 = line.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
                  if (kv2) {
                    const k2 = kv2[1].trim();
                    const v2raw = kv2[2].trim();
                    if (mode === 'flat') {
                      const n = parseInt(v2raw, 10);
                      obj['attributes_bonus'][k2] = Number.isFinite(n) ? n : v2raw;
                    } else {
                      obj['百分比加成'][k2] = v2raw;
                    }
                  }
                  continue;
                }
              }

              // 清理空容器
              if (Object.keys(obj['attributes_bonus']).length === 0) delete obj['attributes_bonus'];
              if (Object.keys(obj['百分比加成']).length === 0) delete obj['百分比加成'];
              if (Array.isArray(obj['special_effects']) && obj['special_effects'].length === 0) delete obj['special_effects'];

              // 保底名称
              if (!obj['名称']) obj['名称'] = '未知灵根';
              if (!obj['品阶']) obj['品阶'] = '凡品';
              if (!obj['描述']) obj['描述'] = '';

              return obj;
            } catch (_) {
              return null;
            }
          };

          source.forEach(raw => {
            if (!raw) return;
            try {
              // 优先 JSON
              const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (obj && typeof obj === 'object') {
                parsed.push(obj);
              } else if (typeof raw === 'string') {
                const loose = parseLooseLinggen(raw);
                parsed.push(loose || { '名称': raw, '品阶': '凡品', '描述': '' });
              }
            } catch (e) {
              // 尝试松散解析
              const loose = (typeof raw === 'string') ? parseLooseLinggen(raw) : null;
              if (loose) {
                parsed.push(loose);
              } else if (typeof raw === 'string') {
                parsed.push({ '名称': raw, '品阶': '凡品', '描述': '' });
              } else {
                console.warn('[归墟] 解析灵根失败:', raw, e);
              }
            }
          });
          const sorted = window.GuixuHelpers.sortByTier(parsed, it => {
            const cnTier = window.GuixuHelpers.SafeGetValue(it, '品阶', '');
            return cnTier || window.GuixuHelpers.SafeGetValue(it, 'tier', '凡品');
          });
          sorted.forEach(item => {
            const unwrap = (v) => (Array.isArray(v) ? (v.length ? v[0] : '') : v);
            const gv = (obj, path, def = '') => {
              try { const val = window.GuixuHelpers.SafeGetValue(obj, path, def); return unwrap(val); } catch (_) { return def; }
            };
            const pick = (obj, candidates, def = '') => {
              for (const p of candidates) {
                const val = gv(obj, p, '');
                if (val !== '' && val !== 'N/A') return val;
              }
              return def;
            };
            const normalized = (Array.isArray(item) && item.length) ? item[0] : item;
            const name = pick(normalized, ['名称', 'name', '灵根名称', 'title', 'data.名称', 'data.name'], '未知灵根');
            const tier = pick(normalized, ['品阶', 'tier', '等级', 'rank', 'data.品阶', 'data.tier'], '凡品');
            const desc = pick(normalized, ['描述', 'description', '说明', 'data.描述', 'data.description'], '无描述');
            const color = window.GuixuHelpers.getTierColorStyle(tier);
            const details = window.GuixuRenderers?.renderItemDetailsForInventory
              ? window.GuixuRenderers.renderItemDetailsForInventory(normalized)
              : '';
            html += `
              <details class="details-container">
                <summary>
                  <span class="attribute-name">灵根</span>
                  <span class="attribute-value" style="${color}">【${tier}】 ${name}</span>
                </summary>
                <div class="details-content">
                  <p>${desc}</p>
                  ${details ? `<div class="item-details">${details}</div>` : ''}
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
      } catch (e) {
        console.warn('[归墟] 渲染灵根失败:', e);
      }

      // 天赋列表
      try {
        const talents = window.GuixuAPI.lodash.get(data, '天赋列表.0', []);
        if (Array.isArray(talents) && talents.length > 0) {
          const parsed = [];
          const source = talents.filter(x => x !== '$__META_EXTENSIBLE__$');
          source.forEach(raw => {
            try {
              const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (obj && typeof obj === 'object') {
                parsed.push(obj);
              } else if (typeof raw === 'string') {
                // 兜底：无法解析为 JSON 时，将整串作为名称展示
                parsed.push({ name: raw, tier: '凡品', description: '' });
              }
            } catch (e) {
              console.warn('[归墟] 解析天赋失败:', raw, e);
              if (typeof raw === 'string') {
                parsed.push({ name: raw, tier: '凡品', description: '' });
              }
            }
          });
          const sorted = window.GuixuHelpers.sortByTier(parsed, it => window.GuixuHelpers.SafeGetValue(it, 'tier', '凡品'));
          sorted.forEach(item => {
            const name = window.GuixuHelpers.SafeGetValue(item, 'name', '未知天赋');
            const tier = window.GuixuHelpers.SafeGetValue(item, 'tier', '凡品');
            const desc = window.GuixuHelpers.SafeGetValue(item, 'description', '无描述');
            const color = window.GuixuHelpers.getTierColorStyle(tier);
            const details = window.GuixuRenderers?.renderItemDetailsForInventory
              ? window.GuixuRenderers.renderItemDetailsForInventory(item)
              : '';
            html += `
              <details class="details-container">
                <summary>
                  <span class="attribute-name">天赋</span>
                  <span class="attribute-value" style="${color}">【${tier}】 ${name}</span>
                </summary>
                <div class="details-content">
                  <p>${desc}</p>
                  ${details ? `<div class="item-details">${details}</div>` : ''}
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
      } catch (e) {
        console.warn('[归墟] 渲染天赋失败:', e);
      }

      container.innerHTML = html;
    },

    async handleAction(userMessage = '') {
      this.showWaitingMessage();
      try {
        const { newMvuState, aiResponse } = await window.GuixuActionService.handleAction(userMessage);
        // 更新 UI
        this.renderUI(newMvuState.stat_data);
        await this.loadAndDisplayCurrentScene(aiResponse);
        // 清理输入与待处理指令（仅当 AI 返回有效文本时清除草稿）
        const input = document.getElementById('quick-send-input');
        const successText = typeof aiResponse === 'string' ? aiResponse.trim() : '';
        if (successText) {
          if (input) input.value = '';
          this.clearInputDraft();
        }
        window.GuixuState.update('pendingActions', []);
        window.GuixuHelpers.showTemporaryMessage('伟大梦星已回应。');
      } catch (error) {
        console.error('[归墟] 处理动作时出错:', error);
        window.GuixuHelpers.showTemporaryMessage(`和伟大梦星沟通失败: ${error.message}`);
      } finally {
        this.hideWaitingMessage();
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

    showWaitingMessage() {
      try {
        const existing = document.getElementById('waiting-popup');
        if (existing) existing.remove();
        const messages = window.GuixuConstants?.WAITING_MESSAGES || [];
        const msg = messages.length > 0 ? messages[Math.floor(Math.random() * messages.length)] : '正在请求伟大梦星...';
        const div = document.createElement('div');
        div.id = 'waiting-popup';
        div.className = 'waiting-popup';
        div.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10002;
          background: rgba(26, 26, 46, 0.95);
          color: #c9aa71;
          border: 1px solid #c9aa71;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 0 20px rgba(201, 170, 113, 0.3);
          font-size: 13px;
          font-weight: 600;
        `;
        const spinner = document.createElement('div');
        spinner.className = 'waiting-spinner';
        spinner.style.cssText = `
          width: 14px;
          height: 14px;
          border: 2px solid #c9aa71;
          border-right-color: transparent;
          border-radius: 50%;
          margin-right: 4px;
        `;
        const span = document.createElement('span');
        span.textContent = msg;
        div.appendChild(spinner);
        div.appendChild(span);
        const container = document.querySelector('.guixu-root-container') || document.body;
        container.appendChild(div);
      } catch (e) {
        console.warn('[归墟] showWaitingMessage 失败:', e);
      }
    },

    hideWaitingMessage() {
      try {
        const existing = document.getElementById('waiting-popup');
        if (existing) existing.remove();
      } catch (_) {}
    },

    // 从 TavernHelper 全局变量同步用户偏好（跨设备漫游），若存在则覆盖本地
    async syncUserPreferencesFromRoaming() {
      try {
        if (!window.TavernHelper || typeof window.TavernHelper.getVariables !== 'function') return;
        const vars = window.TavernHelper.getVariables({ type: 'global' });
        const roamingPrefs = vars && vars.Guixu && vars.Guixu.userPreferences;
        if (roamingPrefs && typeof roamingPrefs === 'object') {
          const state = window.GuixuState?.getState?.();
          const merged = Object.assign({}, state?.userPreferences || {}, roamingPrefs);
          window.GuixuState.update('userPreferences', merged);
        }
      } catch (e) {
        console.warn('[归墟] 同步用户偏好(全局变量)失败:', e);
      }
    },

    // 应用用户主题偏好（背景、遮罩、字号）
    applyUserPreferences(prefsOverride = null) {
      try {
        const container = document.querySelector('.guixu-root-container');
        if (!container) return;
        const state = window.GuixuState?.getState?.();
        const defaults = { backgroundUrl: '', bgMaskOpacity: 0.7, storyFontSize: 14, bgFitMode: 'cover', uiResolutionPreset: 'keep', uiCustomWidth: 900, uiCustomHeight: 600 };
        const prefs = Object.assign({}, defaults, (prefsOverride || state?.userPreferences || {}));

        // 遮罩透明度（0~0.8）
        const mask = Math.min(0.8, Math.max(0, Number(prefs.bgMaskOpacity ?? defaults.bgMaskOpacity)));
        container.style.setProperty('--guixu-bg-mask', String(mask));

        // 正文字号（12~20px）
        const fontPx = Math.round(Number(prefs.storyFontSize ?? defaults.storyFontSize));
        container.style.setProperty('--guixu-story-font-size', `${fontPx}px`);

        // 背景适配方式（bgFitMode -> CSS 变量）
        const mode = String(prefs.bgFitMode || 'cover');
        let size = 'cover', repeat = 'no-repeat', position = 'center';
        switch (mode) {
          case 'contain':
            size = 'contain'; repeat = 'no-repeat'; position = 'center'; break;
          case 'repeat':
            size = 'auto'; repeat = 'repeat'; position = 'left top'; break;
          case 'stretch':
            size = '100% 100%'; repeat = 'no-repeat'; position = 'center'; break;
          case 'center':
            size = 'auto'; repeat = 'no-repeat'; position = 'center'; break;
          case 'cover':
          default:
            size = 'cover'; repeat = 'no-repeat'; position = 'center'; break;
        }
        container.style.setProperty('--guixu-bg-size', size);
        container.style.setProperty('--guixu-bg-repeat', repeat);
        container.style.setProperty('--guixu-bg-position', position);

        // 背景图
        const bg = (prefs.backgroundUrl || '').trim();
        if (!bg) {
          container.style.backgroundImage = '';
        } else if (bg.startsWith('lorebook://')) {
          // 异步从世界书加载资源
          const entryComment = bg.slice('lorebook://'.length);
          (async () => {
            try {
              const dataUrl = await this._resolveLorebookDataUrl(entryComment);
              if (dataUrl) {
                container.style.backgroundImage = `url("${dataUrl}")`;
              } else {
                container.style.backgroundImage = '';
              }
            } catch (e) {
              console.warn('[归墟] 读取世界书背景失败:', e);
            }
          })();
        } else {
          // 已移除外部 URL/dataURL 背景支持，仅允许 lorebook:// 来源
          container.style.backgroundImage = '';
        }

        // 应用非全屏分辨率与等比缩放
        this._applyViewportSizing(prefs);
      } catch (e) {
        console.warn('[归墟] 应用用户主题偏好失败:', e);
      }
    },

    async _resolveLorebookDataUrl(entryComment) {
      try {
        const bookName = window.GuixuConstants?.LOREBOOK?.NAME;
        if (!bookName || !entryComment) return '';
        const entries = await window.GuixuAPI.getLorebookEntries(bookName);
        const entry = entries.find(e => (e.comment || '') === entryComment);
        return entry ? (entry.content || '') : '';
      } catch (e) {
        console.warn('[归墟] _resolveLorebookDataUrl 出错:', e);
        return '';
      }
    },

    // 新增：应用非全屏分辨率与等比例缩放
    _applyViewportSizing(prefs) {
      try {
        const baseW = 900;
        const baseH = 600;
        const viewport = document.getElementById('guixu-viewport');
        const root = document.querySelector('.guixu-root-container');
        if (!viewport || !root) return;

        // 全屏时忽略自定义分辨率与缩放
        if (document.fullscreenElement) {
          root.style.transformOrigin = 'top left';
          root.style.transform = 'scale(1)';
          root.style.left = '0px';
          root.style.top = '0px';
          return;
        }

        const preset = String(prefs.uiResolutionPreset || 'keep');
        let targetW = baseW;
        let targetH = baseH;
        if (preset === 'custom') {
          const w = Number(prefs.uiCustomWidth || baseW);
          const h = Number(prefs.uiCustomHeight || baseH);
          targetW = Math.max(300, Math.min(7680, isFinite(w) ? w : baseW));
          targetH = Math.max(200, Math.min(4320, isFinite(h) ? h : baseH));
        } else if (preset === 'keep') {
          targetW = baseW;
          targetH = baseH;
        } else {
          const m = preset.match(/^(\d+)x(\d+)$/);
          if (m) {
            targetW = parseInt(m[1], 10);
            targetH = parseInt(m[2], 10);
          }
        }

        viewport.style.setProperty('--viewport-w', `${targetW}px`);
        viewport.style.setProperty('--viewport-h', `${targetH}px`);

        const scaleW = targetW / baseW;
        const scaleH = targetH / baseH;
        const s = Math.min(scaleW, scaleH);

        root.style.transformOrigin = 'top left';
        root.style.transform = `scale(${s})`;

        const left = Math.max(0, (targetW - baseW * s) / 2);
        const top = Math.max(0, (targetH - baseH * s) / 2);
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
      } catch (e) {
        console.warn('[归墟] _applyViewportSizing 出错:', e);
      }
    },

    // 输入草稿：加载/保存/清除
    loadInputDraft() {
      try {
        const draft = localStorage.getItem('guixu_input_draft');
        if (draft) {
          const input = document.getElementById('quick-send-input');
          if (input && !input.value) {
            input.value = draft;
          }
        }
      } catch (e) {
        console.warn('[归墟] 加载输入草稿失败:', e);
      }
    },
    saveInputDraft() {
      try {
        const input = document.getElementById('quick-send-input');
        const val = input ? input.value : '';
        if (val && val.trim() !== '') {
          localStorage.setItem('guixu_input_draft', val);
        } else {
          localStorage.removeItem('guixu_input_draft');
        }
      } catch (e) {
        console.warn('[归墟] 保存输入草稿失败:', e);
      }
    },
    clearInputDraft() {
      try { localStorage.removeItem('guixu_input_draft'); } catch (_) {}
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

    // 全屏切换：进入/退出全屏
    toggleFullscreen() {
      try {
        const root = document.querySelector('.guixu-root-container') || document.documentElement;
        if (!document.fullscreenElement) {
          if (root.requestFullscreen) root.requestFullscreen();
          else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      } catch (e) {
        console.warn('[归墟] 全屏切换失败:', e);
        window.GuixuHelpers?.showTemporaryMessage?.('暂不支持全屏或被浏览器拦截');
      }
    },

    // 根据全屏状态更新按钮图标与提示
    _updateFullscreenButtonState() {
      const btn = document.getElementById('fullscreen-btn');
      if (!btn) return;
      const isFull = !!document.fullscreenElement;
      btn.title = isFull ? '退出全屏' : '进入全屏';
      btn.textContent = isFull ? '⤡' : '⛶';
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

        // 始终置于最顶层，避免被其他模态遮挡
        overlay.style.zIndex = '9000';
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

      // 浏览器端本地缓存刷新（后备实现）
      refreshLocalStorage() {
        try {
          this.showCustomConfirm('这是为了刷新上一个聊天缓存数据，如果不是打开新聊天，请不要点击', () => {
            try {
              localStorage.removeItem('guixu_equipped_items');
              localStorage.removeItem('guixu_pending_actions');
              localStorage.removeItem('guixu_auto_write_enabled');
              window.GuixuHelpers.showTemporaryMessage('缓存已清除，页面即将刷新...');
              setTimeout(() => window.location.reload(), 1000);
            } catch (e) {
              console.error('[归墟] 清除本地存储失败:', e);
              window.GuixuHelpers.showTemporaryMessage('清除缓存失败！');
            }
          });
        } catch (e) {
          console.error('[归墟] refreshLocalStorage 出错:', e);
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
