/**
 * 归墟 - 背包UI组件
 * 负责渲染和管理背包模态框内的所有交互。
 * 挂载到 window.GuixuUI.inventory
 */
(function (global) {
  'use strict';

  const DOM = global.GuixuDOM;
  const Modal = global.GuixuModal;
  // 依赖主管理器获取数据和方法
  const getManager = () => global.GuixuManager;

  if (!DOM || !Modal) {
    console.error('[归墟] InventoryUI 组件无法初始化：缺少核心UI依赖。');
    return;
  }

  const h = DOM.h;

  class InventoryUI {
    constructor() {
      this.modal = new Modal('inventory-modal', '我的背包');
      this._bindEvents();
    }

    _bindEvents() {
      // **问题1修复**: 不在构造时获取Manager，而是在事件回调中获取
      this.modal.getBody().addEventListener('click', (e) => {
        const Manager = getManager();
        if (!Manager) {
          console.error('[归墟背包] 事件处理失败：GuixuManager 未找到。');
          return;
        }

        const target = e.target;
        const itemElement = target.closest('.inventory-item');
        if (!itemElement) return;

        const itemData = JSON.parse(itemElement.dataset.itemDetails.replace(/'/g, "'") || '{}');
        const category = itemElement.dataset.category;

        if (target.classList.contains('item-equip-btn')) {
          const equipType = target.dataset.equipType; // 'zhuxiu' or 'fuxiu'
          Manager.equipItem(itemData, category, target, equipType);
        } else if (target.classList.contains('item-use-btn')) {
          Manager.useItem(itemData, target);
        } else if (target.classList.contains('item-unequip-btn')) {
          const slotId = target.dataset.slotId;
          const slotElement = document.getElementById(slotId);
          if (slotElement) {
            Manager.unequipItem(slotId, slotElement, true, true);
          }
        } else if (target.classList.contains('item-discard-btn')) {
          Manager.discardItem(itemData, category, itemElement);
        }
      });
    }

    async show() {
      const Manager = getManager();
      if (!Manager) {
        this.modal.renderBody(h('p', { classNames: ['modal-placeholder'], style: 'text-align:center; color:red;', text: '错误：主管理器 GuixuManager 未加载。' }));
        this.modal.show();
        return;
      }

      this.modal.renderBody(h('p', { classNames: ['modal-placeholder'], style: 'text-align:center; color:#8b7355; font-size:12px;', text: '正在清点行囊...' }));
      this.modal.show();

      try {
        // 直接从主管理器获取缓存的状态，而不是重新API调用
        const stat_data = _.get(Manager.currentMvuState, 'stat_data');

        if (!stat_data) {
          this.modal.renderBody(h('p', { classNames: ['modal-placeholder'], style: 'text-align:center; color:#8b7355; font-size:12px;', text: '无法获取背包数据。' }));
          return;
        }
        const inventoryContent = this.render(stat_data);
        this.modal.renderBody(inventoryContent);
      } catch (error) {
        console.error('加载背包时出错:', error);
        this.modal.renderBody(h('p', { classNames: ['modal-placeholder'], style: 'text-align:center; color:#8b7355; font-size:12px;', text: `加载背包时出错: ${error.message}` }));
      }
    }

    render(stat_data) {
      const Manager = getManager();
      if (!Manager) return h('p', { text: '错误' });

      if (!stat_data || Object.keys(stat_data).length === 0) {
        return h('p', { classNames: ['modal-placeholder'], style: 'text-align:center; color:#8b7355; font-size:12px;', text: '背包数据为空。' });
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

      const categoryElements = categories.map(cat => {
        const rawItems = _.get(stat_data, `${cat.key}[0]`);
        let itemsContent;

        if (Array.isArray(rawItems) && rawItems.length > 0 && rawItems[0] !== '$__META_EXTENSIBLE__$') {
          const parsedItems = [];
          rawItems.forEach(rawItem => {
            try {
              if (!rawItem) return;
              const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
              if (item && typeof item === 'object') parsedItems.push(item);
            } catch (e) { console.error('解析背包物品失败:', rawItem, e); }
          });

          const sortedItems = Manager.sortByTier(parsedItems, (item) => Manager.SafeGetValue(item, 'tier', '凡品'));

          const itemElements = sortedItems.map(item => this._renderItem(item, cat)).filter(Boolean);
          itemsContent = h('div', { classNames: ['inventory-item-list'], children: itemElements });

        } else {
          itemsContent = h('div', { classNames: ['inventory-item-list'], children: [h('p', { classNames: ['empty-category-text'], text: '空空如也' })] });
        }

        return h('details', { classNames: ['inventory-category'], attributes: { open: true } }, [
          h('summary', { classNames: ['inventory-category-title'], text: cat.title }),
          itemsContent
        ]);
      });

      return h('div', { children: categoryElements });
    }

    _renderItem(item, categoryConfig) {
      const Manager = getManager();
      if (!Manager) return null;

      const itemJson = JSON.stringify(item).replace(/'/g, "'");
      const name = Manager.SafeGetValue(item, 'name', '未知物品');
      const id = Manager.SafeGetValue(item, 'id', null);
      const tier = Manager.SafeGetValue(item, 'tier', '无');
      const hasQuantity = item.hasOwnProperty('quantity');
      const quantity = parseInt(Manager.SafeGetValue(item, 'quantity', 1), 10);
      const description = Manager.SafeGetValue(item, 'description', Manager.SafeGetValue(item, 'effect', '无描述'));

      const pendingUses = Manager.pendingActions.filter(a => a.action === 'use' && a.itemName === name).reduce((t, a) => t + a.quantity, 0);
      const pendingDiscards = Manager.pendingActions.filter(a => a.action === 'discard' && a.itemName === name).reduce((t, a) => t + a.quantity, 0);
      const displayQuantity = quantity - pendingUses - pendingDiscards;

      if ((hasQuantity && displayQuantity <= 0) || (!hasQuantity && pendingDiscards > 0)) {
        return null;
      }

      const tierStyle = Manager.getTierStyle(tier);
      const tierDisplay = tier !== '无' ? h('span', { style: `${tierStyle} margin-right: 15px;`, text: `品阶: ${tier}` }) : null;
      const quantityDisplay = hasQuantity ? h('span', { classNames: ['item-quantity'], text: `数量: ${displayQuantity}` }) : null;

      const actionButtons = this._renderActionButtons(item, id, categoryConfig, displayQuantity);
      const itemDetailsHtml = Manager.renderItemDetailsForInventory(item);

      return h('div', {
        classNames: ['inventory-item'],
        attributes: { 'data-item-details': itemJson, 'data-category': categoryConfig.title },
        children: [
          h('div', {
            classNames: ['item-header'],
            children: [
              h('div', {
                classNames: ['item-name-desc'],
                children: [
                  h('span', { classNames: ['item-name'], style: tierStyle, text: name }),
                  h('div', { classNames: ['item-description'], text: description })
                ]
              }),
              h('div', {
                classNames: ['item-meta'],
                style: 'text-align: right; white-space: nowrap; display: flex; align-items: center;',
                children: [tierDisplay, quantityDisplay, ...actionButtons].filter(Boolean)
              })
            ]
          }),
          itemDetailsHtml ? h('div', { classNames: ['item-details'], html: itemDetailsHtml }) : null
        ].filter(Boolean)
      });
    }

    _renderActionButtons(item, itemId, categoryConfig, displayQuantity) {
      const Manager = getManager();
      if (!Manager) return [];

      const buttons = [];
      const isEquipped = itemId ? Object.values(Manager.equippedItems).some(eq => eq && eq.id === itemId) : false;

      if (categoryConfig.title === '功法') {
        const isMain = Manager.equippedItems.zhuxiuGongfa && Manager.equippedItems.zhuxiuGongfa.id === itemId;
        const isAux = Manager.equippedItems.fuxiuXinfa && Manager.equippedItems.fuxiuXinfa.id === itemId;
        if (isMain) {
          buttons.push(h('button', { classNames: ['item-unequip-btn'], attributes: { 'data-slot-id': 'equip-zhuxiuGongfa' }, style: 'margin-left: 5px;', text: '卸下' }));
          buttons.push(h('button', { classNames: ['item-equip-btn'], attributes: { 'data-equip-type': 'fuxiu', disabled: true }, style: 'margin-left: 5px; opacity: 0.5; cursor: not-allowed;', text: '辅修' }));
        } else if (isAux) {
          buttons.push(h('button', { classNames: ['item-equip-btn'], attributes: { 'data-equip-type': 'zhuxiu', disabled: true }, style: 'margin-left: 5px; opacity: 0.5; cursor: not-allowed;', text: '主修' }));
          buttons.push(h('button', { classNames: ['item-unequip-btn'], attributes: { 'data-slot-id': 'equip-fuxiuXinfa' }, style: 'margin-left: 5px;', text: '卸下' }));
        } else {
          buttons.push(h('button', { classNames: ['item-equip-btn'], attributes: { 'data-equip-type': 'zhuxiu' }, style: 'margin-left: 5px;', text: '主修' }));
          buttons.push(h('button', { classNames: ['item-equip-btn'], attributes: { 'data-equip-type': 'fuxiu' }, style: 'margin-left: 5px;', text: '辅修' }));
        }
      } else if (categoryConfig.equipable) {
        if (isEquipped) {
          const slotKey = Object.keys(Manager.equippedItems).find(key => Manager.equippedItems[key] && Manager.equippedItems[key].id === itemId);
          buttons.push(h('button', { classNames: ['item-unequip-btn'], attributes: { 'data-slot-id': `equip-${slotKey}` }, text: '卸下' }));
        } else {
          buttons.push(h('button', { classNames: ['item-equip-btn'], text: '装备' }));
        }
      } else if (categoryConfig.title === '丹药' || categoryConfig.title === '杂物') {
        buttons.push(h('button', { classNames: ['item-use-btn'], attributes: { disabled: displayQuantity <= 0 }, text: displayQuantity <= 0 ? '已用完' : '使用' }));
      }

      buttons.push(h('button', { classNames: ['item-discard-btn'], style: 'margin-left: 5px; background: #8b0000; border-color: #ff6b6b;', text: '丢弃' }));

      return buttons;
    }
  }

  // 挂载到全局命名空间
  global.GuixuUI = global.GuixuUI || {};
  global.GuixuUI.inventory = new InventoryUI();

})(window);
