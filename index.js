(() => {
    'use strict';

    const MODULE_ID = 'plot_weaver';
    const MODULE_NAME = '剧情灵感工坊';
    const HISTORY_LIMIT = 12;

    if (globalThis.__plotWeaverLoaded) {
        return;
    }
    globalThis.__plotWeaverLoaded = true;

    const DEFAULT_SETTINGS = Object.freeze({
        mode: 'directions',
        count: 5,
        creativity: 'balanced',
        scope: 'next_scene',
        sideTimeline: 'auto',
        characterConsistency: true,
        avoidRepeat: true,
        preferForeshadow: true,
        respectPlayerAgency: true,
        autoSave: true,
        globalPreference: '',
    });

    const MODES = Object.freeze({
        directions: {
            name: '剧情走向',
            icon: 'fa-code-branch',
            description: '从当前节点推演多个合理分支',
        },
        new_scene: {
            name: '新剧情',
            icon: 'fa-clapperboard',
            description: '生成可直接接上的新场景与开头',
        },
        side_story: {
            name: '番外',
            icon: 'fa-book-open',
            description: '写主线之外、又与人物有关的故事',
        },
        outline: {
            name: '大纲',
            icon: 'fa-list-ol',
            description: '整理章节节拍、冲突升级与收束',
        },
        foreshadow: {
            name: '伏笔工坊',
            icon: 'fa-seedling',
            description: '识别已有线索并设计自然回收方式',
        },
        wildcard: {
            name: '灵感盲盒',
            icon: 'fa-wand-magic-sparkles',
            description: '混合事件、秘密、选择与小转折',
        },
    });

    const CREATIVITY = Object.freeze({
        steady: '稳妥：优先沿用已有矛盾、人物目标和线索，只补充少量新元素。',
        balanced: '平衡：在保持连续性的前提下加入新信息，让结果既合理又有新鲜感。',
        bold: '大胆：允许更强的意外与结构变化，但不能靠角色突然失智、强行巧合或推翻既有设定。',
    });

    const SCOPES = Object.freeze({
        next_scene: '紧接当前最后一幕，短期内可以发生',
        current_arc: '服务于当前篇章，允许跨越数个场景',
        new_arc: '从现有主线自然开启一个新篇章',
        long_term: '面向中长线发展，允许分阶段铺垫与回收',
    });

    const SIDE_TIMELINES = Object.freeze({
        auto: '由上下文判断最合适的位置',
        prequel: '前传：发生在当前主线之前',
        interlude: '间章：嵌在主线两个场景之间',
        parallel: '同期：与主线同时发生的另一视角',
        aftermath: '后日谈：发生在当前主线告一段落之后',
    });

    let settings = { ...DEFAULT_SETTINGS };
    let currentResult = '';
    let currentRequest = null;
    let transientHistory = [];
    let isGenerating = false;

    function getContext() {
        try {
            return globalThis.SillyTavern?.getContext?.() ?? null;
        } catch (error) {
            console.error(`[${MODULE_NAME}] 无法读取酒馆上下文`, error);
            return null;
        }
    }

    function delay(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    function notify(type, message) {
        const toaster = globalThis.toastr;
        if (toaster && typeof toaster[type] === 'function') {
            toaster[type](message, MODULE_NAME);
            return;
        }
        const logger = type === 'error' ? console.error : console.log;
        logger(`[${MODULE_NAME}] ${message}`);
    }

    function loadSettings() {
        const context = getContext();
        const extensionSettings = context?.extensionSettings;
        const saved = extensionSettings?.[MODULE_ID] ?? {};
        settings = { ...DEFAULT_SETTINGS, ...saved };

        if (extensionSettings) {
            extensionSettings[MODULE_ID] = settings;
        }
    }

    function saveSettings() {
        const context = getContext();
        if (context?.extensionSettings) {
            context.extensionSettings[MODULE_ID] = settings;
            context.saveSettingsDebounced?.();
        }
    }

    function getHistory() {
        const metadata = getContext()?.chatMetadata;
        if (!metadata) {
            return transientHistory;
        }

        if (!metadata[MODULE_ID] || !Array.isArray(metadata[MODULE_ID].history)) {
            metadata[MODULE_ID] = { history: [] };
        }
        return metadata[MODULE_ID].history;
    }

    async function persistHistory() {
        const context = getContext();
        try {
            await context?.saveMetadata?.();
        } catch (error) {
            console.warn(`[${MODULE_NAME}] 灵感历史暂时无法写入聊天元数据`, error);
        }
    }

    async function addHistory(content, request) {
        const history = getHistory();
        history.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
            mode: request.mode,
            content: content.slice(0, 40000),
        });
        history.splice(HISTORY_LIMIT);
        transientHistory = history;
        await persistHistory();
        renderHistory();
    }

    function injectMenuButton() {
        const menu = document.querySelector('#extensionsMenu');
        if (!menu || document.querySelector('#plot_weaver_menu_button')) {
            return Boolean(menu);
        }

        const button = document.createElement('div');
        button.id = 'plot_weaver_menu_button';
        button.className = 'list-group-item flex-container flexGap5 interactable';
        button.tabIndex = 0;
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', '打开剧情灵感工坊');
        button.innerHTML = '<i class="fa-solid fa-feather-pointed"></i><span>剧情灵感工坊</span>';
        button.addEventListener('click', openPanel);
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPanel();
            }
        });
        menu.append(button);
        return true;
    }

    function panelTemplate() {
        const modeButtons = Object.entries(MODES).map(([id, mode]) => `
            <button class="pw-mode" type="button" data-mode="${id}" aria-pressed="false">
                <i class="fa-solid ${mode.icon}" aria-hidden="true"></i>
                <span class="pw-mode-copy"><strong>${mode.name}</strong><small>${mode.description}</small></span>
            </button>
        `).join('');

        return `
            <div id="plot_weaver_overlay" class="pw-overlay" hidden>
                <section class="pw-panel" role="dialog" aria-modal="true" aria-labelledby="plot_weaver_title">
                    <header class="pw-header">
                        <div>
                            <p class="pw-eyebrow">CONTEXT-AWARE STORY IDEAS</p>
                            <h2 id="plot_weaver_title"><i class="fa-solid fa-feather-pointed" aria-hidden="true"></i> 剧情灵感工坊</h2>
                            <p>结合当前角色、世界书与最近剧情，使用酒馆当前选中的模型生成。</p>
                        </div>
                        <button id="plot_weaver_close" class="pw-icon-button" type="button" aria-label="关闭">
                            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </header>

                    <div class="pw-body">
                        <div class="pw-workspace">
                            <section class="pw-section" aria-labelledby="pw_mode_heading">
                                <div class="pw-section-title">
                                    <h3 id="pw_mode_heading">想生成什么？</h3>
                                    <span id="pw_mode_hint"></span>
                                </div>
                                <div class="pw-mode-grid">${modeButtons}</div>
                            </section>

                            <section class="pw-section pw-options" aria-labelledby="pw_options_heading">
                                <h3 id="pw_options_heading">生成偏好</h3>
                                <div class="pw-control-grid">
                                    <label class="pw-field">
                                        <span id="pw_count_label">方案数量</span>
                                        <select id="pw_count">
                                            <option value="3">3</option>
                                            <option value="5">5</option>
                                            <option value="7">7</option>
                                        </select>
                                    </label>
                                    <label class="pw-field">
                                        <span>创意幅度</span>
                                        <select id="pw_creativity">
                                            <option value="steady">稳妥</option>
                                            <option value="balanced">平衡</option>
                                            <option value="bold">大胆</option>
                                        </select>
                                    </label>
                                    <label class="pw-field">
                                        <span>时间范围</span>
                                        <select id="pw_scope">
                                            <option value="next_scene">紧接下一幕</option>
                                            <option value="current_arc">当前篇章</option>
                                            <option value="new_arc">开启新篇</option>
                                            <option value="long_term">中长线</option>
                                        </select>
                                    </label>
                                    <label id="pw_timeline_field" class="pw-field" hidden>
                                        <span>番外位置</span>
                                        <select id="pw_side_timeline">
                                            <option value="auto">自动判断</option>
                                            <option value="prequel">前传</option>
                                            <option value="interlude">间章</option>
                                            <option value="parallel">同期另一视角</option>
                                            <option value="aftermath">后日谈</option>
                                        </select>
                                    </label>
                                </div>

                                <div class="pw-check-grid">
                                    <label><input id="pw_character_consistency" type="checkbox"> 保持人物性格与动机一致</label>
                                    <label><input id="pw_avoid_repeat" type="checkbox"> 避免复述已经发生的剧情</label>
                                    <label><input id="pw_prefer_foreshadow" type="checkbox"> 优先利用已有细节与伏笔</label>
                                    <label><input id="pw_respect_player_agency" type="checkbox"> 不替玩家角色强行做决定</label>
                                </div>

                                <label class="pw-field pw-wide-field">
                                    <span>这一次的额外要求 <small>（可留空）</small></span>
                                    <textarea id="pw_custom_request" rows="3" maxlength="2000" placeholder="例如：更偏悬疑；让配角发挥作用；不要新增反派；希望这一幕发生在雨夜……"></textarea>
                                </label>

                                <details class="pw-advanced">
                                    <summary>长期偏好与记录设置</summary>
                                    <label class="pw-field pw-wide-field">
                                        <span>每次都要遵守的创作偏好</span>
                                        <textarea id="pw_global_preference" rows="2" maxlength="2000" placeholder="例如：偏爱群像悬疑；少用巧合和误会；语言简洁；重要转折提前铺垫……"></textarea>
                                    </label>
                                    <label class="pw-toggle"><input id="pw_auto_save" type="checkbox"> 自动把结果保存在当前聊天的灵感记录中（最多 ${HISTORY_LIMIT} 条）</label>
                                </details>

                                <button id="pw_generate" class="pw-primary-button" type="button">
                                    <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                                    <span>结合当前剧情生成</span>
                                </button>
                                <div id="pw_status" class="pw-status" role="status" aria-live="polite">准备就绪，不会自动发送消息。</div>
                            </section>

                            <section class="pw-section pw-result-section" aria-labelledby="pw_result_heading">
                                <div class="pw-section-title">
                                    <h3 id="pw_result_heading">生成结果</h3>
                                    <span id="pw_result_badge">尚未生成</span>
                                </div>
                                <div id="pw_result" class="pw-result pw-placeholder">选择一种模式，然后点击“结合当前剧情生成”。</div>
                                <div id="pw_result_actions" class="pw-result-actions" hidden>
                                    <button type="button" data-result-action="copy"><i class="fa-regular fa-copy"></i> 复制</button>
                                    <button type="button" data-result-action="insert"><i class="fa-solid fa-arrow-turn-down"></i> 填入输入框</button>
                                    <button type="button" data-result-action="regenerate"><i class="fa-solid fa-rotate"></i> 换一批</button>
                                </div>
                                <div id="pw_refine_box" class="pw-refine" hidden>
                                    <label class="pw-field pw-wide-field">
                                        <span>继续细化</span>
                                        <textarea id="pw_refine_request" rows="2" maxlength="1200" placeholder="例如：展开第 2 个方案；让节奏慢一点；改成三章大纲……"></textarea>
                                    </label>
                                    <button id="pw_refine" type="button"><i class="fa-solid fa-pen-ruler"></i> 按要求细化</button>
                                </div>
                            </section>
                        </div>

                        <aside class="pw-history" aria-labelledby="pw_history_heading">
                            <div class="pw-section-title">
                                <div>
                                    <p class="pw-eyebrow">CURRENT CHAT</p>
                                    <h3 id="pw_history_heading">灵感记录</h3>
                                </div>
                                <button id="pw_clear_history" class="pw-text-button" type="button">清空</button>
                            </div>
                            <p class="pw-history-note">记录跟随当前聊天保存，切换聊天时会自动切换。</p>
                            <div id="pw_history_list" class="pw-history-list"></div>
                        </aside>
                    </div>
                </section>
            </div>
        `;
    }

    function injectPanel() {
        if (document.querySelector('#plot_weaver_overlay')) {
            return;
        }
        document.body.insertAdjacentHTML('beforeend', panelTemplate());
        bindPanelEvents();
        syncControlsFromSettings();
        renderHistory();
    }

    function bindPanelEvents() {
        const overlay = document.querySelector('#plot_weaver_overlay');
        const panel = overlay?.querySelector('.pw-panel');

        document.querySelector('#plot_weaver_close')?.addEventListener('click', closePanel);
        overlay?.addEventListener('mousedown', (event) => {
            if (event.target === overlay) {
                closePanel();
            }
        });
        panel?.addEventListener('mousedown', (event) => event.stopPropagation());

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !overlay?.hidden) {
                closePanel();
            }
        });

        document.querySelectorAll('.pw-mode').forEach((button) => {
            button.addEventListener('click', () => {
                settings.mode = button.dataset.mode;
                saveSettings();
                syncControlsFromSettings();
            });
        });

        const settingBindings = [
            ['#pw_count', 'count', (value) => Number(value)],
            ['#pw_creativity', 'creativity'],
            ['#pw_scope', 'scope'],
            ['#pw_side_timeline', 'sideTimeline'],
            ['#pw_character_consistency', 'characterConsistency', (_, element) => element.checked],
            ['#pw_avoid_repeat', 'avoidRepeat', (_, element) => element.checked],
            ['#pw_prefer_foreshadow', 'preferForeshadow', (_, element) => element.checked],
            ['#pw_respect_player_agency', 'respectPlayerAgency', (_, element) => element.checked],
            ['#pw_auto_save', 'autoSave', (_, element) => element.checked],
            ['#pw_global_preference', 'globalPreference'],
        ];

        for (const [selector, key, transform] of settingBindings) {
            const element = document.querySelector(selector);
            const eventName = element?.matches('textarea') ? 'input' : 'change';
            element?.addEventListener(eventName, () => {
                settings[key] = transform ? transform(element.value, element) : element.value;
                saveSettings();
            });
        }

        document.querySelector('#pw_generate')?.addEventListener('click', () => generateIdeas());
        document.querySelector('#pw_refine')?.addEventListener('click', refineResult);
        document.querySelector('#pw_result_actions')?.addEventListener('click', handleResultAction);
        document.querySelector('#pw_history_list')?.addEventListener('click', handleHistoryAction);
        document.querySelector('#pw_clear_history')?.addEventListener('click', clearHistory);
    }

    function syncControlsFromSettings() {
        for (const button of document.querySelectorAll('.pw-mode')) {
            const active = button.dataset.mode === settings.mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        }

        const values = {
            '#pw_count': String(settings.count),
            '#pw_creativity': settings.creativity,
            '#pw_scope': settings.scope,
            '#pw_side_timeline': settings.sideTimeline,
            '#pw_global_preference': settings.globalPreference,
        };
        for (const [selector, value] of Object.entries(values)) {
            const element = document.querySelector(selector);
            if (element) element.value = value;
        }

        const checks = {
            '#pw_character_consistency': settings.characterConsistency,
            '#pw_avoid_repeat': settings.avoidRepeat,
            '#pw_prefer_foreshadow': settings.preferForeshadow,
            '#pw_respect_player_agency': settings.respectPlayerAgency,
            '#pw_auto_save': settings.autoSave,
        };
        for (const [selector, checked] of Object.entries(checks)) {
            const element = document.querySelector(selector);
            if (element) element.checked = Boolean(checked);
        }

        const mode = MODES[settings.mode] ?? MODES.directions;
        const hint = document.querySelector('#pw_mode_hint');
        if (hint) hint.textContent = mode.description;

        const countLabel = document.querySelector('#pw_count_label');
        if (countLabel) {
            countLabel.textContent = settings.mode === 'outline' ? '章节数量' : '方案数量';
        }

        const timelineField = document.querySelector('#pw_timeline_field');
        if (timelineField) timelineField.hidden = settings.mode !== 'side_story';
    }

    function openPanel() {
        injectPanel();
        const overlay = document.querySelector('#plot_weaver_overlay');
        if (!overlay) return;
        overlay.hidden = false;
        document.body.classList.add('pw-no-scroll');
        renderHistory();
        setTimeout(() => overlay.querySelector('.pw-mode.is-active')?.focus(), 0);
    }

    function closePanel() {
        const overlay = document.querySelector('#plot_weaver_overlay');
        if (overlay) overlay.hidden = true;
        document.body.classList.remove('pw-no-scroll');
        document.querySelector('#plot_weaver_menu_button')?.focus();
    }

    function buildRequest() {
        return {
            mode: settings.mode,
            count: Number(settings.count) || 5,
            creativity: settings.creativity,
            scope: settings.scope,
            sideTimeline: settings.sideTimeline,
            characterConsistency: settings.characterConsistency,
            avoidRepeat: settings.avoidRepeat,
            preferForeshadow: settings.preferForeshadow,
            respectPlayerAgency: settings.respectPlayerAgency,
            customRequest: document.querySelector('#pw_custom_request')?.value.trim() ?? '',
            globalPreference: settings.globalPreference.trim(),
        };
    }

    function buildModeInstruction(request) {
        const count = request.count;
        const instructions = {
            directions: `给出 ${count} 条彼此真正不同的后续走向。每条包含：\n1. 简短标题\n2. 与当前最后一幕的接续点\n3. 核心事件与推动它发生的人物动机\n4. 主要冲突或选择\n5. 可利用的既有细节/伏笔（没有可靠依据就写“无明确伏笔”）\n6. 短期影响与可能的长线后果\n7. 一句可用于开启下一幕的“入场钩子”\n最后补一个简短比较：哪条最稳、哪条最有张力、哪条最适合长线。`,
            new_scene: `设计 ${count} 个可以直接接入当前故事的新剧情方案。每个方案包含：\n1. 标题与一句话定位\n2. 承接当前剧情的依据\n3. 场景、时间与出场角色\n4. 触发事件\n5. 三到五个推进节拍\n6. 留给玩家角色的可选回应空间\n7. 一段可直接使用的开场文字（简洁，不替玩家角色说话或行动）\n各方案不能只是换地点，核心矛盾也要不同。`,
            side_story: `创作 ${count} 个番外方案。番外时间位置为“${SIDE_TIMELINES[request.sideTimeline] ?? SIDE_TIMELINES.auto}”。每个方案包含：\n1. 标题、时间位置与视角人物\n2. 为什么值得写，以及它与主线的隐性联系\n3. 开端—发展—转折—收束四个节拍\n4. 能补充的人物侧面或世界信息\n5. 结尾如何轻轻呼应主线\n6. 一小段开场示例\n番外应能独立阅读，但不能破坏主线事实。`,
            outline: `把后续内容整理为 ${count} 章的大纲。先用两三句话说明这一阶段的核心命题和主矛盾，然后逐章给出：\n1. 章节标题与目标\n2. 场景/事件节拍\n3. 角色主动行为与阻力\n4. 新信息、伏笔或回收\n5. 章末钩子\n最后列出：冲突升级曲线、人物变化线、仍需保留的悬念，以及一个不过度仓促的阶段性收束。`,
            foreshadow: `根据当前上下文，整理并扩展 ${count} 个伏笔机会。每个包含：\n1. 线索名称\n2. 依据：明确指出来自当前剧情的哪类已知细节；无法确认时标为“新伏笔候选”，不能伪装成旧线索\n3. 至少两种可能真相\n4. 最自然的再次出现方式\n5. 合适的回收时机与回收效果\n6. 如何避免显得刻意\n最后指出哪些伏笔可以组合，哪些彼此冲突。`,
            wildcard: `生成 ${count} 枚互不重复的剧情灵感。混合使用：突发事件、角色秘密、环境变化、误导信息、道德选择、关系变化、日常小事或世界规则，但不要每条都靠反派或巧合。每枚包含：\n1. 一句话灵感\n2. 它为何适合当前上下文\n3. 最小可执行场景\n4. 可能引出的后果\n5. 使用时需要避免的连续性问题。`,
        };
        return instructions[request.mode] ?? instructions.directions;
    }

    function booleanGuideline(enabled, enabledText, disabledText) {
        return enabled ? `- ${enabledText}` : `- ${disabledText}`;
    }

    function protectDelimiter(text) {
        return String(text).replaceAll('</', '<\/');
    }

    function buildPrompt(request) {
        const mode = MODES[request.mode] ?? MODES.directions;
        const customRequest = request.customRequest || '无额外要求';
        const globalPreference = request.globalPreference || '无长期偏好';

        return `你是“剧情灵感工坊”，负责为互动故事提供可执行、尊重连续性的剧情策划。请读取本次请求随附的当前角色卡、世界书、作者注释和聊天记录，尤其关注最新一段剧情。只输出最终策划结果，不展示思考过程。

<context_rules>
- 只把当前会话中已经出现的信息当作事实，不串入其他聊天或常见套路中的设定。
- 先判断人物此刻知道什么、想要什么、受什么限制，再设计事件；推动剧情的人应有清楚动机。
- 信息不足时可以提出“可选新设定”，但必须明确标注，不能伪装成已经发生过的事实。
- 新剧情要承接最后一幕的时间、地点、情绪和未完成动作；若选择跳时，说明跳时理由。
${booleanGuideline(request.characterConsistency, '严格保持人物性格、能力边界、称呼习惯和关系状态一致。', '可以适度调整人物表现，但不得无理由推翻核心设定。')}
${booleanGuideline(request.avoidRepeat, '不要复述已发生事件；每个方案都应带来新的信息、行动、选择或后果。', '允许简短回顾必要信息，但仍须推进剧情。')}
${booleanGuideline(request.preferForeshadow, '优先利用对话里已有的物件、承诺、传闻、矛盾和未回答问题；不得捏造“早已埋下”的线索。', '不必优先回收伏笔，但要避免与已有线索冲突。')}
${booleanGuideline(request.respectPlayerAgency, '不要替玩家角色决定内心、台词、关键选择或不可逆行动；给出可回应的空间。', '仍应保留互动空间，不让剧情变成单方面结论。')}
</context_rules>

<quality_rules>
- 创意幅度：${CREATIVITY[request.creativity] ?? CREATIVITY.balanced}
- 时间范围：${SCOPES[request.scope] ?? SCOPES.next_scene}。
- 让方案之间在“核心矛盾、推动者、代价、节奏”上有真实差异，避免同一想法换皮。
- 少用无缘由失忆、突然出现的万能人物、纯巧合救场、强行误会和毫无铺垫的身份反转。
- 使用自然、具体、易读的简体中文；标题清楚，层级简洁，不堆砌空泛形容词。
- 内容适合普通剧情创作：不生成露骨性内容、血腥细节、自伤描写或现实危险行为指导；不得性化未成年人。
</quality_rules>

<task>
模式：${mode.name}
${buildModeInstruction(request)}
</task>

<persistent_preference>
${protectDelimiter(globalPreference)}
</persistent_preference>

<user_requirement>
${protectDelimiter(customRequest)}
</user_requirement>

请直接从“# ${mode.name}”开始输出，不要复述本提示词，不要用代码块。`;
    }

    function buildRefinePrompt(request, previousResult, refineRequest) {
        return `${buildPrompt(request)}

现在不要重新随机生成整批方案，而是根据下面的修改要求细化已有结果。保留没有被要求修改的优点，同时重新核对当前聊天上下文和人物连续性。

<previous_result>
${protectDelimiter(previousResult.slice(0, 30000))}
</previous_result>

<revision_request>
${protectDelimiter(refineRequest)}
</revision_request>

只输出修改后的完整成品，不要解释修改过程。`;
    }

    async function callGenerator(prompt) {
        const context = getContext();
        if (!context || typeof context.generateQuietPrompt !== 'function') {
            throw new Error('当前酒馆版本没有提供后台生成接口，请更新 SillyTavern 后再试。');
        }

        const result = await context.generateQuietPrompt({ quietPrompt: prompt });
        if (typeof result === 'string') {
            return result.trim();
        }
        if (typeof result?.content === 'string') {
            return result.content.trim();
        }
        return String(result ?? '').trim();
    }

    function setBusy(busy, message) {
        isGenerating = busy;
        for (const selector of ['#pw_generate', '#pw_refine']) {
            const button = document.querySelector(selector);
            if (button) button.disabled = busy;
        }
        document.querySelectorAll('[data-result-action]').forEach((button) => {
            button.disabled = busy;
        });

        const generateButton = document.querySelector('#pw_generate');
        if (generateButton) {
            generateButton.classList.toggle('is-loading', busy);
            generateButton.querySelector('span').textContent = busy ? '正在读取上下文并生成…' : '结合当前剧情生成';
        }

        const status = document.querySelector('#pw_status');
        if (status && message) status.textContent = message;
    }

    function showResult(content, mode, badgeText) {
        currentResult = content;
        const result = document.querySelector('#pw_result');
        const badge = document.querySelector('#pw_result_badge');
        const actions = document.querySelector('#pw_result_actions');
        const refine = document.querySelector('#pw_refine_box');

        if (result) {
            result.textContent = content;
            result.classList.remove('pw-placeholder');
        }
        if (badge) badge.textContent = badgeText ?? MODES[mode]?.name ?? '生成结果';
        if (actions) actions.hidden = false;
        if (refine) refine.hidden = false;
    }

    async function generateIdeas({ reuseRequest = false } = {}) {
        if (isGenerating) return;
        const context = getContext();
        if (!context) {
            notify('error', '暂时无法读取酒馆上下文。');
            return;
        }
        if (!Array.isArray(context.chat)) {
            notify('warning', '请先打开一个角色或群聊。');
            return;
        }
        if (context.chat.length === 0) {
            notify('info', '当前聊天还没有消息，本次会主要依据角色卡和世界书生成。');
        }

        const request = reuseRequest && currentRequest ? currentRequest : buildRequest();
        currentRequest = request;
        setBusy(true, '正在结合当前角色、世界书和聊天记录生成，请稍候…');

        try {
            const content = await callGenerator(buildPrompt(request));
            if (!content) throw new Error('模型返回了空内容，请重试或检查当前 API 状态。');
            showResult(content, request.mode, MODES[request.mode]?.name);
            if (settings.autoSave) await addHistory(content, request);
            setBusy(false, '生成完成。结果没有自动发送，你可以复制、填入输入框或继续细化。');
        } catch (error) {
            console.error(`[${MODULE_NAME}] 生成失败`, error);
            setBusy(false, `生成失败：${error.message || '未知错误'}`);
            notify('error', error.message || '生成失败，请检查酒馆当前 API 连接。');
        }
    }

    async function refineResult() {
        if (isGenerating || !currentResult || !currentRequest) return;
        const input = document.querySelector('#pw_refine_request');
        const refineRequest = input?.value.trim() ?? '';
        if (!refineRequest) {
            notify('info', '先写下想怎样细化。');
            input?.focus();
            return;
        }

        setBusy(true, '正在按要求细化，并重新核对当前上下文…');
        try {
            const content = await callGenerator(buildRefinePrompt(currentRequest, currentResult, refineRequest));
            if (!content) throw new Error('模型返回了空内容，请重试。');
            showResult(content, currentRequest.mode, `${MODES[currentRequest.mode]?.name ?? '结果'} · 已细化`);
            if (settings.autoSave) await addHistory(content, currentRequest);
            if (input) input.value = '';
            setBusy(false, '细化完成。');
        } catch (error) {
            console.error(`[${MODULE_NAME}] 细化失败`, error);
            setBusy(false, `细化失败：${error.message || '未知错误'}`);
            notify('error', error.message || '细化失败，请稍后重试。');
        }
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const temporary = document.createElement('textarea');
        temporary.value = text;
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        document.body.append(temporary);
        temporary.select();
        document.execCommand('copy');
        temporary.remove();
    }

    function insertIntoChatInput(text) {
        const input = document.querySelector('#send_textarea');
        if (!input) {
            notify('error', '没有找到酒馆输入框。');
            return;
        }

        const existing = input.value.trim();
        input.value = existing ? `${existing}\n\n${text}` : text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        closePanel();
        notify('success', '已填入输入框，你可以编辑后再发送。');
    }

    async function handleResultAction(event) {
        const button = event.target.closest('[data-result-action]');
        if (!button || !currentResult || isGenerating) return;

        const action = button.dataset.resultAction;
        if (action === 'copy') {
            try {
                await copyText(currentResult);
                notify('success', '已复制生成结果。');
            } catch (error) {
                console.error(`[${MODULE_NAME}] 复制失败`, error);
                notify('error', '复制失败，请手动选中文字。');
            }
        } else if (action === 'insert') {
            insertIntoChatInput(currentResult);
        } else if (action === 'regenerate') {
            await generateIdeas({ reuseRequest: true });
        }
    }

    function formatTime(isoString) {
        try {
            return new Intl.DateTimeFormat('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date(isoString));
        } catch {
            return '';
        }
    }

    function renderHistory() {
        const container = document.querySelector('#pw_history_list');
        if (!container) return;
        container.replaceChildren();

        const history = getHistory();
        if (!history.length) {
            const empty = document.createElement('div');
            empty.className = 'pw-history-empty';
            empty.innerHTML = '<i class="fa-regular fa-lightbulb" aria-hidden="true"></i><p>这里还没有记录。<br>生成后的灵感会出现在这里。</p>';
            container.append(empty);
            return;
        }

        for (const entry of history) {
            const item = document.createElement('article');
            item.className = 'pw-history-item';
            item.dataset.historyId = entry.id;

            const top = document.createElement('div');
            top.className = 'pw-history-item-top';
            const title = document.createElement('strong');
            title.textContent = MODES[entry.mode]?.name ?? '剧情灵感';
            const time = document.createElement('time');
            time.dateTime = entry.createdAt;
            time.textContent = formatTime(entry.createdAt);
            top.append(title, time);

            const preview = document.createElement('p');
            preview.textContent = entry.content.replace(/[#*_>`\[\]]/g, '').slice(0, 110);

            const actions = document.createElement('div');
            actions.className = 'pw-history-actions';
            actions.innerHTML = `
                <button type="button" data-history-action="load">查看</button>
                <button type="button" data-history-action="copy">复制</button>
                <button type="button" data-history-action="delete" aria-label="删除这条记录"><i class="fa-regular fa-trash-can"></i></button>
            `;
            item.append(top, preview, actions);
            container.append(item);
        }
    }

    async function handleHistoryAction(event) {
        const button = event.target.closest('[data-history-action]');
        const item = button?.closest('[data-history-id]');
        if (!button || !item) return;

        const history = getHistory();
        const entry = history.find((candidate) => candidate.id === item.dataset.historyId);
        if (!entry) return;

        if (button.dataset.historyAction === 'load') {
            currentRequest = { ...buildRequest(), mode: entry.mode };
            showResult(entry.content, entry.mode, `${MODES[entry.mode]?.name ?? '灵感'} · 历史`);
            document.querySelector('#pw_result_heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (button.dataset.historyAction === 'copy') {
            try {
                await copyText(entry.content);
                notify('success', '已复制这条灵感。');
            } catch {
                notify('error', '复制失败，请打开后手动选择。');
            }
        } else if (button.dataset.historyAction === 'delete') {
            history.splice(history.indexOf(entry), 1);
            transientHistory = history;
            await persistHistory();
            renderHistory();
        }
    }

    async function clearHistory() {
        const history = getHistory();
        if (!history.length) return;
        if (!globalThis.confirm('确定清空当前聊天的全部灵感记录吗？此操作无法撤销。')) return;
        history.splice(0);
        transientHistory = history;
        await persistHistory();
        renderHistory();
        notify('success', '已清空当前聊天的灵感记录。');
    }

    function resetForChatChange() {
        currentResult = '';
        currentRequest = null;
        transientHistory = [];
        const result = document.querySelector('#pw_result');
        if (result) {
            result.textContent = '选择一种模式，然后点击“结合当前剧情生成”。';
            result.classList.add('pw-placeholder');
        }
        const badge = document.querySelector('#pw_result_badge');
        if (badge) badge.textContent = '尚未生成';
        const actions = document.querySelector('#pw_result_actions');
        if (actions) actions.hidden = true;
        const refine = document.querySelector('#pw_refine_box');
        if (refine) refine.hidden = true;
        renderHistory();
    }

    function subscribeToChatChanges() {
        const context = getContext();
        const eventName = context?.event_types?.CHAT_CHANGED;
        if (eventName && context?.eventSource?.on) {
            context.eventSource.on(eventName, resetForChatChange);
        }
    }

    async function initialize() {
        for (let attempt = 0; attempt < 60; attempt += 1) {
            if (getContext() && document.querySelector('#extensionsMenu')) break;
            await delay(250);
        }

        loadSettings();
        injectPanel();
        if (!injectMenuButton()) {
            console.error(`[${MODULE_NAME}] 没有找到扩展菜单，入口未能加载。`);
            return;
        }
        subscribeToChatChanges();
        console.log(`[${MODULE_NAME}] v1.0.0 已加载`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
