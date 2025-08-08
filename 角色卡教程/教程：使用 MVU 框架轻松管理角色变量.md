---

# 教程：使用 MVU 框架轻松管理角色变量

## 引言：为什么要用 MVU？

在 SillyTavern 中创建动态角色时，管理变量（如好感度、状态等）至关重要。传统方法常依赖复杂的正则表达式或容易出错的 AI 指令。MVU (Magical Astrogy Variable Update) 框架提供了一种更现代、更可靠的解决方案，旨在解决这些痛点。

**MVU 的优势：**

*   **精确更新：** AI 只需输出标准化的更新指令，由精确的脚本执行，减少错误。
*   **历史独立：** 变量状态与每条消息关联，不依赖旧聊天记录，可随时隐藏/删除旧消息。
*   **可靠性高：** 减少了对 AI “自由发挥”的依赖，格式更严格，更新更可控。
*   **设置简单：** 配置流程清晰，易于上手。

本教程将指导你如何安装和使用 MVU 框架，为你的角色卡带来更稳定、更动态的变量管理体验。

## MVU 工作原理简介

MVU 的核心是一个后台脚本，它会读取 AI 输出的一种特定格式指令 (`_.set(...)`) 来更新变量。

1.  **状态存储 (`stat_data`)**: MVU 将所有变量及其状态存储在一个名为 `stat_data` 的特殊对象中，该对象附加到每条聊天消息上。
2.  **AI 指令 (`_.set(...)`)**: 你需要指导 AI 在需要更新变量时，输出特定格式的指令，如 `_.set('角色.变量路径', 旧值, 新值); //更新原因`。
3.  **脚本处理**: 安装的 MVU 脚本会自动检测并执行这些 `_.set` 指令，更新下一条消息的 `stat_data`。
4.  **EJS 访问**: 在世界书条目的 EJS 代码中，通过 `getvar("stat_data")` 可以访问到最新的变量状态。

## 安装 MVU 框架

按照以下步骤为你的角色卡配置 MVU：

**1. 添加 MVU 脚本**

*   打开角色卡编辑界面，找到“脚本” > “局部脚本”。
*   点击“添加脚本”。
*   **名称**: `MVU_Core` (或任意名称)
*   **内容**:
    ```javascript
    import 'https://gcore.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@master/artifact/bundle.js'
    ```
*   点击“确认”，然后**启用**该脚本。

**2. 添加正则表达式**

*   进入“正则表达式” > “局部正则”。
*   **正则一：隐藏更新块**
    *   **名称**: `MVU_Hide_UpdateBlock`
    *   **查找正则表达式**: `/<UpdateVariable>[\s\S]*?</UpdateVariable>/gm`
    *   **替换为**: (留空)
    *   **作用范围**: `AI输出`
    *   **其他选项**: 勾选 `仅格式显示`, `仅格式提示词`
*   **正则二：隐藏状态栏占位符 (如果未来使用相关功能)**
    *   **名称**: `MVU_Hide_StatusPlaceholder`
    *   **查找正则表达式**: `<StatusPlaceHolderImpl/>`
    *   **替换为**: (留空)
    *   **作用范围**: `AI输出`
    *   **其他选项**: 勾选 `仅格式提示词`

**3. 添加核心世界书条目 (AI 指令)**

