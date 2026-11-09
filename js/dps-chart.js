/*
 * Prime NOW — DPS profit-growth chart inside the savings calculator.
 * Single series: cumulative interest month by month for the chosen monthly instalment
 * and tenure (same Fixed DPS rates and maths as the calculator in main.js). Redraws on
 * slider / tenure / language change; hover or touch shows the interest at that month.
 * Grows in once when it first scrolls into view (skipped for reduced motion).
 */
(function () {
  'use strict';

  var box = document.getElementById('dps-chart');
  var range = document.getElementById('calc-amt');
  var seg = document.querySelector('#calc .seg');
  if (!box || !range || !seg) return;
  var svg = box.querySelector('.dps-svg');
  var tip = box.querySelector('.dps-tip');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'bn'; }
  function T(key, vars) {
    var ui = window.PN_I18N && window.PN_I18N.ui && window.PN_I18N.ui[lang()];
    var s = (ui && ui[key]) || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }
  var NF = {};
  function num(n) {
    var l = lang();
    if (!NF[l]) NF[l] = new Intl.NumberFormat(l === 'bn' ? 'bn-BD' : 'en-IN', { maximumFractionDigits: 0 });
    return NF[l].format(Math.round(n));
  }
  function tk(n) { return '৳' + num(n); }

  function rateFor(m) { return m < 12 ? 8 : m < 36 ? 8.5 : 9; }       // Fixed DPS, primenow.ai/product-rates
  function months() { var b = seg.querySelector('[aria-checked="true"]'); return b ? +b.dataset.m : 36; }
  function series(P, n) {
    var i = rateFor(n) / 100 / 12, out = [0];
    for (var k = 1; k <= n; k++) out.push(P * ((Math.pow(1 + i, k) - 1) / i) * (1 + i) - P * k);
    return out;
  }

  var state = { vals: [0], n: 1, grow: 1 };

  function draw() {
    var vals = state.vals, n = state.n, g = state.grow;
    var w = Math.max(200, box.clientWidth), h = 132, top = 12, bot = 22, base = h - bot;
    var max = vals[n] || 1;
    function X(k) { return (k / n) * w; }
    function Y(v) { return top + (1 - (v * g) / max) * (base - top); }
    var line = '', area = 'M0,' + base;
    for (var k = 0; k <= n; k++) {
      var x = X(k).toFixed(1), y = Y(vals[k]).toFixed(1);
      line += (k ? 'L' : 'M') + x + ',' + y;
      area += 'L' + x + ',' + y;
    }
    area += 'L' + w + ',' + base + 'Z';
    var mid = Math.round(n / 2);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML =
      '<defs><linearGradient id="dpsFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#88f958" stop-opacity=".55"/><stop offset="1" stop-color="#88f958" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<line class="grid" x1="0" x2="' + w + '" y1="' + top + '" y2="' + top + '"/>' +
      '<line class="grid" x1="0" x2="' + w + '" y1="' + base + '" y2="' + base + '"/>' +
      '<path d="' + area + '" fill="url(#dpsFill)"/>' +
      '<path d="' + line + '" fill="none" stroke="#88f958" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + X(n).toFixed(1) + '" cy="' + Y(vals[n]).toFixed(1) + '" r="5" fill="#88f958" stroke="#fff" stroke-width="2"/>' +
      '<text class="axis" x="0" y="' + (h - 5) + '">' + T('dps.start') + '</text>' +
      '<text class="axis" x="' + X(mid).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + num(mid) + ' ' + T('dps.month') + '</text>' +
      '<text class="axis" x="' + w + '" y="' + (h - 5) + '" text-anchor="end">' + num(n) + ' ' + T('dps.month') + '</text>' +
      '<line class="hx" x1="0" x2="0" y1="' + top + '" y2="' + base + '" stroke="rgba(255,255,255,.55)" stroke-dasharray="3 3" visibility="hidden"/>' +
      '<circle class="hd" r="5" fill="#fff" stroke="#88f958" stroke-width="2.5" visibility="hidden"/>';
    box.setAttribute('aria-label', T('dps.aria', { m: num(n), amt: tk(vals[n]) }));
  }

  function update(animate) {
    state.n = months();
    state.vals = series(+range.value, state.n);
    if (!animate || reduce) { state.grow = 1; draw(); return; }
    var start = performance.now(), dur = 650;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      state.grow = 1 - Math.pow(1 - p, 3);
      draw();
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  // hover / touch: interest at the nearest month
  function showAt(clientX) {
    var r = svg.getBoundingClientRect(), n = state.n;
    var k = Math.max(0, Math.min(n, Math.round((clientX - r.left) / r.width * n)));
    var w = r.width, h = 132, top = 12, base = h - 22, max = state.vals[n] || 1;
    var x = (k / n) * w, y = top + (1 - state.vals[k] / max) * (base - top);
    var hx = svg.querySelector('.hx'), hd = svg.querySelector('.hd');
    if (!hx || !hd) return;
    hx.setAttribute('x1', x); hx.setAttribute('x2', x); hx.setAttribute('visibility', 'visible');
    hd.setAttribute('cx', x); hd.setAttribute('cy', y); hd.setAttribute('visibility', 'visible');
    tip.innerHTML = T('dps.tip', { m: num(k) }) + '<b>' + T('dps.tipAmt', { amt: tk(state.vals[k]) }) + '</b>';
    tip.style.left = Math.max(56, Math.min(w - 56, x)) + 'px';
    tip.style.top = y + 'px';
    tip.hidden = false;
  }
  function hide() {
    tip.hidden = true;
    var hx = svg.querySelector('.hx'), hd = svg.querySelector('.hd');
    if (hx) hx.setAttribute('visibility', 'hidden');
    if (hd) hd.setAttribute('visibility', 'hidden');
  }
  svg.addEventListener('pointermove', function (e) { showAt(e.clientX); });
  svg.addEventListener('pointerdown', function (e) { showAt(e.clientX); });
  svg.addEventListener('pointerleave', hide);

  // redraw on slider, tenure (aria-checked set by main.js) and language changes
  range.addEventListener('input', function () { hide(); update(false); });
  var mo = new MutationObserver(function () { hide(); update(true); });
  seg.querySelectorAll('[role="radio"]').forEach(function (b) { mo.observe(b, { attributes: true, attributeFilter: ['aria-checked'] }); });
  new MutationObserver(function () { update(false); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { update(false); }, 120); });

  // grow in once when first seen
  update(false);
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { io.disconnect(); update(true); }
    }, { threshold: 0.4 });
    io.observe(box);
  }
})();
