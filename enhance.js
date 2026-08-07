(() => {
  'use strict';

  const NAME='剧情灵感工坊';
  const STORE='plot_weaver_enhance_settings_v1';
  const VERSION=4;
  const DEF={
    version:VERSION, outputMode:'story', povMode:'auto', povName:'',
    engine:'current', apiBase:'', apiKey:'', apiModel:'', temperature:.9,
    readChat:true, rangeMode:'latest', latestCount:12, anchorFloor:1, above:6, below:6,
    readCharacter:true, readWorldbook:true, worldbookMode:'relevant',
    lens:'free', focusPoint:'', focusDestination:'both'
  };
  const LENS={
    free:'自由推演：综合当前剧情寻找最自然的新变化。',
    main:'主线推进：优先推动核心矛盾、关键秘密、阶段目标或主要关系变化。',
    side:'支线开枝：从配角、地点、物件、传闻或未展开信息里长出可回收的支线。',
    point:'抓住一点：围绕指定细节深挖，让它成为后续剧情的发动机。',
    character:'人物驱动：从人物欲望、恐惧、秘密、关系与当前选择出发推动剧情。',
    world:'世界设定驱动：优先利用世界规则、组织、地点、风俗、历史或资源约束推动剧情。'
  };
  const POV={
    auto:'自动判断最合适的叙事视角，并保持稳定。',
    character:'以当前角色为主要视角，只写其合理可感知或推断的信息。',
    user:'以用户角色为主要视角，不替用户角色决定关键内心、台词或行动。',
    custom:'以指定人物为主要视角，只写该人物合理可感知或推断的信息。',
    omniscient:'使用第三人称全知视角，可切换观察对象，但避免无意义频繁跳视角。'
  };
  let cfg=load(), busy=false, lastResult='', lastPrompt='';

  function load(){
    try{
      const old=JSON.parse(localStorage.getItem(STORE)||'{}');
      const x={...DEF,...old};
      if(!old.version||Number(old.version)<VERSION){x.outputMode='story';x.version=VERSION;}
      return x;
    }catch{return {...DEF};}
  }
  function save(){try{localStorage.setItem(STORE,JSON.stringify(cfg));}catch{}}
  function ctx(){try{return globalThis.SillyTavern?.getContext?.()||null;}catch{return null;}}
  function toast(type,msg){const t=globalThis.toastr;if(t?.[type])t[type](msg,NAME);else console.log(`[${NAME}] ${msg}`);}
  function wait(ms){return new Promise(r=>setTimeout(r,ms));}
  function $(s){return document.querySelector(s);}
  function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f;}

  function scriptUrl(){
    const me=[...document.scripts].find(s=>/\/enhance\.js(?:\?|$)/.test(s.src));
    if(me?.src)return new URL('index.js',me.src).href;
    return './index.js';
  }
  function loadBase(){
    if(globalThis.__plotWeaverLoaded)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const old=$('script[data-pw-base="1"]');
      if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');s.dataset.pwBase='1';s.src=scriptUrl();s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  function addStyle(){
    if($('#pw_safe_style'))return;
    const s=document.createElement('style');s.id='pw_safe_style';s.textContent=`
      .pws-box{margin:14px 0;padding:13px;border:1px solid var(--pw-border);border-radius:13px;background:rgba(157,140,255,.03)}
      .pws-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.pws-title h4{margin:0;color:var(--pw-text);font-size:.84rem}.pws-title span{color:var(--pw-muted);font-size:.67rem;text-align:right}
      .pws-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.pws-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .pws-field{display:grid;gap:5px;color:var(--pw-muted);font-size:.72rem}.pws-field input,.pws-field select,.pws-field textarea{box-sizing:border-box;width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--pw-border);border-radius:9px;outline:0;color:var(--pw-text);background:var(--pw-surface-2)}.pws-field textarea{min-height:58px;resize:vertical}
      .pws-checks{display:flex;flex-wrap:wrap;gap:8px 14px;margin:10px 0;color:var(--pw-muted);font-size:.72rem}.pws-checks label{display:flex;align-items:center;gap:6px}
      .pws-models{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:9px;align-items:end;margin-top:9px}
      .pws-btn{min-height:38px;padding:7px 11px;border:1px solid var(--pw-border);border-radius:9px;color:var(--pw-text);background:rgba(157,140,255,.08);cursor:pointer;white-space:nowrap}.pws-btn:hover{border-color:var(--pw-accent)}.pws-btn:disabled{opacity:.6;cursor:wait}
      .pws-note{margin:8px 0 0;color:var(--pw-muted);font-size:.67rem;line-height:1.5}.pws-preview{margin-top:9px;padding:8px 10px;border:1px dashed var(--pw-border);border-radius:9px;color:var(--pw-muted);font-size:.67rem;line-height:1.5}.pws-hidden{display:none!important}
      @media(max-width:1100px){.pws-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pws-models{grid-template-columns:1fr 1fr}.pws-models .pws-btn{grid-column:1/-1}}
      @media(max-width:680px){.pws-grid,.pws-grid.two,.pws-models{grid-template-columns:1fr}.pws-models .pws-btn{grid-column:auto;width:100%}.pws-box{padding:10px}}
    `;document.head.appendChild(s);
  }

  function html(){return `
    <section id="pws_box" class="pws-box">
      <div class="pws-title"><h4>正文、视角与资料读取</h4><span>默认直接生成 1 份可读剧情</span></div>
      <div class="pws-grid">
        <label class="pws-field"><span>输出形式</span><select id="pws_output"><option value="story">剧情正文</option><option value="ideas">灵感方案</option></select></label>
        <label class="pws-field"><span>人物视角</span><select id="pws_pov"><option value="auto">自动判断</option><option value="character">当前角色</option><option value="user">用户角色</option><option value="custom">指定人物</option><option value="omniscient">全知视角</option></select></label>
        <label class="pws-field pws-pov-name"><span>指定人物名</span><input id="pws_pov_name" maxlength="80" placeholder="输入人物名字"></label>
        <label class="pws-field"><span>剧情方向</span><select id="pws_lens"><option value="free">自由推演</option><option value="main">主线推进</option><option value="side">支线开枝</option><option value="point">抓住一点</option><option value="character">人物驱动</option><option value="world">世界设定驱动</option></select></label>
        <label class="pws-field"><span>聊天范围</span><select id="pws_range"><option value="latest">读取最近楼层</option><option value="anchor">指定楼层向上下读取</option></select></label>
        <label class="pws-field pws-latest"><span>最近读取多少楼</span><input id="pws_latest" type="number" min="1" max="200"></label>
        <label class="pws-field pws-anchor"><span>中心楼层</span><input id="pws_anchor" type="number" min="1"></label>
        <label class="pws-field pws-anchor"><span>向上读取</span><input id="pws_above" type="number" min="0" max="100"></label>
        <label class="pws-field pws-anchor"><span>向下读取</span><input id="pws_below" type="number" min="0" max="100"></label>
        <label class="pws-field"><span>世界书读取</span><select id="pws_world_mode"><option value="relevant">相关信息优先</option><option value="all">尽量读取全部可见信息</option></select></label>
      </div>
      <div class="pws-checks"><label><input id="pws_chat" type="checkbox">聊天记录</label><label><input id="pws_character" type="checkbox">当前人物设定</label><label><input id="pws_world" type="checkbox">世界书/世界信息</label></div>
      <div id="pws_focus_wrap" class="pws-grid two"><label class="pws-field"><span>要抓住的点</span><textarea id="pws_focus" maxlength="1000" placeholder="例如：上一幕的旧钥匙、某角色突然改口、世界书里的禁令……"></textarea></label><label class="pws-field"><span>这个点更偏向</span><select id="pws_focus_dest"><option value="both">主线与支线都可</option><option value="main">优先主线</option><option value="side">优先支线</option></select></label></div>
      <div id="pws_preview" class="pws-preview"></div>
    </section>
    <section id="pws_api_box" class="pws-box">
      <div class="pws-title"><h4>生成引擎</h4><span>独立 API 可手输、选择、拉取模型</span></div>
      <div class="pws-grid">
        <label class="pws-field"><span>生成方式</span><select id="pws_engine"><option value="current">使用酒馆当前模型</option><option value="independent">使用独立 API</option></select></label>
        <label class="pws-field pws-api"><span>Base URL</span><input id="pws_base" placeholder="https://example.com/v1"></label>
        <label class="pws-field pws-api"><span>API Key</span><input id="pws_key" type="password" autocomplete="off" placeholder="仅保存在本机浏览器"></label>
        <label class="pws-field pws-api"><span>温度</span><input id="pws_temp" type="number" min="0" max="2" step="0.1"></label>
      </div>
      <div class="pws-models pws-api">
        <label class="pws-field"><span>模型名称（可直接输入）</span><input id="pws_model" maxlength="200" placeholder="例如 gemini-2.5-flash"></label>
        <label class="pws-field"><span>已拉取模型（可选择）</span><select id="pws_model_select"><option value="">尚未拉取</option></select></label>
        <button id="pws_fetch" class="pws-btn" type="button"><i class="fa-solid fa-cloud-arrow-down"></i> 拉取模型</button>
      </div>
      <p class="pws-note pws-api">按 OpenAI 兼容接口读取：模型列表 <code>/models</code>，生成 <code>/chat/completions</code>。若服务商限制浏览器跨域，仍可手动输入模型名称。</p>
    </section>`}

  function addOneCount(){
    const s=$('#pw_count');if(!s)return;
    if(![...s.options].some(o=>o.value==='1'))s.prepend(new Option('1','1'));
    if(!cfg.countMigrated){s.value='1';s.dispatchEvent(new Event('change',{bubbles:true}));cfg.countMigrated=true;save();}
  }
  function inject(){
    if($('#pws_box'))return true;
    const options=$('.pw-options');if(!options)return false;
    addStyle();addOneCount();
    const custom=options.querySelector('.pw-wide-field');
    (custom||$('#pw_generate'))?.insertAdjacentHTML('beforebegin',html());
    bind();sync();return true;
  }

  function bindVal(id,key,num=false){
    const e=$(id);if(!e)return;e.addEventListener('input',()=>{cfg[key]=num?n(e.value,DEF[key]):e.value;save();visibility();preview();});e.addEventListener('change',()=>{cfg[key]=num?n(e.value,DEF[key]):e.value;save();visibility();preview();});
  }
  function bindCheck(id,key){const e=$(id);e?.addEventListener('change',()=>{cfg[key]=e.checked;save();preview();});}
  function bind(){
    [['#pws_output','outputMode'],['#pws_pov','povMode'],['#pws_pov_name','povName'],['#pws_lens','lens'],['#pws_range','rangeMode'],['#pws_latest','latestCount',1],['#pws_anchor','anchorFloor',1],['#pws_above','above',1],['#pws_below','below',1],['#pws_world_mode','worldbookMode'],['#pws_focus','focusPoint'],['#pws_focus_dest','focusDestination'],['#pws_engine','engine'],['#pws_base','apiBase'],['#pws_key','apiKey'],['#pws_model','apiModel'],['#pws_temp','temperature',1]].forEach(x=>bindVal(...x));
    [['#pws_chat','readChat'],['#pws_character','readCharacter'],['#pws_world','readWorldbook']].forEach(x=>bindCheck(...x));
    $('#pws_model_select')?.addEventListener('change',e=>{if(e.target.value){cfg.apiModel=e.target.value;$('#pws_model').value=cfg.apiModel;save();}});
    $('#pws_fetch')?.addEventListener('click',fetchModels);
  }
  function set(id,v){const e=$(id);if(e)e.value=v??'';}function check(id,v){const e=$(id);if(e)e.checked=!!v;}
  function sync(){
    [['#pws_output',cfg.outputMode],['#pws_pov',cfg.povMode],['#pws_pov_name',cfg.povName],['#pws_lens',cfg.lens],['#pws_range',cfg.rangeMode],['#pws_latest',cfg.latestCount],['#pws_anchor',cfg.anchorFloor],['#pws_above',cfg.above],['#pws_below',cfg.below],['#pws_world_mode',cfg.worldbookMode],['#pws_focus',cfg.focusPoint],['#pws_focus_dest',cfg.focusDestination],['#pws_engine',cfg.engine],['#pws_base',cfg.apiBase],['#pws_key',cfg.apiKey],['#pws_model',cfg.apiModel],['#pws_temp',cfg.temperature]].forEach(x=>set(...x));
    [['#pws_chat',cfg.readChat],['#pws_character',cfg.readCharacter],['#pws_world',cfg.readWorldbook]].forEach(x=>check(...x));visibility();preview();
  }
  function visibility(){
    document.querySelectorAll('.pws-pov-name').forEach(e=>e.classList.toggle('pws-hidden',cfg.povMode!=='custom'));
    document.querySelectorAll('.pws-latest').forEach(e=>e.classList.toggle('pws-hidden',cfg.rangeMode!=='latest'));
    document.querySelectorAll('.pws-anchor').forEach(e=>e.classList.toggle('pws-hidden',cfg.rangeMode!=='anchor'));
    $('#pws_focus_wrap')?.classList.toggle('pws-hidden',cfg.lens!=='point');
    document.querySelectorAll('.pws-api').forEach(e=>e.classList.toggle('pws-hidden',cfg.engine!=='independent'));
  }

  function msg(m){const who=m?.is_user?'用户':(m?.name||'角色');const text=String(m?.mes??m?.content??'').trim();return text?`[${who}] ${text}`:'';}
  function chatRows(chat){
    if(!cfg.readChat||!Array.isArray(chat))return[];
    if(cfg.rangeMode==='anchor'){
      const c=Math.max(1,n(cfg.anchorFloor,1))-1,s=Math.max(0,c-Math.max(0,n(cfg.above,0))),e=Math.min(chat.length,c+Math.max(0,n(cfg.below,0))+1);
      return chat.slice(s,e).map((m,i)=>({floor:s+i+1,text:msg(m)})).filter(x=>x.text);
    }
    const c=Math.max(1,Math.min(200,n(cfg.latestCount,12))),s=Math.max(0,chat.length-c);
    return chat.slice(s).map((m,i)=>({floor:s+i+1,text:msg(m)})).filter(x=>x.text);
  }
  function currentCharacter(c){const id=c?.characterId,chars=c?.characters||globalThis.characters;return chars?.[id]||c?.character||null;}
  function charText(c){if(!cfg.readCharacter||!c)return'';return[['名字',c.name],['简介',c.description],['性格',c.personality],['场景',c.scenario],['首条消息',c.first_mes],['示例对话',c.mes_example],['作者注释',c.creator_notes]].filter(x=>x[1]).map(x=>`${x[0]}：${x[1]}`).join('\n').slice(0,18000);}
  function flatten(o,d=0,seen=new WeakSet()){
    if(!o||d>4)return[];if(typeof o==='string')return o.trim()?[o.trim()]:[];if(typeof o!=='object'||seen.has(o))return[];seen.add(o);if(Array.isArray(o))return o.flatMap(x=>flatten(x,d+1,seen));
    const out=[];for(const k of ['content','text','description','comment','key','keys','entry','entries','worldInfo','world_info','lorebook','book'])if(k in o)out.push(...flatten(o[k],d+1,seen));return out;
  }
  function worldText(c){if(!cfg.readWorldbook)return'';let p=[c?.worldInfo,c?.world_info,c?.worldInfoPrompt,c?.extensionPrompts,globalThis.world_info,globalThis.worldInfo,globalThis.selected_world_info].flatMap(x=>flatten(x));p=[...new Set(p)].filter(Boolean);if(cfg.worldbookMode==='relevant')p=p.slice(0,80);return p.join('\n---\n').slice(0,18000);}
  function preview(){
    const c=ctx(),rows=chatRows(c?.chat||[]),floors=rows.length?`${rows[0].floor}–${rows.at(-1).floor} 楼`:'不读聊天';
    const ch=charText(currentCharacter(c))?'人物✓':'人物–',w=worldText(c)?'世界书✓':'世界书–';if($('#pws_preview'))$('#pws_preview').textContent=`本次预计读取：${floors} · ${ch} · ${w} · ${LENS[cfg.lens]||LENS.free}`;
  }

  function modeInfo(){
    const m=$('.pw-mode.is-active')?.dataset.mode||'new_scene',count=Math.max(1,n($('#pw_count')?.value,1));
    if(cfg.outputMode==='story'){
      const base=`写 ${count} 份彼此独立、可直接阅读的剧情正文。不要先做策划分析，要有具体动作、对话、环境与推进，并自然承接当前故事。`;
      return {m,text:{directions:`${base} 让“剧情走向”通过正在发生的事件体现。`,new_scene:`${base} 紧接当前最后一幕，从未完成动作、未回答问题或当前关系张力进入。`,side_story:`${base} 写成与主线有联系、但可独立阅读的番外或间章。`,outline:`输出 ${count} 份可读型剧情大纲，既有章节结构，也把关键场景写具体。`,foreshadow:`${base} 让伏笔通过物件、对话、动作或反常细节自然出现，不直接告诉读者“这是伏笔”。`,wildcard:`${base} 允许更有新鲜感的事件，但必须和当前人物、设定或最近剧情有真实联系。`}[m]||base};
    }
    return {m,text:{directions:`给出 ${count} 条真正不同的后续剧情走向，写清触发点、推动者、冲突、后果与下一幕钩子。`,new_scene:`设计 ${count} 个能直接接上当前最后一幕的新剧情方案，并各给一小段开场。`,side_story:`设计 ${count} 个与当前人物或设定有联系、但能独立成立的番外/间章。`,outline:`把后续整理为 ${count} 个章节或阶段的大纲，明确主矛盾、节拍、人物变化与章末钩子。`,foreshadow:`整理并扩展 ${count} 个伏笔机会，区分已存在的线索与新伏笔候选。`,wildcard:`生成 ${count} 个互不重复的剧情灵感，核心矛盾和推动者必须有差异。`}[m]};
  }
  function povLine(c){let t=POV[cfg.povMode]||POV.auto;if(cfg.povMode==='custom')t+=`\n主要视角人物：${cfg.povName||'未填写'}。`;if(cfg.povMode==='character')t+=`\n主要视角人物：${currentCharacter(c)?.name||'当前角色'}。`;return t;}
  function buildPrompt(){
    const c=ctx(),rows=chatRows(c?.chat||[]),ch=charText(currentCharacter(c)),w=worldText(c),mi=modeInfo(),custom=$('#pw_custom_request')?.value.trim()||'';
    const focus=cfg.lens==='point'?`\n指定聚焦点：${cfg.focusPoint||'未填写，请从已有信息中选一个值得深挖的细节'}；偏向：${cfg.focusDestination==='main'?'主线':cfg.focusDestination==='side'?'支线':'主线或支线均可'}。`:'';
    return `你是“剧情灵感工坊”，既能做剧情策划，也能直接写可阅读的互动故事正文。只依据提供的实际资料工作，不把缺失信息伪装成既有事实。只输出最终成品，不展示思考过程。\n\n【任务】\n${mi.text}\n\n【剧情方向】\n${LENS[cfg.lens]||LENS.free}${focus}\n\n【人物视角】\n${povLine(c)}\n\n【人物设定】\n${ch||'本次未读取或未找到'}\n\n【世界书/世界信息】\n${w||'本次未读取，或当前接口未向扩展暴露可直接读取的世界书。若使用酒馆当前模型，可利用酒馆自身注入的世界书。'}\n\n【聊天记录】\n${rows.map(x=>`【第${x.floor}楼】${x.text}`).join('\n\n')||'本次未读取聊天记录'}\n\n【额外要求】\n${custom||'无'}\n\n要求：优先承接最近剧情；角色行为要有动机；避免复述；剧情正文模式优先写场景而非分析报告；不要替用户角色决定关键内心、台词或不可逆行动。直接输出成品。`;
  }

  function baseUrl(s){return String(s||'').trim().replace(/\/$/,'');}
  function ep(s,kind){const b=baseUrl(s);if(!b)return'';if(kind==='models'){if(b.endsWith('/models'))return b;if(b.endsWith('/v1'))return`${b}/models`;return`${b}/v1/models`;}if(b.endsWith('/chat/completions'))return b;if(b.endsWith('/v1'))return`${b}/chat/completions`;return`${b}/v1/chat/completions`;}
  async function fetchModels(){
    const btn=$('#pws_fetch'),sel=$('#pws_model_select'),url=ep(cfg.apiBase,'models');if(!url)return toast('info','先填写 Base URL。');if(btn){btn.disabled=true;btn.textContent='正在拉取…';}
    try{const h={Accept:'application/json'};if(cfg.apiKey)h.Authorization=`Bearer ${cfg.apiKey}`;const r=await fetch(url,{headers:h});if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json(),raw=Array.isArray(d?.data)?d.data:Array.isArray(d?.models)?d.models:Array.isArray(d)?d:[];const models=[...new Set(raw.map(x=>typeof x==='string'?x:(x?.id||x?.name||x?.model)).filter(Boolean))].sort();if(!models.length)throw new Error('没有识别到模型列表');if(sel){sel.replaceChildren(new Option(`已拉取 ${models.length} 个模型`,''));models.forEach(m=>sel.append(new Option(m,m)));if(models.includes(cfg.apiModel))sel.value=cfg.apiModel;}toast('success',`已拉取 ${models.length} 个模型，可以直接选择。`);}catch(e){console.error(e);toast('error',`拉取模型失败：${e.message}。仍可手动输入模型名。`);}finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-cloud-arrow-down"></i> 拉取模型';}}
  }
  async function current(prompt){const c=ctx();if(typeof c?.generateQuietPrompt!=='function')throw new Error('当前酒馆没有后台生成接口');const r=await c.generateQuietPrompt({quietPrompt:prompt});return typeof r==='string'?r.trim():String(r?.content??r??'').trim();}
  async function independent(prompt){
    if(!baseUrl(cfg.apiBase)||!String(cfg.apiModel||'').trim())throw new Error('请先填写独立 API 的 Base URL 和模型');const h={'Content-Type':'application/json'};if(cfg.apiKey)h.Authorization=`Bearer ${cfg.apiKey}`;
    const r=await fetch(ep(cfg.apiBase,'chat'),{method:'POST',headers:h,body:JSON.stringify({model:String(cfg.apiModel).trim(),messages:[{role:'user',content:prompt}],temperature:Math.max(0,Math.min(2,n(cfg.temperature,.9))),stream:false})});if(!r.ok)throw new Error(`独立 API 返回 ${r.status}: ${(await r.text()).slice(0,180)}`);const d=await r.json(),o=d?.choices?.[0]?.message?.content??d?.choices?.[0]?.text??d?.content;if(!o)throw new Error('独立 API 返回空内容');return String(o).trim();
  }
  async function generate(refine=''){
    if(busy)return;if(cfg.povMode==='custom'&&!cfg.povName.trim())return toast('info','指定人物视角需要先输入人物名。');busy=true;setBusy(true,refine?'正在细化…':`正在生成${cfg.outputMode==='story'?'剧情正文':'灵感方案'}…`);
    try{const base=buildPrompt(),prompt=refine?`${base}\n\n【已有结果】\n${lastResult.slice(0,30000)}\n\n【细化要求】\n${refine}\n\n只输出修改后的完整成品。`:base;lastPrompt=prompt;const out=cfg.engine==='independent'?await independent(prompt):await current(prompt);if(!out)throw new Error('模型返回空内容');show(out,refine?`${cfg.outputMode==='story'?'剧情正文':'灵感'} · 已细化`:cfg.outputMode==='story'?'剧情正文':'灵感方案');setBusy(false,'生成完成，可以直接阅读、复制、填入输入框或继续细化。');}catch(e){console.error(e);setBusy(false,`生成失败：${e.message}`);toast('error',e.message||'生成失败');}finally{busy=false;}
  }
  function show(text,badge){lastResult=text;const r=$('#pw_result');if(r){r.textContent=text;r.classList.remove('pw-placeholder');}if($('#pw_result_badge'))$('#pw_result_badge').textContent=badge;$('#pw_result_actions')?.removeAttribute('hidden');$('#pw_refine_box')?.removeAttribute('hidden');globalThis.__plotWeaverEnhancedLastResult=text;}
  function setBusy(on,msg){const b=$('#pw_generate');if(b){b.disabled=on;const s=b.querySelector('span');if(s)s.textContent=on?'正在读取资料并生成…':'结合当前剧情生成';}if($('#pw_refine'))$('#pw_refine').disabled=on;if($('#pw_status'))$('#pw_status').textContent=msg||'';}

  function intercept(e){
    const gen=e.target.closest?.('#pw_generate');if(gen){e.preventDefault();e.stopImmediatePropagation();generate();return;}
    const ref=e.target.closest?.('#pw_refine');if(ref){e.preventDefault();e.stopImmediatePropagation();const q=$('#pw_refine_request')?.value.trim()||'';if(!q)return toast('info','先写下想怎样细化。');generate(q);return;}
    const regen=e.target.closest?.('[data-result-action="regenerate"]');if(regen){e.preventDefault();e.stopImmediatePropagation();generate();}
  }

  async function start(){
    try{await loadBase();}catch(e){console.error(`[${NAME}] 基础脚本加载失败`,e);return;}
    for(let i=0;i<60;i++){if(inject())break;await wait(200);}
    if(!$('#pws_box')){console.error(`[${NAME}] 增强界面未能注入，基础插件仍可继续使用`);return;}
    if(!globalThis.__plotWeaverSafeEnhanceBound){globalThis.__plotWeaverSafeEnhanceBound=true;document.addEventListener('click',intercept,true);}
    preview();console.log(`[${NAME}] 安全增强版 v1.3.0 已加载`);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
