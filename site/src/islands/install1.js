// Quilt q2161: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('install');
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
$$('[data-copy]').forEach(function (b) {
      var label = b.querySelector('[data-copy-label]'), orig = label.textContent;
      b.addEventListener('click', function () {
        var done = function () { label.textContent = 'Copied'; clearTimeout(b._t); b._t = setTimeout(function () { label.textContent = orig; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute('data-copy')).then(done);
      });
    });
    var CMD = 'curl -fsSL https://imbo.dev/install | sh', CPS = 30, T0 = 0.4, TYPE_END = T0 + CMD.length / CPS;
    var typed = sec.querySelector('[data-typed]'), caret = sec.querySelector('[data-caret]'), caret2 = sec.querySelector('[data-caret2]');
    var lines = $$('[data-line]'), dot = sec.querySelector('[data-dot]'), ping = sec.querySelector('[data-ping]');
    var AT = [TYPE_END + 0.35, TYPE_END + 1.0, TYPE_END + 1.45, TYPE_END + 1.9], DOT = TYPE_END + 2.1;
    function draw(t, final) {
      typed.textContent = final ? CMD : CMD.slice(0, Math.max(0, Math.floor((t - T0) * CPS)));
      var blink = Math.floor(t * 1.8) % 2 === 0;
      caret.style.display = final || t > AT[0] ? 'none' : '';
      caret.style.opacity = t < TYPE_END ? 1 : blink ? 1 : 0;
      caret2.style.display = final ? 'none' : '';
      caret2.style.opacity = blink ? 1 : 0;
      lines.forEach(function (l, i) { var p = final ? 1 : ease(clamp((t - AT[i]) / 0.3)); l.style.opacity = p; l.style.transform = 'translateY(' + 4 * (1 - p) + 'px)'; });
      // the inbox gets its first red dot: pops in, one ring goes out
      var d = final ? 1 : clamp((t - DOT) / 0.35), pop = d < 1 ? ease(d) * (1 + 0.25 * Math.sin(Math.PI * d)) : 1;
      dot.style.transform = 'scale(' + pop + ')';
      var r = final ? 1 : clamp((t - DOT - 0.15) / 0.9);
      ping.style.display = final || r >= 1 ? 'none' : '';
      ping.style.transform = 'scale(' + (1 + 1.6 * r) + ')'; ping.style.opacity = 1 - r;
      $$('[data-ok]').forEach(function (o, i) { o.style.color = final || t > AT[1 + i] + 0.8 ? '' : '#D97757'; });
    }
    if (reduce) { draw(0, true); return; }
    draw(0, false);
    whenVisible(function (t) { draw(t, false); }, 0.4);
  })();
}
