// Quilt q2363: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('pricing');
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
    var ORANGE = '#D97757', pick = 0, hover = -1;
    var rows = $$('[data-prow]'), heads = $$('[data-head]'), frames = $$('[data-frame]');
    var checks = $$('[data-table] [data-check]');
    // the picked column (Central until you point at the other one): light header, orange frame
    function paint() {
      var s = hover >= 0 ? hover : pick;
      heads.forEach(function (h, i) { h.style.background = i === s ? 'var(--color-on-background)' : ''; h.style.color = i === s ? 'var(--color-background)' : ''; });
      frames.forEach(function (f, i) { f.style.borderColor = i === s ? ORANGE : ''; });
    }
    $$('[data-table] [data-col]').forEach(function (c) {
      var i = +c.getAttribute('data-col');
      c.addEventListener('mouseenter', function () { hover = i; paint(); });
      c.addEventListener('mouseleave', function () { hover = -1; paint(); });
    });
$$('[data-copy]').forEach(function (b) {
      var label = b.querySelector('[data-copy-label]'), orig = label.textContent;
      b.addEventListener('click', function () {
        var done = function () { label.textContent = 'Copied'; clearTimeout(b._t); b._t = setTimeout(function () { label.textContent = orig; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute('data-copy')).then(done);
      });
    });
    var ROW = 0.07, END = 0.3 + ROW * rows.length + 1.2;
    function draw(t, final) {
      rows.forEach(function (r, i) { var p = final ? 1 : ease(clamp((t - 0.1 - i * ROW) / 0.45)); r.style.opacity = p; r.style.transform = 'translateY(' + 10 * (1 - p) + 'px)'; });
      // each check draws in orange, then settles to the text color
      checks.forEach(function (c, i) {
        var s = 0.45 + Math.floor(i / 2) * ROW + (i % 2) * 0.12, p = final ? 1 : clamp((t - s) / 0.35);
        c.firstChild.style.strokeDashoffset = 22 * (1 - p);
        c.style.color = !final && t > s && t < s + 0.9 ? ORANGE : '';
      });
      var f = final ? 1 : ease(clamp((t - 0.3 - ROW * rows.length) / 0.6));
      frames.forEach(function (fr) { fr.style.clipPath = 'inset(0 0 ' + (100 - 100 * f) + '% 0)'; });
      return final || t < END;
    }
    paint();
    if (reduce) { draw(0, true); return; }
    draw(0, false);
    whenVisible(function (t) { return draw(t, false); }, 0.25);
  })();
}
