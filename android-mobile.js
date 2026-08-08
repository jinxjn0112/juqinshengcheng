(() => {
  'use strict';

  const NAME = '剧情灵感工坊';
  const SELF = 'android-mobile.js';
  let lastOpenAt = 0;

  function $(selector) {
    return document.querySelector(selector);
  }

  function selfUrl() {
    const script = [...document.scripts].find(s => /\/android-mobile\.js(?:\?|$)/.test(s.src));
    return script?.src || '';
  }

  function childUrl(file) {
    const src = selfUrl();
    return src ? new URL(file, src).href : `./${file}`;
  }

  function loadRulesLayer() {
    if (document.querySelector('script[data-pw-rules-mobile="1"]')) return;
    const script = document.createElement('script');
    script.dataset.pwRulesMobile = '1';
    script.src = childUrl('enhance-rules-safe.js');
    script.onerror = error => console.error(`[${NAME}] 规则增强层加载失败`, error);
    document.head.appendChild(script);
  }

  function openPanelNow() {
    const overlay = $('#plot_weaver_overlay');
    if (!overlay) return false;
    overlay.hidden = false;
    overlay.removeAttribute('hidden');
    document.body.classList.add('pw-no-scroll');
    document.documentElement.classList.add('pw-mobile-open');
    requestAnimationFrame(() => {
      const body = overlay.querySelector('.pw-body');
      if (body) body.scrollTop = 0;
    });
    lastOpenAt = Date.now();
    return true;
  }

  function closeCleanup() {
    const overlay = $('#plot_weaver_overlay');
    if (!overlay || overlay.hidden || overlay.hasAttribute('hidden')) {
      document.documentElement.classList.remove('pw-mobile-open');
    }
  }

  function isMenuTrigger(target) {
    return !!target?.closest?.('#plot_weaver_menu_button');
  }

  // Android tablets are treated exactly like phones: pointer-up opens the panel directly.
  // This runs before the older touchend fallback, so that fallback sees an already-open panel and does nothing.
  document.addEventListener('pointerup', event => {
    if (!isMenuTrigger(event.target)) return;
    if (event.pointerType && !['touch', 'pen'].includes(event.pointerType)) return;
    openPanelNow();
  }, true);

  // Click is kept as a fallback for WebView/browser combinations that do not expose pointerType reliably.
  document.addEventListener('click', event => {
    if (!isMenuTrigger(event.target)) return;
    if (Date.now() - lastOpenAt < 500) return;
    openPanelNow();
  }, true);

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#plot_weaver_close')) {
      setTimeout(closeCleanup, 0);
    }
  }, true);

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      const overlay = $('#plot_weaver_overlay');
      if (overlay && !overlay.hidden) {
        overlay.style.height = '100dvh';
        requestAnimationFrame(() => { overlay.style.height = ''; });
      }
    }, 250);
  });

  loadRulesLayer();
  console.log(`[${NAME}] Android/手机触控入口已启用`);
})();
