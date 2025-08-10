/**
 * 归墟 - MVU 桥接服务
 * 封装 handleAction 主流程，包括：
 *  - 组装指令与用户输入
 *  - 调用 AI 生成
 *  - 调用 MVU 更新（带超时与备用方案）
 *  - 静默写回第0层
 * 挂载到 window.GuixuMvuBridge
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('MVU-Bridge') : console;
  var API = global.GuixuAPI;
  var _ = global._;

  if (!API || !_) {
    console.error('[归墟] MVU Bridge 服务无法初始化：缺少核心依赖（API, _）。');
    return;
  }

  // --- 内部辅助函数，从 function.ts 移植 ---
  function _trimQuotes(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/^['"` ]*(.*?)['"` ]*$/, '$1');
  }

  function _parseCommandValue(valStr) {
    if (typeof valStr !== 'string') return valStr;
    const trimmed = valStr.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;
    try { return JSON.parse(trimmed); } catch (e) {
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { return new Function(`return ${trimmed};`)(); } catch (err) { /* continue */ }
      }
    }
    return _trimQuotes(valStr);
  }

  function _findMatchingCloseParen(str, startPos) {
    let parenCount = 1, inQuote = false, quoteChar = '';
    for (let i = startPos; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'" || char === '`') && str[i - 1] !== '\\') {
        if (!inQuote) { inQuote = true; quoteChar = char; } else if (char === quoteChar) { inQuote = false; }
      }
      if (!inQuote) {
        if (char === '(') parenCount++;
        else if (char === ')') { parenCount--; if (parenCount === 0) return i; }
      }
    }
    return -1;
  }

  function _parseParameters(paramsString) {
    const params = [];
    let currentParam = '', inQuote = false, quoteChar = '', bracketCount = 0, braceCount = 0, parenCount = 0;
    for (let i = 0; i < paramsString.length; i++) {
      const char = paramsString[i];
      if ((char === '"' || char === "'" || char === '`') && (i === 0 || paramsString[i - 1] !== '\\')) {
        if (!inQuote) { inQuote = true; quoteChar = char; } else if (char === quoteChar) { inQuote = false; }
      }
      if (!inQuote) {
        if (char === '(') parenCount++; if (char === ')') parenCount--;
        if (char === '[') bracketCount++; if (char === ']') bracketCount--;
        if (char === '{') braceCount++; if (char === '}') braceCount--;
      }
      if (char === ',' && !inQuote && parenCount === 0 && bracketCount === 0 && braceCount === 0) {
        params.push(currentParam.trim()); currentParam = ''; continue;
      }
      currentParam += char;
    }
    if (currentParam.trim()) params.push(currentParam.trim());
    return params;
  }

  function _extractCommands(inputText) {
    const results = [];
    let i = 0;
    while (i < inputText.length) {
      const match = inputText.substring(i).match(/_\.(set|assign|remove|add|insert)\(/);
      if (!match || match.index === undefined) break;
      const commandType = match[1];
      const start = i + match.index;
      const openParen = start + match[0].length;
      const closeParen = _findMatchingCloseParen(inputText, openParen);
      if (closeParen === -1) { i = openParen; continue; }
      let endPos = closeParen + 1;
      if (endPos >= inputText.length || inputText[endPos] !== ';') { i = closeParen + 1; continue; }
      endPos++;
      const paramsString = inputText.substring(openParen, closeParen);
      const params = _parseParameters(paramsString);
      results.push({ command: commandType, args: params });
      i = endPos;
    }
    return results;
  }

  function _applyUpdateFallback(script, currentMvuState) {
    if (!script || !currentMvuState) return null;
    const newState = _.cloneDeep(currentMvuState);
    let modified = false;
    const commands = _extractCommands(script);
    for (const command of commands) {
      try {
        const path = _trimQuotes(command.args[0]);
        switch (command.command) {
          case 'set': {
            const newValueStr = command.args.length >= 2 ? command.args[1] : undefined;
            if (newValueStr === undefined) continue;
            let newValue = _parseCommandValue(newValueStr);
            if (newValue instanceof Date) newValue = newValue.toISOString();
            _.set(newState.stat_data, path, newValue);
            modified = true;
            break;
          }
          case 'add': {
            const value = _.get(newState.stat_data, path);
            const delta = _parseCommandValue(command.args[1]);
            if (typeof value === 'number' && typeof delta === 'number') {
              _.set(newState.stat_data, path, value + delta);
              modified = true;
            }
            break;
          }
          case 'remove': { _.unset(newState.stat_data, path); modified = true; break; }
          case 'assign': case 'insert': {
            if (command.args.length === 2) {
              const valueToAssign = _parseCommandValue(command.args[1]);
              const parentCollection = _.get(newState.stat_data, path);
              if (Array.isArray(parentCollection) && parentCollection.length === 2 && Array.isArray(parentCollection[0]) && typeof parentCollection[1] === 'string') {
                const newInnerArray = parentCollection[0].concat(Array.isArray(valueToAssign) ? valueToAssign : [valueToAssign]);
                _.set(newState.stat_data, path, [newInnerArray, parentCollection[1]]);
              } else if (Array.isArray(parentCollection)) {
                _.set(newState.stat_data, path, parentCollection.concat(Array.isArray(valueToAssign) ? valueToAssign : [valueToAssign]));
              } else if (_.isObject(parentCollection)) {
                _.merge(parentCollection, valueToAssign);
              } else {
                _.set(newState.stat_data, path, valueToAssign);
              }
              modified = true;
            } else if (command.args.length >= 3) {
              const keyOrIndex = _parseCommandValue(command.args[1]);
              const valueToAssign = _parseCommandValue(command.args[2]);
              let collection = _.get(newState.stat_data, path);
              if (Array.isArray(collection)) {
                if (typeof keyOrIndex === 'number') {
                  const newCollection = [...collection];
                  newCollection.splice(keyOrIndex, 0, valueToAssign);
                  _.set(newState.stat_data, path, newCollection);
                  modified = true;
                }
              } else if (_.isObject(collection)) {
                _.set(collection, String(keyOrIndex), valueToAssign);
                modified = true;
              } else {
                const newCollection = {};
                _.set(newCollection, String(keyOrIndex), valueToAssign);
                _.set(newState.stat_data, path, newCollection);
                modified = true;
              }
            }
            break;
          }
        }
      } catch (e) { Log.error(`处理指令失败:`, command, e); }
    }
    return modified ? newState : null;
  }

  async function handleAction(pendingActions, currentMvuState, userMessage = '') {
    // 1. 整合输入
    let commandText = '';
    if (pendingActions && pendingActions.length > 0) {
      commandText += '[本轮行动指令]\n';
      pendingActions.forEach(cmd => {
        let actionText = '';
        switch (cmd.action) {
          case 'equip': actionText = `装备 [${cmd.itemName}] 到 [${cmd.category}] 槽位。`; break;
          case 'unequip': actionText = `卸下 [${cmd.itemName}] 从 [${cmd.category}] 槽位。`; break;
          case 'use': actionText = `使用 ${cmd.quantity} 个 [${cmd.itemName}]。`; break;
          case 'discard': actionText = `丢弃 ${cmd.quantity > 1 ? `${cmd.quantity} 个 ` : ''}[${cmd.itemName}]。`; break;
        }
        commandText += `- ${actionText}\n`;
      });
    }

    if (!userMessage && !commandText) {
      return { success: false, message: '请输入回复或添加指令后发送。' };
    }

    // 2. 构建 GenerateConfig
    const generateConfig = { injects: [], should_stream: false };
    let combinedContent = (commandText ? commandText + '\n' : '') + (userMessage ? `<行动选择>\n${userMessage}\n</行动选择>` : '');
    if (combinedContent) {
      generateConfig.injects.push({ role: 'user', content: combinedContent, position: 'in_chat', depth: 0, should_scan: true });
    }

    try {
      // 3. 调用 generate
      const aiResponse = await API.generate(generateConfig);
      if (typeof aiResponse !== 'string') throw new Error('AI未返回有效文本。');
      Log.log('AI原始回复:', aiResponse);

      // 4. 调用 mag_invoke_mvu
      let newMvuState = null;
      if (aiResponse && currentMvuState) {
        const inputData = { old_variables: currentMvuState };
        let mvuSucceeded = false;
        try {
          const mvuPromise = API.emit('mag_invoke_mvu', aiResponse, inputData);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MVU event timeout')), 3000));
          await Promise.race([mvuPromise, timeoutPromise]);
          if (inputData.new_variables) {
            newMvuState = inputData.new_variables;
            mvuSucceeded = true;
            Log.log('mvu 状态已更新:', newMvuState);
          } else {
            Log.log('mvu 未返回新状态，尝试前端备用方案。');
          }
        } catch (eventError) {
          Log.error('调用 mag_invoke_mvu 事件时发生错误或超时，尝试前端备用方案:', eventError);
        }
        if (!mvuSucceeded) {
          const modifiedState = _applyUpdateFallback(aiResponse, currentMvuState);
          if (modifiedState) {
            newMvuState = modifiedState;
            Log.log('前端模拟更新成功。');
          }
        }
      } else {
        Log.log('未找到更新脚本或当前mvu状态为空，跳过mvu更新。');
      }

      // 5. 静默保存到第0层
      const messages = await API.getChatMessages('0');
      if (messages && messages.length > 0) {
        const messageZero = messages[0];
        messageZero.message = aiResponse;
        messageZero.data = newMvuState || currentMvuState;
        await API.setChatMessages([messageZero], { refresh: 'none' });
        Log.log('已静默更新第0层。');
      } else {
        Log.error('未找到第0层消息，无法更新。');
      }

      return { success: true, message: '伟大梦星已回应。', aiResponse: aiResponse, newMvuState: newMvuState || currentMvuState, lastSentPrompt: combinedContent };

    } catch (error) {
      Log.error('处理动作时出错:', error);
      return { success: false, message: `和伟大梦星沟通失败: ${error.message}` };
    }
  }

  var api = { handleAction: handleAction };
  try { Object.freeze(api); } catch (e) {}

  global.GuixuMvuBridge = api;
})(window);
