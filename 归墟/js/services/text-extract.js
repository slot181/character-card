/**
 * 归墟 - 文本提取与格式化服务
 * 提供：
 *  - formatMessageContent(text): 格式化展示用HTML
 *  - getDisplayText(aiResponse): 从AI完整回复中抽取展示文本（优先<gametxt>）
 *  - extractLastTagContent(tagName, text, ignoreCase?): 提取最后一个匹配标签内容
 *  - parseJourneyEntry(contentString): 将“本世历程”条目解析为事件数组
 *  - parsePastLifeEntry(contentString): 将“往世涟漪”单段解析为键值对象
 * 挂载到 window.GuixuText
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('Text') : console;

  function formatMessageContent(text) {
    try {
      if (!text) return '';
      var processedText = String(text).replace(/\\n/g, '<br />');

      // 语言: “...” 或 「...」
      processedText = processedText.replace(/(“[^”]+”|「[^」]+」)/g, function (match) {
        return '<span class="text-language">' + match + '</span>';
      });

      // 心理: *...* => 去星号
      processedText = processedText.replace(/\*([^*]+)\*/g, function (_, p1) {
        return '<span class="text-psychology">' + p1 + '</span>';
      });

      // 景物: 【...】但不匹配纯数字
      processedText = processedText.replace(/【([^】\d]+[^】]*)】/g, function (_, p1) {
        return '<span class="text-scenery">' + p1 + '</span>';
      });

      return processedText;
    } catch (e) {
      try { Log.error('formatMessageContent error', e); } catch (_) {}
      return String(text || '');
    }
  }

  function extractLastTagContent(tagName, text, ignoreCase) {
    if (!text || typeof text !== 'string') return null;
    var endTag = '</' + tagName + '>';
    var searchPool = text;
    var endTagPattern = endTag;

    if (ignoreCase) {
      searchPool = text.toLowerCase();
      endTagPattern = endTag.toLowerCase();
    }

    var lastEndIndex = searchPool.lastIndexOf(endTagPattern);
    if (lastEndIndex !== -1) {
      var startTag = '<' + tagName + '>';
      var startTagPattern = startTag;
      if (ignoreCase) startTagPattern = startTag.toLowerCase();

      var lastStartIndex = searchPool.lastIndexOf(startTagPattern, lastEndIndex);
      if (lastStartIndex !== -1) {
        var startIndex = lastStartIndex + startTag.length;
        return text.substring(startIndex, lastEndIndex).trim();
      }
    }
    return null;
  }

  function getDisplayText(aiResponse) {
    try {
      if (!aiResponse || typeof aiResponse !== 'string') return '';
      var gameText = extractLastTagContent('gametxt', aiResponse);
      if (gameText !== null) return gameText;

      // 移除不用于展示的标签
      var cleanedText = aiResponse;
      var tagsToRemove = ['本世历程', '往世涟漪', 'UpdateVariable', '角色提取', 'thinking'];
      tagsToRemove.forEach(function (tag) {
        var regexWithContent = new RegExp('<' + tag + '>[\\s\\S]*?<\\/' + tag + '>', 'gi');
        cleanedText = cleanedText.replace(regexWithContent, '');
        var regexSelfClosing = new RegExp('<' + tag + '\\s*\\/>', 'gi');
        cleanedText = cleanedText.replace(regexSelfClosing, '');
      });
      return cleanedText.trim();
    } catch (e) {
      try { Log.error('getDisplayText error', e); } catch (_) {}
      return '';
    }
  }

  function parseJourneyEntry(contentString) {
    if (!contentString || !String(contentString).trim()) return [];
    var blocks = String(contentString).trim().split(/\n\n+/);
    var events = blocks.map(function (block) {
      var event = {};
      var lines = block.trim().split('\n');
      var currentKey = null;
      lines.forEach(function (line) {
        var sep = line.indexOf('|');
        if (sep !== -1) {
          var key = line.substring(0, sep).trim();
          var value = line.substring(sep + 1);
          if (key) {
            event[key] = (value || '').trim();
            currentKey = key;
          }
        } else if (currentKey && event[currentKey] !== undefined) {
          event[currentKey] += '\n' + line;
        }
      });
      return event;
    }).filter(function (e) { return e && Object.keys(e).length > 0 && e['序号']; });

    return events;
  }

  function parsePastLifeEntry(contentString) {
    if (!contentString || typeof contentString !== 'string') return {};
    try {
      var data = {};
      var lines = contentString.trim().split('\n');
      lines.forEach(function (line) {
        var parts = line.split('|');
        if (parts.length >= 2) {
          var key = parts[0].trim();
          var value = parts.slice(1).join('|').trim();
          data[key] = value;
        }
      });
      return data;
    } catch (e) {
      try { Log.error('parsePastLifeEntry error', e); } catch (_) {}
      return {};
    }
  }

  var api = {
    formatMessageContent: formatMessageContent,
    getDisplayText: getDisplayText,
    extractLastTagContent: extractLastTagContent,
    parseJourneyEntry: parseJourneyEntry,
    parsePastLifeEntry: parsePastLifeEntry
  };

  try { Object.freeze(api); } catch (e) {}

  global.GuixuText = api;
})(window);
