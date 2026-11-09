/* ==========================================================================
   Liquid lettering — renders a transparent image (e.g. the "you be you"
   script) as glossy, slowly wobbling liquid with WebGL.

   Markup:
     <div class="liquid-type" data-liquid>
       <img src="assets/you-be-you.webp" alt="You be you" width="760" height="829">
     </div>

   - Flows in the first time it scrolls into view: liquid runs through each line
     left → right (so the letters fill one after another), line after line.
   - Viscous wobble, drifting reflections, caustics, moving surface ripples.
   - Pointer: magnifying "drop" under the cursor, ripples when moving over the
     letters, a splash on click / tap.
   - The <img> stays in the layout (size, alt text) and is the fallback when
     WebGL is unavailable. prefers-reduced-motion renders one still frame.
   ========================================================================== */
(() => {
  'use strict';

  const PAD = 0.08;            // canvas bleed around the art (fraction of art size) — room for wobble
  const MAX_DPR = 2;
  const FILL_DURATION = 3.6;   // seconds for the liquid to run through every line
  const RIPPLES = 8;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5);   // y down, like the image
      gl_Position = vec4(aPos, 0., 1.);
    }`;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform sampler2D uArt;      // premultiplied artwork
    uniform sampler2D uHeight;   // r: small blur of alpha, g: large blur of alpha
    uniform vec2 uTexel;
    uniform float uKeyPx;        // length of the flow-in path, height-map px
    uniform float uPad;
    uniform float uAspect;
    uniform float uTime;
    uniform float uFill;
    uniform float uSlosh;
    uniform vec3 uMouse;                 // xy: canvas uv, z: hover 0..1
    uniform vec4 uRipples[${RIPPLES}];   // xy: uv, z: birth time, w: strength
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
      float a = hash(i), b = hash(i + vec2(1., 0.));
      float c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0., a = .5;
      for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        a *= .5;
      }
      return v;
    }
    float heightAt(vec2 p) {
      vec4 h = texture2D(uHeight, p);
      return h.r * .62 + h.g * .38;
    }
    // small moving ripples on the liquid surface
    float surface(vec2 p, float t) {
      return noise(p + vec2(t * .32, -t * .23)) + .5 * noise(p * 2.13 - vec2(t * .21, t * .41));
    }

    void main() {
      float t = uTime;
      vec2 asp = vec2(uAspect, 1.);
      vec2 uv = vUv;

      // 1. slow, viscous drift of the whole body
      vec2 q = uv * asp * 2.1;
      vec2 warp = vec2(fbm(q + vec2(0., t * .11)), fbm(q + vec2(5.2, 1.3) - vec2(t * .09, 0.))) - .44;
      uv += warp * (.011 + .03 * uSlosh);

      // 2. pointer ripples: outward-travelling wave packets
      vec2 rip = vec2(0.);
      for (int i = 0; i < ${RIPPLES}; i++) {
        vec4 r = uRipples[i];
        float age = t - r.z;
        if (r.w <= 0. || age < 0. || age > 3.5) continue;
        vec2 d = (uv - r.xy) * asp;
        float dist = length(d);
        float x = dist - age * .3;
        float pk = exp(-x * x * 520.) * exp(-age * 1.6) * r.w / (1. + dist * 5.);
        rip += d / (dist + 1e-4) * sin(x * 85.) * pk;
      }
      uv += rip / asp * .011;

      // 3. magnifying drop under the cursor
      vec2 md = (uv - uMouse.xy) * asp;
      float lens = exp(-dot(md, md) * 24.) * uMouse.z;
      uv -= md / asp * lens * .12;

      // art space
      vec2 tuv = (uv - uPad) / (1. - 2. * uPad);
      float inb = step(0., tuv.x) * step(tuv.x, 1.) * step(0., tuv.y) * step(tuv.y, 1.);
      vec4 art = texture2D(uArt, tuv) * inb;

      // 4. flow-in: liquid runs through each line left → right, line after line.
      //    b+a of the height map hold the px along that path where it arrives.
      vec4 hk = texture2D(uHeight, tuv);
      float key = (hk.b * (65280. / 65535.) + hk.a * (255. / 65535.)) * uKeyPx;
      float ypx = tuv.y / uTexel.y;
      float front = mix(-30., uKeyPx + 30., uFill)
        + (4. + 6. * uSlosh) * sin(ypx * .085 + t * 5.) + 2.5 * sin(ypx * .23 - t * 3.7);
      float ahead = front - key;                    // > 0: the liquid has reached this pixel
      float filled = smoothstep(-1.5, 1.5, ahead);
      float meniscus = exp(-abs(ahead) * .2);
      float alpha = art.a * mix(.09, 1., filled);   // unfilled part reads as faint glass
      if (alpha < .002) { gl_FragColor = vec4(0.); return; }

      // normals from the blurred-alpha height field + surface ripples
      vec2 e = uTexel * 1.5;
      float hx = heightAt(tuv + vec2(e.x, 0.)) - heightAt(tuv - vec2(e.x, 0.));
      float hy = heightAt(tuv + vec2(0., e.y)) - heightAt(tuv - vec2(0., e.y));
      vec3 N = normalize(vec3(-hx, -hy, .085));

      vec2 sp = tuv * vec2(6.3, 6.9);
      float s0 = surface(sp, t);
      float sx = surface(sp + vec2(.06, 0.), t);
      float sy = surface(sp + vec2(0., .06), t);
      N = normalize(N + vec3(s0 - sx, s0 - sy, 0.) * 1.6 + vec3(rip * 1.8, 0.));

      vec3 albedo = art.rgb / max(art.a, .001);
      float thick = texture2D(uHeight, tuv).g;

      // flowing tint inside the liquid
      float fl = fbm(tuv * vec2(2.8, 3.1) + warp * 3. + vec2(t * .06, -t * .085));
      vec3 tint = mix(vec3(.52, .92, .44), vec3(.86, 1., .58), smoothstep(.22, .72, fl));
      vec3 col = mix(albedo, tint, .26);

      // drifting key light
      vec3 L = normalize(vec3(-.5 + .25 * sin(t * .37), -.7 + .2 * cos(t * .29), .65));
      float dif = dot(N, L) * .5 + .5;
      col *= .86 + .24 * dif;

      // caustics in the thick parts
      vec2 cp = tuv * 8.5 + warp * 4.;
      float c1 = 1. - abs(noise(cp + vec2(t * .45, t * .2)) * 2. - 1.);
      float c2 = 1. - abs(noise(cp * 1.7 - vec2(t * .3, t * .38)) * 2. - 1.);
      col += vec3(.88, 1., .72) * pow(c1 * c2, 6.) * smoothstep(.25, .85, thick) * .5;

      // reflections
      vec3 R = reflect(vec3(0., 0., -1.), N);
      float sp1 = pow(max(dot(R, L), 0.), 70.);
      vec3 L2 = normalize(vec3(.62 + .2 * cos(t * .23), .38 + .15 * sin(t * .31), .7));
      float sp2 = pow(max(dot(R, L2), 0.), 22.);
      float strip = smoothstep(.84, .98, sin(R.x * 5. + R.y * 2.6 + t * .5) * .5 + .5);
      float fres = pow(1. - clamp(N.z, 0., 1.), 3.);
      col += vec3(1., 1., .94) * sp1 * .9;
      col += vec3(.9, 1., .8) * sp2 * .22;
      col += vec3(.9, 1., .85) * strip * (.1 + .45 * fres);
      col += vec3(.72, 1., .52) * fres * .16;

      // empty glass above the level, bright line at the surface
      col = mix(vec3(.86, 1., .82) * (.55 + .9 * fres), col, filled);
      col += vec3(.95, 1., .86) * meniscus * .6 * filled;

      gl_FragColor = vec4(clamp(col, 0., 1.) * alpha, alpha);
    }`;

  /* ---------- CPU helpers ---------- */

  // separable box blur, zero outside the image
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const inv = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = 0; x <= r && x < w; x++) acc += src[row + x];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * inv;
        if (x + r + 1 < w) acc += src[row + x + r + 1];
        if (x - r >= 0) acc -= src[row + x - r];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = 0; y <= r && y < h; y++) acc += tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * inv;
        if (y + r + 1 < h) acc += tmp[(y + r + 1) * w + x];
        if (y - r >= 0) acc -= tmp[(y - r) * w + x];
      }
    }
    return out;
  }
  const gaussianish = (src, w, h, r) => boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Flow-in order. Connected pieces of ink are grouped into lines (top → bottom);
  // the liquid runs through each line left → right, the next line starting
  // slightly before the previous one finishes. Returns, per pixel, the distance
  // (px) along that path at which the liquid arrives, and the path's length.
  function flowKeys(alpha, w, h) {
    const n = w * h;
    const INK = 0.03;
    const label = new Int32Array(n).fill(-1);
    const stack = new Int32Array(n);
    const comps = [];
    for (let i = 0; i < n; i++) {
      if (label[i] !== -1 || alpha[i] < INK) continue;
      const c = { area: 0, x0: w, x1: 0, sx: 0, sy: 0 };
      const id = comps.length;
      let sp = 0;
      stack[sp++] = i;
      label[i] = id;
      while (sp) {
        const p = stack[--sp];
        const x = p % w;
        const y = (p - x) / w;
        c.area++;
        c.sx += x;
        c.sy += y;
        if (x < c.x0) c.x0 = x;
        if (x > c.x1) c.x1 = x;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const q = ny * w + nx;
            if (label[q] === -1 && alpha[q] >= INK) { label[q] = id; stack[sp++] = q; }
          }
        }
      }
      c.cx = c.sx / c.area;
      c.cy = c.sy / c.area;
      comps.push(c);
    }

    // lines: big pieces sorted by vertical centre, a new line where the centre jumps
    const inkArea = comps.reduce((s, c) => s + c.area, 0);
    const big = comps.filter((c) => c.area >= inkArea * 0.01).sort((a, b) => a.cy - b.cy);
    const lines = [];
    for (const c of big) {
      let line = lines[lines.length - 1];
      if (!line || c.cy - line.cy > h * 0.08) {
        line = { cy: c.cy, area: 0, x0: w, x1: 0 };
        lines.push(line);
      }
      line.cy = (line.cy * line.area + c.cy * c.area) / (line.area + c.area);
      line.area += c.area;
      line.x0 = Math.min(line.x0, c.x0);
      line.x1 = Math.max(line.x1, c.x1);
      c.line = line;
    }
    // specks join the line of the nearest big piece
    for (const c of comps) {
      if (c.line) continue;
      let best = null;
      let bestD = Infinity;
      for (const b of big) {
        const d = (b.cx - c.cx) ** 2 + (b.cy - c.cy) ** 2;
        if (d < bestD) { bestD = d; best = b; }
      }
      c.line = best && best.line;
    }

    const OVERLAP = 0.12;
    let start = 0;
    let span = 1;
    for (const line of lines) {
      const width = line.x1 - line.x0 + 1;
      line.start = start;
      span = Math.max(span, start + width);
      start += width * (1 - OVERLAP);
    }

    let key = new Float32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const line = label[i] >= 0 && comps[label[i]].line;
      if (line) key[i] = line.start + (i % w) - line.x0;
    }
    // grow a few px into the transparent surround so filtered edges keep their order
    for (let pass = 0; pass < 4; pass++) {
      const next = key.slice();
      for (let i = 0; i < n; i++) {
        if (key[i] >= 0) continue;
        const x = i % w;
        if (x > 0 && key[i - 1] >= 0) next[i] = key[i - 1];
        else if (x < w - 1 && key[i + 1] >= 0) next[i] = key[i + 1];
        else if (i >= w && key[i - w] >= 0) next[i] = key[i - w];
        else if (i + w < n && key[i + w] >= 0) next[i] = key[i + w];
      }
      key = next;
    }
    for (let i = 0; i < n; i++) if (key[i] < 0) key[i] = span;
    return { key, span };
  }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[liquid-type]', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  /* ---------- component ---------- */

  class LiquidType {
    constructor(root) {
      this.root = root;
      this.img = root.querySelector('img');
      if (!this.img) return;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'liquid-type__canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.canvas.style, {
        left: `${-PAD * 100}%`,
        top: `${-PAD * 100}%`,
        width: `${(1 + 2 * PAD) * 100}%`,
        height: `${(1 + 2 * PAD) * 100}%`,
      });

      this.ripples = new Float32Array(RIPPLES * 4);
      this.rippleIdx = 0;
      this.mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, hover: 0, active: false };
      this.lastRipple = { x: -9, y: -9, t: -9 };
      this.slosh = 0;
      this.fill = 0;
      this.fillStart = -1;
      this.aspect = 1;
      this.visible = false;
      this.running = false;
      this.lost = false;
      this.t0 = performance.now();
      this.frame = this.frame.bind(this);

      const img = this.img;
      const ready = img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', reject, { once: true });
          });
      ready.then(() => this.start()).catch((err) => console.warn('[liquid-type]', err));
    }

    now() { return (performance.now() - this.t0) / 1000; }
    get still() { return reduceMotion.matches; }

    start() {
      this.buildHeightMap();          // throws on a cross-origin image; the <img> stays as fallback
      if (!this.initGL()) return;
      this.root.appendChild(this.canvas);
      this.root.classList.add('is-live');
      this.bind();
      this.resize();
    }

    // Height field for lighting: blurred copies of the alpha channel make each
    // stroke a rounded tube (small blur = edges, large blur = body).
    buildHeightMap() {
      const img = this.img;
      const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;

      const alpha = new Float32Array(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3] / 255;

      const k = w / 760;
      const small = gaussianish(alpha, w, h, Math.max(1, Math.round(3 * k)));
      const large = gaussianish(alpha, w, h, Math.max(2, Math.round(8 * k)));

      const flow = flowKeys(alpha, w, h);

      // r: small blur, g: large blur, b+a: flow-in key as 16 bits
      const packed = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < alpha.length; i++) {
        const k16 = Math.round((flow.key[i] / flow.span) * 65535);
        packed[i * 4] = small[i] * 255;
        packed[i * 4 + 1] = large[i] * 255;
        packed[i * 4 + 2] = k16 >> 8;
        packed[i * 4 + 3] = k16 & 255;
      }
      this.hm = { w, h, span: flow.span, data: new Uint8Array(packed.buffer) };
      this.hit = { w, h, data: small };
    }

    initGL() {
      const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
      const gl = this.canvas.getContext('webgl', opts) || this.canvas.getContext('experimental-webgl', opts);
      if (!gl) return false;
      this.gl = gl;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('[liquid-type]', gl.getProgramInfoLog(prog));
        return false;
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const texture = (unit, premultiply, upload) => {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
        upload();
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      };
      texture(0, true, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img));
      texture(1, false, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.hm.w, this.hm.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.hm.data));

      const u = {};
      ['uArt', 'uHeight', 'uTexel', 'uKeyPx', 'uPad', 'uAspect', 'uTime', 'uFill', 'uSlosh', 'uMouse', 'uRipples']
        .forEach((name) => { u[name] = gl.getUniformLocation(prog, name); });
      gl.uniform1i(u.uArt, 0);
      gl.uniform1i(u.uHeight, 1);
      gl.uniform2f(u.uTexel, 1 / this.hm.w, 1 / this.hm.h);
      gl.uniform1f(u.uKeyPx, this.hm.span);
      gl.uniform1f(u.uPad, PAD / (1 + 2 * PAD));
      this.u = u;
      return true;
    }

    bind() {
      this.io = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible && this.fillStart < 0) {
          this.fillStart = this.now() + 0.15;
          this.slosh = 1;
        }
        this.kick();
      }, { threshold: 0.2 });
      this.io.observe(this.root);

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);

      document.addEventListener('visibilitychange', () => this.kick());
      reduceMotion.addEventListener?.('change', () => this.kick());
      window.addEventListener('pointermove', (e) => this.onPointer(e, false), { passive: true });
      window.addEventListener('pointerdown', (e) => this.onPointer(e, true), { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { this.mouse.active = false; });

      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.lost = true;
        this.root.classList.remove('is-live');
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this.lost = false;
        if (this.initGL()) {
          this.root.classList.add('is-live');
          this.resize();
          this.kick();
        }
      });
    }

    resize() {
      const r = this.root.getBoundingClientRect();
      if (!r.width || !r.height || this.lost) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cw = r.width * (1 + 2 * PAD);
      const ch = r.height * (1 + 2 * PAD);
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
      this.aspect = cw / ch;
      if (!this.running) this.draw();
    }

    // pointer → canvas uv; ripples only when moving over the letters
    onPointer(e, isDown) {
      if (this.lost || this.still) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      this.mouse.active = inside && e.pointerType !== 'touch';
      if (!inside) return;
      this.mouse.tx = x;
      this.mouse.ty = y;

      const p = PAD / (1 + 2 * PAD);
      const hx = Math.floor(((x - p) / (1 - 2 * p)) * this.hit.w);
      const hy = Math.floor(((y - p) / (1 - 2 * p)) * this.hit.h);
      const onInk = hx >= 0 && hy >= 0 && hx < this.hit.w && hy < this.hit.h
        && this.hit.data[hy * this.hit.w + hx] > 0.12;

      const t = this.now();
      const dx = (x - this.lastRipple.x) * this.aspect;
      const dy = y - this.lastRipple.y;
      const moved = Math.hypot(dx, dy);
      if (isDown) {
        this.addRipple(x, y, t, 1.6);
        this.slosh = Math.min(1.2, this.slosh + 0.7);
      } else if (onInk && moved > 0.045 && t - this.lastRipple.t > 0.08) {
        this.addRipple(x, y, t, clamp01(0.35 + moved * 4));
      }
    }

    addRipple(x, y, t, strength) {
      const i = this.rippleIdx * 4;
      this.ripples[i] = x;
      this.ripples[i + 1] = y;
      this.ripples[i + 2] = t;
      this.ripples[i + 3] = strength;
      this.rippleIdx = (this.rippleIdx + 1) % RIPPLES;
      this.lastRipple = { x, y, t };
      this.kick();
    }

    kick() {
      if (this.lost) return;
      const animate = this.visible && !document.hidden && !this.still;
      if (animate && !this.running) {
        this.running = true;
        this.prev = this.now();
        requestAnimationFrame(this.frame);
      } else if (!animate) {
        this.draw();
      }
    }

    frame() {
      if (!this.visible || document.hidden || this.still || this.lost) {
        this.running = false;
        return;
      }
      const t = this.now();
      const dt = Math.min(0.05, t - this.prev);
      this.prev = t;

      if (this.fillStart >= 0) {
        this.fill = clamp01((t - this.fillStart) / FILL_DURATION);   // steady pace, like writing
      }
      this.slosh *= Math.exp(-dt * 0.9);
      const m = this.mouse;
      const k = 1 - Math.exp(-dt * 9);
      m.x += (m.tx - m.x) * k;
      m.y += (m.ty - m.y) * k;
      m.hover += ((m.active ? 1 : 0) - m.hover) * (1 - Math.exp(-dt * 5));

      this.draw(t);
      requestAnimationFrame(this.frame);
    }

    draw(t = this.now()) {
      const gl = this.gl;
      if (!gl || this.lost || !this.canvas.width) return;
      const still = this.still;
      const u = this.u;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(u.uAspect, this.aspect);
      gl.uniform1f(u.uTime, still ? 4 : t);
      gl.uniform1f(u.uFill, still ? 1 : this.fill);
      gl.uniform1f(u.uSlosh, still ? 0 : this.slosh);
      gl.uniform3f(u.uMouse, this.mouse.x, this.mouse.y, still ? 0 : this.mouse.hover);
      gl.uniform4fv(u.uRipples, this.ripples);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  function init() {
    document.querySelectorAll('[data-liquid]').forEach((el) => {
      if (!el.liquidType) el.liquidType = new LiquidType(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
