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

      // 自动检测并应用移动端视图
      this._autoDetectMobileAndApply();

      // 嵌入式(iframe)可见性兜底修复 + 移动端主内容固定高度
      this._applyEmbeddedVisibilityFix();
      this._reflowMobileLayout();

      // 防抖处理，避免软键盘触发的频繁 resize 导致抖动
      if (!this._onResizeBound) {
        this._onResizeBound = true;
        this._resizeTimer = null;
        window.addEventListener('resize', () => {
          clearTimeout(this._resizeTimer);
          this._resizeTimer = setTimeout(() => {
            // 若正在编辑输入框，跳过本次重排以防抖动
            const ae = document.activeElement;
            if (ae && (ae.id === 'quick-send-input' || ae.classList?.contains('quick-send-input'))) return;
            this._pulseFastReflow(120);
            this._applyEmbeddedVisibilityFix();
            this._reflowMobileLayout();
          }, 50);
        });
      }

      // 监听 visualViewport 变化和方向变化，快速重排移动端布局
      if (window.visualViewport && !this._vvBound) {
        this._vvBound = true;
        this._vvTimer = null;
        const onVV = () => {
          clearTimeout(this._vvTimer);
          this._vvTimer = setTimeout(() => {
            const ae = document.activeElement;
            if (ae && (ae.id === 'quick-send-input' || ae.classList?.contains('quick-send-input'))) return;
            this._pulseFastReflow(120);
            this._reflowMobileLayout();
          }, 50);
        };
        window.visualViewport.addEventListener('resize', onVV);
        window.visualViewport.addEventListener('scroll', onVV);
        window.addEventListener('orientationchange', () => setTimeout(() => this._reflowMobileLayout(), 50));
      }

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
        const isMobile = !container?.classList.contains('mobile-view');
        this.setMobileView(!!isMobile);
      });

      // 全屏切换
      $('#fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());
      // 全屏状态变化时更新按钮并重新应用视口缩放（退出/进入全屏时需要重算）
      document.addEventListener('fullscreenchange', () => { 
        this._updateFullscreenButtonState(); 
        this.applyUserPreferences(); 
        // 全屏进入/退出时，确保移动端 FAB 存在并位于全屏子树内可见
        this._ensureFABsVisibleInFullscreen();
        // 快速恢复：临时禁用动画/过渡，并多次重排
        this._pulseFastReflow(300);
        this._reflowMobileLayout();
        requestAnimationFrame(() => this._reflowMobileLayout());
        setTimeout(() => this._reflowMobileLayout(), 200);
      });
      document.addEventListener('webkitfullscreenchange', () => { 
        this._updateFullscreenButtonState(); 
        this.applyUserPreferences(); 
        this._ensureFABsVisibleInFullscreen();
        this._pulseFastReflow(300);
        this._reflowMobileLayout();
        requestAnimationFrame(() => this._reflowMobileLayout());
        setTimeout(() => this._reflowMobileLayout(), 200);
      });
      // 初始化一次按钮状态
      this._updateFullscreenButtonState();

      // 右侧按钮 -> 组件入口
      $('#btn-inventory')?.addEventListener('click', () => window.InventoryComponent?.show?.());
      $('#btn-relationships')?.addEventListener('click', () => window.RelationshipsComponent?.show?.());
      $('#btn-command-center')?.addEventListener('click', () => window.CommandCenterComponent?.show?.());
      $('#btn-guixu-system')?.addEventListener('click', () => window.GuixuSystemComponent?.show?.());
      $('#btn-show-extracted')?.addEventListener('click', () => window.ExtractedContentComponent?.show?.());
      $('#btn-save-load-manager')?.addEventListener('click', () => window.GuixuActionService?.showSaveLoadManager?.());
      $('#btn-settings')?.addEventListener('click', () => window.SettingsComponent?.show?.());
      $('#btn-view-statuses')?.addEventListener('click', () => window.StatusesComponent?.show?.());
      // 新增：创建底部“状态一览”弹窗按钮（替代滚动条）
      this.ensureStatusPopupButton();

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

        // 点击空白处关闭设置FAB的菜单
        const fabMenu = document.getElementById('fab-settings-menu');
        const fabSettings = document.getElementById('fab-settings');
        if (fabMenu && getComputedStyle(fabMenu).display !== 'none') {
          if (!fabMenu.contains(e.target) && (!fabSettings || !fabSettings.contains(e.target))) {
            this.hideSettingsFabMenu();
          }
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

        // 点击空白关闭移动端“角色/功能”浮层（不影响模态）
        try {
          const rootEl = document.querySelector('.guixu-root-container');
          if (rootEl && rootEl.classList.contains('mobile-view')) {
            const target = e.target;
            const charPanel = document.querySelector('.character-panel');
            const funcPanel = document.querySelector('.interaction-panel');
            const fabChar = document.getElementById('fab-character');
            const fabFunc = document.getElementById('fab-functions');

            if (rootEl.classList.contains('show-character-panel')) {
              if (charPanel && !charPanel.contains(target) && (!fabChar || !fabChar.contains(target))) {
                rootEl.classList.remove('show-character-panel');
              }
            }
            if (rootEl.classList.contains('show-interaction-panel')) {
              if (funcPanel && !funcPanel.contains(target) && (!fabFunc || !fabFunc.contains(target))) {
                rootEl.classList.remove('show-interaction-panel');
              }
            }
          }
        } catch (_) {}
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

    // 新增：确保底部状态弹窗按钮存在
    ensureStatusPopupButton() {
      try {
        const bottom = document.getElementById('bottom-status-container');
        if (!bottom) return;
        if (!document.getElementById('btn-status-pop')) {
          const btn = document.createElement('button');
          btn.id = 'btn-status-pop';
          btn.className = 'status-pop-btn';
          btn.innerHTML = '<div class="effect-icon"></div><span>状态一览</span>';
          btn.title = '查看当前状态';
          btn.addEventListener('click', () => window.StatusesComponent?.show?.());
          const qs = bottom.querySelector('.quick-send-container');
          bottom.insertBefore(btn, qs || null);
        }
      } catch (e) {
        console.warn('[归墟] ensureStatusPopupButton 失败:', e);
      }
    },

    // 新增：移动端视图切换与悬浮按钮
    _getViewportEl() {
      try { return document.getElementById('guixu-viewport'); } catch (_) { return null; }
    },

    setMobileView(enable) {
      try {
        const root = document.querySelector('.guixu-root-container');
        const viewport = this._getViewportEl();
        if (!root) return;

        if (enable) {
          // 显式切到移动端：移除桌面强制类
          root.classList.remove('force-desktop', 'show-character-panel', 'show-interaction-panel');
          viewport?.classList?.remove('force-desktop');
          root.classList.add('mobile-view');
          viewport?.classList?.add('mobile-view');
          try { localStorage.setItem('guixu_force_view', 'mobile'); } catch(_) {}
          this._ensureMobileFABs();
          this._ensureFABsVisibleInFullscreen();
        } else {
          // 显式切到桌面端：移除移动端类并加上强制桌面类（覆盖小屏CSS兜底）
          root.classList.remove('mobile-view', 'show-character-panel', 'show-interaction-panel');
          viewport?.classList?.remove('mobile-view');
          root.classList.add('force-desktop');
          viewport?.classList?.add('force-desktop');
          try { localStorage.setItem('guixu_force_view', 'desktop'); } catch(_) {}
          this._removeMobileFABs();
        }

        // 更新按钮状态与偏好应用（会触发视口计算）
        const btn = document.getElementById('view-toggle-btn');
        if (btn) {
          btn.textContent = enable ? '💻' : '📱';
          btn.title = enable ? '切换到桌面视图' : '切换到移动视图';
        }
        this.applyUserPreferences();
        this._applyEmbeddedVisibilityFix();
        this._pulseFastReflow(200);
        this._reflowMobileLayout();
      } catch (e) {
        console.warn('[归墟] setMobileView 失败:', e);
      }
    },

    _autoDetectMobileAndApply() {
      try {
        const root = document.querySelector('.guixu-root-container');
        const viewport = this._getViewportEl();

        // 用户强制视图优先（localStorage 记忆）
        try {
          const pref = (localStorage.getItem('guixu_force_view') || '').toLowerCase();
          if (pref === 'desktop') { this.setMobileView(false); return; }
          if (pref === 'mobile')  { this.setMobileView(true);  return; }
        } catch(_) {}

        // 若用户显式切换到桌面端，则不再自动切换回移动端
        if (root?.classList.contains('force-desktop') || viewport?.classList.contains('force-desktop')) return;

        const shouldMobile =
          (window.SillyTavern?.isMobile?.() === true) ||
          window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
        if (shouldMobile) this.setMobileView(true);
      } catch (e) {
        console.warn('[归墟] 自动检测移动端失败:', e);
      }
    },

    _ensureMobileFABs() {
      try {
        const root = document.querySelector('.guixu-root-container');
        if (!root) return;
        if (document.getElementById('fab-character') && document.getElementById('fab-functions') && document.getElementById('fab-settings')) return;

        const makeFab = (id, text, title, leftRightStyles, onClick) => {
          const btn = document.createElement('button');
          btn.id = id;
          btn.className = 'mobile-fab';
          btn.type = 'button';
          btn.textContent = text;
          btn.title = title;
          btn.style.position = 'fixed';
          btn.style.zIndex = '10040';
          btn.style.width = '44px';
          btn.style.height = '44px';
          btn.style.borderRadius = '50%';
          btn.style.border = '1px solid #c9aa71';
          btn.style.background = 'rgba(15, 15, 35, 0.9)';
          btn.style.color = '#c9aa71';
          btn.style.display = 'flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.fontSize = '12px';
          btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          btn.style.touchAction = 'none';
          btn.style.bottom = '72px';
          Object.entries(leftRightStyles).forEach(([k, v]) => (btn.style[k] = v));
          btn.addEventListener('click', onClick);
          (root || document.body).appendChild(btn);

          // 恢复持久化位置
          try {
            const saved = JSON.parse(localStorage.getItem(`guixu_fab_pos_${id}`) || 'null');
            if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
              btn.style.left = `${saved.left}px`;
              btn.style.top = `${saved.top}px`;
              btn.style.right = 'auto';
            }
          } catch (_) {}

          // 位置越界校正（视口变化或全屏切换后）
          this._clampFabWithinViewport(btn);

          this._makeDraggable(btn);
          return btn;
        };

        makeFab(
          'fab-character',
          '角色',
          '打开角色面板',
          { left: '16px' },
          () => {
            const rootEl = document.querySelector('.guixu-root-container');
            if (!rootEl) return;
            const willOpen = !rootEl.classList.contains('show-character-panel');
            rootEl.classList.toggle('show-character-panel', willOpen);
            if (willOpen) rootEl.classList.remove('show-interaction-panel');
          }
        );

        makeFab(
          'fab-functions',
          '功能',
          '打开功能面板',
          { right: '16px' },
          () => {
            const rootEl = document.querySelector('.guixu-root-container');
            if (!rootEl) return;
            const willOpen = !rootEl.classList.contains('show-interaction-panel');
            rootEl.classList.toggle('show-interaction-panel', willOpen);
            if (willOpen) rootEl.classList.remove('show-character-panel');
          }
        );

        // 设置与更多 FAB（居中偏下，统一聚合 设置/全屏/切换视图）
        const fabSettings = makeFab(
          'fab-settings',
          '⚙',
          '打开设置与更多',
          { left: 'calc(50% - 22px)' },
          () => this.toggleSettingsFabMenu()
        );
      } catch (e) {
        console.warn('[归墟] _ensureMobileFABs 失败:', e);
      }
    },

    // 设置FAB菜单：显示/隐藏/切换（仅移动端）
    toggleSettingsFabMenu() {
      try {
        const menu = document.getElementById('fab-settings-menu');
        if (menu && getComputedStyle(menu).display !== 'none') {
          this.hideSettingsFabMenu();
        } else {
          this.showSettingsFabMenu();
        }
      } catch (_) {}
    },
    showSettingsFabMenu() {
      try {
        let menu = document.getElementById('fab-settings-menu');
        const root = document.querySelector('.guixu-root-container');
        if (!root) return;
        if (!menu) {
          menu = document.createElement('div');
          menu.id = 'fab-settings-menu';
          menu.style.position = 'fixed';
          menu.style.zIndex = '10055';
          menu.style.display = 'flex';
          menu.style.flexDirection = 'column';
          menu.style.gap = '8px';
          menu.style.padding = '10px';
          menu.style.border = '1px solid #c9aa71';
          menu.style.borderRadius = '8px';
          menu.style.background = 'rgba(15,15,35,0.95)';
          menu.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)';
          const mkBtn = (text, handler) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.style.cssText = 'min-width:120px;height:34px;padding:0 10px;border:1px solid #c9aa71;border-radius:6px;background:linear-gradient(45deg,#1a1a2e,#2d1b3d);color:#c9aa71;font-size:12px;box-sizing:border-box;';
            b.addEventListener('click', (e) => { e.stopPropagation(); this.hideSettingsFabMenu(); handler(); });
            return b;
          };
          menu.appendChild(mkBtn('设置', () => window.SettingsComponent?.show?.()));
          menu.appendChild(mkBtn('全屏切换', () => this.toggleFullscreen()));
          menu.appendChild(mkBtn('切到桌面端', () => this.setMobileView(false)));
          root.appendChild(menu);
        } else {
          menu.style.display = 'flex';
        }
        // 位置：贴着设置FAB上方居中
        const fab = document.getElementById('fab-settings');
        if (fab) {
          const rect = fab.getBoundingClientRect();
          // 先临时显示以获取尺寸
          const vw = window.innerWidth;
          const menuRect = menu.getBoundingClientRect();
          const mw = menuRect.width || 160;
          const mh = menuRect.height || 140;
          const left = Math.max(8, Math.min(vw - mw - 8, rect.left + rect.width / 2 - mw / 2));
          const top = Math.max(8, rect.top - mh - 10);
          menu.style.left = `${left}px`;
          menu.style.top = `${top}px`;
        } else {
          menu.style.left = 'calc(50% - 80px)';
          menu.style.top = '30%';
        }
      } catch (e) {
        console.warn('[归墟] showSettingsFabMenu 失败:', e);
      }
    },
    hideSettingsFabMenu() {
      try {
        const menu = document.getElementById('fab-settings-menu');
        if (menu) menu.style.display = 'none';
      } catch (_) {}
    },

    // 确保全屏时 FAB 可见且处于全屏元素子树内
    _ensureFABsVisibleInFullscreen() {
      try {
        const root = document.querySelector('.guixu-root-container');
        if (!root) return;
        // 仅在移动端视图下处理
        if (!root.classList.contains('mobile-view')) return;

        // 确保存在
        this._ensureMobileFABs();

        // 将 FAB 重新挂载到 root（全屏元素）下，并提升层级
        ['fab-character', 'fab-functions', 'fab-settings'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          if (el.parentElement !== root) {
            root.appendChild(el);
          }
          el.style.zIndex = '10060';
          el.style.display = 'flex';
          this._clampFabWithinViewport(el);
        });
        // 设置菜单也挂到 root 之下，确保全屏时可见
        const settingsMenu = document.getElementById('fab-settings-menu');
        if (settingsMenu && settingsMenu.parentElement !== root) {
          root.appendChild(settingsMenu);
        }
        if (settingsMenu) settingsMenu.style.zIndex = '10065';
      } catch (e) {
        console.warn('[归墟] _ensureFABsVisibleInFullscreen 失败:', e);
      }
    },

    // 将 FAB 位置限制在当前可视区域内（适配全屏/窗口变化）
    _clampFabWithinViewport(el) {
      try {
        if (!el) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = el.getBoundingClientRect();
        const w = rect.width || 56;
        const h = rect.height || 56;
        const getNum = (v) => (parseFloat(String(v || '0')) || 0);
        let left = getNum(el.style.left);
        let top = getNum(el.style.top);
        // 若未设置 left/top，使用当前可见位置
        if (!left && !top) {
          left = rect.left; top = rect.top;
        }
        left = Math.max(0, Math.min(vw - w, left));
        top = Math.max(0, Math.min(vh - h, top));
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.right = 'auto';
      } catch (_) {}
    },

    _removeMobileFABs() {
      ['fab-character', 'fab-functions', 'fab-settings', 'fab-settings-menu'].forEach(id => {
        try {
          const el = document.getElementById(id);
          if (el) el.remove();
        } catch (_) {}
      });
    },

    _makeDraggable(el) {
      try {
        let dragging = false;
        let startX = 0, startY = 0, originLeft = 0, originTop = 0;

        const getNum = (v) => (parseFloat(String(v || '0')) || 0);
        const pointerDown = (e) => {
          dragging = true;
          const pt = e.touches ? e.touches[0] : e;
          startX = pt.clientX;
          startY = pt.clientY;
          originLeft = getNum(el.style.left);
          originTop = getNum(el.style.top);
          // 若未设置left/right，补一个基于当前布局的left
          if (!el.style.left && !el.style.right) {
            const rect = el.getBoundingClientRect();
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top}px`;
          }
          document.addEventListener('pointermove', pointerMove, { passive: false });
          document.addEventListener('pointerup', pointerUp, { passive: true, once: true });
        };

        const pointerMove = (e) => {
          if (!dragging) return;
          e.preventDefault();
          const pt = e.touches ? e.touches[0] : e;
          const dx = pt.clientX - startX;
          const dy = pt.clientY - startY;
          let nextLeft = originLeft + dx;
          let nextTop = originTop + dy;

          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const rect = el.getBoundingClientRect();
          const w = rect.width || 56;
          const h = rect.height || 56;
          nextLeft = Math.max(0, Math.min(vw - w, nextLeft));
          nextTop = Math.max(0, Math.min(vh - h, nextTop));

          el.style.left = `${nextLeft}px`;
          el.style.right = 'auto';
          el.style.top = `${nextTop}px`;
        };

        const pointerUp = () => {
          dragging = false;
          document.removeEventListener('pointermove', pointerMove);
          // 持久化保存位置
          try {
            const left = getNum(el.style.left);
            const top = getNum(el.style.top);
            localStorage.setItem(`guixu_fab_pos_${el.id}`, JSON.stringify({ left, top }));
          } catch (_) {}
        };

        el.addEventListener('pointerdown', pointerDown, { passive: true });
      } catch (e) {
        console.warn('[归墟] _makeDraggable 失败:', e);
      }
    },

    // 嵌入式(iframe)环境下的可见性兜底：若高度过小则强制启用 embedded-fix 样式
    _applyEmbeddedVisibilityFix() {
      try {
        const viewport = this._getViewportEl();
        const root = document.querySelector('.guixu-root-container');
        if (!viewport || !root) return;

        // 注入一次性样式，确保即使外部CSS未更新也能生效
        if (!document.getElementById('guixu-embedded-fix-style')) {
          const style = document.createElement('style');
          style.id = 'guixu-embedded-fix-style';
          style.textContent = `
            .guixu-viewport.embedded-fix{width:100%!important;height:auto!important;overflow:visible!important;}
            .guixu-viewport.embedded-fix .guixu-root-container{position:static!important;left:auto!important;top:auto!important;width:100%!important;height:auto!important;}
            .guixu-root-container.embedded-fix .game-container{display:flex!important;flex-direction:column!important;gap:0!important;min-height:480px;height:auto!important;}
            .guixu-root-container.embedded-fix .main-content{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;}
          `;
          document.head.appendChild(style);
        }

        // 计算当前可见高度（避免 transform/absolute 影响导致为 0）
        const rect = root.getBoundingClientRect();
        const h = rect.height || root.offsetHeight || root.scrollHeight || 0;

        // 条件：内容高度过小或 viewport 不可见时，开启兜底
        const needFix = h < 260 || !(rect.width > 0 && rect.height > 0);
        root.classList.toggle('embedded-fix', needFix);
        viewport.classList.toggle('embedded-fix', needFix);
      } catch (e) {
        console.warn('[归墟] _applyEmbeddedVisibilityFix 失败:', e);
      }
    },

    // 新增：移动端主内容固定高度 + 溢出滚动（避免正文根据文字量无限拉伸）
    _reflowMobileLayout() {
      try {
        const root = document.querySelector('.guixu-root-container');
        const viewport = this._getViewportEl();
        const main = document.querySelector('.main-content');
        if (!root || !main) return;

        // 若当前正在编辑底部输入框，跳过本次重排，防止软键盘引发的抖动
        const ae = document.activeElement;
        if (ae && (ae.id === 'quick-send-input' || ae.classList?.contains('quick-send-input'))) return;

        const isMobile = root.classList.contains('mobile-view') || (viewport && viewport.classList.contains('mobile-view'));
        if (!isMobile) {
          // 桌面视图还原
          main.style.height = '';
          main.style.maxHeight = '';
          main.style.minHeight = '';
          main.style.flex = '';
          main.style.overflowY = '';
          return;
        }

        // 计算可用高度：优先使用可视视口高度（处理移动端地址栏/软键盘影响）
        const vvH = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : 0;
        const baseH = Math.max(vvH, window.innerHeight || 0);
        const containerH = Math.max(
          baseH,
          viewport?.getBoundingClientRect().height || 0,
          root.getBoundingClientRect().height || 0
        );

        const topEl = document.querySelector('.top-status');
        const bottomEl = document.getElementById('bottom-status-container');
        const topH = topEl ? topEl.getBoundingClientRect().height : 0;
        const bottomH = bottomEl ? bottomEl.getBoundingClientRect().height : 0;
        const reserves = 12; // 上下预留像素

        // 使用“可用高度”作为正文固定高度（尽可能大），并给出合理下限
        let available = containerH - topH - bottomH - reserves;
        if (!isFinite(available) || available <= 0) {
          available = Math.floor((baseH || 800) * 0.75);
        }
        const target = Math.max(360, Math.round(available));

        // 固定高度并强制滚动，避免正文撑开
        main.style.flex = '0 0 auto';
        main.style.height = `${target}px`;
        main.style.maxHeight = `${target}px`;
        main.style.minHeight = '360px';
        main.style.overflowY = 'auto';
      } catch (e) {
        console.warn('[归墟] _reflowMobileLayout 失败:', e);
      }
    },

    // 临时开启“快速重排模式”：为根容器添加 fast-reflow 类，短时间内禁用过渡/动画以迅速稳定布局
    _pulseFastReflow(duration = 200) {
      try {
        const root = document.querySelector('.guixu-root-container');
        if (!root) return;
        root.classList.add('fast-reflow');
        clearTimeout(this._frTimer);
        this._frTimer = setTimeout(() => root.classList.remove('fast-reflow'), Math.max(50, duration|0));
      } catch (_) {}
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

        // 移动端视图下禁用缩放与固定分辨率，开启自然滚动
        const isMobileView = root.classList.contains('mobile-view') || viewport.classList.contains('mobile-view');
        if (isMobileView) {
          root.style.transformOrigin = 'top left';
          root.style.transform = 'none';
          root.style.left = '0px';
          root.style.top = '0px';
          // 嵌入式环境（如酒馆楼层 iframe）使用自适应高度，避免 100vh/100dvh 造成坍塌
          viewport.classList.add('mobile-view');
          // 清除任何强制尺寸/变量，交给 CSS 去控制
          viewport.style.removeProperty('--viewport-w');
          viewport.style.removeProperty('--viewport-h');
          viewport.style.removeProperty('width');
          viewport.style.removeProperty('height');
          return;
        }

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

        // 将 Tooltip 限制在 .guixu-root-container 内部，避免在移动端溢出屏幕
        const root = document.querySelector('.guixu-root-container');
        const containerRect = root
          ? root.getBoundingClientRect()
          : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        const pt = event.touches ? event.touches[0] : event;

        // 计算相对于容器左上角的位置
        let relLeft = (pt.clientX - containerRect.left) + 15;
        let relTop = (pt.clientY - containerRect.top) + 15;

        // 读取尺寸后进行边界收敛
        const ttRect = tooltip.getBoundingClientRect();
        const ttW = ttRect.width || 260;
        const ttH = ttRect.height || 160;

        const maxLeft = Math.max(8, containerRect.width - ttW - 8);
        const maxTop = Math.max(8, containerRect.height - ttH - 8);
        relLeft = Math.min(Math.max(8, relLeft), maxLeft);
        relTop = Math.min(Math.max(8, relTop), maxTop);

        tooltip.style.left = `${relLeft}px`;
        tooltip.style.top = `${relTop}px`;
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

      // 自定义数字输入弹窗（与UI一致），返回 Promise<number|null>
      async showNumberPrompt({ title = '请输入数量', message = '', min = 1, max = 99, defaultValue = 1 } = {}) {
        return new Promise((resolve) => {
          try {
            // 防重：若此前遗留了数量弹窗，先移除，避免叠加导致需要点两次关闭
            try { const ex = document.getElementById('custom-number-prompt-modal'); if (ex) ex.remove(); } catch(_) {}
            const root = document.querySelector('.guixu-root-container') || document.body;

            // 外层遮罩
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'custom-number-prompt-modal';

            // 内容容器（复用确认弹窗风格）
            const content = document.createElement('div');
            content.className = 'modal-content confirm-modal-content';
            content.style.width = 'auto';
            content.style.maxWidth = '420px';
            content.style.height = 'auto';
            content.style.maxHeight = 'none';

            // 头部
            const header = document.createElement('div');
            header.className = 'modal-header';

            const titleEl = document.createElement('div');
            titleEl.className = 'modal-title';
            titleEl.textContent = String(title || '请输入数量');

            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close-btn';
            closeBtn.innerHTML = '&times;';

            header.appendChild(titleEl);
            header.appendChild(closeBtn);

            // 主体
            const body = document.createElement('div');
            body.className = 'modal-body';

            const msg = document.createElement('div');
            msg.className = 'confirm-modal-message';
            msg.textContent = String(message || '');

            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(defaultValue ?? min ?? 1);
            input.min = String(min ?? 1);
            input.max = String(max ?? 9999);
            input.step = '1';
            input.style.cssText = 'margin-top:10px;width:100%;height:36px;padding:0 10px;background:rgba(0,0,0,0.4);border:1px solid #8b7355;border-radius:4px;color:#e0dcd1;box-sizing:border-box;font-size:14px;';

            body.appendChild(msg);
            body.appendChild(input);

            // 底部按钮
            const footer = document.createElement('div');
            footer.className = 'confirm-modal-buttons';

            const okBtn = document.createElement('button');
            okBtn.className = 'interaction-btn';
            okBtn.style.cssText = 'min-width:120px;height:36px;padding:0 12px;box-sizing:border-box;';
            okBtn.textContent = '确定';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'danger-btn';
            cancelBtn.style.cssText = 'min-width:120px;height:36px;padding:0 12px;box-sizing:border-box;';
            cancelBtn.textContent = '取消';

            footer.appendChild(okBtn);
            footer.appendChild(cancelBtn);

            // 组装
            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(footer);
            overlay.appendChild(content);
            root.appendChild(overlay);

            const cleanup = (ret = null) => {
              try { overlay.remove(); } catch (_) {}
              resolve(ret);
            };

            closeBtn.addEventListener('click', () => cleanup(null));
            cancelBtn.addEventListener('click', () => cleanup(null));
            overlay.addEventListener('click', (e) => {
              if (e.target === overlay) cleanup(null);
            });
            okBtn.addEventListener('click', () => {
              const n = parseInt(input.value, 10);
              const minN = Number(min ?? 1);
              const maxN = Number(max ?? 9999);
              if (!Number.isFinite(n) || n < minN || n > maxN) {
                window.GuixuHelpers?.showTemporaryMessage?.(`请输入 ${minN}-${maxN} 的整数`);
                return;
              }
              cleanup(n);
            });

            // 显示与交互
            overlay.style.display = 'flex';
            overlay.style.zIndex = '9000';
            setTimeout(() => input.focus(), 0);
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') okBtn.click();
              if (e.key === 'Escape') cancelBtn.click();
            });
          } catch (e) {
            console.warn('[归墟] showNumberPrompt 失败，回退到 prompt:', e);
            const fallback = prompt(message || '请输入数量', String(defaultValue ?? min ?? 1));
            const n = parseInt(String(fallback || ''), 10);
            if (!Number.isFinite(n)) resolve(null);
            else resolve(n);
          }
        });
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
