// Prime NOW preloader: logo reveal
(function () {
  var root = document.documentElement;
  var template = document.querySelector('.preloader').cloneNode(true);   // pristine copy for replay

  function play() {
    var pl = document.querySelector('.preloader');
    if (!pl) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { pl.remove(); return; }
    root.classList.add('pl-on');
    // start on a fresh frame so the first morph frame isn't skipped
    requestAnimationFrame(function () {
      pl.classList.add('is-go');
      // start the SVG shape animations together, each at its own offset (data-at, seconds)
      pl.querySelectorAll('[data-at]').forEach(function (a) {
        if (a.beginElementAt) a.beginElementAt(parseFloat(a.getAttribute('data-at')) || 0);
      });
    });
    // drop the overlay (and the scroll lock) once its CSS fade-out finishes
    pl.addEventListener('animationend', function (e) {
      if (e.target === pl) { pl.remove(); root.classList.remove('pl-on'); }
    });
  }

  // replay: put a fresh copy back and run it again (SVG <set> timings restart with the new node)
  var replay = document.getElementById('replay');
  if (replay) replay.addEventListener('click', function () {
    var old = document.querySelector('.preloader');
    if (old) old.remove();
    document.body.prepend(template.cloneNode(true));
    play();
  });

  // start right away: the markup is already in the page when this runs (CodePen runs the JS
  // panel after the HTML), and waiting for window "load" is unreliable inside CodePen's preview
  play();
})();
