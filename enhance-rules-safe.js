(() => {
  'use strict';

  const NAME = '剧情灵感工坊';
  const STORE = 'plot_weaver_enhance_settings_v1';
  const SCRIPT_NAME = 'enhance-rules-safe.js';

  const RULE_CATS = {
    global: { label: '全局规则', options: { all: '所有生成都遵守' } },
    mode: { label: '生成类型', options: { directions: '剧情走向', new_scene: '新剧情', side_story: '番外', outline: '大纲', foreshadow: '伏笔工坊', wildcard: '灵感盲盒' } },
    output: { label: '输出形式', options: { story: '剧情正文', ideas: '灵感方案' } },
    pov: { label: '人物视角', options: { auto: '自动判断', character: '当前角色', user: '用户角色', custom: '指定人物', omniscient: '全知视角' } },
    lens: { label: '剧情方向', options: { free: '自由推演', main: '主线推进', side: '支线开枝', point: '抓住一点', character: '人物驱动', world: '世界设定驱动' } },
    source: { label: '资料来源', options: { chat: '聊天记录', character: '人物设定', world: '世界书 / 世界信息' } },
  };

  let editorState = { cat: 'global', opt: 'all' };
  let injectedTextSnapshot = null;

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function $(selector) { return document.querySelector(selector); }
  function toast(type, message) {
    const t = globalThis.toastr;
    if (t?.[type]) t[type](message, NAME);
    else console.log(`[${NAME}] ${message}`);
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch { return {}; }
  }
  function writeStore(next) {
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  }
  function readRules() {
    const data = readStore();
    return data.rules && typeof data.rules === 'object' ? data.rules : {};
  }
  function saveRules(rules) {
    const data = readStore();
    data.rules = rules;
    writeStore(data);
  }
  function ruleKey(cat, opt) { return `${cat}:${opt}`; }
  function getRule(cat, opt) { return String(readRules()[ruleKey(cat, opt)] || ''); }
  function setRule(cat, opt, text) {
    const rules = readRules();
    const key = ruleKey(cat, opt);
    if (String(text).trim()) rules[key] = String(text);
    else delete rules[key];
    saveRules(rules);
  }

  function selfUrl() {
    const script = [...document.scripts].find(s => new RegExp(`/${SCRIPT_NAME.replace('.', '\\.')}(?:\\?|$)`).test(s.src));
    return script?.src || '';
  }
  function enhanceUrl() {
    const src = selfUrl();
    return src ? new URL('enhance.js', src).href : './enhance.js';
  }

  function loadStableEnhancer() {
    if ($('#pws_box') || globalThis.__plotWeaverSafeEnhanceBound) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = $('script[data-pw-stable-enhancer="1"]');
      if (script?.dataset.loaded === '1') return resolve();
      if (!script) {
        script = document.createElement('script');
        script.dataset.pwStableEnhancer = '1';
        script.src = enhanceUrl();
        document.head.appendChild(script);
      }
      script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
      script.addEventListener('error', reject, { once: true });
    });
  }

  function addStyle() {
    if ($('#pws_rules_safe_style')) return;
    const style = document.createElement('style');
    style.id = 'pws_rules_safe_style';
    style.textContent = `
      #plot_weaver_menu_button{touch-action:manipulation;pointer-events:auto!important}
      .pws-rules-safe{margin:12px 0 0;padding-top:10px;border-top:1px dashed var(--pw-border)}
      .pws-rules-safe>summary{display:flex;align-items:center;min-height:44px;box-sizing:border-box;padding:8px 4px;cursor:pointer;touch-action:manipulation;color:var(--pw-text);font-size:.78rem;font-weight:700;user-select:none;-webkit-user-select:none}
      .pws-rules-safe>summary::marker{color:var(--pw-accent)}
      .pws-rule-safe-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:8px}
      .pws-rule-safe-field{display:grid;gap:5px;color:var(--pw-muted);font-size:.72rem}
      .pws-rule-safe-field select,.pws-rule-safe-field textarea{box-sizing:border-box;width:100%;min-height:40px;padding:8px 9px;border:1px solid var(--pw-border);border-radius:9px;outline:0;color:var(--pw-text);background:var(--pw-surface-2)}
      .pws-rule-safe-field textarea{min-height:118px;resize:vertical;line-height:1.5}
      .pws-rule-safe-note{margin:8px 0 0;color:var(--pw-muted);font-size:.67rem;line-height:1.55}
      .pws-rule-safe-active{margin-top:8px;padding:8px 10px;border:1px dashed var(--pw-border);border-radius:9px;color:var(--pw-muted);font-size:.66rem;line-height:1.5}
      .pws-rule-safe-active strong{color:var(--pw-warm)}
      @media (orientation:portrait){
        .pws-rules-safe{scroll-margin-top:12px}
        .pws-rules-safe>summary{min-height:50px;padding:10px 5px}
      }
      @media(max-width:680px){.pws-rule-safe-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function rulesHtml() {
    return `
      <details id="pws_rules_safe" class="pws-rules-safe">
        <summary>✍ AI 规则词 / 提示词（点这里展开）</summary>
        <div class="pws-rule-safe-grid">
          <label class="pws-rule-safe-field"><span>规则分类</span><select id="pws_rule_safe_cat"></select></label>
          <label class="pws-rule-safe-field"><span>要编辑的选项</span><select id="pws_rule_safe_opt"></select></label>
        </div>
        <label class="pws-rule-safe-field" style="margin-top:9px"><span>给 AI 的规则词</span><textarea id="pws_rule_safe_text" maxlength="12000" placeholder="例如：对白自然一点；不要总结人物情绪；多用动作、停顿和环境体现；少用套路化台词……"></textarea></label>
        <p class="pws-rule-safe-note">只会把本次真正选中的规则送给 AI。你可以分别给“剧情正文、指定人物、主线推进、世界书”等选项写不同规则。</p>
        <div id="pws_rule_safe_active" class="pws-rule-safe-active"></div>
      </details>`;
  }

  function currentSelections() {
    const mode = $('.pw-mode.is-active')?.dataset.mode || 'new_scene';
    const output = $('#pws_output')?.value || 'story';
    const pov = $('#pws_pov')?.value || 'auto';
    const lens = $('#pws_lens')?.value || 'free';
    return {
      mode, output, pov, lens,
      chat: !!$('#pws_chat')?.checked,
      character: !!$('#pws_character')?.checked,
      world: !!$('#pws_world')?.checked,
    };
  }

  function activeRules() {
    const s = currentSelections();
    const all = [];
    const add = (cat, opt) => {
      const text = getRule(cat, opt).trim();
      if (text) all.push({ cat, opt, text });
    };
    add('global', 'all');
    add('mode', s.mode);
    add('output', s.output);
    add('pov', s.pov);
    add('lens', s.lens);
    if (s.chat) add('source', 'chat');
    if (s.character) add('source', 'character');
    if (s.world) add('source', 'world');
    return all;
  }

  function renderActiveRules() {
    const box = $('#pws_rule_safe_active');
    if (!box) return;
    const list = activeRules();
    if (!list.length) {
      box.textContent = '本次还没有自定义规则词，会使用工坊原有规则。';
      return;
    }
    box.innerHTML = `<strong>本次生效：</strong> ${list.map(x => RULE_CATS[x.cat]?.options?.[x.opt] || x.opt).join(' · ')}`;
  }

  function fillOptions() {
    const cat = $('#pws_rule_safe_cat');
    const opt = $('#pws_rule_safe_opt');
    const text = $('#pws_rule_safe_text');
    if (!cat || !opt || !text) return;
    const def = RULE_CATS[cat.value] || RULE_CATS.global;
    opt.replaceChildren(...Object.entries(def.options).map(([key, label]) => new Option(label, key)));
    if (!def.options[editorState.opt]) editorState.opt = Object.keys(def.options)[0];
    opt.value = editorState.opt;
    text.value = getRule(cat.value, opt.value);
  }

  function bindRuleEditor() {
    const cat = $('#pws_rule_safe_cat');
    const opt = $('#pws_rule_safe_opt');
    const text = $('#pws_rule_safe_text');
    if (!cat || !opt || !text) return;
    cat.replaceChildren(...Object.entries(RULE_CATS).map(([key, def]) => new Option(def.label, key)));
    cat.value = editorState.cat;
    fillOptions();

    cat.addEventListener('change', () => {
      editorState.cat = cat.value;
      editorState.opt = Object.keys((RULE_CATS[cat.value] || RULE_CATS.global).options)[0];
      fillOptions();
      renderActiveRules();
    });
    opt.addEventListener('change', () => {
      editorState.opt = opt.value;
      text.value = getRule(cat.value, opt.value);
    });
    text.addEventListener('input', () => {
      setRule(cat.value, opt.value, text.value);
      renderActiveRules();
    });

    $('#pws_rules_safe')?.addEventListener('toggle', event => {
      if (event.currentTarget.open && matchMedia('(orientation: portrait)').matches) {
        setTimeout(() => event.currentTarget.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
      }
    });
  }

  function injectRules() {
    if ($('#pws_rules_safe')) return true;
    const box = $('#pws_box');
    if (!box) return false;
    addStyle();
    const preview = $('#pws_preview');
    if (preview) preview.insertAdjacentHTML('afterend', rulesHtml());
    else box.insertAdjacentHTML('beforeend', rulesHtml());
    bindRuleEditor();
    renderActiveRules();
    return true;
  }

  function rulesPromptText() {
    const list = activeRules();
    if (!list.length) return '';
    const body = list.map((x, i) => {
      const group = RULE_CATS[x.cat]?.label || x.cat;
      const option = RULE_CATS[x.cat]?.options?.[x.opt] || x.opt;
      return `${i + 1}. 【${group} / ${option}】\n${x.text}`;
    }).join('\n\n');
    return `\n\n【用户自定义写作规则】\n以下规则优先作为本次创作要求执行；若彼此冲突，越具体的当前选项规则优先于全局规则。\n${body}`;
  }

  function prepareRulesForGeneration(event) {
    const trigger = event.target?.closest?.('#pw_generate, #pw_refine, [data-result-action="regenerate"]');
    if (!trigger) return;
    const extra = rulesPromptText();
    if (!extra) return;
    const textarea = $('#pw_custom_request');
    if (!textarea || injectedTextSnapshot !== null) return;
    injectedTextSnapshot = textarea.value;
    textarea.value = `${textarea.value || ''}${extra}`;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      if (!textarea.isConnected) { injectedTextSnapshot = null; return; }
      textarea.value = injectedTextSnapshot ?? '';
      injectedTextSnapshot = null;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);
  }

  function bindSelectionRefresh() {
    document.addEventListener('change', event => {
      if (event.target?.matches?.('#pws_output,#pws_pov,#pws_lens,#pws_chat,#pws_character,#pws_world')) renderActiveRules();
    });
    document.addEventListener('click', event => {
      if (event.target?.closest?.('.pw-mode')) setTimeout(renderActiveRules, 0);
    });
  }

  function fixPortraitTap() {
    const button = $('#plot_weaver_menu_button');
    if (!button || button.dataset.pwsTouchFix === '1') return;
    button.dataset.pwsTouchFix = '1';
    button.addEventListener('touchend', event => {
      if (!matchMedia('(orientation: portrait)').matches) return;
      const overlay = $('#plot_weaver_overlay');
      if (overlay && !overlay.hidden) return;
      event.preventDefault();
      button.click();
    }, { passive: false });
  }

  async function start() {
    try {
      await loadStableEnhancer();
    } catch (error) {
      console.error(`[${NAME}] 稳定增强层加载失败`, error);
      return;
    }

    for (let i = 0; i < 80; i++) {
      fixPortraitTap();
      if (injectRules()) break;
      await wait(150);
    }

    fixPortraitTap();
    if (!$('#pws_rules_safe')) console.warn(`[${NAME}] 规则词编辑器未注入，基础增强功能仍可使用。`);
    window.addEventListener('click', prepareRulesForGeneration, true);
    bindSelectionRefresh();
    window.addEventListener('orientationchange', () => setTimeout(fixPortraitTap, 250));
    console.log(`[${NAME}] v1.4.1 安全规则版已加载`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
