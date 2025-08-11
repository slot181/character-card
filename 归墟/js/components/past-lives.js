// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  if (!window.GuixuDOM || !window.GuixuBaseModal || !window.GuixuAPI || !window.GuixuConstants || !window.GuixuState) {
    console.error('[归墟] PastLivesComponent 初始化失败：缺少依赖(GuixuDOM/GuixuBaseModal/GuixuAPI/GuixuConstants/GuixuState)。');
    return;
  }

  // 简单解析“往世涟漪”块的工具（与原 guixu.js 的 parsePastLifeEntry 行为一致）
  function parsePastLifeEntry(contentString) {
    if (!contentString || typeof contentString !== 'string') return {};
    try {
      const data = {};
      const lines = contentString.trim().split('\n');
      lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('|').trim();
          data[key] = value;
        }
      });
      return data;
    } catch (e) {
      console.error('[归墟] 解析往世涟漪条目失败:', e);
      return {};
    }
  }

  const PastLivesComponent = {
    async show() {
      const { $ } = window.GuixuDOM;
      window.GuixuBaseModal.open('history-modal');

      const titleEl = $('#history-modal-title');
      if (titleEl) titleEl.textContent = '往世涟漪';

      const actionsContainer = $('#history-modal-actions');
      if (actionsContainer) {
        actionsContainer.innerHTML = ''; // 往世涟漪不需要“修剪”选项
      }

      const body = $('#history-modal-body');
      if (!body) return;
      body.innerHTML =
        '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在回溯时光长河...</p>';

      try {
        const bookName = window.GuixuConstants.LOREBOOK.NAME;
        const index = window.GuixuState.getState().unifiedIndex || 1;
        const pastLivesKey =
          index > 1
            ? `${window.GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES}(${index})`
            : window.GuixuConstants.LOREBOOK.ENTRIES.PAST_LIVES;

        const allEntries = await window.GuixuAPI.getLorebookEntries(bookName);
        const pastLivesEntry = allEntries.find(entry => (entry.comment || '').trim() === pastLivesKey.trim());

        body.innerHTML = this.renderPastLives(pastLivesEntry);
      } catch (error) {
        console.error('[归墟] 读取“往世涟漪”时出错:', error);
        body.innerHTML = `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">回溯时光长河时出现错误：${error.message}</p>`;
      }
    },

    renderPastLives(entry) {
      if (!entry || !entry.content)
        return '<p style="text-align:center; color:#8b7355; font-size:12px;">未发现任何往世的痕迹。</p>';

      const blocks = entry.content.trim().split(/第x世\|/g).slice(1);
      if (blocks.length === 0)
        return '<p style="text-align:center; color:#8b7355; font-size:12px;">内容格式有误，无法解析往世记录。</p>';

      let html = '<div class="timeline-container"><div class="timeline-line"></div>';
      blocks.forEach(block => {
        const fullContent = `第x世|${block}`;
        const data = parsePastLifeEntry(fullContent);
        const title = `第${data['第x世'] || '?'}世`;

        html += `
          <div class="timeline-event">
            <div class="timeline-content">
              <div class="timeline-title">${title}</div>
              <div class="past-life-details">
                <div class="detail-item"><strong>事件脉络:</strong> ${data['事件脉络'] || '不详'}</div>
                <div class="detail-item"><strong>本世概述:</strong> ${data['本世概述'] || '不详'}</div>
                <div class="detail-item"><strong>本世成就:</strong> ${data['本世成就'] || '无'}</div>
                <div class="detail-item"><strong>获得物品:</strong> ${data['本世获得物品'] || '无'}</div>
                <div class="detail-item"><strong>人物关系:</strong> ${data['本世人物关系网'] || '无'}</div>
                <div class="detail-item"><strong>死亡原因:</strong> ${data['死亡原因'] || '不详'}</div>
                <div class="detail-item"><strong>本世总结:</strong> ${data['本世总结'] || '无'}</div>
                <div class="detail-item"><strong>本世评价:</strong> ${data['本世评价'] || '无'}</div>
              </div>
            </div>
          </div>`;
      });
      html += '</div>';
      return html;
    }
  };

  window.PastLivesComponent = PastLivesComponent;
})(window);
