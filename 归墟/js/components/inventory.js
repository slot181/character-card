// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  if (!window.GuixuDOM || !window.GuixuBaseModal || !window.GuixuAPI || !window.GuixuHelpers || !window.GuixuState) {
    console.error('[归墟] InventoryComponent 初始化失败：缺少依赖(GuixuDOM/GuixuBaseModal/GuixuAPI/GuixuHelpers/GuixuState)。');
    return;
  }

  const InventoryComponent = {
    async show() {
      const { $ } = window.GuixuDOM;
      window.GuixuBaseModal.open('inventory-modal');

      const body = $('#inventory-modal .modal-body');
      if (!body) return;

      body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在清点行囊...</p>';

      try {
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        const stat_data = messages?.[0]?.data?.stat_data;

        if (!stat_data) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法获取背包数据。</p>';
          return;
        }

        body.innerHTML = this.render(stat_data || {});
        this.bindEvents(body);
      } catch (error) {
        console.error('[归墟] 加载背包时出错:', error);
        body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载背包时出错: ${error.message}</p>`;
      }
    },

    render(stat_data) {
      const h = window.GuixuHelpers;
      const state = window.GuixuState.getState();

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

          // 解析并按品阶排序物品
          const parsedItems = [];
          rawItems.forEach(rawItem => {
            try {
              if (!rawItem) {
                console.warn(`在分类 "${cat.title}" 中发现一个空的物品条目，已跳过。`);
                return;
              }
              const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
              if (item && typeof item === 'object') {
                parsedItems.push(item);
              }
            } catch (e) {
              console.error('解析背包物品失败:', rawItem, e);
            }
          });

          const sortedItems = h.sortByTier(parsedItems, (item) => h.SafeGetValue(item, 'tier', '凡品'));

          sortedItems.forEach(item => {
            try {
              const itemJson = JSON.stringify(item).replace(/'/g, "'");

              const name = h.SafeGetValue(item, 'name', '未知物品');
              const id = h.SafeGetValue(item, 'id', null);
              const tier = h.SafeGetValue(item, 'tier', '无');
              const hasQuantity = Object.prototype.hasOwnProperty.call(item, 'quantity');
              const quantity = parseInt(h.SafeGetValue(item, 'quantity', 1), 10);
              const description = h.SafeGetValue(item, 'description', h.SafeGetValue(item, 'effect', '无描述'));

              // 待处理队列扣减数量
              const pendingActions = (state?.pendingActions || []);
              const pendingUses = pendingActions
                .filter(action => action.action === 'use' && action.itemName === name)
                .reduce((total, action) => total + (action.quantity || 0), 0);
              const pendingDiscards = pendingActions
                .filter(action => action.action === 'discard' && action.itemName === name)
                .reduce((total, action) => total + (action.quantity || 0), 0);
              const displayQuantity = quantity - pendingUses - pendingDiscards;

              // 数量用尽/丢弃后隐藏
              if (hasQuantity && displayQuantity <= 0) return;
              if (!hasQuantity && pendingDiscards > 0) return;

              const tierStyle = h.getTierStyle(tier);
              const tierDisplay = tier !== '无' ? `<span style="${tierStyle} margin-right: 15px;">品阶: ${tier}</span>` : '';
              const quantityDisplay = hasQuantity ? `<span class="item-quantity">数量: ${displayQuantity}</span>` : '';

              // 是否已装备
              const equippedItems = state?.equippedItems || {};
              const isEquipped = id ? Object.values(equippedItems).some(eq => eq && eq.id === id) : false;
              let actionButton = '';

              if (cat.title === '功法') {
                const isEquippedAsMain = id && equippedItems?.zhuxiuGongfa && equippedItems.zhuxiuGongfa.id === id;
                const isEquippedAsAux = id && equippedItems?.fuxiuXinfa && equippedItems.fuxiuXinfa.id === id;

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
                  const slotKey = Object.keys(equippedItems || {}).find(
                    key => equippedItems[key] && equippedItems[key].id === id
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

              // 所有物品都可丢弃或彻底删除
              actionButton += `<button class="item-discard-btn" style="margin-left: 5px;">丢弃</button>`;
              actionButton += `<button class="interaction-btn item-delete-btn danger-btn" style="margin-left: 5px;">彻底删除</button>`;

              // 细节说明使用通用渲染工具，避免重复实现
              const itemDetailsHtml = (window.GuixuRenderers && typeof window.GuixuRenderers.renderItemDetailsForInventory === 'function')
                ? window.GuixuRenderers.renderItemDetailsForInventory(item)
                : '';

              html += `
                <div class="inventory-item" data-item-details='${itemJson}' data-category='${cat.title}'>
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

    bindEvents(container) {
      const { $ } = window.GuixuDOM;

      container.addEventListener('click', async (e) => {
        const target = e.target;
        const itemElement = target.closest('.inventory-item');
        if (!itemElement) return;

        let item;
        try {
          item = JSON.parse(itemElement.dataset.itemDetails.replace(/'/g, "'") || '{}');
        } catch {
          item = {};
        }
        const category = itemElement.dataset.category;

        if (target.classList.contains('item-equip-btn')) {
          const equipType = target.dataset.equipType; // zhuxiu/fuxiu 或空
          await this.equipItem(item, category, equipType);
        } else if (target.classList.contains('item-unequip-btn')) {
          const slotId = target.dataset.slotId;
          await this.unequipItem(slotId);
        } else if (target.classList.contains('item-use-btn')) {
          await this.useItem(item);
        } else if (target.classList.contains('item-discard-btn')) {
          await this.discardItem(item, category);
        } else if (target.classList.contains('item-delete-btn')) {
          await this.deleteItem(item, category);
        }
      });
    },

    // 逻辑：装备
    async equipItem(item, category, equipType = null) {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      const h = window.GuixuHelpers;
      const state = window.GuixuState.getState();
      const equipped = { ...(state.equippedItems || {}) };

      const itemId = h.SafeGetValue(item, 'id');
      if (!itemId || itemId === 'N/A') {
        h.showTemporaryMessage('物品无ID，无法装备。');
        return;
      }

      // 分类映射
      const categoryMap = { 武器: 'wuqi', 防具: 'fangju', 饰品: 'shipin', 法宝: 'fabao1', 功法: equipType === 'zhuxiu' ? 'zhuxiuGongfa' : equipType === 'fuxiu' ? 'fuxiuXinfa' : null };
      const slotKey = categoryMap[category];
      if (!slotKey) {
        h.showTemporaryMessage('错误的装备分类或类型。');
        return;
      }

      // 同一物品若在其他槽位，先卸下
      const currentSlot = Object.keys(equipped).find(k => equipped[k]?.id === itemId);
      if (currentSlot && currentSlot !== slotKey) {
        await this.unequipItem(`equip-${currentSlot}`, false);
      }

      // 如果目标槽位已有装备，先卸下
      if (equipped[slotKey]) {
        await this.unequipItem(`equip-${slotKey}`, false);
      }

      // 更新状态
      equipped[slotKey] = item;
      window.GuixuState.update('equippedItems', equipped);

      // 更新槽位DOM
      const slotEl = $(`#equip-${slotKey}`);
      if (slotEl) {
        const tier = h.SafeGetValue(item, 'tier', '凡品');
        const tierStyle = h.getTierStyle(tier);
        slotEl.textContent = h.SafeGetValue(item, 'name');
        slotEl.setAttribute('style', tierStyle);
        slotEl.classList.add('equipped');
        slotEl.dataset.itemDetails = JSON.stringify(item).replace(/'/g, "'");
      }

      // 实时写入装备到变量
      await this.persistEquipmentToVariables(slotKey, item);

      // 加入指令队列
      const pending = [...(state.pendingActions || [])];
      const itemName = h.SafeGetValue(item, 'name');
      const defaultTextMap = {
        wuqi: '武器',
        fangju: '防具',
        shipin: '饰品',
        fabao1: '法宝',
        zhuxiuGongfa: '主修功法',
        fuxiuXinfa: '辅修心法',
      };
      // 去重
      const filtered = pending.filter(a => !(a.action === 'equip' && a.itemName === itemName));
      filtered.push({ action: 'equip', itemName, category: defaultTextMap[slotKey] || category });
      window.GuixuState.update('pendingActions', filtered);

      window.GuixuHelpers.showTemporaryMessage(`已装备 ${window.GuixuHelpers.SafeGetValue(item, 'name')}`);

      // 重新渲染
      await this.show();
      // 刷新属性展示（若需要）
      if (window.GuixuAttributeService?.updateDisplay) window.GuixuAttributeService.updateDisplay();
    },

    // 逻辑：卸下
    async unequipItem(slotId, refresh = true) {
      const $ = (sel, ctx = document) => ctx.querySelector(sel);
      const h = window.GuixuHelpers;
      const state = window.GuixuState.getState();
      const equipped = { ...(state.equippedItems || {}) };
      const slotKey = (slotId || '').replace('equip-', '');

      const slotEl = $(`#equip-${slotKey}`);
      if (!slotEl) return;

      let itemName = '一件装备';
      try {
        const item = JSON.parse((slotEl.dataset.itemDetails || '').replace(/'/g, "'") || '{}');
        itemName = h.SafeGetValue(item, 'name', itemName);
      } catch {}

      // 清状态
      equipped[slotKey] = null;
      window.GuixuState.update('equippedItems', equipped);

      // 清UI
      const defaultTextMap = {
        wuqi: '武器',
        fangju: '防具',
        shipin: '饰品',
        fabao1: '法宝',
        zhuxiuGongfa: '主修功法',
        fuxiuXinfa: '辅修心法',
      };
      slotEl.textContent = defaultTextMap[slotKey] || '空';
      slotEl.classList.remove('equipped');
      slotEl.removeAttribute('style');
      delete slotEl.dataset.itemDetails;

      // 实时写回变量（清空该槽位）
      await this.persistEquipmentToVariables(slotKey, null);

      // 加队列
      const pending = [...(state.pendingActions || [])].filter(a => !(a.action === 'unequip' && a.itemName === itemName));
      pending.push({ action: 'unequip', itemName, category: defaultTextMap[slotKey] });
      window.GuixuState.update('pendingActions', pending);

      window.GuixuHelpers.showTemporaryMessage(`已卸下 ${itemName}`);

      if (refresh) await this.show();
      if (window.GuixuAttributeService?.updateDisplay) window.GuixuAttributeService.updateDisplay();
    },

    // 逻辑：使用（数量类）
    async useItem(item) {
      const h = window.GuixuHelpers;
      const state = window.GuixuState.getState();
      const pending = [...(state.pendingActions || [])];

      const itemName = h.SafeGetValue(item, 'name');
      const originalQuantity = parseInt(h.SafeGetValue(item, 'quantity', 0), 10);
      const pendingUses = pending.filter(a => a.action === 'use' && a.itemName === itemName).reduce((t, a) => t + (a.quantity || 0), 0);

      if (originalQuantity - pendingUses <= 0) {
        h.showTemporaryMessage(`${itemName} 已用完或已在指令队列中。`);
        return;
      }

      const exist = pending.find(a => a.action === 'use' && a.itemName === itemName);
      if (exist) exist.quantity = (exist.quantity || 0) + 1;
      else pending.push({ action: 'use', itemName, quantity: 1 });

      window.GuixuState.update('pendingActions', pending);
      h.showTemporaryMessage(`已将 [使用 ${itemName}] 加入指令队列`);

      await this.show();
    },

    // 逻辑：丢弃（数量类/装备类）
    async discardItem(item, category) {
      const hasQuantity = Object.prototype.hasOwnProperty.call(item, 'quantity');
      if (hasQuantity && (category === '丹药' || category === '杂物')) {
        // 简化：采用浏览器 prompt
        const h = window.GuixuHelpers;
        const name = h.SafeGetValue(item, 'name');
        const state = window.GuixuState.getState();
        const pending = (state?.pendingActions || []);
        const currentQuantity = parseInt(h.SafeGetValue(item, 'quantity', 0), 10);
        const pendingUses = pending.filter(a => a.action === 'use' && a.itemName === name).reduce((t, a) => t + (a.quantity || 0), 0);
        const pendingDiscards = pending.filter(a => a.action === 'discard' && a.itemName === name).reduce((t, a) => t + (a.quantity || 0), 0);
        const available = currentQuantity - pendingUses - pendingDiscards;
        if (available <= 0) {
          h.showTemporaryMessage(`${name} 没有可丢弃的数量。`);
          return;
        }

        const input = prompt(`请输入要丢弃的数量（1-${available}）：`, '1');
        const qty = parseInt(input || '0', 10);
        if (!qty || qty <= 0 || qty > available) {
          h.showTemporaryMessage('无效的数量');
          return;
        }
        await this.confirmDiscardItem(item, category, qty);
      } else {
        await this.confirmDiscardItem(item, category, 1);
      }
    },

    async confirmDiscardItem(item, category, quantity = 1) {
      const h = window.GuixuHelpers;
      const name = h.SafeGetValue(item, 'name');

      const state = window.GuixuState.getState();
      const pending = [...(state.pendingActions || [])];
      pending.push({ action: 'discard', itemName: name, category, quantity });

      window.GuixuState.update('pendingActions', pending);

      if (quantity > 1) h.showTemporaryMessage(`已将 [丢弃 ${quantity} 个 ${name}] 加入指令队列`);
      else h.showTemporaryMessage(`已将 [丢弃 ${name}] 加入指令队列`);

      await this.show();
    },

    // 逻辑：彻底删除（直接修改数据）
    async deleteItem(item, category) {
      const h = window.GuixuHelpers;
      const itemName = h.SafeGetValue(item, 'name', '未知物品');
      const itemId = h.SafeGetValue(item, 'id');

      const confirmed = await new Promise(resolve => 
        window.GuixuMain.showCustomConfirm(
          `确定要彻底删除【${itemName}】吗？此操作不可逆，将直接从角色数据中移除，且不会通知AI。`,
          () => resolve(true),
          () => resolve(false)
        )
      );

      if (!confirmed) {
        h.showTemporaryMessage('操作已取消');
        return;
      }

      try {
        // 1. 获取当前最新的 stat_data
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        if (!messages || !messages[0] || !messages[0].data || !messages[0].data.stat_data) {
          throw new Error('无法获取角色数据。');
        }
        const currentMvuState = messages[0].data;
        const stat_data = currentMvuState.stat_data;

        // 2. 找到对应的列表并删除项目
        const categoryMap = {
          '功法': '功法列表', '武器': '武器列表', '防具': '防具列表',
          '饰品': '饰品列表', '法宝': '法宝列表', '丹药': '丹药列表', '杂物': '其他列表'
        };
        const listKey = categoryMap[category];
        if (!listKey || !stat_data[listKey] || !Array.isArray(stat_data[listKey][0])) {
          throw new Error(`找不到对应的物品列表: ${listKey}`);
        }

        const list = stat_data[listKey][0];
        const itemIndex = list.findIndex(i => {
          const parsed = typeof i === 'string' ? JSON.parse(i) : i;
          // 优先使用ID匹配，如果ID不存在或不匹配，则使用名称进行模糊匹配
          if (itemId && itemId !== 'N/A') {
            return parsed.id === itemId;
          }
          return parsed.name === itemName;
        });

        if (itemIndex === -1) {
          throw new Error(`在列表中未找到物品: ${itemName}`);
        }

        // 从数组中移除
        list.splice(itemIndex, 1);

        // 3. 将修改后的数据写回
        await window.GuixuAPI.setChatMessages([{
          message_id: 0,
          data: currentMvuState,
        }], { refresh: 'none' });

        // 若该物品正被装备，立即清空对应槽位（变量 + 状态 + UI）
        try {
          const state = window.GuixuState.getState();
          const equipped = { ...(state.equippedItems || {}) };
          const slots = ['wuqi', 'fangju', 'shipin', 'fabao1', 'zhuxiuGongfa', 'fuxiuXinfa'];
          for (const slotKey of slots) {
            const eq = equipped[slotKey];
            if (eq && ((itemId && eq.id === itemId) || eq.name === itemName)) {
              equipped[slotKey] = null;
              // 写回变量
              await this.persistEquipmentToVariables(slotKey, null);
              // 更新槽位UI（兜底，避免等待全量刷新）
              const $ = (sel, ctx = document) => ctx.querySelector(sel);
              const slotEl = $(`#equip-${slotKey}`);
              if (slotEl) {
                const defaultTextMap = {
                  wuqi: '武器',
                  fangju: '防具',
                  shipin: '饰品',
                  fabao1: '法宝',
                  zhuxiuGongfa: '主修功法',
                  fuxiuXinfa: '辅修心法',
                };
                slotEl.textContent = defaultTextMap[slotKey] || '空';
                slotEl.classList.remove('equipped');
                slotEl.removeAttribute('style');
                delete slotEl.dataset.itemDetails;
              }
            }
          }
          window.GuixuState.update('equippedItems', equipped);
        } catch (clearErr) {
          console.warn('[归墟] 删除物品后清理装备槽位失败:', clearErr);
        }

        h.showTemporaryMessage(`【${itemName}】已彻底删除。`);

        // 4. 刷新UI
        await this.show();
        // 同步主界面
        if (window.GuixuMain?.updateDynamicData) {
          window.GuixuMain.updateDynamicData();
        }

      } catch (error) {
        console.error('彻底删除物品时出错:', error);
        h.showTemporaryMessage(`删除失败: ${error.message}`);
      }
    },

    // 将装备变动实时写入到酒馆变量（当前楼层与第0楼）
    async persistEquipmentToVariables(slotKey, itemOrNull) {
      try {
        const currentId = window.GuixuAPI.getCurrentMessageId();
        const messages = await window.GuixuAPI.getChatMessages(currentId);
        if (!messages || !messages[0]) return;
        const currentMvuState = messages[0].data || {};
        currentMvuState.stat_data = currentMvuState.stat_data || {};
        const mvuKey = this.getMvuKeyForSlotKey(slotKey);
        if (!mvuKey) return;

        // 设置或清空装备
        if (itemOrNull) {
          currentMvuState.stat_data[mvuKey] = [itemOrNull];
        } else {
          currentMvuState.stat_data[mvuKey] = [];
        }

        // 写回当前楼层与第0楼
        const updates = [{ message_id: currentId, data: currentMvuState }];
        if (currentId !== 0) updates.push({ message_id: 0, data: currentMvuState });
        await window.GuixuAPI.setChatMessages(updates, { refresh: 'none' });

        // 同步前端缓存
        window.GuixuState.update('currentMvuState', currentMvuState);
      } catch (e) {
        console.warn('[归墟] persistEquipmentToVariables 失败:', e);
      }
    },

    getMvuKeyForSlotKey(slotKey) {
      const map = {
        wuqi: '武器',
        zhuxiuGongfa: '主修功法',
        fuxiuXinfa: '辅修心法',
        fangju: '防具',
        shipin: '饰品',
        fabao1: '法宝栏1',
      };
      return map[slotKey] || null;
    },
  };

  window.InventoryComponent = InventoryComponent;
})(window);
