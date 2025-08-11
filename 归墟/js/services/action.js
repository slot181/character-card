// /js/services/action.js
// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
    'use strict';

    // 依赖检查
    if (!window.GuixuState || !window.GuixuHelpers || !window.GuixuAPI || !window.GuixuDOM) {
        console.error('ActionService 依赖 GuixuState, GuixuHelpers, GuixuAPI, 和 GuixuDOM。');
        return;
    }

    const ActionService = {
        /**
         * 处理所有用户和系统动作的核心函数。
         * @param {string} userMessage - 用户在输入框中输入的消息。
         */
        async handleAction(userMessage = '') {
            const state = window.GuixuState.getState();

            // 1. 整合输入
            const commandText = this.buildActionCommandText(state.pendingActions);
            if (!userMessage && !commandText) {
                throw new Error('请输入回复或添加指令后发送。');
            }

            // 2. 构建 GenerateConfig 对象
            const combinedContent = this.buildCombinedContent(commandText, userMessage);
            const generateConfig = {
                injects: [{
                    role: 'user',
                    content: combinedContent,
                    position: 'in_chat',
                    depth: 0,
                    should_scan: true,
                }],
                should_stream: false,
            };
            state.update('lastSentPrompt', combinedContent);

            // 3. 调用AI生成
            const aiResponse = await GuixuAPI.generate(generateConfig);
            if (typeof aiResponse !== 'string') {
                throw new Error('AI未返回有效文本。');
            }
            console.log('[归墟] AI原始回复:', aiResponse);

            // 4. 提取并更新状态
            this.extractAndCacheResponse(aiResponse);
            await this.updateMvuState(aiResponse);
            
            // 5. 静默保存到第0层
            await this.saveToMessageZero(aiResponse);

            // 6. 返回新的状态和AI响应
            return {
                newMvuState: state.getState().currentMvuState,
                aiResponse: aiResponse
            };
        },

        /**
         * 从待处理动作数组构建指令文本。
         * @private
         */
        buildActionCommandText(pendingActions) {
            if (pendingActions.length === 0) return '';
            
            let commandText = '[本轮行动指令]\n';
            pendingActions.forEach(cmd => {
                let actionText = '';
                switch (cmd.action) {
                    case 'equip': actionText = `装备 [${cmd.itemName}] 到 [${cmd.category}] 槽位。`; break;
                    case 'unequip': actionText = `卸下 [${cmd.itemName}] 从 [${cmd.category}] 槽位。`; break;
                    case 'use': actionText = `使用 ${cmd.quantity} 个 [${cmd.itemName}]。`; break;
                    case 'discard':
                        actionText = cmd.quantity > 1 ? `丢弃 ${cmd.quantity} 个 [${cmd.itemName}]。` : `丢弃 [${cmd.itemName}]。`;
                        break;
                }
                commandText += `- ${actionText}\n`;
            });
            return commandText;
        },

        /**
         * 合并指令和用户输入。
         * @private
         */
        buildCombinedContent(commandText, userMessage) {
            let combined = '';
            if (commandText) combined += commandText + '\n';
            if (userMessage) combined += `<行动选择>\n${userMessage}\n</行动选择>`;
            return combined;
        },

        /**
         * 从AI响应中提取所有标签内容并缓存到State。
         * @private
         */
        extractAndCacheResponse(aiResponse) {
            const state = window.GuixuState;
            state.update('lastExtractedNovelText', GuixuHelpers.extractLastTagContent('gametxt', aiResponse));
            state.update('lastExtractedJourney', GuixuHelpers.extractLastTagContent('本世历程', aiResponse));
            state.update('lastExtractedPastLives', GuixuHelpers.extractLastTagContent('往世涟漪', aiResponse));
            state.update('lastExtractedVariables', GuixuHelpers.extractLastTagContent('UpdateVariable', aiResponse, true));
            state.update('lastExtractedCharacterCard', GuixuHelpers.extractLastTagContent('角色提取', aiResponse));
        },

        /**
         * 使用AI响应更新MVU状态。
         * @private
         */
        async updateMvuState(aiResponse) {
            const state = window.GuixuState;
            const updateScript = aiResponse; // 整个响应作为脚本

            if (updateScript && state.currentMvuState) {
                const inputData = { old_variables: state.currentMvuState };
                try {
                    const mvuPromise = eventEmit('mag_invoke_mvu', updateScript, inputData);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MVU event timeout')), 3000));
                    await Promise.race([mvuPromise, timeoutPromise]);

                    if (inputData.new_variables) {
                        const normalized = this.normalizeMvuState(inputData.new_variables);
                        state.update('currentMvuState', normalized);
                    } else {
                        throw new Error('mvu 未返回新状态。');
                    }
                } catch (eventError) {
                    console.warn('[归墟] 调用 mag_invoke_mvu 失败，尝试前端备用方案:', eventError);
                    const modifiedState = GuixuHelpers.applyUpdateFallback(updateScript, state.currentMvuState);
                    if (modifiedState) {
                        const normalized = this.normalizeMvuState(modifiedState);
                        state.update('currentMvuState', normalized);
                        console.log('[归墟-备用方案] 前端模拟更新成功。');
                    }
                }
            }
        },

        /**
         * 对 mvu state 进行去重与规范化，避免重复添加天赋/物品/灵根等列表。
         * 仅在前端缓存中规范化，不直接写回酒馆，以免产生副作用。
         * @param {object} mvu
         * @returns {object} 规范化后的 mvu
         */
        normalizeMvuState(mvu) {
            try {
                const clone = JSON.parse(JSON.stringify(mvu || {}));
                const sd = clone.stat_data || {};

                // 需去重的一般列表键
                const listKeys = [
                    '天赋列表', '灵根列表',
                    '功法列表', '武器列表', '防具列表', '饰品列表', '法宝列表',
                    '丹药列表', '其他列表',
                    '人物关系列表'
                ];

                const makeKey = (item) => {
                    if (item == null) return 'null';
                    if (typeof item === 'string') {
                        // 字符串尝试按 JSON 解析后再取 key；否则直接用原串
                        try { const obj = JSON.parse(item); return makeKey(obj); } catch (_) { return 'str:' + item; }
                    }
                    if (typeof item === 'object') {
                        if (item.id) return `id:${item.id}`;
                        const name = item.name || item['名称'] || '';
                        const tier = item.tier || item['品阶'] || '';
                        const level = item.level || item['等级'] || '';
                        const desc = item.description || item['描述'] || '';
                        return `key:${name}|${tier}|${level}|${desc}`;
                    }
                    return String(item);
                };

                listKeys.forEach(k => {
                    const arrWrapper = sd[k];
                    if (!arrWrapper || !Array.isArray(arrWrapper) || arrWrapper.length === 0) return;
                    const arr = arrWrapper[0];
                    if (!Array.isArray(arr)) return;

                    const seen = new Set();
                    const deduped = [];
                    for (const raw of arr) {
                        if (raw === '$__META_EXTENSIBLE__$' || raw === '...') continue;
                        const key = makeKey(raw);
                        if (seen.has(key)) continue;
                        seen.add(key);
                        deduped.push(raw);
                    }
                    sd[k][0] = deduped;
                });

                clone.stat_data = sd;
                return clone;
            } catch (e) {
                console.warn('[归墟] normalizeMvuState 失败:', e);
                return mvu;
            }
        },

        /**
         * 将结果静默保存到第0层消息。
         * @private
         */
        async saveToMessageZero(aiResponse) {
            const state = window.GuixuState.getState();
            const messages = await GuixuAPI.getChatMessages('0');
            if (messages && messages.length > 0) {
                const messageZero = messages[0];
                messageZero.message = aiResponse;
                messageZero.data = state.currentMvuState;
                await GuixuAPI.setChatMessages([messageZero], { refresh: 'none' });
                console.log('[归墟] 已静默更新第0层。');
            } else {
                console.error('[归墟] 未找到第0层消息，无法更新。');
            }
        },

        // --- 存档/读档管理功能 ---
        showSaveLoadManager() {
            window.GuixuBaseModal.open('save-load-modal');
            const manualContainer = GuixuDOM.$('#save-slots-container');
            const autoContainer = GuixuDOM.$('#auto-save-slot-container');
            const autoSaveCheckbox = GuixuDOM.$('#auto-save-checkbox');

            if (!manualContainer || !autoContainer || !autoSaveCheckbox) return;

            autoSaveCheckbox.checked = GuixuState.getState().isAutoSaveEnabled;

            let saves;
            try {
                saves = this.getSavesFromStorage();
            } catch (e) {
                console.error("解析整个存档文件失败:", e);
                manualContainer.innerHTML = `<div style="color: #ff6b6b; padding: 20px; text-align: center;"><p>错误：主存档文件已损坏。</p></div>`;
                autoContainer.innerHTML = '';
                return;
            }

            let autoHtml = '';
            const autoSlotIds = ['auto_save_slot_0', 'auto_save_slot_1'];
            autoSlotIds.forEach(slotId => {
                autoHtml += this.renderSlot(saves[slotId], slotId, true);
            });
            autoContainer.innerHTML = autoHtml;

            let manualHtml = '';
            const totalSlots = 5;
            for (let i = 1; i <= totalSlots; i++) {
                manualHtml += this.renderSlot(saves[`slot_${i}`], `slot_${i}`, false);
            }
            manualContainer.innerHTML = manualHtml;
            
            this.bindSaveSlotListeners();
        },

        renderSlot(saveData, slotId, isAutoSave) {
            const { h } = GuixuDOM;
            const infoDiv = h('div', { className: 'save-slot-info' });
            let statDataForRender = null;

            if (saveData && typeof saveData.mvu_data === 'object' && saveData.mvu_data !== null) {
                statDataForRender = saveData.mvu_data.stat_data || saveData.mvu_data;
            }

            if (statDataForRender) {
                const date = new Date(saveData.timestamp).toLocaleString('zh-CN');
                const jingjie = GuixuHelpers.SafeGetValue(statDataForRender, '当前境界.0', '未知');
                const jinian = GuixuHelpers.SafeGetValue(statDataForRender, '当前时间纪年.0', '未知');
                const summary = (window.GuixuMain && typeof window.GuixuMain._getDisplayText === 'function')
                  ? window.GuixuMain._getDisplayText(saveData.message_content)
                  : (saveData.message_content || '');
                const saveName = saveData.save_name || (isAutoSave ? `自动存档 (${slotId.slice(-1)})` : `存档 ${slotId.split('_')[1]}`);
                
                infoDiv.append(
                    h('div', { className: 'slot-name' }, [saveName]),
                    h('div', { className: 'slot-time' }, [`${date} - ${jingjie} - ${jinian}`]),
                    h('div', { className: 'slot-summary' }, [summary ? summary.substring(0, 40) + '...' : '无正文记录'])
                );
            } else {
                const name = isAutoSave ? `自动存档 (${slotId.slice(-1)})` : `存档 ${slotId.split('_')[1]}`;
                infoDiv.append(
                    h('div', { className: 'slot-name' }, [name]),
                    h('div', { className: 'slot-time', style: 'font-style: italic; color: #8b7355;' }, ['空存档位'])
                );
            }

            const actionsDiv = h('div', { className: 'save-slot-actions' });
            if (isAutoSave) {
                actionsDiv.append(
                    h('button', { className: 'interaction-btn btn-load-slot', style: 'padding: 8px 12px;', disabled: !saveData }, ['读档']),
                    h('button', { className: 'interaction-btn btn-delete-slot', style: 'padding: 8px 12px; background: #8b0000;', disabled: !saveData }, ['删除'])
                );
            } else {
                actionsDiv.append(
                    h('button', { className: 'interaction-btn btn-save-slot', style: 'padding: 6px 10px; font-size: 12px;' }, ['存档']),
                    h('button', { className: 'interaction-btn btn-load-slot', style: 'padding: 6px 10px; font-size: 12px;', disabled: !saveData }, ['读档']),
                    h('button', { className: 'interaction-btn btn-export-slot', style: 'padding: 6px 10px; font-size: 12px; background: #004d40;', disabled: !saveData }, ['导出']),
                    h('button', { className: 'interaction-btn btn-delete-slot', style: 'padding: 6px 10px; font-size: 12px; background: #8b0000;', disabled: !saveData }, ['删除'])
                );
            }

            const slotDiv = h('div', { className: 'save-slot', 'data-slot-id': slotId }, [infoDiv, actionsDiv]);
            return slotDiv.outerHTML;
        },

        bindSaveSlotListeners() {
            const container = GuixuDOM.$('#save-load-modal .modal-body');
            if (!container) return;

            const newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);

            newContainer.querySelector('#auto-save-checkbox')?.addEventListener('change', (e) => {
                GuixuState.update('isAutoSaveEnabled', e.target.checked);
                GuixuHelpers.showTemporaryMessage(`自动存档已${e.target.checked ? '开启' : '关闭'}`);
                if (e.target.checked) GuixuState.startAutoSavePolling();
                else GuixuState.stopAutoSavePolling();
            });

            newContainer.addEventListener('click', (e) => {
                const target = e.target;
                const slotDiv = target.closest('.save-slot');
                if (!slotDiv) return;
                
                const slotId = slotDiv.dataset.slotId;
                
                // 修复：确保按钮事件绑定正确，并避免重复触发
                e.preventDefault();
                e.stopPropagation();
                
                if (target.classList.contains('btn-save-slot') && !target.disabled) {
                    this.saveGame(slotId);
                } else if (target.classList.contains('btn-load-slot') && !target.disabled) {
                    this.loadGame(slotId);
                } else if (target.classList.contains('btn-export-slot') && !target.disabled) {
                    this.exportSave(slotId);
                } else if (target.classList.contains('btn-delete-slot') && !target.disabled) {
                    this.deleteSave(slotId);
                }
            });
        },

        getSavesFromStorage() {
            try {
                return JSON.parse(localStorage.getItem('guixu_multi_save_data') || '{}');
            } catch (e) {
                console.error("获取存档失败:", e);
                return {};
            }
        },

        async saveGame(slotId) {
            const saveName = await this.promptForSaveName(slotId);
            if (!saveName) {
                GuixuHelpers.showTemporaryMessage('存档已取消');
                return;
            }

            const allSaves = this.getSavesFromStorage();
            const performSave = async () => {
                try {
                    const state = GuixuState.getState();
                    if (!state.currentMvuState || !state.currentMvuState.stat_data) {
                        throw new Error('MVU数据不完整，无法存档。');
                    }
                    const lorebookEntries = await GuixuLorebookService.backupActiveLore(`${saveName}-本世历程`, `${saveName}-往世涟漪`, state.unifiedIndex);
                    const saveDataPayload = {
                        timestamp: new Date().toISOString(),
                        save_name: saveName,
                        message_content: (await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId()))?.[0]?.message || '',
                        lorebook_entries: lorebookEntries,
                        mvu_data: state.currentMvuState,
                        // 新增：保存当前装备状态
                        equipped_items: state.equippedItems,
                    };
                    allSaves[slotId] = saveDataPayload;
                    localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
                    GuixuHelpers.showTemporaryMessage(`存档"${saveName}"已保存`);
                    this.showSaveLoadManager();
                } catch (error) {
                    console.error('执行存档操作失败:', error);
                    GuixuHelpers.showTemporaryMessage(`存档失败: ${error.message}`);
                }
            };

            if (allSaves[slotId]) {
                (window.GuixuMain && typeof window.GuixuMain.showCustomConfirm === 'function')
                  ? window.GuixuMain.showCustomConfirm(`存档位 ${slotId.split('_')[1]} 已有数据，确定要覆盖吗？`, performSave)
                  : (confirm(`存档位 ${slotId.split('_')[1]} 已有数据，确定要覆盖吗？`) ? performSave() : void 0);
            } else {
                await performSave();
            }
        },

        async loadGame(slotId) {
            const allSaves = this.getSavesFromStorage();
            const saveData = allSaves[slotId];
            if (!saveData) {
                GuixuHelpers.showTemporaryMessage('没有找到存档文件。');
                return;
            }
            (window.GuixuMain && typeof window.GuixuMain.showCustomConfirm === 'function'
              ? window.GuixuMain.showCustomConfirm
              : (msg, ok) => { if (confirm(msg)) ok(); }
            )(`确定要读取存档"${saveData.save_name}"吗？`, async () => {
                try {
                    const messages = await GuixuAPI.getChatMessages(GuixuAPI.getCurrentMessageId());
                    if (!messages || messages.length === 0) throw new Error('无法获取当前消息，无法读档。');
                    
                    const messageZero = messages[0];
                    messageZero.data = saveData.mvu_data;
                    messageZero.message = saveData.message_content || '';

                    if (saveData.lorebook_entries) {
                       await GuixuLorebookService.restoreActiveLore(saveData.lorebook_entries, GuixuState.getState().unifiedIndex);
                    }
                    
                    // 新增：恢复装备状态
                    if (saveData.equipped_items) {
                        GuixuState.update('equippedItems', saveData.equipped_items);
                    }

                    await GuixuAPI.setChatMessages([messageZero], { refresh: 'all' });
                    
                    // 延迟执行init，确保SillyTavern完成消息渲染
                    setTimeout(() => {
                        try { window.GuixuMain?.init?.(); } catch (_) {}
                        GuixuHelpers.showTemporaryMessage(`读档"${saveData.save_name}"成功！`);
                        try { window.GuixuBaseModal?.closeAll?.(); } catch (_) {}
                    }, 500);

                } catch (error) {
                    console.error('读档失败:', error);
                    GuixuHelpers.showTemporaryMessage(`读档失败: ${error.message}`);
                }
            });
        },

        async deleteSave(slotId) {
            const allSaves = this.getSavesFromStorage();
            const saveDataToDelete = allSaves[slotId];
            if (!saveDataToDelete) return;

            (window.GuixuMain && typeof window.GuixuMain.showCustomConfirm === 'function'
              ? window.GuixuMain.showCustomConfirm
              : (msg, ok) => { if (confirm(msg)) ok(); }
            )(`确定要删除 "${saveDataToDelete.save_name}" 吗？`, async () => {
                try {
                    await GuixuState.deleteLorebookBackup(saveDataToDelete);
                    delete allSaves[slotId];
                    localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
                    GuixuHelpers.showTemporaryMessage(`"${saveDataToDelete.save_name}" 已删除。`);
                    this.showSaveLoadManager();
                } catch (error) {
                    console.error('删除存档失败:', error);
                    GuixuHelpers.showTemporaryMessage(`删除存档失败: ${error.message}`);
                }
            });
        },

        async clearAllSaves() {
            (window.GuixuMain && typeof window.GuixuMain.showCustomConfirm === 'function'
              ? window.GuixuMain.showCustomConfirm
              : (msg, ok) => { if (confirm(msg)) ok(); }
            )(`确定要清除所有存档吗？`, async () => {
                try {
                    const allSaves = this.getSavesFromStorage();
                    for (const slotId in allSaves) {
                        await GuixuState.deleteLorebookBackup(allSaves[slotId]);
                    }
                    localStorage.removeItem('guixu_multi_save_data');
                    GuixuHelpers.showTemporaryMessage(`所有存档已清除。`);
                    this.showSaveLoadManager();
                } catch (error) {
                    console.error('清除所有存档失败:', error);
                    GuixuHelpers.showTemporaryMessage(`清除存档失败: ${error.message}`);
                }
            });
        },

        async handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedSave = JSON.parse(e.target.result);
                    if (!importedSave.timestamp || !importedSave.mvu_data || !importedSave.save_name) {
                        throw new Error('存档文件格式无效。');
                    }
                    const slotId = await this.promptForSlotSelection(importedSave.save_name);
                    if (!slotId) return;
                    const allSaves = this.getSavesFromStorage();
                    allSaves[slotId] = importedSave;
                    localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
                    GuixuHelpers.showTemporaryMessage(`存档 "${importedSave.save_name}" 已导入。`);
                    this.showSaveLoadManager();
                } catch (error) {
                    GuixuHelpers.showTemporaryMessage(`导入失败: ${error.message}`);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        },

        exportSave(slotId) {
            const saveData = this.getSavesFromStorage()[slotId];
            if (!saveData) {
                GuixuHelpers.showTemporaryMessage('该存档位为空。');
                return;
            }
            const fileName = `${saveData.save_name.replace(/[^a-z0-9]/gi, '_')}.json`;
            this._downloadJSON(saveData, fileName);
        },

        _downloadJSON(data, fileName) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = GuixuDOM.h('a', { href: url, download: fileName });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        async promptForSlotSelection(importName) {
            return new Promise(resolve => {
                const { h } = GuixuDOM;
                let slotsHtml = [];
                for (let i = 1; i <= 5; i++) {
                    slotsHtml.push(h('button', { className: 'interaction-btn slot-select-btn', 'data-slot-id': `slot_${i}` }, [`存档位 ${i}`]));
                }
                const modal = h('div', { className: 'modal-overlay', style: 'display: flex; z-index: 2001; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); justify-content: center; align-items: center;' }, [
                    h('div', { className: 'modal-content', style: 'background: rgba(26, 26, 46, 0.95); border: 1px solid #c9aa71; border-radius: 8px; padding: 20px; width: 450px; height: auto; box-shadow: 0 0 20px rgba(201, 170, 113, 0.3);' }, [
                        h('div', { className: 'modal-header', style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(201, 170, 113, 0.5); padding-bottom: 10px; margin-bottom: 15px;' }, [h('h2', { className: 'modal-title', style: 'font-size: 18px; color: #c9aa71; margin: 0;' }, ['选择导入位置'])]),
                        h('div', { className: 'modal-body', style: 'padding: 20px; color: #e0dcd1;' }, [
                            h('p', { style: 'margin-bottom: 20px; color: #c9aa71;' }, [`请选择一个存档位以导入 "${importName}":`]),
                            h('div', { style: 'display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;' }, slotsHtml),
                            h('div', { style: 'text-align: right; margin-top: 25px;' }, [
                                h('button', { id: 'import-cancel-btn', className: 'interaction-btn', style: 'padding: 10px 8px; background: linear-gradient(45deg, #1a1a2e, #2d1b3d); border: 1px solid #c9aa71; border-radius: 5px; color: #c9aa71; font-size: 12px; cursor: pointer;' }, ['取消'])
                            ])
                        ])
                    ])
                ]);
                GuixuDOM.$('.guixu-root-container').appendChild(modal);
                modal.addEventListener('click', (e) => {
                    if (e.target.classList.contains('slot-select-btn')) {
                        modal.remove();
                        resolve(e.target.dataset.slotId);
                    } else if (e.target.id === 'import-cancel-btn' || e.target === modal) {
                        modal.remove();
                        resolve(null);
                    }
                });
            });
        },

        async promptForSaveName(slotId) {
            return new Promise(resolve => {
                const { h } = GuixuDOM;
                const input = h('input', { type: 'text', id: 'save-name-input', placeholder: '例如：突破金丹期', style: 'width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #8b7355; color: #e0dcd1; border-radius: 4px; font-size: 14px; margin-bottom: 15px;' });
                const confirmBtn = h('button', { 
                    id: 'save-name-confirm', 
                    className: 'interaction-btn primary-btn',
                    style: 'padding: 10px 8px; background: linear-gradient(45deg, #8b4513, #cd853f); border: 1px solid #daa520; color: #fff; border-radius: 5px; font-size: 12px; cursor: pointer;'
                }, ['确认']);
                const cancelBtn = h('button', { 
                    id: 'save-name-cancel', 
                    className: 'interaction-btn',
                    style: 'padding: 10px 8px; background: linear-gradient(45deg, #1a1a2e, #2d1b3d); border: 1px solid #c9aa71; border-radius: 5px; color: #c9aa71; font-size: 12px; cursor: pointer;'
                }, ['取消']);
                const modal = h('div', { className: 'modal-overlay', style: 'display: flex; z-index: 2000; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); justify-content: center; align-items: center;' }, [
                    h('div', { className: 'modal-content', style: 'background: rgba(26, 26, 46, 0.95); border: 1px solid #c9aa71; border-radius: 8px; padding: 20px; width: 400px; height: auto; box-shadow: 0 0 20px rgba(201, 170, 113, 0.3);' }, [
                        h('div', { className: 'modal-header', style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(201, 170, 113, 0.5); padding-bottom: 10px; margin-bottom: 15px;' }, [h('h2', { className: 'modal-title', style: 'font-size: 18px; color: #c9aa71; margin: 0;' }, ['存档命名'])]),
                        h('div', { className: 'modal-body', style: 'padding: 20px; color: #e0dcd1;' }, [
                            h('p', { style: 'margin-bottom: 15px; color: #c9aa71;' }, [`请为存档位 ${slotId.split('_')[1]} 输入一个名称：`]),
                            input,
                            h('div', { style: 'display: flex; gap: 10px; justify-content: flex-end;' }, [cancelBtn, confirmBtn])
                        ])
                    ])
                ]);
                GuixuDOM.$('.guixu-root-container').appendChild(modal);
                confirmBtn.onclick = () => {
                    const saveName = input.value.trim();
                    if (!saveName) { GuixuHelpers.showTemporaryMessage('请输入存档名称'); return; }
                    modal.remove();
                    resolve(saveName);
                };
                cancelBtn.onclick = () => { modal.remove(); resolve(null); };
                input.onkeypress = (e) => { if (e.key === 'Enter') confirmBtn.click(); };
                setTimeout(() => input.focus(), 100);
            });
        }
    };

    // 将服务挂载到 window 对象
    window.GuixuActionService = ActionService;

})(window);
