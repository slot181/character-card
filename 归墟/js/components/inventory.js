// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  if (!window.GuixuDOM || !window.GuixuBaseModal || !window.GuixuAPI || !window.GuixuHelpers) {
    console.error('[归墟] InventoryComponent 初始化失败：缺少依赖(GuixuDOM/GuixuBaseModal/GuixuAPI/GuixuHelpers)。');
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

        // 直接使用组件内渲染逻辑，彻底去耦合 GuixuManager.renderInventory
        body.innerHTML = this.render(stat_data || {});
      } catch (error) {
        console.error('[归墟] 加载背包时出错:', error);
        body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载背包时出错: ${error.message}</p>`;
      }
    },

    render(stat_data) {
      const gm = window.GuixuManager;
      const h = window.GuixuHelpers;

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
              const pendingUses = (gm?.pendingActions || [])
                .filter(action => action.action === 'use' && action.itemName === name)
                .reduce((total, action) => total + action.quantity, 0);
              const pendingDiscards = (gm?.pendingActions || [])
                .filter(action => action.action === 'discard' && action.itemName === name)
                .reduce((total, action) => total + action.quantity, 0);
              const displayQuantity = quantity - pendingUses - pendingDiscards;

              // 数量用尽/丢弃后隐藏
              if (hasQuantity && displayQuantity <= 0) return;
              if (!hasQuantity && pendingDiscards > 0) return;

              const tierStyle = h.getTierStyle(tier);
              const tierDisplay = tier !== '无' ? `<span style="${tierStyle} margin-right: 15px;">品阶: ${tier}</span>` : '';
              const quantityDisplay = hasQuantity ? `<span class="item-quantity">数量: ${displayQuantity}</span>` : '';

              // 是否已装备
              const isEquipped = id ? Object.values(gm?.equippedItems || {}).some(eq => eq && eq.id === id) : false;
              let actionButton = '';

              if (cat.title === '功法') {
                const isEquippedAsMain = id && gm?.equippedItems?.zhuxiuGongfa && gm.equippedItems.zhuxiuGongfa.id === id;
                const isEquippedAsAux = id && gm?.equippedItems?.fuxiuXinfa && gm.equippedItems.fuxiuXinfa.id === id;

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
                  const slotKey = Object.keys(gm?.equippedItems || {}).find(
                    key => gm.equippedItems[key] && gm.equippedItems[key].id === id
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

              // 所有物品都可丢弃
              actionButton += `<button class="item-discard-btn" style="margin-left: 5px; background: #8b0000; border-color: #ff6b6b;">丢弃</button>`;

              // 细节说明使用 Manager 的已有渲染函数，避免重复实现
              const itemDetailsHtml = (gm && typeof gm.renderItemDetailsForInventory === 'function')
                ? gm.renderItemDetailsForInventory(item)
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
    }
  };

  window.InventoryComponent = InventoryComponent;
})(window);
