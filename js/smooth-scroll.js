/*
 * Prime NOW — Lenis smooth scrolling (https://github.com/darkroomengineering/lenis).
 * Lenis is self-hosted (js/vendor/lenis.min.js); index.html loads both after the page load event. Skipped for prefers-reduced-motion,
 * and the page simply falls back to native scrolling if Lenis fails to load.
 * In-page links (#account, #download …) glide to their section, clear of the fixed header.
 * Inner scroll areas marked data-lenis-prevent (the NOW Buddy chat) keep native scrolling.
 */
(function () {
  'use strict';
  if (!window.Lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var lenis = new window.Lenis({
    duration: 1.15,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },   // easeOutExpo
    smoothWheel: true
  });
  window.pnLenis = lenis;

  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  function headerOffset() {
    var h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80;
    return -(h + 12);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    var target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    // Sections render lazily (content-visibility: auto in style.css), so the ones passed on the
    // way take their real height mid-scroll and the first landing can be off. Re-aim on arrival,
    // a couple of times at most, until the section sits where it should.
    var tries = 0;
    function go() {
      lenis.scrollTo(target, {
        offset: target === 0 ? 0 : headerOffset(),
        duration: tries ? 0.5 : undefined,
        onComplete: function () {
          if (target === 0 || ++tries > 2) return;
          var off = target.getBoundingClientRect().top + headerOffset();
          if (Math.abs(off) > 4) go();
        }
      });
    }
    go();
    if (history.replaceState) history.replaceState(null, '', id);
  });
})();
