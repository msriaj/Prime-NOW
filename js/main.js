/* Prime NOW — page behaviour. Plain JS, no dependencies. */
(function () {
  'use strict';

  var D = window.PN_I18N;

  // Preloader: drop the overlay (and the scroll lock) once its fade-out finishes.
  (function () {
    var pl = document.querySelector('.preloader');
    if (!pl) return;
    function done() { pl.remove(); root.classList.remove('pl-on', 'pl-hold'); }
    if (reduceMotion) { done(); return; }
    pl.addEventListener('animationend', function (e) { if (e.target === pl) done(); });
  })();
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
     NOW Buddy — live avatar
     Every [data-buddy] gets the template: official body + SVG face.
     Eyes follow the pointer, blink, and the face swaps by mood.
     ------------------------------------------------------------------ */
  var MOODS = {
    happy:     { eyes: 'happy',  props: 'lines stars' },
    look:      { eyes: 'open',   props: 'lines' },
    curious:   { eyes: 'open',   props: 'ask', gaze: [0.55, -0.85] },
    cool:      { eyes: 'none',   mouth: 'smile', props: 'shades check lines' },
    waiting:   { eyes: 'lid',    props: 'hourglass', gaze: [0.9, 0] },
    savvy:     { eyes: 'lid',    props: 'coins lines', gaze: [0.75, 0] },
    sleepy:    { eyes: 'sleep',  props: 'zzz' },
    surprised: { eyes: 'wide',   mouth: 'o', props: 'lines' },
    tickled:   { eyes: 'squint', mouth: 'grin', props: 'lines stars' },
    alert:     { eyes: 'open',   props: 'brows shield', gaze: [0, 0.15] },
    meh:       { eyes: 'lid',    props: '', gaze: [-0.9, 0] }
  };
  var BUDDY = {};
  var buddies = [];

  function Buddy(host) {
    this.kind = host.getAttribute('data-buddy') || 'mini';
    host.appendChild(document.getElementById('tpl-buddy').content.cloneNode(true));
    this.host = host;
    this.el = host.querySelector('.nb');
    this.svg = this.el.querySelector('svg');
    this.el.classList.add('nb--' + this.kind);
    if (this.kind !== 'stage') this.svg.querySelector('.nb-props').remove();
    this.base = 'happy';     // chosen mood
    this.temp = null;        // short reaction on top of it
    this.cur = '';
    this.mirrors = [];       // avatars that copy this one's face
    this.led = false;        // true when another avatar drives this one
    this.visible = false;
    this.lookUntil = 0;
    this.lookBlock = 0;
    this.g = { x: 0, y: 0 }; this.gp = { x: 9, y: 9 };
    this.wander = { x: 0, y: 0, next: 0 };
    this.onMood = null;
    this.apply();
    this.blinkLoop();
    buddies.push(this);
    BUDDY[this.kind] = this;
  }
  Buddy.prototype.mood = function () {
    if (this.temp) return this.temp;
    if (this.base === 'happy' && performance.now() < this.lookUntil) return 'look';
    return this.base;
  };
  Buddy.prototype.apply = function () {
    var m = this.mood();
    if (m === this.cur) return;
    this.cur = m;
    var d = MOODS[m];
    [this].concat(this.mirrors).forEach(function (b) {
      var s = b.el.dataset;
      s.mood = m; s.eyes = d.eyes; s.mouth = d.mouth || ''; s.props = d.props || '';
    });
    if (this.onMood) this.onMood(m);
  };
  Buddy.prototype.set = function (m) { this.base = m; this.apply(); };
  Buddy.prototype.react = function (m, ms) {
    var self = this;
    clearTimeout(this.tt);
    this.temp = m;
    this.apply();
    if (ms) this.tt = setTimeout(function () { self.temp = null; self.apply(); }, ms);
  };
  Buddy.prototype.calm = function () { clearTimeout(this.tt); this.temp = null; this.apply(); };
  Buddy.prototype.squish = function () {
    var el = this.el;
    el.classList.remove('is-poke');
    void el.getBoundingClientRect(); // restart the animation
    el.classList.add('is-poke');
  };
  Buddy.prototype.blinkLoop = function () {
    var self = this, st = this.el.style;
    setTimeout(function () {
      if (self.visible && !document.hidden) {
        st.setProperty('--blink', '.08');
        setTimeout(function () { st.setProperty('--blink', '1'); }, 120);
        if (Math.random() < 0.2) { // sometimes a double blink
          setTimeout(function () { st.setProperty('--blink', '.08'); }, 260);
          setTimeout(function () { st.setProperty('--blink', '1'); }, 380);
        }
      }
      self.blinkLoop();
    }, 2200 + Math.random() * 3800);
  };

  document.querySelectorAll('[data-buddy]').forEach(function (host) { new Buddy(host); });

  (function () {
    var stage = BUDDY.stage;
    // The chat header avatar wears the same face as the big one
    if (stage && BUDDY.chat) { BUDDY.chat.led = true; stage.mirrors.push(BUDDY.chat); stage.cur = ''; stage.apply(); }

    // Pointer + activity tracking
    var ptr = { x: 0, y: 0, t: -1e6 };
    var lastAct = performance.now();
    var running = false;
    function wake() {
      lastAct = performance.now();
      if (stage && stage.idle) { stage.idle = false; stage.react('surprised', 900); }
    }
    function onPtr(e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); wake(); }
    window.addEventListener('pointermove', onPtr, { passive: true });
    window.addEventListener('pointerdown', onPtr, { passive: true });
    ['keydown', 'scroll', 'wheel', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, wake, { passive: true }); });
    document.addEventListener('mouseleave', function () { ptr.t = -1e6; });

    function idleCheck(now) {
      if ((stage.temp && !stage.idle) || stage.base === 'sleepy') return;
      var idle = now - lastAct;
      var want = idle > 26000 ? 'sleepy' : (idle > 13000 && stage.base !== 'waiting') ? 'waiting' : null;
      if (want && stage.cur !== want) { stage.idle = true; stage.react(want); }
    }

    function frame(now) {
      var any = false;
      var fresh = now - ptr.t < 3500;
      buddies.forEach(function (b) {
        if (!b.visible) return;
        any = true;
        var r = b.svg.getBoundingClientRect();
        if (!r.width) return;
        var d = MOODS[b.cur] || {};
        var tx = 0, ty = 0;
        if (d.gaze) { tx = d.gaze[0]; ty = d.gaze[1]; }
        else if (fresh) {
          var dx = ptr.x - (r.left + r.width * 0.49), dy = ptr.y - (r.top + r.height * 0.46);
          var dist = Math.hypot(dx, dy) || 1;
          var k = Math.min(1, dist / Math.max(160, r.width * 1.3));
          tx = dx / dist * k; ty = dy / dist * k;
          // Buddy opens his eyes to watch you when you move nearby
          if (!b.led && now > b.lookBlock && now - ptr.t < 1200 && dist < Math.max(420, r.width * 2.2)) b.lookUntil = now + 2600;
        } else if (!reduceMotion) {
          if (now > b.wander.next) { // idle glances
            var centre = Math.random() < 0.4;
            b.wander.x = centre ? 0 : Math.random() * 1.4 - 0.7;
            b.wander.y = centre ? 0 : Math.random() * 0.9 - 0.45;
            b.wander.next = now + 1600 + Math.random() * 2800;
          }
          tx = b.wander.x; ty = b.wander.y;
        }
        b.g.x += (tx - b.g.x) * 0.16;
        b.g.y += (ty - b.g.y) * 0.16;
        if (Math.abs(b.g.x - b.gp.x) > 0.002 || Math.abs(b.g.y - b.gp.y) > 0.002) {
          b.gp.x = b.g.x; b.gp.y = b.g.y;
          var s = b.el.style, gx = b.g.x, gy = b.g.y, tilt = reduceMotion ? 0 : 1;
          s.setProperty('--lx', (gx * 26).toFixed(2));
          s.setProperty('--ly', (gy * 18).toFixed(2));
          s.setProperty('--fx', (gx * 14).toFixed(2));
          s.setProperty('--fy', (gy * 10).toFixed(2));
          s.setProperty('--rx', (gx * 12 * tilt).toFixed(2));
          s.setProperty('--ry', (-gy * 9 * tilt).toFixed(2));
        }
        if (!b.led) b.apply(); // lets 'look' expire
      });
      if (stage && stage.visible) idleCheck(now);
      running = any;
      if (any) requestAnimationFrame(frame);
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          buddies.forEach(function (b) { if (b.host === en.target) b.visible = en.isIntersecting; });
        });
        if (stage && stage.visible) lastAct = performance.now();
        kick();
      });
      buddies.forEach(function (b) { io.observe(b.host); });
    } else {
      buddies.forEach(function (b) { b.visible = true; });
      kick();
    }

    if (!stage) return;

    // Poke: giggle, wake up, or get grumpy after too many
    var pokes = [];
    stage.host.addEventListener('click', function () {
      var now = performance.now();
      stage.lookBlock = now + 3000;
      stage.lookUntil = 0;
      stage.squish();
      if (stage.temp === 'surprised') return; // this tap just woke him
      pokes = pokes.filter(function (p) { return now - p < 2500; });
      pokes.push(now);
      if (pokes.length >= 5) { pokes = []; stage.react('meh', 2600); }
      else stage.react('tickled', 1200);
    });

    // Mood picker
    radioGroup(document.querySelector('.nb-chips'), function (btn) {
      stage.idle = false;
      lastAct = performance.now();
      stage.lookBlock = lastAct + 3000;
      stage.lookUntil = 0;
      stage.calm();
      stage.set(btn.dataset.mood);
    });

    // Speech bubble
    var say = document.getElementById('nb-say');
    function renderSay() {
      say.textContent = t('nb.say.' + stage.cur);
      say.classList.remove('is-pop');
      void say.offsetWidth;
      say.classList.add('is-pop');
    }
    stage.onMood = renderSay;
    onLang(renderSay);
  })();

  /* ------------------------------------------------------------------
     Header: scrolled state + mobile menu
     ------------------------------------------------------------------ */
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 12); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // liquid-glass sheen follows the pointer across the bar
  var headerInner = header.querySelector('.header-inner');
  if (headerInner && !reduceMotion) {
    headerInner.addEventListener('pointermove', function (e) {
      var r = headerInner.getBoundingClientRect();
      headerInner.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    });
  }

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
     Numberless card fan
     Slots: "c" front, "l" back-left, "r" back-right (positions in CSS).
     First view: the tuck-and-fan intro plays once.
     Click: the cards turn one step like a carousel. Right card (or the front
     card) -> right comes to the front, front goes left, left wraps round to the
     right. Left card -> the same the other way. The wrapping card dips and
     passes behind the others. The section tint follows the front card.
     ------------------------------------------------------------------ */
  (function () {
    var fan = document.getElementById('card-fan');
    if (!fan) return;
    var section = document.getElementById('card');
    var cards = Array.prototype.slice.call(fan.querySelectorAll('.fan-card'));
    var POS = {   // same as the CSS slot transforms, spelt out for the wrap animation
      l: 'translateX(-108%) translateY(5%) scale(.86)',
      c: 'translateX(-50%) translateY(0%) scale(1)',
      r: 'translateX(8%) translateY(5%) scale(.86)'
    };
    var BEHIND = 'translateX(-50%) translateY(10%) scale(.72)';
    var EASE = 'cubic-bezier(.65, 0, .35, 1)', DUR = 800, busy = false;

    function render() { cards.forEach(function (el) { el.alt = t('card.alt.' + el.dataset.color); }); }

    function turn(dir) {   // dir 1: right card to the front; -1: left card to the front
      if (busy) return;
      busy = true;
      fan.classList.remove('is-playing');
      var next = dir > 0 ? { r: 'c', c: 'l', l: 'r' } : { l: 'c', c: 'r', r: 'l' };
      cards.forEach(function (el) {
        var from = el.dataset.slot, to = next[from];
        el.dataset.slot = to;
        if (from !== 'c' && to !== 'c' && !reduceMotion && el.animate) {
          el.style.zIndex = '0';   // the wrapping card travels behind the other two
          var anim = el.animate(
            [{ transform: POS[from] }, { transform: BEHIND, offset: 0.5 }, { transform: POS[to] }],
            { duration: DUR, easing: EASE }
          );
          anim.onfinish = anim.oncancel = function () { el.style.zIndex = ''; };
        }
        if (to === 'c') section.dataset.front = el.dataset.color;   // background tint follows the front card
      });
      setTimeout(function () { busy = false; }, reduceMotion ? 0 : DUR);
    }

    fan.addEventListener('click', function (e) {
      var el = e.target.closest('.fan-card');
      if (el) turn(el.dataset.slot === 'l' ? -1 : 1);
    });

    // tuck-and-fan intro, once, when the stack first comes into view
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        fan.classList.add('is-playing');
      }, { threshold: 0.55 });
      io.observe(fan);
      fan.addEventListener('animationend', function (e) {
        if (e.target.dataset.slot === 'c') fan.classList.remove('is-playing');
      });
    }
    onLang(render);
    render();
  })();

  /* ------------------------------------------------------------------
     Security: card-lock switch in the "block your card" row
     ------------------------------------------------------------------ */
  (function () {
    var row = document.getElementById('lock-row');
    if (!row) return;
    var sw = row.querySelector('.ld-switch');
    sw.addEventListener('click', function () {
      var locked = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(locked));
      row.classList.toggle('is-locked', locked);
    });
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
      if (BUDDY.spend) BUDDY.spend.set(period === 'this' ? 'happy' : 'savvy');
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
    var buddy = BUDDY.stage;
    // How Buddy feels about each answer
    var FEEL = { '1': 'cool', '2': 'savvy', '3': 'happy', '4': 'alert' };

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
      if (buddy) buddy.react('curious');
      setTimeout(function () {
        typing.remove();
        push({ who: 'bot', key: 'chat.a' + q });
        if (buddy) buddy.react(FEEL[q], 4500);
        busy = false;
        renderQs();
      }, reduceMotion ? 150 : 1100);
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
