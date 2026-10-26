// Quilt q2483: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('faq');
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
    var ORANGE = '#D97757', open = -1, EASE = 'cubic-bezier(0.3, 0, 0, 1)';
    var items = $$('[data-item]'), ticks = $$('[data-tick]'), reel = sec.querySelector('[data-reel]');
    function pad(i) { return i < 0 ? '--' : (i < 9 ? '0' : '') + (i + 1); }
    // the big index rolls: the old number slides up and out, the new one comes in from below
    function roll(from, to) {
      var cur = reel.querySelector('[data-cur]'), next = cur.cloneNode();
      next.textContent = pad(to); reel.appendChild(next);
      if (reduce) { cur.remove(); return; }
      var up = to > from || to < 0 ? -1 : 1;
      cur.removeAttribute('data-cur');
      cur.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(' + up * 100 + '%)', opacity: 0 }], { duration: 380, easing: EASE }).onfinish = function () { cur.remove(); };
      next.animate([{ transform: 'translateY(' + -up * 100 + '%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 380, easing: EASE });
    }
    function setItem(i, on) {
      var it = items[i], a = it.querySelector('[data-a]'), q = it.querySelector('[data-q]');
      q.setAttribute('aria-expanded', on);
      it.querySelector('[data-num]').style.color = on ? ORANGE : '';
      var ring = it.querySelector('[data-ring]');
      ring.style.borderColor = on ? ORANGE : ''; ring.style.color = on ? ORANGE : '';
      ring.style.transform = on ? 'rotate(45deg)' : ''; ring.style.transition = reduce ? '' : 'transform .35s ' + EASE + ', border-color .35s, color .35s';
      var bar = it.querySelector('[data-bar]');
      bar.style.transition = reduce ? '' : 'transform .45s ' + EASE; bar.style.transform = on ? 'scaleY(1)' : 'scaleY(0)';
      ticks[i].firstChild.style.background = on ? ORANGE : '';
      if (a._anim) a._anim.cancel();
      if (on) a.hidden = false;
      if (reduce) { a.hidden = !on; return; }
      var h = a.scrollHeight;
      a._anim = a.animate(on ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }] : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: on ? 420 : 300, easing: EASE });
      a._anim.onfinish = function () { a._anim = null; if (!on) a.hidden = true; };
    }
    function show(i) {
      var to = i === open ? -1 : i, from = open;
      if (from >= 0) setItem(from, false);
      if (to >= 0) setItem(to, true);
      open = to; roll(from, to);
    }
    items.forEach(function (it, i) { it.querySelector('[data-q]').addEventListener('click', function () { show(i); }); });
    ticks.forEach(function (t, i) { t.addEventListener('click', function () { if (i !== open) show(i); }); });
    open = 0; setItem(0, true);
    if (reduce) return;
    items.forEach(function (it) { it.style.opacity = 0; });
    ticks.forEach(function (tk) { tk.firstChild.style.transform = 'scaleX(0)'; });
    whenVisible(function (t) {
      items.forEach(function (it, i) { var p = ease(clamp((t - i * 0.06) / 0.45)); it.style.opacity = p; it.style.transform = 'translateY(' + 8 * (1 - p) + 'px)'; });
      ticks.forEach(function (tk, i) { tk.firstChild.style.transform = 'scaleX(' + ease(clamp((t - 0.2 - i * 0.05) / 0.3)) + ')'; tk.firstChild.style.transformOrigin = 'left'; });
      return t < 1.2;
    }, 0.2);
  })();
}
