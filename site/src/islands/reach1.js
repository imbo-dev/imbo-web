// Quilt q1716: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('reach');
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
    var ROUTES = [{"addr": "mia/orders-api", "msg": "What replaced user_id?", "segs": [["trunk", 0.65, 0.2], ["busU", 0.85, 0.2], ["br0", 1.05, 0.5]], "nodes": [["chip0", 1.1], ["n0", 1.55]]}, {"addr": "release-team", "msg": "Release freeze starts at 18:00.", "segs": [["trunk", 0.65, 0.2], ["br1", 0.85, 0.45], ["hubOut", 1.3, 0.12], ["subU", 1.42, 0.14], ["subD", 1.42, 0.14], ["sb0", 1.56, 0.1], ["sb1", 1.42, 0.1], ["sb2", 1.56, 0.1]], "nodes": [["chip1", 0.9], ["hub", 1.3], ["s1", 1.52], ["s0", 1.66], ["s2", 1.66]]}, {"addr": "48213907", "msg": "Need your OK to run the migration.", "segs": [["trunk", 0.65, 0.2], ["busD", 0.85, 0.2], ["br2", 1.05, 0.5]], "nodes": [["chip2", 1.1], ["n2", 1.55]]}], ROUTE = 3.8, FADE = 0.35, CPS = 26, ORANGE = '#D97757';
    var lit = $$('[data-k]'), byK = {}, nodes = {};
    lit.forEach(function (el) { byK[el.getAttribute('data-k')] = el; });
    $$('[data-n]').forEach(function (el) { nodes[el.getAttribute('data-n')] = { el: el, dot: el.querySelector('[data-unread]'), ring: el.querySelector('[data-ring]') }; });
    var addr = sec.querySelector('[data-addr]'), msg = sec.querySelector('[data-msg]'), caret = sec.querySelector('[data-caret]'), send = sec.querySelector('[data-send]');
    var picks = $$('[data-pick]');
    // r = route, t = seconds into it, fade = 1 while it is shown, 0 once it has faded out; allLit = the static summary
    function draw(r, t, fade, allLit) {
      var R = ROUTES[r], on = {};
      lit.forEach(function (el) { el.style.transform = 'scale' + el.getAttribute('data-axis').toUpperCase() + '(0)'; el.style.opacity = fade; });
      ROUTES.forEach(function (Q, qi) {
        if (!allLit && qi !== r) return;
        Q.segs.forEach(function (s) {
          var p = allLit ? 1 : ease(clamp((t - s[1]) / s[2]));
          var el = byK[s[0]]; el.style.transform = 'scale' + el.getAttribute('data-axis').toUpperCase() + '(' + Math.max(p, parseFloat(el.style.transform.slice(7)) || 0) + ')';
        });
        Q.nodes.forEach(function (n) { on[n[0]] = allLit ? -1 : t - n[1]; });
      });
      Object.keys(nodes).forEach(function (k) {
        var N = nodes[k], u = on[k], hit = u !== undefined && (u === -1 || u >= 0);
        N.el.style.borderColor = hit && fade > 0 ? 'color-mix(in srgb, ' + ORANGE + ' ' + Math.round(70 * fade) + '%, var(--color-outline-variant))' : '';
        if (k.indexOf('chip') === 0) { N.el.style.color = hit && fade > 0.5 ? 'var(--color-on-surface)' : ''; return; }
        if (!N.dot) return;
        var pop = u === -1 ? 1 : hit ? ease(clamp(u / 0.3)) : 0;
        N.dot.style.transform = 'scale(' + pop * fade + ')';
        var s = hit && u !== -1 ? (u * 1.1) % 1 : 1;
        N.ring.style.display = hit && u !== -1 && fade > 0 ? '' : 'none';
        N.ring.style.opacity = 0.7 * (1 - s) * fade; N.ring.style.transform = 'scale(' + (1 + 1.8 * s) + ')';
      });
      // composer: the address types out, then the send button flashes
      var n = allLit ? 99 : Math.max(0, Math.floor(t * CPS));
      addr.textContent = R.addr.slice(0, n); msg.textContent = R.msg;
      caret.style.display = allLit ? 'none' : '';
      caret.style.opacity = n < R.addr.length || (t * 2) % 1 < 0.5 ? 1 : 0;
      var f = !allLit && t > 0.55 && t < 0.95;
      send.style.background = f ? ORANGE : ''; send.style.color = f ? 'var(--color-background)' : ''; send.style.borderColor = f ? ORANGE : '';
      picks.forEach(function (b, i) {
        b.setAttribute('aria-pressed', i === r ? 'true' : 'false');
        b.querySelector('[data-title]').style.color = allLit || i === r ? '' : 'var(--color-on-surface-variant)';
        b.querySelector('[data-prog]').style.transform = 'scaleX(' + (allLit ? 0 : i === r ? (auto ? clamp(t / ROUTE) : 1) : 0) + ')';
      });
    }
    var auto = !reduce, cur = 0, start = 0;
    if (reduce) { draw(0, 0, 1, true); return; }
    var clock = whenVisible(function (t) {
      if (auto) { var k = Math.floor(t / ROUTE); cur = k % ROUTES.length; var lt = t - k * ROUTE; draw(cur, lt, 1 - clamp((lt - (ROUTE - FADE)) / FADE), false); return; }
      draw(cur, t - start, 1, false);
      return t - start < ROUTE;
    });
    picks.forEach(function (b, i) { b.addEventListener('click', function () { auto = false; cur = i; start = 0; clock.restart(); }); });
    draw(0, 0, 1, true);
  })();
}
