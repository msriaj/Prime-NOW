/* Prime NOW — page behaviour. Plain JS, no dependencies. */
(function () {
  'use strict';

  var D = window.PN_I18N;
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STORE = {
    ios: 'https://apps.apple.com/us/app/prime-now-app/id6759029598',
    android: 'https://play.google.com/store/apps/details?id=com.primenow.app'
  };

  /* ------------------------------------------------------------------
     Device detection + smart download links
     ------------------------------------------------------------------ */
  function detectOS() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    return 'other';
  }
  var OS = detectOS();

  // The QR codes on the page encode https://primenow.ai/?get=app.
  // A phone that scans it lands here and is sent straight to its own store.
  var params = new URLSearchParams(location.search);
  if (params.has('get') && OS !== 'other') {
    location.replace(STORE[OS]);
    return;
  }

  document.querySelectorAll('[data-store="smart"]').forEach(function (a) {
    if (OS === 'other') return; // desktop: scroll to the download section with QR
    a.href = STORE[OS];
    a.target = '_blank';
    a.rel = 'noopener';
  });
  if (OS !== 'other') {
    // Put the visitor's own store first and give it a ring.
    document.querySelectorAll('.stores').forEach(function (wrap) {
      var mine = wrap.querySelector('[data-os="' + OS + '"]');
      if (mine) { wrap.prepend(mine); mine.classList.add('is-mine'); }
    });
  }

  /* ------------------------------------------------------------------
     NOW Buddy avatars (one SVG template, cloned)
     ------------------------------------------------------------------ */
  var tpl = document.getElementById('tpl-buddy');
  document.querySelectorAll('[data-buddy]').forEach(function (el) {
    el.appendChild(tpl.content.cloneNode(true));
  });

  /* ------------------------------------------------------------------
     i18n — Bangla is captured from the DOM, English comes from i18n.js
     ------------------------------------------------------------------ */
  var bn = {};
  var textNodes = Array.prototype.slice.call(document.querySelectorAll('[data-i18n]'));
  var attrNodes = Array.prototype.slice.call(document.querySelectorAll('[data-i18n-attr]'));
  textNodes.forEach(function (el) {
    var k = el.getAttribute('data-i18n');
    if (!(k in bn)) bn[k] = el.innerHTML;
  });
  function parseAttrSpec(el) {
    return el.getAttribute('data-i18n-attr').split(';').map(function (pair) {
      var p = pair.split(':');
      return { attr: p[0].trim(), key: p[1].trim() };
    });
  }
  attrNodes.forEach(function (el) {
    parseAttrSpec(el).forEach(function (s) {
      if (!(s.key in bn)) bn[s.key] = el.getAttribute(s.attr);
    });
  });

  var lang = root.lang === 'en' ? 'en' : 'bn';
  var listeners = [];
  function onLang(fn) { listeners.push(fn); }

  function t(key, vars) {
    var s = (D.ui[lang] && D.ui[lang][key]);
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, v) { return vars[v] != null ? vars[v] : ''; });
    return s;
  }

  var NF = {};
  function nf(digits) {
    var id = lang + digits;
    if (!NF[id]) NF[id] = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return NF[id];
  }
  function num(n, digits) { return nf(digits || 0).format(digits ? n : Math.round(n)); }
  function tk(n) { return '৳' + num(n); }
  function pct(n, digits) { return num(n, digits) + '%'; }

  function applyLang(l) {
    lang = l;
    root.lang = l;
    var dict = l === 'en' ? D.en : bn;
    textNodes.forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v != null) el.innerHTML = v;
    });
    attrNodes.forEach(function (el) {
      parseAttrSpec(el).forEach(function (s) {
        var v = dict[s.key];
        if (v != null) el.setAttribute(s.attr, v);
      });
    });
    document.title = t('meta.title');
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.desc'));
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === l));
    });
    try { localStorage.setItem('pn-lang', l); } catch (e) {}
    listeners.forEach(function (fn) { fn(); });
  }

  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.lang !== lang) applyLang(b.dataset.lang); });
  });

  /* ------------------------------------------------------------------
     Small helper: accessible radio group (click + arrow keys)
     ------------------------------------------------------------------ */
  function radioGroup(container, onChange) {
    var items = Array.prototype.slice.call(container.querySelectorAll('[role="radio"]'));
    function select(item, focus) {
      items.forEach(function (it) {
        var on = it === item;
        it.setAttribute('aria-checked', String(on));
        it.tabIndex = on ? 0 : -1;
      });
      if (focus) item.focus();
      onChange(item);
    }
    items.forEach(function (it) {
      it.tabIndex = it.getAttribute('aria-checked') === 'true' ? 0 : -1;
      it.addEventListener('click', function () { select(it, false); });
      it.addEventListener('keydown', function (e) {
        var i = items.indexOf(it), n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = items[(i + 1) % items.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = items[(i - 1 + items.length) % items.length];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }

  /* ------------------------------------------------------------------
     Header: scrolled state + mobile menu
     ------------------------------------------------------------------ */
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 12); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var nav = document.getElementById('nav');
  var menuBtn = document.querySelector('.menu-btn');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ------------------------------------------------------------------
     Reveal on scroll (minimal: fade + 18px rise, once)
     ------------------------------------------------------------------ */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    reveals.forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.classList.contains('reveal'); });
      var i = sibs.indexOf(el);
      if (i > 0) el.style.transitionDelay = Math.min(i, 5) * 70 + 'ms';
    });
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); ro.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------------------------------------------
     e-KYC stepper — auto-advances while in view, stops once the user clicks
     ------------------------------------------------------------------ */
  (function () {
    var steps = Array.prototype.slice.call(document.querySelectorAll('#kyc-steps .step'));
    var screens = document.querySelectorAll('.scr');
    var STEP_MS = 4200;
    var auto = !reduceMotion, inView = false, timer = null, cur = 1;

    function go(n) {
      cur = n;
      clearTimeout(timer);
      steps.forEach(function (b) {
        var on = +b.dataset.step === n;
        b.classList.toggle('is-active', on);
        b.classList.remove('is-timing');
        if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      screens.forEach(function (s) { s.classList.toggle('is-active', +s.dataset.screen === n); });
      if (auto && inView) {
        var active = steps[n - 1];
        active.style.setProperty('--step-ms', STEP_MS + 'ms');
        void active.offsetWidth; // restart the progress bar animation
        active.classList.add('is-timing');
        timer = setTimeout(function () { go(n % steps.length + 1); }, STEP_MS);
      }
    }
    steps.forEach(function (b) {
      b.addEventListener('click', function () { auto = false; go(+b.dataset.step); });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) go(cur); else { clearTimeout(timer); steps.forEach(function (b) { b.classList.remove('is-timing'); }); }
      }, { threshold: 0.35 }).observe(document.getElementById('account'));
    }
  })();

  /* ------------------------------------------------------------------
     Numberless card colour picker
     ------------------------------------------------------------------ */
  (function () {
    var stage = document.querySelector('.card-stage');
    var img = document.getElementById('card-img');
    var mood = document.getElementById('card-mood');
    var SRC = { purple: 'assets/card-purple.webp', orange: 'assets/card-orange.webp', black: 'assets/card-black.webp' };
    Object.keys(SRC).forEach(function (k) { var i = new Image(); i.src = SRC[k]; });
    var color = 'purple', swapTimer;

    function render() {
      mood.textContent = t('card.mood.' + color);
      img.alt = t('card.alt.' + color);
    }
    radioGroup(document.querySelector('.swatches'), function (btn) {
      var c = btn.dataset.color;
      if (c === color) return;
      color = c;
      stage.dataset.color = c;
      clearTimeout(swapTimer);
      img.classList.add('is-swapping');
      swapTimer = setTimeout(function () {
        img.src = SRC[c];
        img.classList.remove('is-swapping');
        render();
      }, reduceMotion ? 0 : 220);
    });
    onLang(render);
    render();
  })();

  /* ------------------------------------------------------------------
     Add Money demo
     ------------------------------------------------------------------ */
  (function () {
    var balEl = document.getElementById('am-balance');
    var toast = document.getElementById('am-toast');
    var chips = document.querySelector('#add-money .chips');
    var btn = document.getElementById('am-btn');
    var balance = 12450, shown = balance, amount = 1000, toastTimer;

    function renderChips() {
      chips.querySelectorAll('button').forEach(function (b) { b.textContent = tk(+b.dataset.amt); });
    }
    function renderBalance() { balEl.textContent = tk(shown); }
    radioGroup(chips, function (b) { amount = +b.dataset.amt; });

    btn.addEventListener('click', function () {
      var from = balance, to = balance + amount;
      balance = to;
      if (reduceMotion) { shown = to; renderBalance(); }
      else {
        var start = performance.now(), dur = 700;
        (function step(now) {
          var p = Math.min(1, (now - start) / dur);
          var e = 1 - Math.pow(1 - p, 3);
          shown = from + (to - from) * e;
          renderBalance();
          if (p < 1) requestAnimationFrame(step);
        })(start);
      }
      toast.textContent = t('am.added', { amt: tk(amount) });
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
    });

    onLang(function () { renderChips(); renderBalance(); toast.textContent = ''; toast.classList.remove('is-on'); });
    renderChips(); renderBalance();
  })();

  /* ------------------------------------------------------------------
     Decorative (non-scannable) QR pattern for the Bangla QR tile
     ------------------------------------------------------------------ */
  (function () {
    var svg = document.querySelector('.fake-qr');
    if (!svg) return;
    var N = 29, seed = 7, out = [];
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function inFinder(x, y) {
      return (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    }
    function finder(ox, oy) {
      out.push('<rect x="' + ox + '" y="' + oy + '" width="7" height="1"/><rect x="' + ox + '" y="' + (oy + 6) + '" width="7" height="1"/>');
      out.push('<rect x="' + ox + '" y="' + (oy + 1) + '" width="1" height="5"/><rect x="' + (ox + 6) + '" y="' + (oy + 1) + '" width="1" height="5"/>');
      out.push('<rect x="' + (ox + 2) + '" y="' + (oy + 2) + '" width="3" height="3"/>');
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (!inFinder(x, y) && rnd() > 0.52) out.push('<rect x="' + x + '" y="' + y + '" width="1" height="1"/>');
    }
    svg.innerHTML = out.join('');
  })();

  /* ------------------------------------------------------------------
     DPS calculator (Fixed DPS rates from primenow.ai/product-rates, Jan 2026)
     ------------------------------------------------------------------ */
  (function () {
    var range = document.getElementById('calc-amt');
    var out = document.getElementById('calc-amt-out');
    var totalEl = document.getElementById('calc-total');
    var depEl = document.getElementById('calc-dep');
    var profEl = document.getElementById('calc-prof');
    var rateEl = document.getElementById('calc-rate');
    var months = 36;

    function rateFor(m) { return m < 12 ? 8 : m < 36 ? 8.5 : 9; }

    function render() {
      var P = +range.value, n = months, r = rateFor(n), i = r / 100 / 12;
      // Monthly instalment at the start of each month, interest compounded monthly.
      var fv = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
      var dep = P * n;
      out.textContent = tk(P);
      range.setAttribute('aria-valuetext', tk(P));
      range.style.setProperty('--fill', ((P - range.min) / (range.max - range.min) * 100) + '%');
      totalEl.textContent = tk(fv);
      depEl.textContent = tk(dep);
      profEl.textContent = '+' + tk(fv - dep);
      rateEl.textContent = pct(r, 2);
    }
    range.addEventListener('input', render);
    radioGroup(document.querySelector('#calc .seg'), function (b) { months = +b.dataset.m; render(); });
    onLang(render);
    render();
  })();

  /* ------------------------------------------------------------------
     Spending widget data (shared with NOW Buddy's answer)
     Colours: validated categorical palette, fixed per category.
     ------------------------------------------------------------------ */
  var CATS = [
    { k: 'food', c: '#2a78d6' },
    { k: 'shop', c: '#eb6834' },
    { k: 'bills', c: '#1baf7a' },
    { k: 'travel', c: '#eda100' },
    { k: 'fun', c: '#e87ba4' }
  ];
  var SPEND = {
    this: { food: 6200, shop: 3300, bills: 4250, travel: 3100, fun: 1600 },
    last: { food: 7400, shop: 4300, bills: 4250, travel: 3500, fun: 1500 },
    prev: 19800 // month before "last", used only for last month's comparison
  };
  function sum(o) { return CATS.reduce(function (s, c) { return s + o[c.k]; }, 0); }
  var thisTotal = sum(SPEND.this), lastTotal = sum(SPEND.last);
  var dropPct = Math.round((lastTotal - thisTotal) / lastTotal * 100);

  (function () {
    var wrap = document.getElementById('spend');
    var bar = document.getElementById('spend-bar');
    var list = document.getElementById('spend-list');
    var totalEl = document.getElementById('spend-total');
    var delta = document.getElementById('spend-delta');
    var tip = document.getElementById('spend-tip');
    var buddyMsg = document.getElementById('spend-buddy-msg');
    var period = 'this';

    var segs = CATS.map(function (c) {
      var s = document.createElement('span');
      s.style.background = c.c;
      s.dataset.k = c.k;
      bar.appendChild(s);
      return s;
    });

    function render() {
      var d = SPEND[period], total = sum(d);
      totalEl.textContent = tk(total);
      var cmp = period === 'this' ? lastTotal : SPEND.prev;
      var ch = Math.round((total - cmp) / cmp * 100);
      delta.classList.toggle('is-up', ch > 0);
      delta.textContent = (ch > 0 ? '↑ ' : '↓ ') + t(ch > 0 ? 'spend.more' : 'spend.less', { pct: num(Math.abs(ch)) });

      segs.forEach(function (s) { s.style.flexGrow = d[s.dataset.k]; s.style.flexBasis = '0'; });
      bar.setAttribute('aria-label', t('spend.aria', {
        total: tk(total),
        parts: CATS.map(function (c) { return t('cat.' + c.k) + ' ' + tk(d[c.k]); }).join(', ')
      }));

      list.innerHTML = CATS.map(function (c) {
        var v = d[c.k];
        return '<li><i style="background:' + c.c + '"></i><span>' + t('cat.' + c.k) + '</span>' +
          '<span class="pct">' + pct(v / total * 100) + '</span><span class="amt">' + tk(v) + '</span></li>';
      }).join('');

      buddyMsg.textContent = period === 'this'
        ? t('spend.tip.this', { amt: tk(SPEND.last.shop - SPEND.this.shop) })
        : t('spend.tip.last');
    }

    // Hover tooltip on bar segments
    function showTip(s) {
      var d = SPEND[period], v = d[s.dataset.k], total = sum(d);
      tip.innerHTML = '<b>' + t('cat.' + s.dataset.k) + '</b>' + tk(v) + ' · ' + pct(v / total * 100);
      var wr = wrap.getBoundingClientRect(), r = s.getBoundingClientRect();
      var x = r.left + r.width / 2 - wr.left;
      x = Math.max(70, Math.min(wr.width - 70, x));
      tip.style.left = x + 'px';
      tip.style.top = (r.top - wr.top) + 'px';
      tip.hidden = false;
    }
    segs.forEach(function (s) {
      s.addEventListener('mouseenter', function () { showTip(s); });
      s.addEventListener('mouseleave', function () { tip.hidden = true; });
    });

    radioGroup(wrap.querySelector('.seg'), function (b) { period = b.dataset.period; tip.hidden = true; render(); });
    onLang(render);
    render();
  })();

  /* ------------------------------------------------------------------
     NOW Buddy chat demo
     ------------------------------------------------------------------ */
  (function () {
    var log = document.getElementById('chat-log');
    var qwrap = document.querySelector('#chat-quick .qbtns');
    var QS = ['1', '2', '3', '4'];
    var history = [{ who: 'bot', key: 'chat.greet' }];
    var asked = [];
    var busy = false;

    function vars(key) {
      return key === 'chat.a2' ? { total: tk(thisTotal), pct: num(dropPct) } : null;
    }
    function msgEl(m, isNew) {
      var el = document.createElement('div');
      el.className = 'msg msg--' + m.who + (isNew ? ' is-new' : '');
      el.textContent = t(m.key, vars(m.key));
      return el;
    }
    function renderLog() {
      log.innerHTML = '';
      history.forEach(function (m) { log.appendChild(msgEl(m, false)); });
      log.scrollTop = log.scrollHeight;
    }
    function renderQs() {
      var left = QS.filter(function (q) { return asked.indexOf(q) < 0; });
      if (!left.length) { asked = []; left = QS.slice(); }
      qwrap.innerHTML = '';
      left.forEach(function (q) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = t('chat.q' + q);
        b.disabled = busy;
        b.addEventListener('click', function () { ask(q); });
        qwrap.appendChild(b);
      });
    }
    function push(m) {
      history.push(m);
      log.appendChild(msgEl(m, true));
      log.scrollTop = log.scrollHeight;
    }
    function ask(q) {
      if (busy) return;
      busy = true;
      asked.push(q);
      push({ who: 'me', key: 'chat.q' + q });
      renderQs();
      var typing = document.createElement('div');
      typing.className = 'msg msg--bot typing is-new';
      typing.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      setTimeout(function () {
        typing.remove();
        push({ who: 'bot', key: 'chat.a' + q });
        busy = false;
        renderQs();
      }, reduceMotion ? 150 : 900);
    }
    onLang(function () { renderLog(); renderQs(); });
    renderLog(); renderQs();
  })();

  /* ------------------------------------------------------------------
     Mobile sticky download bar — hidden over the hero and the final CTA
     ------------------------------------------------------------------ */
  (function () {
    var bar = document.getElementById('sticky-get');
    var link = bar.querySelector('a');
    if (!('IntersectionObserver' in window)) return;
    var vis = { hero: true, final: false, footer: false };
    function update() {
      var on = !vis.hero && !vis.final && !vis.footer;
      bar.classList.toggle('is-on', on);
      bar.setAttribute('aria-hidden', String(!on));
      link.tabIndex = on ? 0 : -1;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { vis[en.target.dataset.watch] = en.isIntersecting; });
      update();
    }, { threshold: 0.05 });
    var hero = document.querySelector('.hero'); hero.dataset.watch = 'hero'; io.observe(hero);
    var fin = document.getElementById('download'); fin.dataset.watch = 'final'; io.observe(fin);
    var foot = document.querySelector('.footer'); foot.dataset.watch = 'footer'; io.observe(foot);
  })();

  /* ------------------------------------------------------------------
     Initial language (from <head> script / localStorage / ?lang=)
     ------------------------------------------------------------------ */
  if (lang === 'en') applyLang('en');
  else listeners.forEach(function (fn) { fn(); });
})();
