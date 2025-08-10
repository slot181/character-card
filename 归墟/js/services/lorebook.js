/**
 * 归墟 - 世界书服务
 * 封装所有与世界书（Lorebook）相关的读写、创建、修剪、自动开关等逻辑。
 * 挂载到 window.GuixuLorebook
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('Lorebook') : console;
  var API = global.GuixuAPI;
  var C = global.GuixuConstants;
  var Text = global.GuixuText;

  if (!API || !C || !Text) {
    console.error('[归墟] Lorebook 服务无法初始化：缺少核心依赖（API, Constants, Text）。');
    return;
  }

  function _getEntryKey(baseEntryKey, index) {
    return index > 1 ? `${baseEntryKey}(${index})` : baseEntryKey;
  }

  async function writeToLorebook(baseEntryKey, contentToWrite, unifiedIndex, isAutoTrimEnabled) {
    if (!contentToWrite || contentToWrite.trim() === '') {
      return { success: false, message: '没有可写入的内容。' };
    }

    const finalEntryKey = _getEntryKey(baseEntryKey, unifiedIndex);
    const bookName = C.LOREBOOK.NAME;
    let reformattedContent = contentToWrite.trim();

    // 内容格式化
    if (baseEntryKey === C.LOREBOOK.ENTRIES.JOURNEY || baseEntryKey === C.LOREBOOK.ENTRIES.PAST_LIVES) {
      const journeyFields = ['序号', '日期', '标题', '描述', '标签', '自动化系统'];
      const pastLivesFields = ['第x世', '事件脉络', '本世概述', '本世成就', '本世获得物品', '本世人物关系网', '死亡原因', '本世总结', '本世评价'];
      const fields = baseEntryKey === C.LOREBOOK.ENTRIES.JOURNEY ? journeyFields : pastLivesFields;
      const parsedData = Text.parseJourneyEntry(contentToWrite)[0] || {};

      if (Object.keys(parsedData).length === 0) {
        return { success: false, message: `无法解析“${baseEntryKey}”的内容。` };
      }
      reformattedContent = fields.map(key => (parsedData[key] ? `${key}|${parsedData[key]}` : null)).filter(Boolean).join('\n');
    }

    try {
      const allEntries = await API.getLorebookEntries(bookName);
      let targetEntry = allEntries.find(entry => entry.comment === finalEntryKey);

      if (targetEntry) { // 条目已存在，检查重复并追加
        const existingContent = targetEntry.content || '';
        let isDuplicate = false;

        if (baseEntryKey === C.LOREBOOK.ENTRIES.JOURNEY) {
          const getSeq = (text) => text ? (text.match(/^序号\|(\d+)/) || [])[1] || null : null;
          const newEventSeq = getSeq(reformattedContent);
          if (newEventSeq) {
            const existingSequences = existingContent.split('\n\n').map(block => getSeq(block.trim())).filter(seq => seq !== null);
            if (existingSequences.includes(newEventSeq)) isDuplicate = true;
          }
        } else {
          if (existingContent.includes(reformattedContent.trim())) isDuplicate = true;
        }

        if (isDuplicate) {
          return { success: true, message: '内容已存在，无需重复写入。', skipped: true };
        }

        let updatedContent = existingContent + (existingContent ? '\n\n' : '') + reformattedContent;

        if (baseEntryKey === C.LOREBOOK.ENTRIES.JOURNEY && isAutoTrimEnabled) {
          Log.log('自动修剪已开启，正在处理合并后的内容...');
          updatedContent = getTrimmedJourneyContent(updatedContent);
        }

        await API.setLorebookEntries(bookName, [{ uid: targetEntry.uid, content: updatedContent }]);
        return { success: true, message: `已成功追加内容到“${finalEntryKey}”。` };

      } else { // 条目不存在，创建它
        const baseEntryTemplate = allEntries.find(entry => entry.comment === baseEntryKey);
        const newEntryData = {
          comment: finalEntryKey,
          content: reformattedContent,
          keys: baseEntryTemplate ? [...baseEntryTemplate.keys, finalEntryKey] : [finalEntryKey],
          enabled: false,
          ...(baseEntryTemplate ? { selective: baseEntryTemplate.selective, constant: baseEntryTemplate.constant, position: baseEntryTemplate.position, case_sensitive: baseEntryTemplate.case_sensitive } : {})
        };
        await API.createLorebookEntries(bookName, [newEntryData]);
        return { success: true, message: `已成功创建并写入到“${finalEntryKey}”。` };
      }
    } catch (error) {
      Log.error(`写入世界书 "${finalEntryKey}" 时出错:`, error);
      return { success: false, message: `写入失败: ${error.message}` };
    }
  }

  async function updateCurrentScene(sceneContent) {
    if (!sceneContent || sceneContent.trim() === '') {
      Log.warn('尝试向“当前场景”写入空内容，操作已取消。');
      return;
    }
    const bookName = C.LOREBOOK.NAME;
    const sceneKey = C.LOREBOOK.ENTRIES.CURRENT_SCENE;
    try {
      const allEntries = await API.getLorebookEntries(bookName);
      const sceneEntry = allEntries.find(entry => entry.comment === sceneKey);

      if (!sceneEntry) {
        Log.warn(`未找到世界书条目 "${sceneKey}"，将自动创建。`);
        await API.createLorebookEntries(bookName, [{ comment: sceneKey, content: sceneContent, keys: [] }]);
      } else {
        await API.setLorebookEntries(bookName, [{ uid: sceneEntry.uid, content: sceneContent }]);
      }
      Log.log(`成功更新 "${sceneKey}" 内容。`);
    } catch (error) {
      Log.error(`更新 "${sceneKey}" 时出错:`, error);
    }
  }

  async function updateAutoToggledEntries(unifiedIndex, andDisableAll = false) {
    const bookName = C.LOREBOOK.NAME;
    const journeyName = C.LOREBOOK.ENTRIES.JOURNEY;
    const pastLivesName = C.LOREBOOK.ENTRIES.PAST_LIVES;
    const journeyKey = _getEntryKey(journeyName, unifiedIndex);
    const pastLivesKey = _getEntryKey(pastLivesName, unifiedIndex);

    try {
      let allEntries = await API.getLorebookEntries(bookName);
      const entriesToCreate = [];

      if (!allEntries.find(e => e.comment === journeyKey)) {
        const base = allEntries.find(e => e.comment === journeyName);
        if (base) entriesToCreate.push({ ...base, uid: undefined, comment: journeyKey, content: '', keys: [...(base.keys || []), journeyKey], enabled: true, position: 'before_character_definition', order: 20 });
      }
      if (!allEntries.find(e => e.comment === pastLivesKey)) {
        const base = allEntries.find(e => e.comment === pastLivesName);
        if (base) entriesToCreate.push({ ...base, uid: undefined, comment: pastLivesKey, content: '', keys: [...(base.keys || []), pastLivesKey], enabled: true, position: 'before_character_definition', order: 19 });
      }

      if (entriesToCreate.length > 0) {
        await API.createLorebookEntries(bookName, entriesToCreate);
        Log.log(`自动创建了 ${entriesToCreate.length} 个新世界书条目。`);
        allEntries = await API.getLorebookEntries(bookName);
      }

      const entriesToUpdate = allEntries
        .filter(e => e.comment.startsWith(journeyName) || e.comment.startsWith(pastLivesName))
        .map(e => {
          const isTarget = e.comment === journeyKey || e.comment === pastLivesKey;
          const shouldBeEnabled = isTarget && !andDisableAll;
          return e.enabled !== shouldBeEnabled ? { uid: e.uid, enabled: shouldBeEnabled } : null;
        })
        .filter(Boolean);

      if (entriesToUpdate.length > 0) {
        await API.setLorebookEntries(bookName, entriesToUpdate);
        Log.log(`更新了 ${entriesToUpdate.length} 个世界书条目状态。`);
      }
    } catch (error) {
      Log.error('更新世界书条目状态时出错:', error);
    }
  }

  function getTrimmedJourneyContent(fullContent) {
    if (!fullContent) return fullContent;
    const events = Text.parseJourneyEntry(fullContent);
    if (events.length <= 2) return fullContent;

    const updatedEvents = events.map((event, idx) => {
      if (idx < events.length - 2 && event['自动化系统']) {
        const newEvent = { ...event };
        delete newEvent['自动化系统'];
        return newEvent;
      }
      return event;
    });

    return updatedEvents.map(event => {
      const lines = [];
      if (event['序号'] !== undefined) lines.push(`序号|${event['序号']}`);
      for (const key in event) {
        if (Object.prototype.hasOwnProperty.call(event, key) && key !== '序号') {
          lines.push(`${key}|${event[key]}`);
        }
      }
      return lines.join('\n');
    }).join('\n\n');
  }

  var api = {
    writeToLorebook: writeToLorebook,
    updateCurrentScene: updateCurrentScene,
    updateAutoToggledEntries: updateAutoToggledEntries,
    getTrimmedJourneyContent: getTrimmedJourneyContent
  };

  try { Object.freeze(api); } catch (e) {}

  global.GuixuLorebook = api;
})(window);
