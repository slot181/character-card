// 类脑/旅程梦星作品，禁止二传，禁止商业化，均无偿免费开源分享
(function (window) {
  'use strict';

  if (!window.GuixuDOM || !window.GuixuBaseModal || !window.GuixuState) {
    console.error('[归墟] ExtractedContentComponent 初始化失败：缺少依赖(GuixuDOM/GuixuBaseModal/GuixuState)。');
    return;
  }

  const ExtractedContentComponent = {
    show() {
      const { $ } = window.GuixuDOM;
      const state = window.GuixuState.getState();

      window.GuixuBaseModal.open('extracted-content-modal');

      // 直接填充已缓存的提取内容
      const sentPromptEl = $('#sent-prompt-display');
      const journeyEl = $('#extracted-journey');
      const pastLivesEl = $('#extracted-past-lives');
      const variablesEl = $('#extracted-variable-changes');
      const novelModeEl = $('#extracted-novel-mode');
      const novelModeBtn = $('#btn-write-novel-mode');
      const characterCardEl = $('#extracted-character-card');
      const characterCardBtn = $('#btn-write-character-card');

      if (sentPromptEl) {
        sentPromptEl.textContent = state.lastSentPrompt || '尚未发送任何内容';
      }
      if (journeyEl) {
        journeyEl.textContent = state.lastExtractedJourney || '未提取到内容';
      }
      if (pastLivesEl) {
        pastLivesEl.textContent = state.lastExtractedPastLives || '未提取到内容';
      }
      if (variablesEl) {
        variablesEl.textContent = state.lastExtractedVariables || '本次无变量改变';
      }
      if (novelModeEl && novelModeBtn) {
        novelModeEl.textContent = state.lastExtractedNovelText || '当前AI回复中未提取到正文内容。';
        novelModeBtn.disabled = !state.lastExtractedNovelText;

        const label = document.querySelector('label[for="novel-mode-enabled-checkbox"]');
        if (label) {
          const statusText = state.isNovelModeEnabled ? '开启' : '关闭';
          label.title = `点击切换自动写入状态，当前为：${statusText}`;
        }
      }
      if (characterCardEl && characterCardBtn) {
        characterCardEl.textContent = state.lastExtractedCharacterCard || '未提取到角色卡内容。';
        characterCardBtn.disabled = !state.lastExtractedCharacterCard;
      }
    }
  };

  window.ExtractedContentComponent = ExtractedContentComponent;
})(window);
