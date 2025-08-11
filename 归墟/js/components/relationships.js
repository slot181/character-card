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
        const stat_data = messages?.[0]?.data?.stat_data;
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
    }
  };

  window.RelationshipsComponent = RelationshipsComponent;
})(window);
