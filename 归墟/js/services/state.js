// /js/services/state.js
// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  const GuixuState = {
    // --- 核心动态数据 ---
    equippedItems: {
      wuqi: null,
      fangju: null,
      shipin: null,
      fabao1: null,
      zhuxiuGongfa: null,
      fuxiuXinfa: null,
    },
    currentMvuState: null, // 缓存最新的完整mvu状态
    pendingActions: [], // 指令队列/购物车

    // --- 从MVU加载的原始数据 ---
    baseAttributes: {}, // 基础属性
    
    // --- 计算衍生的数据 ---
    calculatedMaxAttributes: {}, // 计算后的属性上限

    // --- AI响应提取内容缓存 ---
    lastExtractedJourney: null,
    lastExtractedPastLives: null,
    lastExtractedNovelText: null,
    lastExtractedCharacterCard: null,
    lastExtractedVariables: null,
    
    // --- 写入世界书状态追踪 ---
    lastWrittenJourney: null,
    lastWrittenPastLives: null,
    lastWrittenNovelText: null,

    // --- 用户输入与配置 ---
    lastSentPrompt: null,
    isNovelModeEnabled: false,
    isAutoWriteEnabled: true,
    isMobileView: false,
    unifiedIndex: 1,
    isAutoToggleLorebookEnabled: false,
    isAutoSaveEnabled: false,
    isAutoTrimEnabled: false,

    // --- 计时器ID ---
    autoWriteIntervalId: null,
    novelModeAutoWriteIntervalId: null,
    autoToggleIntervalId: null,
    autoSaveIntervalId: null,

    // --- 初始化方法 ---
    // 从localStorage加载状态
    load() {
      this.loadStateFromStorage('guixu_equipped_items', 'equippedItems', {});
      this.loadStateFromStorage('guixu_pending_actions', 'pendingActions', []);
      this.loadStateFromStorage('guixu_auto_write_enabled', 'isAutoWriteEnabled', true);
      this.loadStateFromStorage('guixu_novel_mode_enabled', 'isNovelModeEnabled', false);
      this.loadStateFromStorage('guixu_view_mode', 'isMobileView', false, (val) => val === 'mobile');
      this.loadStateFromStorage('guixu_unified_index', 'unifiedIndex', 1, parseInt);
      this.loadStateFromStorage('guixu_auto_toggle_enabled', 'isAutoToggleLorebookEnabled', false);
      this.loadStateFromStorage('guixu_auto_save_enabled', 'isAutoSaveEnabled', false);
      this.loadStateFromStorage('guixu_auto_trim_enabled', 'isAutoTrimEnabled', false);
    },

    // --- 状态存取辅助函数 ---
    loadStateFromStorage(key, stateProperty, defaultValue, parser = null) {
      try {
        const savedValue = localStorage.getItem(key);
        if (savedValue !== null) {
          let value = JSON.parse(savedValue);
          if (parser) {
            value = parser(value);
          }
          this[stateProperty] = value;
        } else {
          this[stateProperty] = defaultValue;
        }
      } catch (e) {
        console.error(`加载状态 "${key}" 失败:`, e);
        this[stateProperty] = defaultValue;
      }
    },

    saveStateToStorage(key, stateProperty) {
      try {
        localStorage.setItem(key, JSON.stringify(this[stateProperty]));
      } catch (e) {
        console.error(`保存状态 "${key}" 失败:`, e);
      }
    },

    // --- 暴露给全局的接口 ---
    getState() {
      return this;
    },
    
    // 更新并保存状态的便捷方法
    update(key, value) {
        if (this.hasOwnProperty(key)) {
            this[key] = value;
            // 根据key决定对应的localStorage键名并保存
            const storageMap = {
                equippedItems: 'guixu_equipped_items',
                pendingActions: 'guixu_pending_actions',
                isAutoWriteEnabled: 'guixu_auto_write_enabled',
                isNovelModeEnabled: 'guixu_novel_mode_enabled',
                isMobileView: 'guixu_view_mode',
                unifiedIndex: 'guixu_unified_index',
                isAutoToggleLorebookEnabled: 'guixu_auto_toggle_enabled',
                isAutoSaveEnabled: 'guixu_auto_save_enabled',
                isAutoTrimEnabled: 'guixu_auto_trim_enabled',
            };
            if (storageMap[key]) {
                let valueToStore = value;
                if (key === 'isMobileView') {
                    valueToStore = value ? 'mobile' : 'desktop';
                }
                localStorage.setItem(storageMap[key], JSON.stringify(valueToStore));
            }
        } else {
            console.warn(`GuixuState 中不存在键: ${key}`);
        }
    },

    // --- 轮询服务 ---
    startAutoWritePolling() {
      this.stopAutoWritePolling();
      if (!this.isAutoWriteEnabled) return;
      console.log('[归墟] 启动自动写入轮询 (5秒)...');
      this.autoWriteIntervalId = setInterval(async () => {
        if (this.lastExtractedJourney && this.lastExtractedJourney !== this.lastWrittenJourney) {
          await window.GuixuLorebookService.writeToLorebook('本世历程', this.lastExtractedJourney, this.unifiedIndex, this.isAutoTrimEnabled, true);
          this.update('lastWrittenJourney', this.lastExtractedJourney);
        }
        if (this.lastExtractedPastLives && this.lastExtractedPastLives !== this.lastWrittenPastLives) {
          await window.GuixuLorebookService.writeToLorebook('往世涟漪', this.lastExtractedPastLives, this.unifiedIndex, false, true);
          this.update('lastWrittenPastLives', this.lastExtractedPastLives);
        }
      }, 5000);
    },

    stopAutoWritePolling() {
      if (this.autoWriteIntervalId) {
        clearInterval(this.autoWriteIntervalId);
        this.autoWriteIntervalId = null;
        console.log('[归墟] 停止自动写入轮询。');
      }
    },

    startNovelModeAutoWritePolling() {
        this.stopNovelModeAutoWritePolling();
        if (!this.isNovelModeEnabled) return;
        console.log('[归墟] 启动小说模式自动写入轮询 (5秒)...');
        this.novelModeAutoWriteIntervalId = setInterval(async () => {
            if (this.lastExtractedNovelText && this.lastExtractedNovelText !== this.lastWrittenNovelText) {
                await window.GuixuLorebookService.writeToLorebook('小说模式', this.lastExtractedNovelText, this.unifiedIndex, false, true);
                this.update('lastWrittenNovelText', this.lastExtractedNovelText);
            }
        }, 5000);
    },

    stopNovelModeAutoWritePolling() {
        if (this.novelModeAutoWriteIntervalId) {
            clearInterval(this.novelModeAutoWriteIntervalId);
            this.novelModeAutoWriteIntervalId = null;
            console.log('[归墟] 停止小说模式自动写入轮询。');
        }
    },

    startAutoTogglePolling() {
        this.stopAutoTogglePolling();
        if (!this.isAutoToggleLorebookEnabled) return;
        console.log('[归墟] 启动世界书自动开关轮询 (2秒)...');
        this.autoToggleIntervalId = setInterval(async () => {
            await window.GuixuLorebookService.toggleLorebook(this.unifiedIndex, true);
        }, 2000);
    },

    stopAutoTogglePolling() {
        if (this.autoToggleIntervalId) {
            clearInterval(this.autoToggleIntervalId);
            this.autoToggleIntervalId = null;
            console.log('[归墟] 停止世界书自动开关轮询。');
        }
    },

    startAutoSavePolling() {
        this.stopAutoSavePolling();
        if (!this.isAutoSaveEnabled) return;
        console.log('[归墟] 启动自动存档轮询 (10秒)...');
        this.autoSaveIntervalId = setInterval(() => {
            this.performAutoSave();
        }, 10000);
    },

    stopAutoSavePolling() {
        if (this.autoSaveIntervalId) {
            clearInterval(this.autoSaveIntervalId);
            this.autoSaveIntervalId = null;
            console.log('[归墟] 停止自动存档轮询。');
        }
    },

    async performAutoSave() {
        console.log('[归墟] 检查是否需要自动存档...');
        if (!this.currentMvuState) {
          console.warn('[归墟] 自动存档跳过：无法获取当前mvu状态。');
          return;
        }

        try {
          const allSaves = JSON.parse(localStorage.getItem('guixu_multi_save_data') || '{}');
          const slot0 = allSaves['auto_save_slot_0'];

          if (slot0) {
            const currentStateString = JSON.stringify(this.currentMvuState.stat_data);
            const latestSaveStateString = JSON.stringify(slot0.mvu_data.stat_data);
            if (currentStateString === latestSaveStateString) {
              console.log('[归墟] 自动存档跳过：游戏状态自上次自动存档以来未发生变化。');
              return;
            }
          }

          console.log('[归墟] 状态已改变，执行双缓冲自动存档...');

          if (slot0) {
            const oldSlot1 = allSaves['auto_save_slot_1'];
            if (oldSlot1) {
              await this.deleteLorebookBackup(oldSlot1);
            }
            const newSlot1SaveName = `自动存档(上一次) - ${new Date(slot0.timestamp).toLocaleString('sv-SE')}`;
            await this.renameLorebookEntry(slot0.lorebook_entries.journey_entry_name, `${newSlot1SaveName}-本世历程`);
            await this.renameLorebookEntry(slot0.lorebook_entries.past_lives_entry_name, `${newSlot1SaveName}-往世涟漪`);
            slot0.save_name = newSlot1SaveName;
            slot0.lorebook_entries.journey_entry_name = `${newSlot1SaveName}-本世历程`;
            slot0.lorebook_entries.past_lives_entry_name = `${newSlot1SaveName}-往世涟漪`;
            allSaves['auto_save_slot_1'] = slot0;
          }

          const newSaveName = `自动存档(最新) - ${new Date().toLocaleString('sv-SE')}`;
          const currentMessageContent = (await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId()))?.[0]?.message || '';
          
          const lorebookEntries = {
            journey_entry_name: `${newSaveName}-本世历程`,
            past_lives_entry_name: `${newSaveName}-往世涟漪`
          };

          await window.GuixuLorebookService.backupActiveLore(lorebookEntries.journey_entry_name, lorebookEntries.past_lives_entry_name, this.unifiedIndex);

          const saveDataPayload = {
            timestamp: new Date().toISOString(),
            save_name: newSaveName,
            message_content: currentMessageContent,
            lorebook_entries: lorebookEntries,
            mvu_data: this.currentMvuState
          };

          allSaves['auto_save_slot_0'] = saveDataPayload;
          localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
          
          window.GuixuHelpers.showTemporaryMessage(`已自动存档`);
          if (document.getElementById('save-load-modal')?.style.display === 'flex') {
            window.GuixuActionService?.showSaveLoadManager?.();
          }
        } catch (error) {
          console.error('自动存档失败:', error);
          window.GuixuHelpers.showTemporaryMessage(`自动存档失败: ${error.message}`);
        }
    },
    
    async renameLorebookEntry(oldName, newName) {
        if (!oldName || !newName || oldName === newName) return;
        const bookName = window.GuixuConstants.LOREBOOK.NAME;
        try {
            const allEntries = await window.GuixuAPI.getLorebookEntries(bookName);
            const oldEntry = allEntries.find(e => e.comment === oldName);
            if (!oldEntry) {
                console.warn(`[重命名] 未找到旧条目: ${oldName}`);
                return;
            }
            const newEntryData = { ...oldEntry };
            delete newEntryData.uid;
            newEntryData.comment = newName;
            newEntryData.keys = [newName];
            await window.GuixuAPI.createLorebookEntries(bookName, [newEntryData]);
            await window.GuixuAPI.deleteLorebookEntries(bookName, [oldEntry.uid]);
            console.log(`[重命名] 成功将 "${oldName}" 重命名为 "${newName}"`);
        } catch (error) {
            console.error(`重命名世界书条目从 "${oldName}" 到 "${newName}" 时失败:`, error);
            throw new Error(`重命名世界书条目失败: ${error.message}`);
        }
    },

    async deleteLorebookBackup(saveData) {
        if (!saveData || !saveData.lorebook_entries) return;
        const bookName = window.GuixuConstants.LOREBOOK.NAME;
        const { journey_entry_name, past_lives_entry_name } = saveData.lorebook_entries;
        try {
            const allEntries = await window.GuixuAPI.getLorebookEntries(bookName);
            const entriesToDelete = [];
            const journeyEntry = allEntries.find(e => e.comment === journey_entry_name);
            if (journeyEntry) entriesToDelete.push(journeyEntry.uid);
            const pastLivesEntry = allEntries.find(e => e.comment === past_lives_entry_name);
            if (pastLivesEntry) entriesToDelete.push(pastLivesEntry.uid);
            if (entriesToDelete.length > 0) {
                await window.GuixuAPI.deleteLorebookEntries(bookName, entriesToDelete);
                console.log(`[归墟删除] 已删除 ${entriesToDelete.length} 个关联的世界书条目。`);
            }
        } catch (error) {
            console.error('删除关联的世界书条目时出错:', error);
            window.GuixuHelpers.showTemporaryMessage('警告：删除关联的世界书条目失败。');
        }
    }
  };

  // 初始化时加载所有状态
  GuixuState.load();

  // 将状态管理器挂载到 window 对象
  window.GuixuState = GuixuState;

})(window);
