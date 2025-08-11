// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  if (!window.GuixuDOM || !window.GuixuAPI || !window.GuixuHelpers) {
    console.error('[归墟] CharacterDetailsComponent 初始化失败：缺少依赖(GuixuDOM/GuixuAPI/GuixuHelpers)。');
    return;
  }

  const CharacterDetailsComponent = {
    async show() {
      const { $ } = window.GuixuDOM;
      if (!window.GuixuManager || typeof window.GuixuManager.openModal !== 'function') {
        console.warn('[归墟] CharacterDetailsComponent: GuixuManager.openModal 不可用，直接操作 DOM。');
        const modal = $('#character-details-modal');
        if (modal) modal.style.display = 'flex';
      } else {
        window.GuixuManager.openModal('character-details-modal');
      }

      const body = $('#character-details-modal .modal-body');
      if (!body) return;
      body.innerHTML =
        '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">正在加载角色数据...</p>';

      try {
        const messages = await window.GuixuAPI.getChatMessages(window.GuixuAPI.getCurrentMessageId());
        const stat_data = messages?.[0]?.data?.stat_data;
        if (!stat_data) {
          body.innerHTML =
            '<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">无法加载角色数据。</p>';
          return;
        }

        // 同步一次属性展示，保持与左侧面板一致
        if (window.GuixuManager && typeof window.GuixuManager.updateDisplayedAttributes === 'function') {
          window.GuixuManager.updateDisplayedAttributes();
        }

        // 从已渲染的左侧面板获取值，确保与显示一致
        const fali = $('#attr-fali')?.innerText ?? 'N/A';
        const shenhai = $('#attr-shenhai')?.innerText ?? 'N/A';
        const daoxin = $('#attr-daoxin')?.innerText ?? 'N/A';
        const kongsu = $('#attr-kongsu')?.innerText ?? 'N/A';
        const qiyun = $('#attr-qiyun')?.innerText ?? 'N/A';
        const shengli = $('#attr-shengli')?.innerText ?? 'N/A';
        const xinli = $('#attr-xinli')?.innerText ?? 'N/A';

        // 从 stat_data 获取新增的值
        const xiuxingjindu = window.GuixuHelpers.SafeGetValue(stat_data, '修为进度', '0');
        const xiuxingpingjing = window.GuixuHelpers.SafeGetValue(stat_data, '修为瓶颈', '无');

        // 构建HTML
        body.innerHTML = `
              <div class="panel-section">
                  <div class="section-title">核心属性 <span style="font-size: 10px; color: #8b7355;">(当前/上限)</span></div>
                  <div class="attributes-list">
                      <div class="attribute-item"><span class="attribute-name">法力</span><span class="attribute-value">${fali}</span></div>
                      <div class="attribute-item"><span class="attribute-name">神海</span><span class="attribute-value">${shenhai}</span></div>
                      <div class="attribute-item"><span class="attribute-name">道心</span><span class="attribute-value">${daoxin}</span></div>
                      <div class="attribute-item"><span class="attribute-name">空速</span><span class="attribute-value">${kongsu}</span></div>
                      <div class="attribute-item"><span class="attribute-name">气运</span><span class="attribute-value">${qiyun}</span></div>
                      <div class="attribute-item"><span class="attribute-name">生理年龄</span><span class="attribute-value">${shengli}</span></div>
                      <div class="attribute-item"><span class="attribute-name">心理年龄</span><span class="attribute-value">${xinli}</span></div>
                  </div>
              </div>
              <div class="panel-section">
                  <div class="section-title">修为详情</div>
                  <div class="attributes-list">
                      <div class="attribute-item">
                          <span class="attribute-name">修为进度</span>
                          <span class="attribute-value">${xiuxingjindu}%</span>
                      </div>
                      <div class="details-progress-bar">
                          <div class="details-progress-fill" style="width: ${xiuxingjindu}%;"></div>
                      </div>
                      <div class="attribute-item" style="margin-top: 8px;">
                          <span class="attribute-name">当前瓶颈</span>
                          <span class="attribute-value">${xiuxingpingjing}</span>
                      </div>
                  </div>
              </div>
          `;
      } catch (error) {
        console.error('[归墟] 加载角色详情时出错:', error);
        body.innerHTML =
          `<p class="modal-placeholder" style="text-align:center; color:#8b7355; font-size:12px;">加载数据时出错：${error.message}</p>`;
      }
    }
  };

  window.CharacterDetailsComponent = CharacterDetailsComponent;
})(window);
