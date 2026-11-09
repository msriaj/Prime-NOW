/*
 * Prime NOW — gentle pointer parallax in the hero.
 * Every element with data-depth (the two cards behind the hand and the phone itself)
 * drifts up to that many pixels as the pointer moves over the hero; a negative depth
 * drifts the other way, which reads as depth. Eased by the CSS transition on `translate`.
 * Mouse/trackpad only; skipped for touch screens and prefers-reduced-motion.
 */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover)').matches) return;

  var items = Array.prototype.slice.call(hero.querySelectorAll('[data-depth]'));
  var tx = 0, ty = 0, raf = 0;

  function apply() {
    raf = 0;
    items.forEach(function (el) {
      var d = +el.getAttribute('data-depth') || 0;
      el.style.setProperty('--px', (tx * d).toFixed(1) + 'px');
      el.style.setProperty('--py', (ty * d * 0.7).toFixed(1) + 'px');
    });
  }
  function queue() { if (!raf) raf = requestAnimationFrame(apply); }

  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;    // -1 … 1
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    queue();
  });
  hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; queue(); });
})();
