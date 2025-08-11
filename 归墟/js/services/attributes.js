// /js/services/attributes.js
// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
    'use strict';

    // 依赖检查
    if (!window.GuixuState || !window.GuixuHelpers || !window.GuixuAPI) {
        console.error('AttributeService 依赖 GuixuState, GuixuHelpers, 和 GuixuAPI。');
        return;
    }

    const AttributeService = {
        /**
         * 计算并返回所有角色的最终属性。
         * 这是该服务的主要入口点。
         * @returns {object} 包含计算后的当前属性和最大属性的对象
         * {
         *   current: { fali, shenhai, daoxin, kongsu },
         *   max: { fali, shenhai, daoxin, kongsu, qiyun }
         * }
         */
        calculateFinalAttributes() {
            const state = window.GuixuState.getState();
            if (!state.currentMvuState || !state.currentMvuState.stat_data) {
                console.warn('无法计算属性：mvu状态不可用。');
                return {
                    current: { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0 },
                    max: { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 }
                };
            }

            const stat_data = state.currentMvuState.stat_data;

            // 1. 获取基础属性
            const baseAttrs = {
                fali: parseInt(GuixuHelpers.SafeGetValue(stat_data, '基础法力.0', 0), 10),
                shenhai: parseInt(GuixuHelpers.SafeGetValue(stat_data, '基础神海.0', 0), 10),
                daoxin: parseInt(GuixuHelpers.SafeGetValue(stat_data, '基础道心.0', 0), 10),
                kongsu: parseInt(GuixuHelpers.SafeGetValue(stat_data, '基础空速.0', 0), 10),
                qiyun: parseInt(GuixuHelpers.SafeGetValue(stat_data, '基础气运.0', 0), 10),
            };

            // 2. 计算所有来源的加成
            const { totalFlatBonuses, totalPercentBonuses } = this.calculateAllBonuses(stat_data, state.equippedItems);

            // 3. 计算最终上限: 上限 = (基础 + Σ固定) * (1 + Σ百分比)
            const calculatedMaxAttrs = {
                fali: Math.floor((baseAttrs.fali + totalFlatBonuses.fali) * (1 + totalPercentBonuses.fali)),
                shenhai: Math.floor((baseAttrs.shenhai + totalFlatBonuses.shenhai) * (1 + totalPercentBonuses.shenhai)),
                daoxin: Math.floor((baseAttrs.daoxin + totalFlatBonuses.daoxin) * (1 + totalPercentBonuses.daoxin)),
                kongsu: Math.floor((baseAttrs.kongsu + totalFlatBonuses.kongsu) * (1 + totalPercentBonuses.kongsu)),
                qiyun: Math.floor((baseAttrs.qiyun + totalFlatBonuses.qiyun) * (1 + totalPercentBonuses.qiyun)),
            };
            
            // 更新到全局状态缓存
            state.update('calculatedMaxAttributes', calculatedMaxAttrs);

            // 4. 获取当前值，并确保不超过新计算的上限
            const currentAttrs = {
                fali: Math.min(parseInt(GuixuHelpers.SafeGetValue(stat_data, '当前法力.0', 0), 10), calculatedMaxAttrs.fali),
                shenhai: Math.min(parseInt(GuixuHelpers.SafeGetValue(stat_data, '当前神海.0', 0), 10), calculatedMaxAttrs.shenhai),
                daoxin: Math.min(parseInt(GuixuHelpers.SafeGetValue(stat_data, '当前道心.0', 0), 10), calculatedMaxAttrs.daoxin),
                kongsu: Math.min(parseInt(GuixuHelpers.SafeGetValue(stat_data, '当前空速.0', 0), 10), calculatedMaxAttrs.kongsu),
            };

            return {
                current: currentAttrs,
                max: calculatedMaxAttrs
            };
        },

        /**
         * 从所有来源（装备、天赋、灵根）收集属性加成。
         * @param {object} stat_data - 从MVU获取的stat_data对象。
         * @param {object} equippedItems - 当前已装备的物品对象。
         * @returns {object} 包含总固定加成和总百分比加成的对象。
         */
        calculateAllBonuses(stat_data, equippedItems) {
            const totalFlatBonuses = { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 };
            const totalPercentBonuses = { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 };
            const attributeMapping = { '法力': 'fali', '神海': 'shenhai', '道心': 'daoxin', '空速': 'kongsu', '气运': 'qiyun' };

            const processItemBonuses = (item) => {
                if (!item || typeof item !== 'object') return;

                // 处理固定加成
                const flatBonuses = item.attributes_bonus;
                if (flatBonuses && typeof flatBonuses === 'object') {
                    for (const [attrName, bonusValue] of Object.entries(flatBonuses)) {
                        const attrKey = attributeMapping[attrName];
                        if (attrKey) {
                            totalFlatBonuses[attrKey] += parseInt(bonusValue, 10) || 0;
                        }
                    }
                }

                // 处理百分比加成
                const percentBonuses = item['百分比加成'];
                if (percentBonuses && typeof percentBonuses === 'object') {
                    for (const [attrName, bonusValue] of Object.entries(percentBonuses)) {
                        const attrKey = attributeMapping[attrName];
                        if (attrKey) {
                            totalPercentBonuses[attrKey] += parseFloat(String(bonusValue).replace('%', '')) / 100 || 0;
                        }
                    }
                }
            };

            // 1. 收集装备加成
            Object.values(equippedItems).forEach(processItemBonuses);

            // 2. 收集天赋加成
            const tianfuList = GuixuAPI.lodash.get(stat_data, '天赋列表.0', []);
            if (Array.isArray(tianfuList)) {
                tianfuList.forEach(tianfu => {
                    if (typeof tianfu === 'object' && tianfu !== null) processItemBonuses(tianfu);
                });
            }

            // 3. 收集灵根加成
            const linggenListData = GuixuAPI.lodash.get(stat_data, '灵根列表.0', []);
            if (Array.isArray(linggenListData)) {
                linggenListData.forEach(rawLinggen => {
                    try {
                        if (!rawLinggen || rawLinggen === '$__META_EXTENSIBLE__$') return;
                        const linggen = typeof rawLinggen === 'string' ? JSON.parse(rawLinggen) : rawLinggen;
                        if (linggen && typeof linggen === 'object') {
                            processItemBonuses(linggen);
                        }
                    } catch (e) {
                        console.error('处理灵根加成时解析失败:', rawLinggen, e);
                    }
                });
            }

            return { totalFlatBonuses, totalPercentBonuses };
        },

        /**
         * 更新UI上显示的属性值。
         * 这是该服务与UI交互的接口。
         */
        updateDisplay() {
            const { current, max } = this.calculateFinalAttributes();
            const state = window.GuixuState.getState();
            const stat_data = state.currentMvuState?.stat_data;

            if (!stat_data) {
                console.warn('无法更新属性显示：stat_data 不可用。');
                return;
            }

            const updateText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.innerText = value;
            };

            updateText('attr-fali', `${current.fali}/${max.fali}`);
            updateText('attr-shenhai', `${current.shenhai}/${max.shenhai}`);
            updateText('attr-daoxin', `${current.daoxin}/${max.daoxin}`);
            updateText('attr-kongsu', `${current.kongsu}/${max.kongsu}`);
            updateText('attr-qiyun', `${max.qiyun}`);

            // 更新年龄
            const shengli = GuixuHelpers.SafeGetValue(stat_data, '生理年龄.0', 'N/A');
            const shengliMax = GuixuHelpers.SafeGetValue(stat_data, '生理年龄上限.0', 'N/A');
            const xinli = GuixuHelpers.SafeGetValue(stat_data, '心理年龄.0', 'N/A');
            const xinliMax = GuixuHelpers.SafeGetValue(stat_data, '心理年龄上限.0', 'N/A');
            
            updateText('attr-shengli', `${shengli}/${shengliMax}`);
            updateText('attr-xinli', `${xinli}/${xinliMax}`);
        }
    };

    // 将服务挂载到 window 对象
    window.GuixuAttributeService = AttributeService;

})(window);
