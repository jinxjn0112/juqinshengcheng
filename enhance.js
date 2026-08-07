(() => {
  'use strict';

  const ENHANCE_ID = 'plot_weaver_enhance';
  const STORE_KEY = 'plot_weaver_enhance_settings_v1';
  const DEFAULTS = {
    engine: 'current', apiBase: '', apiKey: '', apiModel: '', temperature: 0.9,
    readChat: true, rangeMode: 'latest', latestCount: 12, anchorFloor: 1, above: 6, below: 6,
    readCharacter: true, readWorldbook: true, worldbookMode: 'relevant',
    lens: 'free', focusPoint: '', focusDestination: 'both',
    outputForm: 'prose', povMode: 'auto', povName: '', countDefaultApplied: false
  };
  const LENS_TEXT = {
    free: '自由推演：综合当前剧情寻找最自然的新变化。',
    main: '主线推进：优先推动核心矛盾、核心目标、关键秘密或阶段目标，不被枝节带跑。',
    side: '支线开枝：从配角、关系、地点、物件、传闻或未展开信息里长出可回收的支线。',
    point: '抓住一点：围绕用户指定的一个细节做深挖，让它成为后续剧情的发动机。',
    character: '人物驱动：从人物欲望、恐惧、秘密、关系与当前选择出发推动剧情。',
    world: '世界驱动：优先利用世界规则、组织、地点、风俗、历史或资源约束推动剧情。'
  };

  let cfg = load();
  let legacyLoaded = false;

  function load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }
  function ctx() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch { return null; } }
  function toast(type, msg) { const t=globalThis.toastr; if(t?.[type]) t[type](msg,'剧情灵感工坊'); else console.log(msg); }

  function legacyUrl() {
    const scripts = [...document.scripts];
    const me = scripts.find(s => /\/enhance\.js(?:\?|$)/.test(s.src));
    if (me?.src) return new URL('index.js', me.src).href;
    const hit = scripts.find(s => s.src.includes('/juqinshengcheng/'));
    return hit?.src ? new URL('index.js', hit.src).href : './index.js';
  }

  function loadLegacy() {
    if (globalThis.__plotWeaverLoaded || legacyLoaded) return Promise.resolve();
    legacyLoaded = true;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = legacyUrl();
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function addStyles() {
    if (document.querySelector('#pw_enhance_style')) return;
    const style = document.createElement('style');
    style.id = 'pw_enhance_style';
    style.textContent = `
      .pw-enhance-box{margin:14px 0;padding:14px;border:1px solid var(--pw-border);border-radius:14px;background:rgba(157,140,255,.035)}
      .pw-enhance-box h4{margin:0 0 10px;font-size:.84rem;color:var(--pw-text)}
      .pw-enhance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .pw-enhance-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .pw-enhance-field{display:grid;gap:5px;color:var(--pw-muted);font-size:.72rem}
      .pw-enhance-field input,.pw-enhance-field select,.pw-enhance-field textarea{box-sizing:border-box;width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--pw-border);border-radius:9px;color:var(--pw-text);background:var(--pw-surface-2)}
      .pw-enhance-field textarea{min-height:58px;resize:vertical}
      .pw-enhance-checks{display:flex;flex-wrap:wrap;gap:8px 14px;margin:9px 0;color:var(--pw-muted);font-size:.73rem}
      .pw-enhance-checks label{display:flex;align-items:center;gap:6px}
      .pw-enhance-note{margin:8px 0 0;color:var(--pw-muted);font-size:.68rem;line-height:1.5}
      .pw-enhance-pill{display:inline-flex;margin-left:6px;padding:2px 7px;border:1px solid var(--pw-border);border-radius:999px;color:var(--pw-warm);font-size:.62rem}
      .pw-enhance-hidden{display:none!important}
      .pw-context-preview{margin-top:9px;padding:8px 10px;border:1px dashed var(--pw-border);border-radius:9px;color:var(--pw-muted);font-size:.68rem;line-height:1.5}
      @media (orientation:landscape) and (min-width:900px){.pw-panel{width:min(1380px,98vw)}.pw-body{grid-template-columns:minmax(0,1fr) 280px}.pw-mode-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.pw-enhance-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media (orientation:portrait) and (max-width:1100px){.pw-panel{width:min(760px,96vw)}.pw-body{grid-template-columns:1fr;overflow-y:auto}.pw-history{border-left:0;border-top:1px solid var(--pw-border)}.pw-enhance-grid,.pw-enhance-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:680px){.pw-enhance-grid,.pw-enhance-grid.two{grid-template-columns:1fr}.pw-enhance-box{padding:11px}}
    `;
    document.head.appendChild(style);
  }

  function html() {
    return `
      <section id="pw_enhance_box" class="pw-enhance-box">
        <h4>资料读取与剧情聚焦 <span class="pw-enhance-pill">增强版</span></h4>
        <div class="pw-enhance-grid">
          <label class="pw-enhance-field"><span>输出形式</span><select id="pwe_output_form"><option value="prose">剧情正文</option><option value="ideas">灵感方案</option></select></label>
          <label class="pw-enhance-field"><span>剧情方向</span><select id="pwe_lens">
            <option value="free">自由推演</option><option value="main">主线推进</option><option value="side">支线开枝</option><option value="point">抓住一点</option><option value="character">人物驱动</option><option value="world">世界设定驱动</option>
          </select></label>
          <label class="pw-enhance-field"><span>人物视角</span><select id="pwe_pov_mode"><option value="auto">自动判断</option><option value="current">当前角色</option><option value="user">用户角色</option><option value="custom">指定人物</option><option value="omniscient">全知视角</option></select></label>
          <label class="pw-enhance-field pwe-pov-custom"><span>视角人物</span><input id="pwe_pov_name" placeholder="输入人物名字"></label>
          <label class="pw-enhance-field"><span>聊天范围</span><select id="pwe_range_mode"><option value="latest">读取最近楼层</option><option value="anchor">指定楼层向上下读取</option></select></label>
          <label class="pw-enhance-field pwe-latest"><span>最近读取多少楼</span><input id="pwe_latest" type="number" min="1" max="200" value="12"></label>
          <label class="pw-enhance-field pwe-anchor"><span>中心楼层</span><input id="pwe_anchor" type="number" min="1" value="1"></label>
          <label class="pw-enhance-field pwe-anchor"><span>向上读取</span><input id="pwe_above" type="number" min="0" max="100" value="6"></label>
          <label class="pw-enhance-field pwe-anchor"><span>向下读取</span><input id="pwe_below" type="number" min="0" max="100" value="6"></label>
          <label class="pw-enhance-field"><span>世界书读取</span><select id="pwe_worldbook_mode"><option value="relevant">相关信息优先</option><option value="all">尽量读取全部可见信息</option></select></label>
          <label class="pw-enhance-field"><span>生成引擎</span><select id="pwe_engine"><option value="current">使用酒馆当前模型</option><option value="independent">使用独立 API</option></select></label>
        </div>
        <div class="pw-enhance-checks">
          <label><input id="pwe_chat" type="checkbox">聊天记录</label>
          <label><input id="pwe_character" type="checkbox">当前人物设定</label>
          <label><input id="pwe_worldbook" type="checkbox">世界书/世界信息</label>
        </div>
        <div id="pwe_focus_wrap" class="pw-enhance-grid two">
          <label class="pw-enhance-field"><span>要抓住的点</span><textarea id="pwe_focus" placeholder="例如：上一幕提到的旧钥匙；某角色突然改口；世界书里的禁令……"></textarea></label>
          <label class="pw-enhance-field"><span>这个点更偏向</span><select id="pwe_focus_dest"><option value="both">主线与支线都可</option><option value="main">优先主线</option><option value="side">优先支线</option></select></label>
        </div>
        <div id="pwe_api" class="pw-enhance-box" style="margin:10px 0 0">
          <h4>独立 API</h4>
          <div class="pw-enhance-grid">
            <label class="pw-enhance-field"><span>Base URL</span><input id="pwe_api_base" placeholder="https://.../v1"></label>
            <label class="pw-enhance-field"><span>模型</span><input id="pwe_api_model" placeholder="例如 gemini-2.5-flash"></label>
            <label class="pw-enhance-field"><span>API Key</span><input id="pwe_api_key" type="password" autocomplete="off" placeholder="仅保存在本机浏览器"></label>
            <label class="pw-enhance-field"><span>温度</span><input id="pwe_temp" type="number" min="0" max="2" step="0.1"></label>
          </div>
          <p class="pw-enhance-note">独立 API 按 OpenAI 兼容的 <code>/chat/completions</code> 方式调用。密钥只保存在这台设备的浏览器本地存储中，不会写进仓库。</p>
        </div>
        <div id="pwe_preview" class="pw-context-preview"></div>
      </section>`;
  }

  function ensureCountOne() {
    const count = document.querySelector('#pw_count');
    if (!count) return;
    if (![...count.options].some(o => o.value === '1')) {
      const option = document.createElement('option');
      option.value = '1';
      option.textContent = '1';
      count.prepend(option);
    }
    if (!cfg.countDefaultApplied) {
      count.value = '1';
      count.dispatchEvent(new Event('change', { bubbles: true }));
      cfg.countDefaultApplied = true;
      save();
    }
    updateCountLabel();
  }

  function patchCopy() {
    const subtitle = document.querySelector('.pw-header p:not(.pw-eyebrow)');
    if (subtitle) subtitle.textContent = '结合当前角色、世界书与最近剧情，既可以找灵感，也可以直接生成可阅读的剧情正文。';
  }

  function inject() {
    addStyles();
    const options = document.querySelector('.pw-options');
    if (!options || document.querySelector('#pw_enhance_box')) return false;
    const custom = options.querySelector('.pw-wide-field');
    (custom || options.querySelector('#pw_generate'))?.insertAdjacentHTML('beforebegin', html());
    ensureCountOne();
    patchCopy();
    bind();
    sync();
    replaceGenerate();
    return true;
  }

  function val(id) { return document.querySelector(id); }
  function n(v, fallback=0) { const x=Number(v); return Number.isFinite(x)?x:fallback; }
  function bind() {
    const pairs = [
      ['#pwe_output_form','outputForm'],['#pwe_lens','lens'],['#pwe_pov_mode','povMode'],['#pwe_pov_name','povName'],
      ['#pwe_range_mode','rangeMode'],['#pwe_latest','latestCount'],['#pwe_anchor','anchorFloor'],['#pwe_above','above'],['#pwe_below','below'],
      ['#pwe_worldbook_mode','worldbookMode'],['#pwe_engine','engine'],['#pwe_focus','focusPoint'],['#pwe_focus_dest','focusDestination'],
      ['#pwe_api_base','apiBase'],['#pwe_api_key','apiKey'],['#pwe_api_model','apiModel'],['#pwe_temp','temperature']
    ];
    for (const [id,key] of pairs) val(id)?.addEventListener('input', e => {
      cfg[key] = ['latestCount','anchorFloor','above','below','temperature'].includes(key) ? n(e.target.value, DEFAULTS[key]) : e.target.value;
      save(); syncVisibility(); updateCountLabel(); updateGenerateLabel(); preview();
    });
    for (const [id,key] of [['#pwe_chat','readChat'],['#pwe_character','readCharacter'],['#pwe_worldbook','readWorldbook']]) {
      val(id)?.addEventListener('change', e => { cfg[key]=e.target.checked; save(); preview(); });
    }
    document.querySelector('.pw-mode-grid')?.addEventListener('click', () => setTimeout(updateCountLabel, 0));
  }
  function sync() {
    const values={
      '#pwe_output_form':cfg.outputForm,'#pwe_lens':cfg.lens,'#pwe_pov_mode':cfg.povMode,'#pwe_pov_name':cfg.povName,
      '#pwe_range_mode':cfg.rangeMode,'#pwe_latest':cfg.latestCount,'#pwe_anchor':cfg.anchorFloor,'#pwe_above':cfg.above,'#pwe_below':cfg.below,
      '#pwe_worldbook_mode':cfg.worldbookMode,'#pwe_engine':cfg.engine,'#pwe_focus':cfg.focusPoint,'#pwe_focus_dest':cfg.focusDestination,
      '#pwe_api_base':cfg.apiBase,'#pwe_api_key':cfg.apiKey,'#pwe_api_model':cfg.apiModel,'#pwe_temp':cfg.temperature
    };
    for(const [id,v] of Object.entries(values)) if(val(id)) val(id).value=v;
    for(const [id,v] of Object.entries({'#pwe_chat':cfg.readChat,'#pwe_character':cfg.readCharacter,'#pwe_worldbook':cfg.readWorldbook})) if(val(id)) val(id).checked=!!v;
    syncVisibility(); updateCountLabel(); updateGenerateLabel(); preview();
  }
  function syncVisibility() {
    document.querySelectorAll('.pwe-latest').forEach(e=>e.classList.toggle('pw-enhance-hidden',cfg.rangeMode!=='latest'));
    document.querySelectorAll('.pwe-anchor').forEach(e=>e.classList.toggle('pw-enhance-hidden',cfg.rangeMode!=='anchor'));
    document.querySelectorAll('.pwe-pov-custom').forEach(e=>e.classList.toggle('pw-enhance-hidden',cfg.povMode!=='custom'));
    val('#pwe_focus_wrap')?.classList.toggle('pw-enhance-hidden',cfg.lens!=='point');
    val('#pwe_api')?.classList.toggle('pw-enhance-hidden',cfg.engine!=='independent');
  }
  function updateCountLabel() {
    const label=val('#pw_count_label');
    if (!label) return;
    const active=document.querySelector('.pw-mode.is-active')?.dataset.mode || 'directions';
    if (active==='outline') label.textContent='章节数量';
    else label.textContent=cfg.outputForm==='prose'?'文案数量':'方案数量';
  }
  function updateGenerateLabel() {
    const span=val('#pw_generate')?.querySelector('span');
    if (span) span.textContent=cfg.outputForm==='prose'?'生成剧情正文':'结合当前剧情生成';
  }

  function messageText(m) {
    const who = m.is_user ? '用户' : (m.name || '角色');
    const text = String(m.mes ?? m.content ?? '').trim();
    return text ? `[${who}] ${text}` : '';
  }
  function selectedChat(chat) {
    if (!cfg.readChat || !Array.isArray(chat)) return [];
    if (cfg.rangeMode === 'anchor') {
      const center = Math.max(1, n(cfg.anchorFloor,1)) - 1;
      const start = Math.max(0, center - Math.max(0,n(cfg.above,0)));
      const end = Math.min(chat.length, center + Math.max(0,n(cfg.below,0)) + 1);
      return chat.slice(start,end).map((m,i)=>({floor:start+i+1,text:messageText(m)})).filter(x=>x.text);
    }
    const count = Math.max(1, Math.min(200,n(cfg.latestCount,12)));
    const start = Math.max(0, chat.length-count);
    return chat.slice(start).map((m,i)=>({floor:start+i+1,text:messageText(m)})).filter(x=>x.text);
  }
  function characterText(c) {
    if (!c) return '';
    const fields = [['名字',c.name],['简介',c.description],['性格',c.personality],['场景',c.scenario],['首条消息',c.first_mes],['示例对话',c.mes_example],['作者注释',c.creator_notes]];
    return fields.filter(([,v])=>v).map(([k,v])=>`${k}：${v}`).join('\n');
  }
  function getCurrentCharacterObject(context) {
    const id = context?.characterId;
    const chars = context?.characters || globalThis.characters;
    return chars?.[id] || context?.character || null;
  }
  function getCharacter(context) {
    if (!cfg.readCharacter) return '';
    return characterText(getCurrentCharacterObject(context)).slice(0,18000);
  }
  function flattenWorld(obj, depth=0, seen=new WeakSet()) {
    if (!obj || depth>4) return [];
    if (typeof obj === 'string') return obj.trim() ? [obj.trim()] : [];
    if (typeof obj !== 'object') return [];
    if (seen.has(obj)) return [];
    seen.add(obj);
    if (Array.isArray(obj)) return obj.flatMap(x=>flattenWorld(x,depth+1,seen));
    const out=[];
    const preferred=['content','text','description','comment','key','keys','entry','entries','worldInfo','world_info','lorebook','book'];
    for(const k of preferred) if(k in obj) out.push(...flattenWorld(obj[k],depth+1,seen));
    return out;
  }
  function getWorld(context) {
    if (!cfg.readWorldbook) return '';
    const candidates=[context?.worldInfo,context?.world_info,context?.worldInfoPrompt,context?.extensionPrompts,globalThis.world_info,globalThis.worldInfo,globalThis.selected_world_info];
    let parts=[];
    for(const x of candidates) parts.push(...flattenWorld(x));
    parts=[...new Set(parts)].filter(Boolean);
    if(cfg.worldbookMode==='relevant') parts=parts.slice(0,80);
    return parts.join('\n---\n').slice(0,18000);
  }
  function povInstruction(context) {
    const current = getCurrentCharacterObject(context)?.name || context?.name2 || '当前角色';
    const user = context?.name1 || context?.userName || '用户角色';
    if (cfg.povMode==='current') return `以“${current}”作为主要视角人物。叙事重点跟随其看到、听到、注意到和能够推断的信息，不直接泄露其不知道的事实。`;
    if (cfg.povMode==='user') return `以“${user}”作为主要视角人物。保留互动空间，不替该角色强行决定关键台词、内心结论或不可逆行动。`;
    if (cfg.povMode==='custom') return cfg.povName.trim() ? `以“${cfg.povName.trim()}”作为主要视角人物，主要跟随此人的感知与认知范围。` : '用户选择了指定人物视角但没有填写名字，请从现有角色中选择最适合承接当前剧情的人物作为视角中心。';
    if (cfg.povMode==='omniscient') return '使用全知视角，可以在必要时展示不同人物的行动与信息，但不要频繁跳视角造成割裂。';
    return '自动选择最适合当前剧情的视角人物；如果单一人物视角更有张力，优先采用有限视角。';
  }
  function povPreview(context) {
    const current = getCurrentCharacterObject(context)?.name || '当前角色';
    const user = context?.name1 || context?.userName || '用户角色';
    if (cfg.povMode==='current') return current;
    if (cfg.povMode==='user') return user;
    if (cfg.povMode==='custom') return cfg.povName.trim() || '指定人物（未填写）';
    if (cfg.povMode==='omniscient') return '全知';
    return '自动';
  }
  function preview() {
    const c=ctx(); const chat=selectedChat(c?.chat||[]); const ch=getCharacter(c); const w=getWorld(c);
    const floors = chat.length ? `${chat[0].floor}–${chat.at(-1).floor} 楼，共 ${chat.length} 楼` : '不读取聊天';
    const form = cfg.outputForm==='prose' ? '剧情正文' : '灵感方案';
    if(val('#pwe_preview')) val('#pwe_preview').textContent=`本次预计读取：${floors}；人物设定 ${ch?'已找到':'未读取/未找到'}；世界书 ${w?'已找到可见信息':'未读取/当前接口未暴露'}；输出：${form}；人物视角：${povPreview(c)}；剧情方向：${LENS_TEXT[cfg.lens]||LENS_TEXT.free}`;
  }

  function ideaInstruction(active, count) {
    const map={
      directions:`给出 ${count} 条真正不同的后续剧情走向，每条写清触发点、推动者、冲突、后果与下一幕钩子。`,
      new_scene:`设计 ${count} 个能直接接上当前最后一幕的新剧情方案，并各给一小段开场。`,
      side_story:`设计 ${count} 个与当前人物或设定有联系、但能独立成立的番外/间章。`,
      outline:`把后续整理为 ${count} 个章节或阶段的大纲，明确主矛盾、节拍、人物变化与章末钩子。`,
      foreshadow:`整理并扩展 ${count} 个伏笔机会，区分已存在的线索与新伏笔候选。`,
      wildcard:`生成 ${count} 个互不重复的剧情灵感，核心矛盾和推动者必须有差异。`
    };
    return map[active]||map.directions;
  }
  function proseInstruction(active, count) {
    if (active==='outline') return `仍按大纲模式工作：整理为 ${count} 个章节或阶段，但每一章都补一小段可直接阅读的场景示例，让大纲和成品剧情能连起来看。`;
    if (active==='foreshadow') return `仍按伏笔工坊模式工作：整理 ${count} 个最值得使用的伏笔，并为每个伏笔写一小段自然嵌入正文的示例，不要只讲概念。`;
    const map={
      directions:`生成 ${count} 份可直接阅读的后续剧情正文。每份只选择一个明确的发展方向直接写成完整场景，不先列方案、提纲或分析。`,
      new_scene:`生成 ${count} 份可以直接接在当前最后一幕后阅读的新剧情正文。要有具体场景、动作、对话与推进，不先解释构思。`,
      side_story:`生成 ${count} 份可以直接阅读的番外或间章正文，既能独立成立，又与当前人物、关系或设定保持联系。`,
      wildcard:`生成 ${count} 份可直接阅读的意外剧情正文。允许有新鲜转折，但必须从现有信息自然长出来，不能靠无铺垫巧合。`
    };
    return map[active]||map.directions;
  }
  function modeInstruction() {
    const active=document.querySelector('.pw-mode.is-active')?.dataset.mode || 'directions';
    const count=Math.max(1,n(document.querySelector('#pw_count')?.value,1));
    return cfg.outputForm==='prose' ? proseInstruction(active,count) : ideaInstruction(active,count);
  }
  function buildPrompt(context) {
    const chat=selectedChat(context?.chat||[]);
    const character=getCharacter(context);
    const world=getWorld(context);
    const custom=document.querySelector('#pw_custom_request')?.value.trim()||'';
    const lens=LENS_TEXT[cfg.lens]||LENS_TEXT.free;
    const focus=cfg.lens==='point' ? `\n指定聚焦点：${cfg.focusPoint||'未填写，请从现有信息中选择一个最值得深挖的细节'}。方向偏好：${cfg.focusDestination==='main'?'主线':cfg.focusDestination==='side'?'支线':'主线或支线均可'}。` : '';
    const chatText=chat.map(x=>`【第${x.floor}楼】${x.text}`).join('\n\n');
    const formRule = cfg.outputForm==='prose'
      ? '本次优先交付可直接阅读的剧情成品。正文要自然连续，有场景、动作、对话和具体变化；不要先写“方案一/剧情思路/分析”。除非当前模式本身是大纲或伏笔，否则直接从剧情正文开始。'
      : '本次交付剧情策划与灵感方案，结构清楚，便于比较和继续选择。';
    return `你是互动剧情的剧情工坊。你既能做剧情策划，也能直接写出可阅读的剧情正文。基于下列实际资料生成，不要把缺失信息脑补成既定事实。\n\n【任务】\n${modeInstruction()}\n\n【输出要求】\n${formRule}\n\n【人物视角】\n${povInstruction(context)}\n\n【剧情聚焦】\n${lens}${focus}\n\n【人物设定】\n${character||'本次未读取或未找到'}\n\n【世界书/世界信息】\n${world||'本次未读取，或当前酒馆接口没有向扩展暴露可直接读取的世界书文本。若你通过酒馆当前模型生成，可利用酒馆自动注入的世界书。'}\n\n【聊天记录】\n${chatText||'本次未读取聊天记录'}\n\n【额外要求】\n${custom||'无'}\n\n要求：优先承接最后一幕；角色行为要有动机；不要复述已经发生的剧情；主线要真正推进核心矛盾，支线要有未来可回收价值；如果抓住某个细节，要让它通过具体事件自然生长。只输出成品，不展示思考过程。`;
  }

  async function callCurrent(prompt) {
    const c=ctx();
    if(typeof c?.generateQuietPrompt!=='function') throw new Error('当前酒馆版本没有后台生成接口');
    const r=await c.generateQuietPrompt({quietPrompt:prompt});
    return typeof r==='string'?r.trim():String(r?.content??r??'').trim();
  }
  async function callIndependent(prompt) {
    const base=String(cfg.apiBase||'').replace(/\/$/,'');
    if(!base||!cfg.apiModel) throw new Error('请先填写独立 API 的 Base URL 和模型');
    const url=base.endsWith('/chat/completions')?base:`${base}/chat/completions`;
    const headers={'Content-Type':'application/json'};
    if(cfg.apiKey) headers.Authorization=`Bearer ${cfg.apiKey}`;
    const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({model:cfg.apiModel,messages:[{role:'user',content:prompt}],temperature:n(cfg.temperature,.9),stream:false})});
    if(!res.ok) throw new Error(`独立 API 返回 ${res.status}: ${(await res.text()).slice(0,240)}`);
    const data=await res.json();
    const out=data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.content;
    if(!out) throw new Error('独立 API 返回了空内容');
    return String(out).trim();
  }
  function showResult(text) {
    const r=val('#pw_result'); if(r){r.textContent=text;r.classList.remove('pw-placeholder');}
    const badge=val('#pw_result_badge');
    if(badge) badge.textContent=cfg.outputForm==='prose'?'剧情正文':cfg.lens==='main'?'主线推进':cfg.lens==='side'?'支线开枝':cfg.lens==='point'?'聚焦生成':'生成结果';
    val('#pw_result_actions')?.removeAttribute('hidden');
    val('#pw_refine_box')?.removeAttribute('hidden');
    globalThis.__plotWeaverEnhancedLastResult=text;
  }
  function setBusy(on,msg) {
    const b=val('#pw_generate'); if(b){b.disabled=on; const s=b.querySelector('span'); if(s)s.textContent=on?'正在整理资料并生成…':cfg.outputForm==='prose'?'生成剧情正文':'结合当前剧情生成';}
    const st=val('#pw_status'); if(st)st.textContent=msg||'';
  }
  async function generate() {
    const c=ctx(); if(!c) return toast('error','暂时无法读取酒馆上下文');
    setBusy(true,'正在按你选择的楼层、人物视角与世界信息生成…');
    try{
      const prompt=buildPrompt(c);
      const out=cfg.engine==='independent'?await callIndependent(prompt):await callCurrent(prompt);
      showResult(out);
      setBusy(false,cfg.outputForm==='prose'?'剧情正文生成完成。可以直接阅读、复制或填入输入框。':'生成完成。你可以复制、填入输入框，或调整聚焦方式再生成。');
    } catch(e) {
      console.error(e); setBusy(false,`生成失败：${e.message}`); toast('error',e.message||'生成失败');
    }
  }
  function replaceGenerate() {
    const old=val('#pw_generate');
    if(!old || old.dataset.pwe==='1') return;
    const fresh=old.cloneNode(true); fresh.dataset.pwe='1'; old.replaceWith(fresh); fresh.addEventListener('click',generate);
    const span=fresh.querySelector('span'); if(span) span.textContent=cfg.outputForm==='prose'?'生成剧情正文':'结合当前剧情生成';
  }

  async function start() {
    try { await loadLegacy(); } catch(e) { console.error(`[${ENHANCE_ID}] legacy load failed`,e); }
    for(let i=0;i<80;i++){
      if(inject()) break;
      await new Promise(r=>setTimeout(r,200));
    }
    const mo=new MutationObserver(()=>{
      if(document.querySelector('.pw-options')&&!document.querySelector('#pw_enhance_box')) inject();
      else { ensureCountOne(); patchCopy(); replaceGenerate(); updateCountLabel(); updateGenerateLabel(); }
    });
    mo.observe(document.body,{childList:true,subtree:true});
    console.log('[剧情灵感工坊] 增强版 v1.2.0 已加载');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();