*   在角色使用的世界书中，新建一个世界书条目。
*   **名称**: `MVU_AI_Instructions` (或任意名称)
*   **设置**: 设为**始终启用 (蓝灯)**，并置于列表**靠前**位置。
*   **内容**:
    ```ejs
    ---
    <status_current_variables>
    {{get_message_variable::stat_data}}
    </status_current_variables>

    rule:
      description: At the end of your response, you MUST output an <UpdateVariable> block if any variables changed based on the interaction and the rules below. Output this block only if changes occurred.
      analysis_guidelines:
        - **Rethink and list variables:** Review all variables defined within `<status_current_variables>`. Understand their current value and the provided description/update condition.
        - **Evaluate conditions:** Based on the latest user interaction and overall story progression, meticulously analyze if each variable satisfies its specific condition for change.
        - **Consider context:** Factor in the time passed and the narrative context. Significant events or time skips may warrant more substantial ("dramatic") updates.
        - **Counting variables:** For counting variables, change it when the corresponding event occur but don't change it any more during the same event.
        - **Numerical changes & thresholds:** When a numerical variable changes, check if it crosses any stage threshold and update to the corresponding stage. Ensure related stage variables (if any) are also updated accordingly in separate `_.set()` commands if applicable.
        - **Array handling:** if dest element is an array, only update and only output the first element, not `[]` block.
        - **Ignore meta-content:** Disregard summaries, out-of-character discussions, or instructions about formatting when evaluating the *narrative* reasons for variable changes.
      output_format: |-
        <UpdateVariable>
          <Analysis>
              ${variable_path}: Y/N //${brief_reason_for_change_if_Y_or_N}
              ...
          </Analysis>
          _.set('${path_of_changed_variable}', ${old_value}, ${new_value});
          ...
        </UpdateVariable>
      example: |-
        <UpdateVariable>
          <Analysis>
              诗织.与<user>的好感度: Y //<user>的关心让诗织感到温暖
              世界.当前时间段: Y //时间流逝，进入夜晚
              诗织.内心迷茫指数: N
          </Analysis>
          _.set('诗织.与<user>的好感度', 45, 52);
          _.set('世界.当前时间段', "放学后", "晚上");
        </UpdateVariable>
    ---
    ```

安装完成！现在可以开始使用 MVU 定义和管理变量了。

## 使用 MVU 定义和初始化变量

**1. 规划变量**

思考你的角色需要追踪哪些状态。例如，对于角色“诗织”：

*   `诗织.与<user>的好感度`
*   `诗织.自我压抑程度`
*   `世界.当前日期`
*   ...等等

**2. 创建 `[InitVar]` 初始化文件**

这是设置变量初始值的核心步骤。

*   新建一个世界书条目。
*   **名称**: 必须包含 `[InitVar]`，例如 `Character_InitVar [InitVar]`。
*   **状态**: 可以是**禁用**状态（灰灯）。
*   **内容**: 使用 **JSON5 格式**（注意：**绝对不允许使用 `//` 或 `/* */` 等任何任何注释！**），无论任何，都绝对禁止在json中使用注释！
定义变量的层级结构、初始值和描述/更新规则。
示例：
    ```json5
    {
      "诗织": {
        "与<user>的好感度": [
          0,
          "[-100, 100]之间。根据<user>与诗织的互动情感反馈进行更新。积极互动增加(3~7点)，消极互动减少(2~5点)。这是衡量两人关系的核心指标。"
        ],
        "自我压抑程度": [
          70,
          "[0, 100]之间。当诗织因为在意他人看法而隐藏真实想法时增加(2~4点)，当她尝试表达自我、被理解或感到安全时减少(3~6点)。数值越高越压抑。"
        ]
      },
      "世界": {
        "当前日期": [
          "04月10日",
          "格式为 MM月DD日，根据游戏内时间流逝更新。"
        ]
      }
    }
    ```
    注释：你可以在之后写注释，但是绝对不要在json中写注释！
    【【【json内绝对绝对绝对绝对不允许添加任何注释，如果一定需要请在文件外进行注释】】】
    *   每个变量都是一个数组 `[ 初始值, "描述/更新规则字符串" ]`。这个描述字符串会显示给 AI，指导它何时以及如何更新。

**3. (可选) 多开局设置**

如果需要在不同的开局设定不同的初始值，可以在角色卡的“问候语”或“高级问候语”**末尾**添加 `<UpdateVariable>` 块：

```
... 你的开局 ...

<UpdateVariable>
_.set('诗织.与<user>的好感度', 0, 25); // 覆盖初始好感度为 25
</UpdateVariable>
```
这里的旧值 (`0`) 可以随意填写，MVU 在初始化覆盖时不关心旧值。

## 在 EJS 中使用 MVU 变量 (告别 Config!)

这是将变量应用于角色行为的关键。MVU 的设计使得你**不再需要**使用旧教程中的 `_config` 条目和 `define` 函数来传递状态。

**核心访问方式：**

