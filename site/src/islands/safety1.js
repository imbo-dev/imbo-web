// Quilt q2869: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('safety');
    if (!sec) return;
    var $$ = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    // brand semantic.motion.easing.emphasized: cubic-bezier(0.3, 0, 0, 1)
    function ease(x) {
      var t = x;
      for (var i = 0; i < 6; i++) {
        var d = 0.9 * (1 - t) * (1 - t) - 1.8 * t * (1 - t) + 3 * t * t;
        if (Math.abs(d) < 1e-6) break;
        t -= (0.9 * t * (1 - t) * (1 - t) + t * t * t - x) / d;
      }
      t = clamp(t);
      return 3 * t * t * (1 - t) + t * t * t;
    }
    // runs fn(seconds since the section came into view) every frame while it is visible
    function whenVisible(fn, threshold) {
      var t0 = 0, raf = 0, visible = false;
      function frame() { raf = 0; if (!visible) return; if (fn((performance.now() - t0) / 1000) !== false) raf = requestAnimationFrame(frame); }
      new IntersectionObserver(function (es) {
        var was = visible; visible = es[0].isIntersecting;
        if (visible && !was) { t0 = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
      }, { threshold: threshold || 0.35 }).observe(sec);
      return { restart: function () { t0 = performance.now(); if (visible && !raf) raf = requestAnimationFrame(frame); } };
    }
    var ORANGE = '#D97757', STEP = 0.5, FIRST = 0.8, CYCLE = 2.4;
    var rows = $$('[data-row]'), marks = $$('[data-mark]'), leads = $$('[data-lead]'), notes = $$('[data-note]'), regions = $$('[data-region]');
    var stamp = sec.querySelector('[data-stamp]'), INTRO = FIRST + STEP * marks.length, hover = -1;
    function draw(t, final) {
      rows.forEach(function (r, i) { var p = final ? 1 : ease(clamp((t - i * 0.12) / 0.4)); r.style.opacity = p; r.style.transform = 'translateY(' + 6 * (1 - p) + 'px)'; });
      // after the intro the marks take turns; hovering a note picks one
      var active = final ? -1 : hover >= 0 ? hover : t < INTRO + 0.4 ? -1 : Math.floor((t - INTRO - 0.4) / CYCLE) % marks.length;
      marks.forEach(function (m, i) {
        var s = FIRST + i * STEP, p = final ? 1 : ease(clamp((t - s) / 0.3)), q = final ? 1 : ease(clamp((t - s - 0.2) / 0.35));
        var side = notes[i].getAttribute('data-side') === 'left' ? -1 : 1, on = i === active;
        m.style.transform = 'scale(' + p + ')';
        m.style.background = on ? ORANGE : ''; m.style.borderColor = on ? ORANGE : ''; m.style.color = on ? 'var(--color-background)' : '';
        leads[i].style.transform = 'scaleX(' + (final ? 1 : ease(clamp((t - s - 0.1) / 0.3))) + ')';
        leads[i].style.background = on ? ORANGE : '';
        notes[i].style.opacity = q; notes[i].style.transform = 'translateX(' + side * 8 * (1 - q) + 'px)';
        notes[i].querySelector('[data-note-title]').style.color = active >= 0 && !on ? 'var(--color-on-surface-variant)' : '';
      });
      regions.forEach(function (r) {
        var on = +r.getAttribute('data-region') === active;
        r.style.background = on ? 'color-mix(in srgb, ' + ORANGE + ' 9%, transparent)' : '';
        if (r.classList.contains('border-l-2')) r.style.borderLeftColor = on ? ORANGE : '';
      });
      stamp.style.strokeDashoffset = 11 * (1 - (final ? 1 : clamp((t - FIRST - 0.15) / 0.3)));
    }
    notes.forEach(function (n, i) {
      n.addEventListener('mouseenter', function () { hover = i; });
      n.addEventListener('mouseleave', function () { hover = -1; });
    });
    if (reduce) { draw(0, true); return; }
    draw(0, false);
    whenVisible(function (t) { draw(t, false); }, 0.3);
  })();
}
