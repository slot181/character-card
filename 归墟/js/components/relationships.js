// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  if (!window.GuixuDOM || !window.GuixuBaseModal || !window.GuixuAPI || !window.GuixuHelpers) {
    console.error('[归墟] RelationshipsComponent 初始化失败：缺少依赖(GuixuDOM/GuixuBaseModal/GuixuAPI/GuixuHelpers)。');
    return;
  }

  const RelationshipsComponent = {
    async show() {
      const { $ } = window.GuixuDOM;
      window.GuixuBaseModal.open('relationships-modal');

      const body = $('#relationships-modal .modal-body');
      if (!body) return;

      body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在梳理人脉...</p>';

      try {
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        let stat_data = messages?.[0]?.data?.stat_data;
        if (window.GuixuMain && typeof window.GuixuMain._deepStripMeta === 'function') {
          stat_data = window.GuixuMain._deepStripMeta(stat_data);
        }
        if (!stat_data) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法获取人物关系数据。</p>';
          return;
        }

        let relationships = stat_data['人物关系列表']?.[0];

        // 兼容：字符串化 JSON
        if (typeof relationships === 'string') {
          try {
            relationships = JSON.parse(relationships);
          } catch (e) {
            console.error('[归墟] 解析人物关系列表字符串失败:', e);
            relationships = [];
          }
        }

        body.innerHTML = this.render(relationships || []);
      } catch (error) {
        console.error('[归墟] 加载人物关系时出错:', error);
        body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载人物关系时出错: ${error.message}</p>`;
      }
    },

    render(relationships) {
      const h = window.GuixuHelpers;

      if (!Array.isArray(relationships) || relationships.length === 0 || relationships[0] === '$__META_EXTENSIBLE__$') {
        return '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">红尘俗世，暂无纠葛。</p>';
      }

      let html = '';
      relationships.forEach(rawRel => {
        try {
          const rel = typeof rawRel === 'string' ? JSON.parse(rawRel) : rawRel;

          const name = h.SafeGetValue(rel, 'name', '未知之人');
          const tier = h.SafeGetValue(rel, 'tier', '凡人');
          const level = h.SafeGetValue(rel, '等级', '');
          const relationship = h.SafeGetValue(rel, 'relationship', '萍水相逢');
          const description = h.SafeGetValue(rel, 'description', '背景不详');
          const favorability = parseInt(h.SafeGetValue(rel, 'favorability', 0), 10);
          const eventHistory = rel.event_history || [];

          const tierStyle = h.getTierStyle(tier);
          const favorabilityPercent = Math.max(0, Math.min(100, (favorability / 200) * 100)); // 假设好感度上限为200
          const cultivationDisplay = level ? `${tier} ${level}` : tier;

          // 新增：关系类型与权限
          const relationshipType = String((relationship || 'NEUTRAL')).toUpperCase();
          const allowView = (String(h.SafeGetValue(rel, 'allow_view', false)).toLowerCase() === 'true') || h.SafeGetValue(rel, 'allow_view', false) === true;
          const allowTrade = (String(h.SafeGetValue(rel, 'allow_trade', false)).toLowerCase() === 'true') || h.SafeGetValue(rel, 'allow_trade', false) === true;

          const relJson = JSON.stringify(rel).replace(/'/g, "'");
          html += `
            <div class="relationship-card" data-relationship="${relationshipType}" data-relationship-details='${relJson}'>
              <div class="relationship-header">
                  <p class="relationship-name" style="${tierStyle}">${name}</p>
                  <div class="rel-actions">
                    <button class="btn-detail ${allowView ? 'primary' : ''}" ${allowView ? '' : 'disabled'}>详细</button>
                    <button class="btn-trade ${allowTrade ? 'primary' : ''}" ${allowTrade ? '' : 'disabled'}>交易</button>
                    <button class="btn-delete-relationship">删除</button>
                  </div>
              </div>
              <div class="relationship-body">
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
                          ${eventHistory
                            .filter(event => event !== '$__META_EXTENSIBLE__$' && event !== '...')
                            .map(event => `<li>${event}</li>`)
                            .join('')}
                        </ul>
                      </details>
                    `
                    : ''
                }
              </div>
            </div>
          `;
        } catch (e) {
          console.error('[归墟] 解析人物关系失败:', rawRel, e);
        }
      });

      return html || '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">红尘俗世，暂无纠葛。</p>';
    },

    bindEvents(container) {
        container.addEventListener('click', async (e) => {
            const card = e.target.closest('.relationship-card');
            const getRelFromCard = () => {
              if (!card) return null;
              try { return JSON.parse(card.dataset.relationshipDetails.replace(/'/g, "'")); } catch { return null; }
            };

            // 查看详细
            if (e.target.classList.contains('btn-detail')) {
              const relData = getRelFromCard();
              if (!relData) return;
              const allowView = (String(window.GuixuHelpers.SafeGetValue(relData, 'allow_view', false)).toLowerCase() === 'true') || window.GuixuHelpers.SafeGetValue(relData, 'allow_view', false) === true;
              if (!allowView) {
                window.GuixuHelpers.showTemporaryMessage('对方未授权查看详细信息（allow_view = false）');
                return;
              }
              await this.showCharacterDetails(relData);
              return;
            }

            // 交易
            if (e.target.classList.contains('btn-trade')) {
              const relData = getRelFromCard();
              if (!relData) return;
              const allowTrade = (String(window.GuixuHelpers.SafeGetValue(relData, 'allow_trade', false)).toLowerCase() === 'true') || window.GuixuHelpers.SafeGetValue(relData, 'allow_trade', false) === true;
              if (!allowTrade) {
                window.GuixuHelpers.showTemporaryMessage('该角色不接受交易（allow_trade = false）');
                return;
              }
              this.openTradePanel(relData);
              return;
            }

            // 删除
            if (e.target.classList.contains('btn-delete-relationship')) {
                if (card) {
                    const relData = getRelFromCard();
                    if (relData) await this.deleteRelationship(relData);
                }
                return;
            }
        });
    },

    async deleteRelationship(relToDelete) {
        const h = window.GuixuHelpers;
        const relName = h.SafeGetValue(relToDelete, 'name', '未知之人');

        const confirmed = await new Promise(resolve => 
            window.GuixuMain.showCustomConfirm(
                `确定要删除与【${relName}】的关系吗？此操作不可逆，将直接从角色数据中移除。`,
                () => resolve(true),
                () => resolve(false)
            )
        );

        if (!confirmed) {
            h.showTemporaryMessage('操作已取消');
            return;
        }

        try {
            const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
            if (!messages || !messages[0] || !messages[0].data || !messages[0].data.stat_data) {
                throw new Error('无法获取角色数据。');
            }
            const currentMvuState = messages[0].data;
            const stat_data = currentMvuState.stat_data;

            const listKey = '人物关系列表';
            if (!stat_data[listKey] || !Array.isArray(stat_data[listKey][0])) {
                throw new Error('找不到人物关系列表。');
            }

            const list = stat_data[listKey][0];
            const relIndex = list.findIndex(r => {
                const parsed = typeof r === 'string' ? JSON.parse(r) : r;
                return parsed.name === relName;
            });

            if (relIndex === -1) {
                throw new Error(`在列表中未找到人物: ${relName}`);
            }

            list.splice(relIndex, 1);

            await window.GuixuAPI.setChatMessages([{
                message_id: 0,
                data: currentMvuState,
            }], { refresh: 'none' });

            h.showTemporaryMessage(`与【${relName}】的关系已删除。`);
            await this.show();
            // 同步主界面（如有装备信息联动）
            if (window.GuixuMain?.updateDynamicData) {
              window.GuixuMain.updateDynamicData();
            }

        } catch (error) {
            console.error('删除人物关系时出错:', error);
            h.showTemporaryMessage(`删除失败: ${error.message}`);
        }
    },

    async show() {
      const { $ } = window.GuixuDOM;
      window.GuixuBaseModal.open('relationships-modal');

      const body = $('#relationships-modal .modal-body');
      if (!body) return;

      body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在梳理人脉...</p>';

      try {
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        let stat_data = messages?.[0]?.data?.stat_data;
        if (window.GuixuMain && typeof window.GuixuMain._deepStripMeta === 'function') {
          stat_data = window.GuixuMain._deepStripMeta(stat_data);
        }
        if (!stat_data) {
          body.innerHTML = '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法获取人物关系数据。</p>';
          return;
        }

        let relationships = stat_data['人物关系列表']?.[0];

        if (typeof relationships === 'string') {
          try {
            relationships = JSON.parse(relationships);
          } catch (e) {
            console.error('[归墟] 解析人物关系列表字符串失败:', e);
            relationships = [];
          }
        }

        body.innerHTML = this.render(relationships || []);
        this.bindEvents(body); // 重新绑定事件
      } catch (error) {
        console.error('[归墟] 加载人物关系时出错:', error);
        body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载人物关系时出错: ${error.message}</p>`;
      }
    },

    // 新增：角色详情面板
    async showCharacterDetails(rel) {
      try {
        const h = window.GuixuHelpers;
        const $ = window.GuixuDOM.$;
        // 使用最新存储中的人物对象，避免卡片dataset精简导致字段缺失
        try {
          const msgs = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
          const sd = (msgs?.[0]?.data?.stat_data) || {};
          const arr = (sd?.['人物关系列表']?.[0]) || [];
          const rid = h.SafeGetValue(rel, 'id', null);
          const rname = h.SafeGetValue(rel, 'name', null);
          const full = arr.map(x => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; } })
                         .find(o => o && ((rid != null && h.SafeGetValue(o, 'id', null) === rid) || (rname && h.SafeGetValue(o, 'name', null) === rname)));
          if (full) rel = full;
        } catch {}
        const name = h.SafeGetValue(rel, 'name', '未知之人');
        const tier = h.SafeGetValue(rel, 'tier', '凡人');
        const level = h.SafeGetValue(rel, '等级', '');
        const relationship = h.SafeGetValue(rel, 'relationship', 'NEUTRAL');
        const relationshipCN = RelationshipsComponent._toChineseRelationship(relationship);
        const favorability = parseInt(h.SafeGetValue(rel, 'favorability', 0), 10);

        // 四维（兼容字符串化 JSON，同时兼容数组包装或字符串数组）
        const parseMaybeJson = (v) => {
          if (typeof v === 'string') {
            const s = v.trim();
            if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
              try { 
                return JSON.parse(s); 
              } catch (e1) {
                // 兼容单引号/非严格 JSON：使用 Function 尝试解析
                try { 
                  return (new Function('return (' + s + ')'))(); 
                } catch (e2) {}
              }
            }
          }
          return v;
        };

        // 归一化字段：如果是数组则优先取第一个元素并尝试解析
        const normalizeField = (v) => {
          if (Array.isArray(v) && v.length > 0) {
            const first = v[0];
            // 若首项是字符串化 JSON，再解析
            return parseMaybeJson(first);
          }
          return parseMaybeJson(v);
        };

        // 基础/加成/当前 四维属性，可能是对象、字符串化 JSON 或包装在数组里
        const baseAttrs = (function () {
          const raw = h.SafeGetValue(rel, '基础四维属性', {}) || {};
          const n = normalizeField(raw) || {};
          return (typeof n === 'object' && !Array.isArray(n)) ? n : {};
        })();
        const attrs = (function () {
          const raw = h.SafeGetValue(rel, '四维属性', {}) || {};
          const n = normalizeField(raw) || {};
          return (typeof n === 'object' && !Array.isArray(n)) ? n : {};
        })();
        const curAttrs = (function () {
          const raw = h.SafeGetValue(rel, '当前四维属性', {}) || {};
          const n = normalizeField(raw) || {};
          return (typeof n === 'object' && !Array.isArray(n)) ? n : {};
        })();

        // 灵根/功法/天赋（兼容：对象、数组、字符串化 JSON、数组内字符串化 JSON）
        const inhRaw = h.SafeGetValue(rel, 'inherent_abilities', {}) || h.SafeGetValue(rel, '内在能力', {}) || {};
        const inh = (function () {
          const n = normalizeField(inhRaw) || {};
          return (typeof n === 'object' && !Array.isArray(n)) ? n : {};
        })();

        // 灵根有时为对象或数组，优先取第一个元素并解析
        let linggen = {};
        try {
          const lgRaw = inh['灵根'] || inh['灵根列表'] || inh['linggen'] || inh['灵根'] || {};
          if (Array.isArray(lgRaw) && lgRaw.length > 0) {
            linggen = parseMaybeJson(lgRaw[0]) || {};
          } else {
            linggen = normalizeField(lgRaw) || {};
          }
        } catch (e) { linggen = {}; }

        // 功法和天赋通常是数组，但可能被字符串化或包装在数组里
        let gongfaList = [];
        try {
          const gfRaw = inh['功法'] || inh['gongfa'] || [];
          if (Array.isArray(gfRaw)) {
            gongfaList = gfRaw.map(x => parseMaybeJson(x)).filter(Boolean);
          } else {
            const parsed = normalizeField(gfRaw);
            gongfaList = Array.isArray(parsed) ? parsed.map(x => parseMaybeJson(x)).filter(Boolean) : (parsed ? [parsed] : []);
          }
        } catch (e) { gongfaList = []; }

        let talentList = [];
        try {
          const tRaw = inh['天赋'] || inh['talent'] || [];
          if (Array.isArray(tRaw)) {
            talentList = tRaw.map(x => parseMaybeJson(x)).filter(Boolean);
          } else {
            const parsed = normalizeField(tRaw);
            talentList = Array.isArray(parsed) ? parsed.map(x => parseMaybeJson(x)).filter(Boolean) : (parsed ? [parsed] : []);
          }
        } catch (e) { talentList = []; }

        // 小工具：渲染KV
        const renderKV = (obj) => {
          if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
            return '<div class="attribute-item"><span class="attribute-name">无</span><span class="attribute-value">-</span></div>';
          }
          return Object.keys(obj).map(k => `
            <div class="attribute-item"><span class="attribute-name">${k}</span><span class="attribute-value">${obj[k]}</span></div>
          `).join('');
        };
        const renderList = (arr, titleKey = 'name', tierKey = 'tier', descKey = 'description') => {
          if (!Array.isArray(arr) || arr.length === 0) return '<div class="attribute-item"><span class="attribute-name">无</span><span class="attribute-value">-</span></div>';
          return arr.map(item => {
            const n = h.SafeGetValue(item, titleKey, h.SafeGetValue(item, '名称', '未知'));
            const t = h.SafeGetValue(item, tierKey, h.SafeGetValue(item, '品阶', '凡品'));
            const d = h.SafeGetValue(item, descKey, h.SafeGetValue(item, '描述', ''));
            const color = h.getTierColorStyle(t);
            return `
              <details class="details-container">
                <summary><span class="attribute-name">【${t}】</span><span class="attribute-value" style="${color}">${n}</span></summary>
                <div class="details-content">${d || '无描述'}</div>
              </details>
            `;
          }).join('');
        };

        const tierStyle = h.getTierStyle(tier);
        const cultivationDisplay = level ? `${tier} ${level}` : tier;

        const bodyHtml = `
          <div class="panel-section">
            <div class="section-title">基本信息</div>
            <div class="attributes-list">
              <div class="attribute-item"><span class="attribute-name">姓名</span><span class="attribute-value">${name}</span></div>
              <div class="attribute-item"><span class="attribute-name">修为</span><span class="attribute-value" style="${tierStyle}">${cultivationDisplay}</span></div>
              <div class="attribute-item"><span class="attribute-name">关系</span><span class="attribute-value">${relationshipCN}</span></div>
              <div class="attribute-item"><span class="attribute-name">好感度</span><span class="attribute-value">${favorability}</span></div>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-title">基础四维属性</div>
            <div class="attributes-list">${renderKV(baseAttrs)}</div>
          </div>
          <div class="panel-section">
            <div class="section-title">四维属性（加成后）</div>
            <div class="attributes-list">${renderKV(attrs)}</div>
          </div>
          <div class="panel-section">
            <div class="section-title">当前四维属性</div>
            <div class="attributes-list">${renderKV(curAttrs)}</div>
          </div>

          <div class="panel-section">
            <div class="section-title">灵根</div>
            <div class="attributes-list">
              ${linggen && (linggen.名称 || linggen.name) ? `
                <div class="attribute-item"><span class="attribute-name">名称</span><span class="attribute-value">${linggen.名称 || linggen.name}</span></div>
                <div class="attribute-item"><span class="attribute-name">品阶</span><span class="attribute-value">${linggen.品阶 || linggen.tier || '凡品'}</span></div>
                ${linggen.描述 || linggen.description ? `<div class="details-content">${linggen.描述 || linggen.description}</div>` : ''}
              ` : '<div class="attribute-item"><span class="attribute-name">无</span><span class="attribute-value">-</span></div>'}
            </div>
          </div>

          <div class="panel-section">
            <div class="section-title">功法</div>
            ${renderList(gongfaList)}
          </div>

          <div class="panel-section">
            <div class="section-title">天赋</div>
            ${renderList(talentList)}
          </div>
        `;

        window.GuixuBaseModal.open('character-details-modal');
        window.GuixuBaseModal.setTitle('character-details-modal', `角色详情 - ${name}`);
        window.GuixuBaseModal.setBodyHTML('character-details-modal', bodyHtml);
      } catch (e) {
        console.warn('[归墟] showCharacterDetails 失败:', e);
        window.GuixuHelpers.showTemporaryMessage('无法展示角色详情');
      }
    },

    // 新增：交易面板
    async openTradePanel(rel) {
      try {
        const h = window.GuixuHelpers;
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        const stat_data = (messages?.[0]?.data?.stat_data) || {};
        const userStones = Number(h.SafeGetValue(stat_data, '灵石', 0)) || 0;

        const name = h.SafeGetValue(rel, 'name', '未知之人');
        const favorability = parseInt(h.SafeGetValue(rel, 'favorability', 0), 10);
        // 获取最新NPC对象（避免面板复用导致的旧数据）
        const findRelNow = (sd) => {
          try {
            const arr = (sd?.['人物关系列表']?.[0]) || [];
            const rid = h.SafeGetValue(rel, 'id', null);
            const rname = h.SafeGetValue(rel, 'name', null);
            const found = arr.map(x => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; } })
              .find(o => o && ((rid != null && h.SafeGetValue(o, 'id', null) === rid) || (rname && h.SafeGetValue(o, 'name', null) === rname)));
            return found || rel;
          } catch { return rel; }
        };
        const relNow = findRelNow(stat_data);
        const theirStones = Number(h.SafeGetValue(relNow, '灵石', 0)) || 0;

        // 对方可出售的物品 + 我方背包
        const npcItems = Array.isArray(relNow?.物品列表) ? relNow.物品列表.filter(x => x && x !== '$__META_EXTENSIBLE__$') : [];
        // 汇总玩家背包内所有列表为一并展示（只读）
        const collectUserItems = (sd) => {
          const lists = ['功法列表','武器列表','防具列表','饰品列表','法宝列表','丹药列表','其他列表'];
          const out = [];
          try {
            lists.forEach(key => {
              const arr = sd?.[key]?.[0];
              if (Array.isArray(arr)) {
                arr.forEach(raw => {
                  if (!raw || raw === '$__META_EXTENSIBLE__$') return;
                  try { out.push(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch { /* ignore */ }
                });
              }
            });
          } catch {}
          return out;
        };
        const userItems = collectUserItems(stat_data);

        const renderNpcItemRow = (it) => {
          const n = h.SafeGetValue(it, 'name', '未知物品');
          const id = h.SafeGetValue(it, 'id', h.SafeGetValue(it, 'uid', 'N/A'));
          const t = h.SafeGetValue(it, 'tier', '无');
          const q = Number(h.SafeGetValue(it, 'quantity', 1)) || 1;
          const baseVal = Number(h.SafeGetValue(it, 'base_value', 0)) || 0;
          const meta = `品阶:${t} | 价值:${baseVal} | 库存:${q}`;
          const tierStyle = h.getTierStyle(t);
          return `
            <div class="trade-item" data-item-id="${id}">
              <span class="item-name" style="${tierStyle}">${n}</span>
              <span class="item-meta">${meta}</span>
              <button class="btn-purchase-item" data-item-id="${id}">购买</button>
            </div>
          `;
        };

        // 我方物品：展示名称/品阶/数量/价值，提供“出售”按钮
        const renderUserItemRow = (it) => {
          const n = h.SafeGetValue(it, 'name', '未知物品');
          const id = h.SafeGetValue(it, 'id', h.SafeGetValue(it, 'uid', 'N/A'));
          const t = h.SafeGetValue(it, 'tier', '无');
          const q = Number(h.SafeGetValue(it, 'quantity', 1)) || 1;
          const baseVal = Number(h.SafeGetValue(it, 'base_value', 0)) || 0;
          const tierStyle = h.getTierStyle(t);
          return `
            <div class="trade-item" data-item-id="${id}">
              <span class="item-name" style="${tierStyle}">${n}</span>
              <span class="item-meta">品阶:${t} | 数量:${q} | 价值:${baseVal}</span>
              <button class="btn-sell-item" data-item-id="${id}">出售</button>
            </div>
          `;
        };

        const bodyHtml = `
          <div class="trade-summary">
            <div class="trade-section">
              <div class="section-title">你的资产</div>
              <div class="attributes-list" style="padding:10px;">
                <div class="attribute-item"><span class="attribute-name">灵石</span><span class="attribute-value" id="trade-user-stones">${userStones}</span></div>
              </div>
            </div>
            <div class="trade-section">
              <div class="section-title">对方信息</div>
              <div class="attributes-list" style="padding:10px;">
                <div class="attribute-item"><span class="attribute-name">姓名</span><span class="attribute-value">${name}</span></div>
                <div class="attribute-item"><span class="attribute-name">好感度</span><span class="attribute-value">${favorability}</span></div>
                <div class="attribute-item"><span class="attribute-name">灵石</span><span class="attribute-value" id="trade-npc-stones">${theirStones}</span></div>
              </div>
            </div>
          </div>

          <div class="trade-section">
            <div class="section-title">物品列表</div>
            <div class="inventory-grid">
              <div>
                <div class="section-title" style="font-size:12px; margin-bottom:6px;">对方物品</div>
                ${npcItems.length ? npcItems.map(renderNpcItemRow).join('') : '<div class="empty-category-text">暂无</div>'}
              </div>
              <div>
                <div class="section-title" style="font-size:12px; margin-bottom:6px;">我的物品</div>
                ${userItems.length ? userItems.map(renderUserItemRow).join('') : '<div class="empty-category-text">暂无</div>'}
              </div>
            </div>
            <p style="color:#8b7355; margin-top:8px; font-size:12px;">提示：出价越接近物品基础价值，且好感度越高，成交越稳妥。</p>
            <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(201, 170, 113, 0.3);">
              <button id="btn-batch-fix-items" class="interaction-btn" style="padding: 8px 16px; font-size: 12px;">🔧 批量修复物品分类</button>
              <p style="color:#8b7355; font-size: 11px; margin-top: 5px;">如遇到物品分类错误，点击此按钮进行修复</p>
            </div>
          </div>
        `;

        window.GuixuBaseModal.open('trade-modal');
        window.GuixuBaseModal.setTitle('trade-modal', `交易面板 - ${name}`);
        window.GuixuBaseModal.setBodyHTML('trade-modal', bodyHtml);

        // 事件委托：购买
        const modalBody = document.querySelector('#trade-modal .modal-body');
        if (modalBody && !modalBody._bindTradePurchase) {
          modalBody._bindTradePurchase = true;
          modalBody.addEventListener('click', async (ev) => {
            // 购买对方物品
            const btnBuy = ev.target.closest('.btn-purchase-item');
            if (btnBuy) {
              const itemId = btnBuy.dataset.itemId;
              // 使用最新 NPC 数据定位物品，避免使用旧的 rel 导致找不到
              const messagesBuy = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
              const sdBuy = (messagesBuy?.[0]?.data?.stat_data) || {};
              const arrBuy = (sdBuy?.['人物关系列表']?.[0]) || [];
              const ridBuy = window.GuixuHelpers.SafeGetValue(rel, 'id', null);
              const rnameBuy = window.GuixuHelpers.SafeGetValue(rel, 'name', null);
              const relLatestBuy = arrBuy.map(x => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; } })
                .find(o => o && ((ridBuy != null && window.GuixuHelpers.SafeGetValue(o, 'id', null) === ridBuy) || (rnameBuy && window.GuixuHelpers.SafeGetValue(o, 'name', null) === rnameBuy))) || rel;
              const item = (() => {
                const list = Array.isArray(relLatestBuy?.物品列表) ? relLatestBuy.物品列表 : [];
                for (const raw of list) {
                  let it;
                  try { it = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { it = raw; }
                  if (!it) continue;
                  const id = String(window.GuixuHelpers.SafeGetValue(it, 'id', window.GuixuHelpers.SafeGetValue(it, 'uid', '')));
                  const name = String(window.GuixuHelpers.SafeGetValue(it, 'name', ''));
                  if (String(itemId) === id || (name && String(itemId) === name)) return it;
                }
                return null;
              })();
              if (!item) {
                console.error('[归墟] 购买失败：未找到该物品', { itemId, relLatestBuy });
                window.GuixuHelpers.showTemporaryMessage('未找到该物品');
                return;
              }

              // 数量选择（如果库存大于1）
              const maxQuantity = Number(window.GuixuHelpers.SafeGetValue(item, 'quantity', 1)) || 1;
              let purchaseQuantity = 1;
              if (maxQuantity > 1) {
                purchaseQuantity = await (window.GuixuMain?.showNumberPrompt
                  ? window.GuixuMain.showNumberPrompt({
                      title: '选择购买数量',
                      message: `【${window.GuixuHelpers.SafeGetValue(item, 'name', '未知物品')}】库存：${maxQuantity}，请选择购买数量`,
                      min: 1,
                      max: maxQuantity,
                      defaultValue: 1,
                    })
                  : Promise.resolve(parseInt(prompt(`请输入购买数量（库存：${maxQuantity}）`, '1') || '1', 10)));
                if (!Number.isFinite(purchaseQuantity) || purchaseQuantity <= 0 || purchaseQuantity > maxQuantity) {
                  window.GuixuHelpers.showTemporaryMessage('已取消或无效的数量');
                  return;
                }
              }

              // 出价输入（基础价值 x 数量）
              const baseVal = Number(window.GuixuHelpers.SafeGetValue(item, 'base_value', 0)) || 0;
              const totalBaseVal = baseVal * purchaseQuantity;
              const offer = await (window.GuixuMain?.showNumberPrompt
                ? window.GuixuMain.showNumberPrompt({
                    title: '出价（灵石）',
                    message: `为【${window.GuixuHelpers.SafeGetValue(item, 'name', '未知物品')} x${purchaseQuantity}】出价（基础价值：${totalBaseVal} 灵石）`,
                    min: 1,
                    max: 999999,
                    defaultValue: Math.max(1, totalBaseVal || 1),
                  })
                : Promise.resolve(parseInt(prompt(`请输入总出价（基础价值：${totalBaseVal}，数量：${purchaseQuantity}）`, String(totalBaseVal || 1)) || '0', 10)));
              if (!Number.isFinite(offer) || offer <= 0) {
                window.GuixuHelpers.showTemporaryMessage('已取消或无效的出价');
                return;
              }

              // 校验余额
              const messagesNow = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
              const currentStat = (messagesNow?.[0]?.data?.stat_data) || {};
              const myStones = Number(window.GuixuHelpers.SafeGetValue(currentStat, '灵石', 0)) || 0;
              if (offer > myStones) {
                window.GuixuHelpers.showTemporaryMessage('灵石不足，无法完成交易');
                return;
              }

              // 修复：传入批量购买的总基础价值进行价格合理性判断
              const success = RelationshipsComponent._computeTradeSuccess(offer, totalBaseVal, favorability);
              if (!success) {
                window.GuixuHelpers.showTemporaryMessage('对方摇头婉拒，或许提高出价/好感度再试。');
                return;
              }

              try {
                await RelationshipsComponent._applyTradeTransaction(rel, item, offer, purchaseQuantity);
                window.GuixuHelpers.showTemporaryMessage('交易成功！物品已入账');
                
                // 实时刷新相关界面
                await RelationshipsComponent._refreshAllRelatedUI();
                
                // 重新打开交易面板显示最新数据
                await RelationshipsComponent.openTradePanel(rel);
              } catch (err) {
                console.error('[归墟] 交易落账失败：', err);
                window.GuixuHelpers.showTemporaryMessage('交易失败：保存数据出错');
              }
              return;
            }

              // 出售我方物品
            const btnSell = ev.target.closest('.btn-sell-item');
            if (btnSell) {
              const itemId = btnSell.dataset.itemId;
              // 重新获取最新数据，避免使用缓存的旧数据
              const messagesLatest = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
              const latestStatData = (messagesLatest?.[0]?.data?.stat_data) || {};
              
              // 从玩家背包合并清单中查找（与渲染列表保持一致）
              // 改进：查找玩家物品时同时返回原数组索引与原始条目，避免后续写回时找不到对应位置
              const findUserItemById = () => {
                const lists = ['功法列表','武器列表','防具列表','饰品列表','法宝列表','丹药列表','其他列表'];
                const normalize = (v) => {
                  if (v === null || v === undefined) return '';
                  try { return String(v).trim().toLowerCase(); } catch { return ''; }
                };
                const needle = normalize(itemId);
                try {
                  for (const k of lists) {
                    const arr = (latestStatData?.[k]?.[0]) || [];
                    if (Array.isArray(arr)) {
                      for (let i = 0; i < arr.length; i++) {
                        const raw = arr[i];
                        if (!raw || raw === '$__META_EXTENSIBLE__$') continue;
                        let it;
                        try { it = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { it = raw; }
                        if (!it && typeof raw === 'string') {
                          // 纯文本条目，尝试简单匹配
                          const rawStr = raw.toLowerCase();
                          if (needle && rawStr.includes(needle)) {
                            return {
                              listKey: k,
                              listIndex: i,
                              originalEntry: raw,
                              parsedEntry: typeof raw === 'string' ? raw : it,
                            };
                          }
                          continue;
                        }
                        const id = normalize(window.GuixuHelpers.SafeGetValue(it, 'id', window.GuixuHelpers.SafeGetValue(it, 'uid', '')));
                        const name = normalize(window.GuixuHelpers.SafeGetValue(it, 'name', ''));
                        // 精确 id/name 匹配
                        if (needle && (id === needle || name === needle)) {
                          return {
                            listKey: k,
                            listIndex: i,
                            originalEntry: raw,
                            parsedEntry: it,
                          };
                        }
                        // 宽松匹配：name 包含 needle 或 raw 字符串包含 needle（最后保底）
                        if (needle && (name && name.includes(needle))) {
                          return {
                            listKey: k,
                            listIndex: i,
                            originalEntry: raw,
                            parsedEntry: it,
                          };
                        }
                        try {
                          const rawPreview = (typeof raw === 'string') ? raw.toLowerCase() : JSON.stringify(it).toLowerCase();
                          if (needle && rawPreview.includes(needle)) {
                            return {
                              listKey: k,
                              listIndex: i,
                              originalEntry: raw,
                              parsedEntry: it,
                            };
                          }
                        } catch (_) {}
                      }
                    }
                  }
                } catch (e) { /* ignore */ }
                try {
                  // 更详细的调试信息：列出各个背包列表内的条目 id/name 快照，便于定位匹配失败的原因
                  const lists = ['功法列表','武器列表','防具列表','饰品列表','法宝列表','丹药列表','其他列表'];
                  const snapshot = lists.map(k => {
                    const arr = stat_data?.[k]?.[0] || [];
                    const items = [];
                    if (Array.isArray(arr)) {
                      for (const rawEntry of arr) {
                        if (!rawEntry || rawEntry === '$__META_EXTENSIBLE__$') continue;
                        let parsed;
                        try { parsed = typeof rawEntry === 'string' ? JSON.parse(rawEntry) : rawEntry; } catch { parsed = rawEntry; }
                        items.push({
                          id: window.GuixuHelpers.SafeGetValue(parsed, 'id', window.GuixuHelpers.SafeGetValue(parsed, 'uid', '')),
                          name: window.GuixuHelpers.SafeGetValue(parsed, 'name', ''),
                          rawPreview: (typeof rawEntry === 'string' ? (rawEntry.length > 120 ? rawEntry.slice(0,120) + '...' : rawEntry) : JSON.stringify(parsed).slice(0,120))
                        });
                      }
                    }
                    return { key: k, length: (arr?.length || 0), items };
                  });
                  console.warn('[归墟] findUserItemById 未找到匹配，itemId=', itemId, '背包快照=', snapshot);
                } catch (e) { /* ignore */ }
                return null;
              };
              const userItemRef = findUserItemById();
              if (!userItemRef) {
                window.GuixuHelpers.showTemporaryMessage('未找到要出售的物品');
                return;
              }
              // 将解析后的物品对象传给后端处理，并保留原引用信息以便写回
              const item = Object.assign({}, (typeof userItemRef.parsedEntry === 'string' ? (function(){ try { return JSON.parse(userItemRef.parsedEntry); } catch { return { name: userItemRef.parsedEntry }; } })() : userItemRef.parsedEntry), { __userRef: { listKey: userItemRef.listKey, uIdx: userItemRef.listIndex } });
              if (!item) {
                window.GuixuHelpers.showTemporaryMessage('未找到要出售的物品');
                return;
              }

              // 数量选择（如果物品数量大于1）
              const itemQuantity = Number(window.GuixuHelpers.SafeGetValue(item, 'quantity', 1)) || 1;
              let sellQuantity = 1;
              if (itemQuantity > 1) {
                sellQuantity = await (window.GuixuMain?.showNumberPrompt
                  ? window.GuixuMain.showNumberPrompt({
                      title: '选择出售数量',
                      message: `【${window.GuixuHelpers.SafeGetValue(item, 'name', '未知物品')}】拥有：${itemQuantity}，请选择出售数量`,
                      min: 1,
                      max: itemQuantity,
                      defaultValue: 1,
                    })
                  : Promise.resolve(parseInt(prompt(`请输入出售数量（拥有：${itemQuantity}）`, '1') || '1', 10)));
                if (!Number.isFinite(sellQuantity) || sellQuantity <= 0 || sellQuantity > itemQuantity) {
                  window.GuixuHelpers.showTemporaryMessage('已取消或无效的数量');
                  return;
                }
              }

              // 出价输入（基础价值 x 数量）
              const baseVal = Number(window.GuixuHelpers.SafeGetValue(item, 'base_value', 0)) || 0;
              const totalBaseVal = baseVal * sellQuantity;
              const offer = await (window.GuixuMain?.showNumberPrompt
                ? window.GuixuMain.showNumberPrompt({
                    title: '出售价格（灵石）',
                    message: `为【${window.GuixuHelpers.SafeGetValue(item, 'name', '未知物品')} x${sellQuantity}】标价（基础价值：${totalBaseVal} 灵石）`,
                    min: 1,
                    max: 999999,
                    defaultValue: Math.max(1, totalBaseVal || 1),
                  })
                : Promise.resolve(parseInt(prompt(`请输入总标价（基础价值：${totalBaseVal}，数量：${sellQuantity}）`, String(totalBaseVal || 1)) || '0', 10)));
              if (!Number.isFinite(offer) || offer <= 0) {
                window.GuixuHelpers.showTemporaryMessage('已取消或无效的标价');
                return;
              }

              // 将出售数量添加到物品对象中，供后续处理使用
              item.sellQuantity = sellQuantity;

              // NPC 余额校验 + 成交逻辑（标价需不高于 NPC 可接受最高价，且 NPC 灵石足够）
              // 读取最新 NPC 灵石（避免使用旧的 rel 值）
              const messagesNow2 = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
              const sd2 = (messagesNow2?.[0]?.data?.stat_data) || {};
              const arr2 = (sd2?.['人物关系列表']?.[0]) || [];
              const rid2 = window.GuixuHelpers.SafeGetValue(rel, 'id', null);
              const rname2 = window.GuixuHelpers.SafeGetValue(rel, 'name', null);
              const relLatest = arr2.map(x => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; } })
                .find(o => o && ((rid2 != null && window.GuixuHelpers.SafeGetValue(o, 'id', null) === rid2) || (rname2 && window.GuixuHelpers.SafeGetValue(o, 'name', null) === rname2))) || rel;
              const theirStonesNow = Number(window.GuixuHelpers.SafeGetValue(relLatest, '灵石', 0)) || 0;
              if (offer > theirStonesNow) {
                window.GuixuHelpers.showTemporaryMessage('对方灵石不足，无法成交');
                return;
              }
              // 修复：传入批量出售的总基础价值进行价格合理性判断
              const ok = RelationshipsComponent._computeSellSuccess(offer, totalBaseVal, favorability);
              if (!ok) {
                window.GuixuHelpers.showTemporaryMessage('对方摇头婉拒，或许降低价格/提高好感度再试。');
                return;
              }

              try {
                await RelationshipsComponent._applySellTransaction(rel, item, offer);
                window.GuixuHelpers.showTemporaryMessage('出售成功！灵石已入账');
                
                // 实时刷新相关界面
                await RelationshipsComponent._refreshAllRelatedUI();
                
                // 重新打开交易面板显示最新数据
                await RelationshipsComponent.openTradePanel(rel);
              } catch (err) {
                console.error('[归墟] 出售落账失败：', err);
                window.GuixuHelpers.showTemporaryMessage('出售失败：保存数据出错');
              }
              return;
            }
          });
        }
      } catch (e) {
        console.warn('[归墟] openTradePanel 失败:', e);
        window.GuixuHelpers.showTemporaryMessage('无法打开交易面板');
      }
    },

    // 交易成功率：主要看出价是否“够”，好感度给予一定折扣/保险
    _computeTradeSuccess(offer, baseValue, favorability) {
      try {
        const base = Math.max(1, Number(baseValue || 0));
        const fav = Number(favorability || 0);
        // 动态阈值：好感度越高，所需价格越低；下限为基础价值的 60%
        const threshold = Math.max(Math.floor(base * 0.6), Math.floor(base * (1 - fav / 400)));
        if (offer >= threshold) return true;
        // 次优出价：若达到阈值 80% 且好感度≥60，给予 30% 成交几率
        if (offer >= Math.floor(threshold * 0.8) && fav >= 60) {
          return Math.random() < 0.3;
        }
        return false;
      } catch (_) {
        return offer >= baseValue;
      }
    },

    // 关系英文枚举 → 中文
    _toChineseRelationship(rel) {
      const map = {
        ENEMY: '敌对',
        ALLY: '盟友',
        NEUTRAL: '中立',
        FRIEND: '朋友',
        LOVER: '恋人',
      };
      const key = String(rel || '').toUpperCase();
      return map[key] || rel;
    },

    // 出售成功率：主要看出价是否“合理”，好感度给予上浮空间；NPC余额不足直接失败
    _computeSellSuccess(offer, baseValue, favorability) {
      try {
        const base = Math.max(1, Number(baseValue || 0));
        const fav = Number(favorability || 0);
        // 可接受最高价：基础价值*(1 + 好感度/400)，上限 1.4 倍
        const maxAccept = Math.min(Math.floor(base * (1 + fav / 400)), Math.floor(base * 1.4));
        return offer <= maxAccept;
      } catch (_) {
        return offer <= baseValue;
      }
    },

    // 将出售结果写回 MVU：增加玩家灵石、从玩家包减少/移除该物品、NPC 物品列表加入/叠加、NPC 灵石减少
    async _applySellTransaction(rel, item, offer) {
      const _ = window.GuixuAPI?.lodash || window._ || {
        get: (obj, path, def) => {
          try {
            const val = path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
            return val === undefined ? def : val;
          } catch {
            return def;
          }
        },
        set: (obj, path, value) => {
          try {
            const keys = path.split('.');
            let o = obj;
            while (keys.length > 1) {
              const k = keys.shift();
              if (!o[k] || typeof o[k] !== 'object') o[k] = {};
              o = o[k];
            }
            o[keys[0]] = value;
          } catch {}
          return obj;
        },
      };
      const h = window.GuixuHelpers;
      const currentId = window.GuixuAPI.getCurrentMessageId();
      const messages = await window.GuixuAPI.getChatMessages(currentId);
      if (!messages || !messages[0]) throw new Error('无法读取当前聊天数据');

      const currentMvuState = messages[0].data || {};
      currentMvuState.stat_data = currentMvuState.stat_data || {};
      const stat_data = currentMvuState.stat_data;

      // 玩家 + 灵石
      const myStones = Number(h.SafeGetValue(stat_data, '灵石', 0)) || 0;
      _.set(stat_data, '灵石', myStones + offer);

      // NPC 定位与 - 灵石
      const relListPath = '人物关系列表.0';
      const list = _.get(stat_data, relListPath, []);
      if (!Array.isArray(list)) throw new Error('人物关系列表结构异常');

      const relId = h.SafeGetValue(rel, 'id', null);
      const relName = h.SafeGetValue(rel, 'name', null);
      const idx = list.findIndex(entry => {
        try {
          const obj = typeof entry === 'string' ? JSON.parse(entry) : entry;
          if (relId != null) return h.SafeGetValue(obj, 'id', null) === relId;
          return h.SafeGetValue(obj, 'name', null) === relName;
        } catch { return false; }
      });
      if (idx === -1) throw new Error('在人物关系列表中未找到该角色');

      const originalRelEntry = list[idx];
      const relObj = (typeof originalRelEntry === 'string') ? JSON.parse(originalRelEntry) : (originalRelEntry || {});
      const npcStones = Number(h.SafeGetValue(relObj, '灵石', 0)) || 0;
      if (offer > npcStones) throw new Error('对方灵石不足');
      relObj['灵石'] = npcStones - offer;

      // 从玩家背包中移除该物品（智能分类：与购买时保持一致的分类逻辑）
      const getSmartItemCategoryForSell = (item) => {
        // 优先使用显式的 type 字段
        const explicitType = h.SafeGetValue(item, 'type', null);
        if (explicitType && explicitType !== '其他') {
          return explicitType;
        }
        
        // 基于名称和描述进行智能分类（与购买逻辑保持一致）
        const itemName = (h.SafeGetValue(item, 'name', '') || '').toLowerCase();
        const itemDesc = (h.SafeGetValue(item, 'description', '') || '').toLowerCase();
        const itemEffect = (h.SafeGetValue(item, 'effect', '') || '').toLowerCase();
        const text = `${itemName} ${itemDesc} ${itemEffect}`;
        
        // 物品分类关键词匹配
        const categoryKeywords = {
          '丹药': ['丹', '药', '丹药', '灵药', '仙丹', '药丸', '药液', '药膏', '疗伤', '回血', '回蓝', '恢复'],
          '武器': ['剑', '刀', '枪', '弓', '剑法', '刀法', '武器', '兵器', '长剑', '宝剑', '战刀', '长枪', '弯弓'],
          '防具': ['甲', '袍', '护', '防具', '盔', '靴', '衣', '甲胄', '护甲', '法袍', '战袍', '头盔', '护腕'],
          '饰品': ['戒', '项链', '手镯', '玉', '佩', '饰品', '珠', '戒指', '玉佩', '护符', '令牌'],
          '法宝': ['法宝', '宝物', '灵器', '仙器', '神器', '秘宝', '至宝', '圣器'],
          '功法': ['功法', '心法', '秘籍', '经', '诀', '术', '功', '法', '真经', '宝典'],
          '材料': ['材料', '矿', '石', '木', '草', '花', '兽', '皮', '骨', '精', '血', '矿石', '灵草']
        };
        
        // 按优先级检查分类（丹药优先级最高，因为最容易误分类）
        const priorityOrder = ['丹药', '武器', '防具', '饰品', '法宝', '功法', '材料'];
        
        for (const category of priorityOrder) {
          const keywords = categoryKeywords[category];
          for (const keyword of keywords) {
            if (text.includes(keyword)) {
              return category;
            }
          }
        }
        
        return '其他';
      };

      const mapTypeToListKey = (typ) => {
        switch (String(typ || '其他')) {
          case '功法': return '功法列表';
          case '武器': return '武器列表';
          case '防具': return '防具列表';
          case '饰品': return '饰品列表';
          case '法宝': return '法宝列表';
          case '丹药': return '丹药列表';
          case '材料': return '其他列表'; // 材料暂时放入其他列表
          case '其他':
          default: return '其他列表';
        }
      };

      // 优先使用由前端传入的 __userRef 信息（包含原 listKey 与索引），避免重复查找失败
      let userListKey = mapTypeToListKey(getSmartItemCategoryForSell(item));
      let userListPath = `${userListKey}.0`;
      // 确保包装层存在（{类别}列表 为 [ [] ] 结构）
      if (!Array.isArray(_.get(stat_data, userListKey))) {
        _.set(stat_data, userListKey, [[]]);
      }
      let userArr = _.get(stat_data, userListPath, []);
      if (!Array.isArray(userArr)) throw new Error('玩家背包结构异常');

      let uIdx = -1;
      let originalEntry = null;

      if (item && item.__userRef && item.__userRef.listKey) {
        // 使用前端找到的引用信息
        userListKey = item.__userRef.listKey;
        userListPath = `${userListKey}.0`;
        userArr = _.get(stat_data, userListPath, []);
        if (Array.isArray(userArr)) {
          const possibleIdx = Number(item.__userRef.uIdx);
          if (!Number.isNaN(possibleIdx) && possibleIdx >= 0 && possibleIdx < userArr.length) {
            uIdx = possibleIdx;
            originalEntry = userArr[uIdx];
          }
        }
      }

      // 如果仍未定位到索引，则做保底查找（兼容字符串化条目与 name/id 匹配）
      if (uIdx === -1) {
        const itemId = h.SafeGetValue(item, 'id', h.SafeGetValue(item, 'uid', ''));
        const itemName = h.SafeGetValue(item, 'name', null);
        for (let i = 0; i < userArr.length; i++) {
          const entry = userArr[i];
          if (!entry || entry === '$__META_EXTENSIBLE__$') continue;
          try {
            const it = typeof entry === 'string' ? JSON.parse(entry) : entry;
            const eid = h.SafeGetValue(it, 'id', h.SafeGetValue(it, 'uid', ''));
            const ename = h.SafeGetValue(it, 'name', null);
            if ((eid && String(eid) === String(itemId)) || (ename && itemName && String(ename) === String(itemName))) {
              uIdx = i;
              originalEntry = entry;
              break;
            }
          } catch { continue; }
        }
      }

      if (uIdx === -1) throw new Error('玩家物品不存在');

      // 解析条目，按原始类型写回，并处理批量出售数量
      let parsedEntry = {};
      try { parsedEntry = typeof originalEntry === 'string' ? JSON.parse(originalEntry) : originalEntry; } catch { parsedEntry = {}; }
      const sellQ = Number(h.SafeGetValue(parsedEntry, 'quantity', 1)) || 1;
      const sellQuantity = Number(h.SafeGetValue(item, 'sellQuantity', 1)) || 1;

      if (sellQ > sellQuantity) {
        parsedEntry.quantity = sellQ - sellQuantity;
        userArr[uIdx] = (typeof originalEntry === 'string') ? JSON.stringify(parsedEntry) : parsedEntry;
      } else {
        userArr.splice(uIdx, 1);
      }
      _.set(stat_data, userListPath, userArr);

      // NPC 物品列表加入/叠加
      // 确保 NPC 物品列表是数组，如果不存在则初始化
      if (!Array.isArray(relObj.物品列表)) {
        relObj.物品列表 = [];
      }
      const npcItems = relObj.物品列表;

      // 查找是否已存在同ID/同名物品（兼容字符串化条目），并保持原始存储格式（字符串或对象）
      let nIdx = -1;
      try {
        for (let i = 0; i < npcItems.length; i++) {
          const entry = npcItems[i];
          if (!entry || entry === '$__META_EXTENSIBLE__$') continue;
          let parsed;
          try { parsed = typeof entry === 'string' ? JSON.parse(entry) : entry; } catch { parsed = entry; }
          const eid = h.SafeGetValue(parsed, 'id', h.SafeGetValue(parsed, 'uid', ''));
          const ename = h.SafeGetValue(parsed, 'name', null);
          if ((eid && String(eid) === String(h.SafeGetValue(item, 'id', h.SafeGetValue(item, 'uid', '')))) || (ename && String(ename) === String(h.SafeGetValue(item, 'name', '')))) {
            nIdx = i;
            break;
          }
        }
      } catch (e) { /* ignore */ }

      if (nIdx !== -1) {
        // 找到：在原始格式上叠加数量（根据实际出售数量）
        const originalNpcEntry = npcItems[nIdx];
        try {
          const parsedOld = typeof originalNpcEntry === 'string' ? JSON.parse(originalNpcEntry) : originalNpcEntry;
          const oldQ = Number(h.SafeGetValue(parsedOld, 'quantity', 1)) || 1;
          parsedOld.quantity = oldQ + sellQuantity;
          npcItems[nIdx] = (typeof originalNpcEntry === 'string') ? JSON.stringify(parsedOld) : parsedOld;
        } catch (e) {
          // 退回：直接在对象上操作（若解析失败）
          if (typeof npcItems[nIdx] === 'object' && npcItems[nIdx] !== null) {
            npcItems[nIdx].quantity = (Number(h.SafeGetValue(npcItems[nIdx], 'quantity', 1)) || 1) + sellQuantity;
          }
        }
      } else {
        // 没找到：添加新物品（按对象形式添加，设置为出售的数量）
        const pushItem = JSON.parse(JSON.stringify(item));
        // 清理可能存在的临时字段
        delete pushItem.sellQuantity;
        delete pushItem.__userRef;
        pushItem.quantity = sellQuantity;

        const metaExtensible = '$__META_EXTENSIBLE__$';
        const metaIdx = npcItems.indexOf(metaExtensible);
        if (metaIdx !== -1) {
          npcItems.splice(metaIdx, 0, pushItem);
        } else {
          npcItems.push(pushItem);
        }
      }
      // relObj.物品列表 已经通过引用被修改

      // 写回人物（保持与原类型一致）
      list[idx] = (typeof originalRelEntry === 'string') ? JSON.stringify(relObj) : relObj;

      // 保存（当前楼层 + 0 楼），带错误捕获与调试输出
      const updates = [{ message_id: currentId, data: currentMvuState }];
      if (currentId !== 0) updates.push({ message_id: 0, data: currentMvuState });
      try {
        await window.GuixuAPI.setChatMessages(updates, { refresh: 'none' });
      } catch (err) {
        console.error('[归墟] setChatMessages 失败（出售操作）：', err, '准备写入：', updates);
        try { window.GuixuHelpers.showTemporaryMessage('保存数据失败：' + (err && err.message ? err.message : '未知错误')); } catch(e){}
        // 抛出以便调用处（UI）能显示失败信息
        throw err;
      }
    },

    // 智能物品分类函数 - 统一的分类逻辑
    _getItemCategory(item) {
      const h = window.GuixuHelpers;
      
      // 优先使用显式的 type 字段
      const explicitType = h.SafeGetValue(item, 'type', null);
      if (explicitType && explicitType !== '其他') {
        return explicitType;
      }
      
      // 基于名称和描述进行智能分类
      const itemName = (h.SafeGetValue(item, 'name', '') || '').toLowerCase();
      const itemDesc = (h.SafeGetValue(item, 'description', '') || '').toLowerCase();
      const itemEffect = (h.SafeGetValue(item, 'effect', '') || '').toLowerCase();
      const text = `${itemName} ${itemDesc} ${itemEffect}`;
      
      // 物品分类关键词匹配
      const categoryKeywords = {
        '丹药': ['丹', '药', '丹药', '灵药', '仙丹', '药丸', '药液', '药膏', '疗伤', '回血', '回蓝', '恢复'],
        '武器': ['剑', '刀', '枪', '弓', '剑法', '刀法', '武器', '兵器', '长剑', '宝剑', '战刀', '长枪', '弯弓'],
        '防具': ['甲', '袍', '护', '防具', '盔', '靴', '衣', '甲胄', '护甲', '法袍', '战袍', '头盔', '护腕'],
        '饰品': ['戒', '项链', '手镯', '玉', '佩', '饰品', '珠', '戒指', '玉佩', '护符', '令牌'],
        '法宝': ['法宝', '宝物', '灵器', '仙器', '神器', '秘宝', '至宝', '圣器'],
        '功法': ['功法', '心法', '秘籍', '经', '诀', '术', '功', '法', '真经', '宝典'],
        '材料': ['材料', '矿', '石', '木', '草', '花', '兽', '皮', '骨', '精', '血', '矿石', '灵草']
      };
      
      // 按优先级检查分类（丹药优先级最高，因为最容易误分类）
      const priorityOrder = ['丹药', '武器', '防具', '饰品', '法宝', '功法', '材料'];
      
      for (const category of priorityOrder) {
        const keywords = categoryKeywords[category];
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            return category;
          }
        }
      }
      
      return '其他';
    },

    // 自动修复物品的type字段
    _fixItemType(item) {
      const h = window.GuixuHelpers;
      const currentType = h.SafeGetValue(item, 'type', null);
      
      // 如果没有type字段或type为"其他"，则自动分类
      if (!currentType || currentType === '其他') {
        const correctType = this._getItemCategory(item);
        item.type = correctType;
      }
      
      return item;
    },

    // 批量修复玩家背包中的物品type字段
    async _fixPlayerInventoryTypes() {
      try {
        const h = window.GuixuHelpers;
        const currentId = window.GuixuAPI.getCurrentMessageId();
        const messages = await window.GuixuAPI.getChatMessages(currentId);
        if (!messages || !messages[0]) return false;

        const currentMvuState = messages[0].data || {};
        currentMvuState.stat_data = currentMvuState.stat_data || {};
        const stat_data = currentMvuState.stat_data;

        const inventoryLists = ['功法列表', '武器列表', '防具列表', '饰品列表', '法宝列表', '丹药列表', '其他列表'];
        let hasChanges = false;

        inventoryLists.forEach(listKey => {
          const list = stat_data[listKey];
          if (Array.isArray(list) && Array.isArray(list[0])) {
            const items = list[0];
            for (let i = 0; i < items.length; i++) {
              const rawItem = items[i];
              if (!rawItem || rawItem === '$__META_EXTENSIBLE__$') continue;
              
              try {
                let item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
                const originalType = h.SafeGetValue(item, 'type', null);
                
                // 修复type字段
                item = this._fixItemType(item);
                const newType = item.type;
                
                if (originalType !== newType) {
                  // 将修改后的物品写回
                  items[i] = typeof rawItem === 'string' ? JSON.stringify(item) : item;
                  hasChanges = true;
                  console.log(`[归墟] 修复物品分类：${h.SafeGetValue(item, 'name', '未知')} ${originalType || '无'} -> ${newType}`);
                }
              } catch (e) {
                console.warn('[归墟] 修复物品type字段时出错:', e, rawItem);
              }
            }
          }
        });

        // 如果有变更则保存
        if (hasChanges) {
          const updates = [{ message_id: currentId, data: currentMvuState }];
          if (currentId !== 0) updates.push({ message_id: 0, data: currentMvuState });
          await window.GuixuAPI.setChatMessages(updates, { refresh: 'none' });
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('[归墟] 批量修复玩家物品type字段失败:', error);
        return false;
      }
    },

    // 实时刷新所有相关UI界面
    async _refreshAllRelatedUI() {
      try {
        // 刷新主界面数据（装备、属性等）
        if (window.GuixuMain?.updateDynamicData) {
          window.GuixuMain.updateDynamicData();
        }
        
        // 刷新背包界面（如果已打开）
        const inventoryModal = document.getElementById('inventory-modal');
        if (inventoryModal && inventoryModal.style.display !== 'none' && inventoryModal.classList.contains('show')) {
          if (window.InventoryComponent?.show) {
            setTimeout(() => window.InventoryComponent.show(), 100);
          }
        }
        
        // 刷新人物关系界面本身（如果已打开）
        const relationshipsModal = document.getElementById('relationships-modal');
        if (relationshipsModal && relationshipsModal.style.display !== 'none' && relationshipsModal.classList.contains('show')) {
          setTimeout(() => this.show(), 100);
        }
        
        console.log('[归墟] 已刷新所有相关UI界面');
      } catch (error) {
        console.error('[归墟] 刷新UI界面时出错:', error);
      }
    },

    // 批量修复NPC物品的type字段
    async _fixNpcInventoryTypes() {
      try {
        const h = window.GuixuHelpers;
        const currentId = window.GuixuAPI.getCurrentMessageId();
        const messages = await window.GuixuAPI.getChatMessages(currentId);
        if (!messages || !messages[0]) return false;

        const currentMvuState = messages[0].data || {};
        currentMvuState.stat_data = currentMvuState.stat_data || {};
        const stat_data = currentMvuState.stat_data;

        const relationshipList = stat_data['人物关系列表'];
        if (!relationshipList || !Array.isArray(relationshipList[0])) return false;

        let hasChanges = false;
        const relations = relationshipList[0];

        for (let i = 0; i < relations.length; i++) {
          const rawRel = relations[i];
          if (!rawRel || rawRel === '$__META_EXTENSIBLE__$') continue;

          try {
            let rel = typeof rawRel === 'string' ? JSON.parse(rawRel) : rawRel;
            
            // 检查NPC的物品列表
            if (Array.isArray(rel.物品列表)) {
              let npcItemsChanged = false;
              
              for (let j = 0; j < rel.物品列表.length; j++) {
                const rawItem = rel.物品列表[j];
                if (!rawItem || rawItem === '$__META_EXTENSIBLE__$') continue;
                
                try {
                  let item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
                  const originalType = h.SafeGetValue(item, 'type', null);
                  
                  // 修复type字段
                  item = this._fixItemType(item);
                  const newType = item.type;
                  
                  if (originalType !== newType) {
                    rel.物品列表[j] = typeof rawItem === 'string' ? JSON.stringify(item) : item;
                    npcItemsChanged = true;
                    console.log(`[归墟] 修复NPC ${h.SafeGetValue(rel, 'name', '未知')} 物品分类：${h.SafeGetValue(item, 'name', '未知')} ${originalType || '无'} -> ${newType}`);
                  }
                } catch (e) {
                  console.warn('[归墟] 修复NPC物品type字段时出错:', e, rawItem);
                }
              }

              if (npcItemsChanged) {
                relations[i] = typeof rawRel === 'string' ? JSON.stringify(rel) : rel;
                hasChanges = true;
              }
            }
          } catch (e) {
            console.warn('[归墟] 修复NPC关系数据时出错:', e, rawRel);
          }
        }

        // 如果有变更则保存
        if (hasChanges) {
          const updates = [{ message_id: currentId, data: currentMvuState }];
          if (currentId !== 0) updates.push({ message_id: 0, data: currentMvuState });
          await window.GuixuAPI.setChatMessages(updates, { refresh: 'none' });
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('[归墟] 批量修复NPC物品type字段失败:', error);
        return false;
      }
    },

    // 启动批量修复程序
    async _startBatchFix() {
      try {
        window.GuixuHelpers.showTemporaryMessage('开始批量修复物品分类...');
        
        const playerFixed = await this._fixPlayerInventoryTypes();
        const npcFixed = await this._fixNpcInventoryTypes();
        
        if (playerFixed || npcFixed) {
          window.GuixuHelpers.showTemporaryMessage('物品分类修复完成！请刷新界面查看效果。');
          // 刷新相关界面
          if (window.InventoryComponent && typeof window.InventoryComponent.show === 'function') {
            setTimeout(() => window.InventoryComponent.show(), 1000);
          }
        } else {
          window.GuixuHelpers.showTemporaryMessage('物品分类检查完成，无需修复。');
        }
      } catch (error) {
        console.error('[归墟] 批量修复过程出错:', error);
        window.GuixuHelpers.showTemporaryMessage('修复过程出错，请查看控制台日志。');
      }
    },

    // 将交易结果写回 MVU：扣除玩家灵石、移除/减少对方物品、将物品加入玩家对应分类，并增加对方灵石
    async _applyTradeTransaction(rel, item, offer, purchaseQuantity = 1) {
      const _ = window.GuixuAPI?.lodash || window._ || {
        get: (obj, path, def) => {
          try {
            const val = path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
            return val === undefined ? def : val;
          } catch {
            return def;
          }
        },
        set: (obj, path, value) => {
          try {
            const keys = path.split('.');
            let o = obj;
            while (keys.length > 1) {
              const k = keys.shift();
              if (!o[k] || typeof o[k] !== 'object') o[k] = {};
              o = o[k];
            }
            o[keys[0]] = value;
          } catch {}
          return obj;
        },
      };
      const h = window.GuixuHelpers;
      const currentId = window.GuixuAPI.getCurrentMessageId();
      const messages = await window.GuixuAPI.getChatMessages(currentId);
      if (!messages || !messages[0]) throw new Error('无法读取当前聊天数据');

      const currentMvuState = messages[0].data || {};
      currentMvuState.stat_data = currentMvuState.stat_data || {};
      const stat_data = currentMvuState.stat_data;

      // 1) 扣玩家灵石
      const myStones = Number(h.SafeGetValue(stat_data, '灵石', 0)) || 0;
      if (offer > myStones) throw new Error('余额不足');
      _.set(stat_data, '灵石', myStones - offer);

      // 2) 增对方灵石 + 减少/移除对方物品
      const relListPath = '人物关系列表.0';
      const list = _.get(stat_data, relListPath, []);
      if (!Array.isArray(list)) throw new Error('人物关系列表结构异常');

      const relId = h.SafeGetValue(rel, 'id', null);
      const relName = h.SafeGetValue(rel, 'name', null);
      const idx = list.findIndex(entry => {
        try {
          const obj = typeof entry === 'string' ? JSON.parse(entry) : entry;
          if (relId != null) return h.SafeGetValue(obj, 'id', null) === relId;
          return h.SafeGetValue(obj, 'name', null) === relName;
        } catch { return false; }
      });
      if (idx === -1) throw new Error('在人物关系列表中未找到该角色');

      const originalRelEntry = list[idx];
      const relObj = (typeof originalRelEntry === 'string') ? JSON.parse(originalRelEntry) : (originalRelEntry || {});
      const npcStones = Number(h.SafeGetValue(relObj, '灵石', 0)) || 0;
      relObj['灵石'] = npcStones + offer;

      const itemId = h.SafeGetValue(item, 'id', h.SafeGetValue(item, 'uid', ''));
      const npcItems = Array.isArray(relObj.物品列表) ? relObj.物品列表 : [];
      // 在 NPC 物品列表中定位目标条目（兼容字符串化条目）
      let itIndex = -1;
      try {
        for (let i = 0; i < npcItems.length; i++) {
          const entry = npcItems[i];
          if (!entry || entry === '$__META_EXTENSIBLE__$') continue;
          let parsed;
          try { parsed = typeof entry === 'string' ? JSON.parse(entry) : entry; } catch { parsed = entry; }
          const eid = h.SafeGetValue(parsed, 'id', h.SafeGetValue(parsed, 'uid', ''));
          const ename = h.SafeGetValue(parsed, 'name', null);
          if ((eid && String(eid) === String(itemId)) || (ename && String(ename) === String(h.SafeGetValue(item, 'name', '')))) {
            itIndex = i;
            break;
          }
        }
      } catch (e) { /* ignore */ }
      if (itIndex === -1) throw new Error('对方物品不存在');

      // 拷贝给玩家
      const bought = JSON.parse(JSON.stringify(npcItems[itIndex]));
      const q = Number(h.SafeGetValue(npcItems[itIndex], 'quantity', 1)) || 1;
      if (q > 1) {
        npcItems[itIndex].quantity = q - 1;
      } else {
        npcItems.splice(itIndex, 1);
      }
      relObj.物品列表 = npcItems;

      // 将更新后的 relObj 写回（保持与原类型一致）
      list[idx] = (typeof originalRelEntry === 'string') ? JSON.stringify(relObj) : relObj;

      // 3) 加入玩家对应分类列表（使用统一的分类逻辑并自动修复type字段）
      
      // 自动修复购买物品的type字段（防护机制）
      const fixedBought = this._fixItemType(JSON.parse(JSON.stringify(bought)));
      
      // 使用修复后的type字段进行分类
      const mapTypeToListKey = (typ) => {
        switch (String(typ || '其他')) {
          case '功法': return '功法列表';
          case '武器': return '武器列表';
          case '防具': return '防具列表';
          case '饰品': return '饰品列表';
          case '法宝': return '法宝列表';
          case '丹药': return '丹药列表';
          case '材料': return '其他列表'; // 材料暂时放入其他列表
          case '其他':
          default: return '其他列表';
        }
      };
      
      const itemType = fixedBought.type;
      const userListKey = mapTypeToListKey(itemType);
      const userListPath = `${userListKey}.0`;
      // 确保包装层存在（{类别}列表 为 [ [] ] 结构）
      if (!Array.isArray(_.get(stat_data, userListKey))) {
        _.set(stat_data, userListKey, [[]]);
      }
      const userList = _.get(stat_data, userListPath, []);
      const arr = Array.isArray(userList) ? userList : [];
      const boughtItemId = h.SafeGetValue(bought, 'id', h.SafeGetValue(bought, 'uid', ''));
      const boughtItemName = h.SafeGetValue(bought, 'name', null);

      // 如果已存在相同 id 或 name 的物品则叠加数量（使用归一化匹配并兼容字符串条目）
      const normalize = (v) => {
        if (v === null || v === undefined) return '';
        try { return String(v).trim().toLowerCase(); } catch { return ''; }
      };
      const bId = normalize(boughtItemId);
      const bName = normalize(boughtItemName);
      const existIdx = arr.findIndex(entry => {
        try {
          let it;
          if (typeof entry === 'string') {
            try { it = JSON.parse(entry); } catch { it = { name: entry }; }
          } else {
            it = entry;
          }
          if (!it) return false;
          const currentId = normalize(h.SafeGetValue(it, 'id', h.SafeGetValue(it, 'uid', '')));
          const currentName = normalize(h.SafeGetValue(it, 'name', null));
          if (bId && currentId && currentId === bId) return true;
          if (bName && currentName && currentName === bName) return true;
          return false;
        } catch {
          return false;
        }
      });

      if (existIdx !== -1) {
        // 叠加数量
        const originalEntry = arr[existIdx];
        let parsedEntry;
        try { parsedEntry = typeof originalEntry === 'string' ? JSON.parse(originalEntry) : originalEntry; } catch { parsedEntry = {}; }
        const oldQ = Number(h.SafeGetValue(parsedEntry, 'quantity', 1)) || 1;
        parsedEntry.quantity = oldQ + purchaseQuantity;
        // 写回时保持原格式
        arr[existIdx] = (typeof originalEntry === 'string') ? JSON.stringify(parsedEntry) : parsedEntry;
      } else {
        // 添加新物品
        delete bought.quantity;
        bought.quantity = purchaseQuantity;
        arr.push(bought);
      }
      _.set(stat_data, userListPath, arr);

      // 4) 保存（当前楼层 + 0 楼），带错误捕获与调试输出
      const updates = [{ message_id: currentId, data: currentMvuState }];
      if (currentId !== 0) updates.push({ message_id: 0, data: currentMvuState });
      try {
        await window.GuixuAPI.setChatMessages(updates, { refresh: 'none' });
      } catch (err) {
        console.error('[归墟] setChatMessages 失败（购买操作）：', err, '准备写入：', updates);
        try { window.GuixuHelpers.showTemporaryMessage('保存数据失败：' + (err && err.message ? err.message : '未知错误')); } catch(e){}
        throw err;
      }
    },
  };

  window.RelationshipsComponent = RelationshipsComponent;
})(window);