*   **数据源:** `getvar("stat_data")`。它返回 MVU 维护的、包含最新变量状态的 `stat_data` 对象。
*   **获取数值:** 要获取变量的实际值，使用完整路径并加上 `[0]`。例如：`getvar("stat_data").诗织.与<user>的好感度[0]`。
*   **无需 `const`/`let`:** 遵循极简原则，直接在需要的地方（如 `if` 条件）使用 `getvar(...)` 表达式。
*   **安全检查:** 推荐使用 `_.has(getvar("stat_data"), '路径[0]')` 在访问前检查变量是否存在，避免错误。(`_` 是 Lodash 库)。

**示例：分阶段好感度世界书 (`Shiori_Relationship_Stages.yaml`)**

```yaml
---
<relationship_shiori>
描述: 诗织在当前好感度下，对 <user> 的行为特征
当前好感度: <%= getvar("stat_data").诗织.与<user>的好感度[0] %>

  <%_ if (getvar("stat_data").诗织.与<user>的好感度[0] < 20) { _%>
    诗织:
      好感度阶段: 礼貌疏远 (< 20)
      daily_performance: 
        behavior:
          - "面对 <user> 时总是保持着完美的礼貌..."
        dialogue:
          - "<user>同学，早上好。今天天气不错呢。"
      # ... (其他行为分类) ...
  <%_ } if (getvar("stat_data").诗织.与<user>的好感度[0] >= 20 && getvar("stat_data").诗织.与<user>的好感度[0] < 50) { _%>
    诗织:
      好感度阶段: 好奇接近 (20-49)
      # ... (省略) ...
  <%_ } if (getvar("stat_data").诗织.与<user>的好感度[0] >= 50 && getvar("stat_data").诗织.与<user>的好感度[0] < 80) {_%>
    诗织:
      好感度阶段: 信任萌芽 (50-79)
      # ... (省略) ...
  <%_ } if (getvar("stat_data").诗织.与<user>的好感度[0] >= 80) { _%>
    诗织:
      好感度阶段: 深度依赖 (80+)
      # ... (省略) ...
  <%_ } else { _%>
  <!-- 好感度变量未初始化或获取失败 -->
<%_ } _%>
</relationship_shiori>
---
```

**为什么这样更好？**

MVU 框架保证了 `stat_data` 在 EJS 执行时是可用的最新状态。直接访问它避免了创建额外的 `config` 中间层，代码更直接，且完美符合了不使用局部变量声明的要求。

## 从旧系统迁移到 MVU

**1. 移除旧组件:**
    *   **Regex/@...@ 系统:** 删除或禁用用于解析 `@...@` 并调用 `{{setvar::...}}` 的正则。
    *   **Config/Define 系统:** 删除或禁用你的 `_config` 世界书条目。

**2. 添加 MVU 组件:** 按照“安装步骤”操作。

**3. 创建 `[InitVar]` 文件:** 将旧系统的初始值设定逻辑，转化为 MVU 的 `[InitVar]` JSON5 格式，**重点是添加清晰的“描述/更新规则”字符串**。

**4. 更新 AI 指令:** 确保 AI 被告知要输出 `<UpdateVariable>` 和 `_.set(...)` 格式，而不是旧格式。核心是让 AI 理解 `[InitVar]` 中的描述。

**5. 修改 EJS:**
    *   **将 `getvar('变量.xxx')` 或 `config.xxx` 全部替换为 `getvar("stat_data").路径[0]`。**
    *   **将对 `config` 是否存在的检查替换为 `_.has(getvar("stat_data"), '路径[0]')`。**

迁移的关键在于理解 `stat_data` 取代了旧的持久化变量存储和 `config` 广播机制，成为新的、统一的状态访问入口。

## 调试技巧

*   **Variable Viewer 插件:** 使用 `/variableviewer` 查看当前的 `stat_data`。
*   **检查 AI 输出:** 在开发者工具的网络标签页或 SillyTavern 日志中查看原始 AI 回复，确认 `<UpdateVariable>` 块的格式和 `_.set()` 指令是否正确。
*   **检查聊天文件 (`.jsonl`)**: 每条 AI 消息后都记录了当时的 `stat_data`，便于追溯问题。

## 结语

MVU 提供了一种强大而可靠的方式来管理角色变量，让你从繁琐的正则和不确定的 AI 行为中解放出来。遵循本教程的步骤，特别是直接使用 `getvar("stat_data")` 的 EJS 访问方式，你将能构建出更加生动、稳定和富有动态的角色！