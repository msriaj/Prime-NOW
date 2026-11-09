/*
 * Prime NOW — gentle pointer parallax in the hero.
 * Every element with data-depth (the two cards behind the hand and the phone itself)
 * drifts up to that many pixels as the pointer moves over the hero; a negative depth
 * drifts the other way, which reads as depth. Eased by the CSS transition on `translate`.
 *
 * Peek: pointing at the visible part of a card (data-peek) sets .hero-visual[data-peek],
 * and the CSS leans that card out from behind the hand. The phone image's box covers most
 * of each card, so :hover can't be used — instead the pointer is tested against each card's
 * rotated rectangle and against an alpha mask of the phone image (pointing at the hand
 * itself doesn't count). Once a card peeks it stays out while the pointer is anywhere over it.
 *
 * Mouse/trackpad only; skipped for touch screens and prefers-reduced-motion.
 */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover)').matches) return;

  var items = Array.prototype.slice.call(hero.querySelectorAll('[data-depth]'));
  var visual = hero.querySelector('.hero-visual');
  var phone = hero.querySelector('.hero-phone');
  var cards = Array.prototype.slice.call(hero.querySelectorAll('[data-peek]'));
  var tx = 0, ty = 0, mx = -1, my = -1, raf = 0, peek = '';

  // Downscaled alpha mask of the phone-in-hand image (null if the canvas can't be read, e.g. file://).
  var mask = null, mw = 0, mh = 0;
  function buildMask() {
    try {
      var c = document.createElement('canvas');
      mw = c.width = 160;
      mh = c.height = Math.round(mw * phone.naturalHeight / phone.naturalWidth);
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(phone, 0, 0, mw, mh);
      mask = g.getImageData(0, 0, mw, mh).data;
    } catch (e) { mask = null; }
  }
  if (phone) {
    if (phone.complete && phone.naturalWidth) buildMask();
    else phone.addEventListener('load', buildMask);
  }

  function phoneCovers(x, y) {
    if (!phone || !mask) return false;
    var r = phone.getBoundingClientRect();
    if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) return false;
    var ix = Math.floor((x - r.left) / r.width * mw), iy = Math.floor((y - r.top) / r.height * mh);
    return mask[(iy * mw + ix) * 4 + 3] > 40;
  }

  function inCard(el, x, y) {
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    var a = (parseFloat(cs.rotate) || 0) * Math.PI / 180, s = parseFloat(cs.scale) || 1;
    var dx = x - (r.left + r.right) / 2, dy = y - (r.top + r.bottom) / 2;
    var lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(lx) <= el.offsetWidth * s / 2 && Math.abs(ly) <= el.offsetHeight * s / 2;
  }

  function pickPeek() {
    var hit = '';
    if (mx >= 0) {
      for (var i = 0; i < cards.length; i++) {
        var name = cards[i].getAttribute('data-peek');
        if (inCard(cards[i], mx, my) && (name === peek || !phoneCovers(mx, my))) { hit = name; break; }
      }
    }
    if (hit === peek) return;
    peek = hit;
    if (hit) visual.setAttribute('data-peek', hit);
    else visual.removeAttribute('data-peek');
  }

  function apply() {
    raf = 0;
    items.forEach(function (el) {
      var d = +el.getAttribute('data-depth') || 0;
      el.style.setProperty('--px', (tx * d).toFixed(1) + 'px');
      el.style.setProperty('--py', (ty * d * 0.7).toFixed(1) + 'px');
    });
    if (visual && cards.length) pickPeek();
  }
  function queue() { if (!raf) raf = requestAnimationFrame(apply); }

  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;    // -1 … 1
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    mx = e.clientX; my = e.clientY;
    queue();
  });
  hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; mx = my = -1; queue(); });
})();
