/*
 * Prime NOW — animated background for the numberless card section.
 *   purple → AURORA  : starfield + drifting northern-lights ribbons
 *   orange → PHOENIX : WebGL flames hugging the card outline, heat glow and sparks rising off it
 *   black  → STEALTH : smoke curling off the card and drifting through the section
 *
 * Three full-section canvases: .fx-back (soft, behind everything), .fx-sharp (crisp,
 * behind), .fx-front (soft, in front of the card). Effects are strongest around the
 * card and fade toward the copy so text stays readable. The mode follows
 * #card[data-color], which main.js sets when a swatch is picked. Animates only while
 * the section is on screen; draws one still frame for prefers-reduced-motion.
 */
(function () {
  'use strict';

  var section = document.getElementById('card');
  var scene = document.getElementById('card-scene');
  if (!section || !scene || !window.HTMLCanvasElement) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = {
    back: section.querySelector('.fx-back'),
    sharp: section.querySelector('.fx-sharp'),
    front: section.querySelector('.fx-front')
  };
  if (!cv.back || !cv.sharp || !cv.front) return;
  var ctx = { back: cv.back.getContext('2d'), sharp: cv.sharp.getContext('2d'), front: cv.front.getContext('2d') };
  var cardEl = scene.querySelector('.scene-card');

  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var W = 1, H = 1, small = false;
  var card = { x: 0, y: 0, rx: 100, ry: 140, w: 180, h: 285, ang: 28 * Math.PI / 180 };
  var mode = section.getAttribute('data-color') || 'purple';
  var t = 0, raf = 0, running = false, inView = false;

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- sprites ---------- */
  function glow(r, g, b, mid) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    gr.addColorStop(mid || 0.4, 'rgba(' + r + ',' + g + ',' + b + ',.5)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }
  function strip(stops) {
    var c = document.createElement('canvas'); c.width = 4; c.height = 256;
    var x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    return c;
  }
  var SPR = {
    ember: glow(255, 200, 120, 0.25),
    smoke: glow(150, 158, 186, 0.45), mist: glow(104, 112, 142, 0.5),
    auroraG: strip([[0, 'rgba(70,255,170,0)'], [0.28, 'rgba(70,255,170,.95)'], [0.6, 'rgba(120,90,255,.55)'], [1, 'rgba(120,90,255,0)']]),
    auroraP: strip([[0, 'rgba(170,90,255,0)'], [0.3, 'rgba(170,90,255,.9)'], [0.7, 'rgba(80,120,255,.45)'], [1, 'rgba(80,120,255,0)']])
  };

  /* ---------- state ---------- */
  var stars = [], puffs = [], wisps = [];
  function reset() {
    puffs = []; wisps = [];
    stars = [];
    var n = small ? 90 : 200;
    for (var i = 0; i < n; i++) stars.push({ x: rand(0, W), y: rand(0, H), r: rand(0.4, 1.5), ph: rand(0, 6.3), sp: rand(0.6, 2.2) });
  }

  function measure() {
    var r = cv.back.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    ['back', 'sharp', 'front'].forEach(function (k) {
      cv[k].width = Math.round(W * DPR); cv[k].height = Math.round(H * DPR);
      ctx[k].setTransform(DPR, 0, 0, DPR, 0, 0);
    });
    var c = cardEl.getBoundingClientRect();
    card.x = c.left + c.width / 2 - r.left;
    card.y = c.top + c.height / 2 - r.top;
    card.rx = c.width * 0.5; card.ry = c.height * 0.5;
    card.w = cardEl.offsetWidth; card.h = cardEl.offsetHeight || cardEl.offsetWidth * 1.587;
    small = W < 700;
    reset();
  }

  // A point on the tilted card's outline (+ outward normal), pushed out by `pad` px
  function onEdge(pad) {
    var w = card.w, h = card.h, d = rand(0, 2 * (w + h)), lx, ly, nx, ny;
    if (d < w) { lx = d - w / 2; ly = -h / 2; nx = 0; ny = -1; }
    else if ((d -= w) < h) { lx = w / 2; ly = d - h / 2; nx = 1; ny = 0; }
    else if ((d -= h) < w) { lx = w / 2 - d; ly = h / 2; nx = 0; ny = 1; }
    else { d -= w; lx = -w / 2; ly = h / 2 - d; nx = -1; ny = 0; }
    lx += nx * pad; ly += ny * pad;
    var c = Math.cos(card.ang), s = Math.sin(card.ang);
    return { x: card.x + lx * c - ly * s, y: card.y + lx * s + ly * c, nx: nx * c - ny * s, ny: nx * s + ny * c };
  }

  // keep effects strongest around the card, softer behind the copy
  function focus(c, inner, outer) {
    c.save();
    c.globalCompositeOperation = 'destination-in';
    var R = Math.max(W, H) * 0.75;
    var g = c.createRadialGradient(card.x, card.y, card.ry * 0.6, card.x, card.y, R);
    g.addColorStop(0, 'rgba(0,0,0,' + inner + ')'); g.addColorStop(1, 'rgba(0,0,0,' + outer + ')');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
  }
  function clearAll() { ctx.back.clearRect(0, 0, W, H); ctx.sharp.clearRect(0, 0, W, H); ctx.front.clearRect(0, 0, W, H); }

  /* ---------- AURORA ---------- */
  var RIBBONS = [
    { y: 0.26, amp: 0.10, f: 1.3, s: 0.20, len: 0.50, spr: 'auroraG', a: 0.40 },
    { y: 0.48, amp: 0.08, f: 2.0, s: -0.15, len: 0.40, spr: 'auroraP', a: 0.36 },
    { y: 0.68, amp: 0.07, f: 2.7, s: 0.12, len: 0.32, spr: 'auroraG', a: 0.24 }
  ];
  function aurora() {
    var b = ctx.back, s = ctx.sharp;
    clearAll();
    b.save();
    b.globalCompositeOperation = 'lighter';
    b.translate(card.x, H / 2); b.rotate(-0.5); b.translate(-W * 0.9, -H / 2);
    var span = W * 1.9, step = small ? 8 : 6;
    RIBBONS.forEach(function (rb, i) {
      for (var x = 0; x < span; x += step) {
        var u = x / span;
        var y = H * (rb.y + rb.amp * Math.sin(u * rb.f * Math.PI * 2 + t * rb.s) + rb.amp * 0.5 * Math.sin(u * rb.f * 4.6 - t * rb.s * 1.7));
        var len = H * rb.len * (0.55 + 0.45 * Math.sin(u * 11 + t * rb.s * 2.4 + i));
        b.globalAlpha = rb.a * (0.45 + 0.55 * Math.abs(Math.sin(u * 7 + t * 0.6 + i * 1.3)));
        b.drawImage(SPR[rb.spr], x, y - len * 0.3, step + 1.5, len);
      }
    });
    b.restore();
    focus(b, 1, 0.35);
    s.fillStyle = '#fff';
    for (var k = 0; k < stars.length; k++) {
      var st = stars[k];
      s.globalAlpha = 0.2 + 0.8 * Math.abs(Math.sin(t * st.sp + st.ph));
      s.beginPath(); s.arc(st.x, st.y, st.r, 0, 6.283); s.fill();
    }
    s.globalAlpha = 1;
  }

  /* ---------- PHOENIX ----------
   * Our own WebGL shader (technique in the spirit of "Sparks drifting"; no code reused):
   *  - flames around the card: signed distance to the tilted card outline, warped by
   *    upward-scrolling value-noise fbm, reaching further above the card than below,
   *    broken into licking tongues; a thin band reaches over the card's edge
   *  - drifting sparks: space split into grid cells, each cell may hold one spark
   *    (hash per cell), drawn as a soft streak along its motion, wandering by noise;
   *    kept close to the card, mostly above it
   *  - a warm, slowly breathing heat glow just outside the card
   * Rendered at half resolution (soft content) and only while Phoenix is showing.
   */
  var gfx = (function () {
    var canvas = section.querySelector('.fx-gl');
    var gl = null, uTime, uRes, uC, uHalf, uAng, ok = false, tried = false;
    var VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
    var FS = [
      'precision highp float;',
      'uniform float uTime; uniform vec2 uRes; uniform vec2 uC; uniform vec2 uHalf; uniform float uAng; varying vec2 v;',
      'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
      'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }',
      'float fbm(vec2 p){ float s = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);',
      '  for (int i = 0; i < 5; i++) { s += a * noise(p); p = m * p; a *= .5; } return s; }',
      'vec3 ramp(float t){ return vec3(1.3 * t, .9 * t * t, .5 * t * t * t * t); }',
      'vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }',
      'float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }',
      'float cardD(vec2 p){ return sdBox(rot(p - uC, -uAng), uHalf, uHalf.x * .11); }',   // signed distance to the card outline
      'float spark(vec2 p, float scale, float speed, float seed){',
      '  vec2 q = p * scale;',
      '  q.y -= uTime * speed * scale;',
      '  q.x += (noise(vec2(q.y * .35, seed)) - .5) * 1.6;',
      '  vec2 id = floor(q), f = fract(q) - .5;',
      '  float r = hash(id + seed);',
      '  if (r < .86) return 0.;',
      '  vec2 o = (vec2(hash(id + seed + 1.7), hash(id + seed + 3.1)) - .5) * .6;',
      '  vec2 d = f - o; d.y *= .38;',
      '  return exp(-dot(d, d) * 190.) * (.55 + .45 * sin(uTime * 6. + r * 60.));',
      '}',
      'void main(){',
      '  float asp = uRes.x / uRes.y;',
      '  vec2 p = vec2(v.x * asp, v.y);',
      '  float t = uTime;',
      '  float d = cardD(p);',
      '  float e = .002;',
      '  float up = max((cardD(p + vec2(0., e)) - cardD(p - vec2(0., e))) / (2. * e), 0.);',   // 1 above the card, 0 below
      // flames: hug the outline, reach further upward, warped by rising noise
      '  float n1 = fbm(vec2(p.x * 7., p.y * 5. - t * .75));',
      '  float n2 = fbm(vec2(p.x * 13., p.y * 9. - t * 1.05) + 3.);',
      '  float reach = .02 + .12 * up + .02 * n1;',
      '  float dd = d - (n1 - .5) * .05 - (n2 - .5) * .025;',
      '  float flame = clamp(1. - dd / reach, 0., 1.);',
      '  flame *= smoothstep(-.016, -.004, d);',                       // only a thin band reaches over the card edge
      '  flame *= mix(.5, 1., smoothstep(-.004, .004, d));',
      '  flame = pow(flame, 1.4);',
      '  float tongues = fbm(vec2(p.x * 10. + sin(p.y * 6. + t * .6) * .3, p.y * 4. - t * .9));',
      '  flame *= smoothstep(.22, .72, tongues * .9 + flame * .55);',    // break the sheet into licking tongues
      '  vec3 col = ramp(min(flame * 1.15, 1.));',
      // heat glow just outside the card
      '  float out_ = step(0., d);',
      '  col += vec3(1., .4, .12) * exp(-max(d, 0.) * 13.) * .32 * (.85 + .15 * sin(t * 1.4)) * out_;',
      // sparks rising off the card, mostly above it
      '  float s = spark(p, 22., .05, 1.) + spark(p, 34., .065, 7.) * .7;',
      '  s *= exp(-max(d, 0.) * 5.) * (.35 + .65 * up) * out_;',
      '  col += vec3(1., .62, .26) * s * 1.5;',
      '  float a = clamp(max(col.r, max(col.g, col.b)), 0., 1.);',
      '  gl_FragColor = vec4(min(col, vec3(1.)), a);',
      '}'
    ].join('\n');
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    function init() {
      tried = true;
      try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) { gl = null; }
      if (!gl) return;
      var prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
      gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uTime = gl.getUniformLocation(prog, 'uTime'); uRes = gl.getUniformLocation(prog, 'uRes');
      uC = gl.getUniformLocation(prog, 'uC'); uHalf = gl.getUniformLocation(prog, 'uHalf'); uAng = gl.getUniformLocation(prog, 'uAng');
      ok = true;
    }
    function draw(time) {
      if (!tried) init();
      if (!ok) return false;
      var scale = 0.5 * Math.min(1.5, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uTime, time); gl.uniform2f(uRes, w, h);
      // card geometry in height-normalised, y-up space (CSS turns the card 28deg clockwise)
      gl.uniform2f(uC, (card.x / W) * (W / H), 1 - card.y / H);
      gl.uniform2f(uHalf, card.w / 2 / H, card.h / 2 / H);
      gl.uniform1f(uAng, -card.ang);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    }
    return { draw: draw };
  })();

  function phoenix() {
    clearAll();
    if (gfx.draw(t)) return;
    // no WebGL: a simple warm glow behind the card so the mode still reads
    var b = ctx.back, R = card.ry * 2;
    var g = b.createRadialGradient(card.x, card.y, 0, card.x, card.y, R);
    g.addColorStop(0, 'rgba(255,110,40,.35)'); g.addColorStop(1, 'rgba(255,110,40,0)');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
  }

  /* ---------- STEALTH ---------- */
  function spawnPuff(list, pad, r0, a0) {
    var p = onEdge(pad);
    list.push({ x: p.x, y: p.y, vx: p.nx * rand(0.12, 0.42), vy: p.ny * rand(0.08, 0.3) - rand(0.06, 0.24),
      r: rand(r0[0], r0[1]), g: rand(0.16, 0.4), age: 0, life: rand(160, 300), a: a0 * rand(0.6, 1.25), seed: rand(0, 6.3),
      spr: Math.random() < 0.5 ? SPR.smoke : SPR.mist });
  }
  function drawPuffs(c, list) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.age++; p.vx += Math.sin(p.age * 0.03 + p.seed) * 0.012; p.x += p.vx; p.y += p.vy; p.r += p.g;
      var q = p.age / p.life;
      if (q >= 1) { list.splice(i, 1); continue; }
      c.globalAlpha = p.a * Math.sin(q * Math.PI);
      c.drawImage(p.spr, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    c.globalAlpha = 1;
  }
  function stealth() {
    var b = ctx.back, f = ctx.front;
    clearAll();
    if (Math.random() < (small ? 0.3 : 0.5)) spawnPuff(puffs, rand(-6, 16), [14, 34], 0.12);
    if (Math.random() < 0.14) spawnPuff(wisps, rand(-8, 4), [10, 22], 0.07);
    // slow banks of haze drifting across the whole section
    if (Math.random() < (small ? 0.03 : 0.05)) {
      puffs.push({ x: rand(-50, W * 0.3), y: rand(H * 0.4, H + 40), vx: rand(0.15, 0.4), vy: -rand(0.05, 0.18), r: rand(80, 160), g: rand(0.1, 0.3),
        age: 0, life: rand(320, 520), a: rand(0.04, 0.08), seed: rand(0, 6.3), spr: SPR.mist });
    }
    drawPuffs(b, puffs); drawPuffs(f, wisps);
  }

  /* ---------- loop ---------- */
  var DRAW = { purple: aurora, orange: phoenix, black: stealth };
  function frame() {
    t += 0.016;
    (DRAW[mode] || aurora)();
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduce) return; running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function still() { reset(); for (var i = 0; i < 160; i++) { t += 0.016; (DRAW[mode] || aurora)(); } }

  function setMode(m) {
    if (m === mode) return;
    section.classList.add('fx-switching');
    setTimeout(function () {
      mode = m; reset();
      section.setAttribute('data-fx-mode', m);   // title swaps while everything is faded out
      if (reduce) still();
      section.classList.remove('fx-switching');
    }, 280);
  }

  new MutationObserver(function () { setMode(section.getAttribute('data-color') || 'purple'); })
    .observe(section, { attributes: true, attributeFilter: ['data-color'] });

  var measuredInView = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      inView = en[0].isIntersecting;
      if (inView && !measuredInView) { measuredInView = true; setTimeout(remeasure, 900); }  // after the reveal settles
      if (inView && !document.hidden) start(); else stop();
    }, { rootMargin: '120px 0px' }).observe(section);
  } else { inView = true; start(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (inView) start(); });

  function remeasure() { measure(); if (reduce) still(); }   // resizing a canvas wipes it, so redraw the still frame
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(remeasure, 150); });

  /* subtle pointer tilt on the card */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    scene.addEventListener('pointermove', function (e) {
      var r = scene.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      cardEl.style.setProperty('--tx', (dx * 14).toFixed(2) + 'deg');
      cardEl.style.setProperty('--ty', (-dy * 10).toFixed(2) + 'deg');
    });
    scene.addEventListener('pointerleave', function () {
      cardEl.style.setProperty('--tx', '0deg'); cardEl.style.setProperty('--ty', '0deg');
    });
  }

  function init() { remeasure(); }
  if (document.readyState === 'complete') init(); else window.addEventListener('load', init);
})();
