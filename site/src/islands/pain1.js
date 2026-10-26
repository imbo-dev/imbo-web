// Quilt q1195: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('imbo-pain');
    if (!sec) return;
    var $ = function (s, r) { return (r || sec).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };
    var lanes = $$('[data-lane]').map(function (el) { return { el: el, field: $('[data-field]', el), fx: $('[data-fx]', el) }; });
    var today = lanes[0], imbo = lanes[1], LH = 16, cw = 7.2;

    function measure() {
      var p = document.createElement('span'); p.textContent = '++++++++++';
      today.field.appendChild(p); cw = p.getBoundingClientRect().width / 10; today.field.removeChild(p);
      lanes.forEach(function (l) {
        l.cols = Math.ceil(l.el.clientWidth / cw); l.rows = Math.ceil(l.el.clientHeight / LH);
        l.energy = new Float32Array(l.cols * l.rows);
        l.base = [];
        for (var r = 0; r < l.rows; r++) { var s = ''; for (var c = 0; c < l.cols; c++) s += (r % 2 === 1 && c % 4 === 2) ? '+' : ' '; l.base.push(s); }
        l.field.textContent = l.base.join('\n');
      });
    }
    // random glyph runs must not fuse into JetBrains Mono ligatures (!= <> ::)
    $$('[data-field], [data-fx], [data-scramble], [data-decode]').forEach(function (el) { el.style.fontVariantLigatures = 'none'; });
    measure();
    window.addEventListener('resize', measure);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // brand semantic.motion.easing.emphasized: cubic-bezier(0.3, 0, 0, 1)
    function ease(x) {
      var t = x;
      for (var i = 0; i < 6; i++) {
        var d = 0.9 * (1 - t) * (1 - t) - 1.8 * t * (1 - t) + 3 * t * t;
        if (Math.abs(d) < 1e-6) break;
        t -= (0.9 * t * (1 - t) * (1 - t) + t * t * t - x) / d;
      }
      t = Math.min(1, Math.max(0, t));
      return 3 * t * t * (1 - t) + t * t * t;
    }
    function keys(k, t) {
      if (t <= k[0][0]) return k[0][1];
      for (var i = 1; i < k.length; i++) if (t <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return k[k.length - 1][1];
    }
    var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var rnd = function (s) { return s[(Math.random() * s.length) | 0]; };
    var GLYPH = '%&*+=/\\|<>?!~', NOISE = ".:'`,~", WAKE = ' ..:+*', CPS = 40;
    var CUR = '<span class="text-on-surface">▌</span>';

    // one cycle: the Today story, then the Imbo story, then both side by side
    var CYCLE = 22.4;
    var TODAY_MIN = [[0, 0], [3.2, 0], [3.6, 39], [4.1, 39], [4.5, 68], [6.5, 68], [6.8, 73], [7.9, 73], [8.1, 74], [8.4, 74], [8.9, 208]];
    var IMBO_MIN = [[0, 0], [19.1, 0], [19.4, 1]];
    var TODAY_OP = [[0, 1], [11.2, 1], [11.6, 0.4], [19.6, 0.4], [20.0, 1]];
    var IMBO_OP = [[0, 0.4], [11.0, 0.4], [11.4, 1], [22.0, 1], [22.4, 0.4]];

    var wire = $('[data-wire]'), trail = $('[data-trail]'), dots = $$('circle', trail);
    var dotR = dots.map(function (d) { return +d.getAttribute('r'); }), dotO = dots.map(function (d) { return +d.getAttribute('fill-opacity'); });
    var items = $$('[data-at]').map(function (el) {
      var b = el.getAttribute('data-blink');
      var mode = el.hasAttribute('data-show') ? 'show' : el.hasAttribute('data-pop') ? 'pop' : el.hasAttribute('data-scramble') ? 'scramble' : el.hasAttribute('data-pill') ? 'pill' : 'type';
      if (mode === 'pill') { el.style.display = 'block'; el.style.opacity = 0; }
      return { el: el, at: parseFloat(el.getAttribute('data-at')), mode: mode, full: el.textContent, caret: el.hasAttribute('data-caret'), blink: b ? b.split(',').map(Number) : null, dir: +el.getAttribute('data-dir') || 1 };
    });
    var cache = new WeakMap();
    function set(el, html) { if (cache.get(el) !== html) { cache.set(el, html); el.innerHTML = html; } }
    function hm(m) { m = Math.round(m); return Math.floor(m / 60) + 'h ' + ('0' + m % 60).slice(-2) + 'm'; }
    function meter(el, n) { set(el, '[<span class="text-on-surface">' + '#'.repeat(n) + '</span>' + '.'.repeat(4 - n) + '] ' + n + '/4'); }
    function people(el, n) { set(el, n + (n === 1 ? ' person' : ' people') + ' stopped'); }

    var stream = null, rush = false, TRIP = 2.1, GAP = 120, SPEED = 260, TAIL = 56;
    function pill(it, t) {
      var el = it.el, W = wire.clientWidth, w = el.offsetWidth, u = t - it.at, IN = 0.6, STAY = 1.0;
      if (u < 0 || u > TRIP) { el.style.opacity = 0; return; }
      var a = it.dir > 0 ? -w : W, c = (W - w) / 2, b = it.dir > 0 ? W : -w;
      var x = u < IN ? a + (c - a) * ease(u / IN) : u < IN + STAY ? c : c + (b - c) * ease((u - IN - STAY) / (TRIP - IN - STAY));
      el.style.opacity = 1;
      el.style.transform = 'translate(' + x + 'px,calc(-100% - 10px))';
      stream = { u: u, dir: it.dir, W: W };
    }
    // wave fronts every GAP px moving SPEED px/s toward the receiver; 0..1 at wire x
    function pulse(x) {
      if (!stream || x < 0 || x > stream.W) return 0;
      var xr = stream.dir > 0 ? x : stream.W - x, ph = ((stream.u * SPEED - xr) % GAP + GAP) % GAP;
      var env = Math.min(1, stream.u / 0.2, (TRIP - stream.u) / 0.2);
      return ph < TAIL ? (1 - ph / TAIL) * env : 0;
    }
    function render(t) {
      var fade = t > CYCLE - 0.4 ? (CYCLE - t) / 0.4 : 1;
      stream = null;
      items.forEach(function (it) {
        var el = it.el, on = t >= it.at, u = t - it.at;
        if (it.mode === 'show') el.style.opacity = on ? fade : 0;
        else if (it.mode === 'pop') el.style.transform = 'scale(' + (u < 0 ? 0 : u < 0.12 ? u / 0.12 * 1.4 : u < 0.26 ? 1.4 - (u - 0.12) / 0.14 * 0.4 : 1) * fade + ')';
        else if (it.mode === 'pill') pill(it, t);
        else if (it.mode === 'scramble') {
          el.style.opacity = on ? fade : 0;
          if (on && u < 0.25) { var s = ''; for (var j = 0; j < it.full.length; j++) s += rnd(GLYPH); set(el, esc(s)); } else set(el, esc(it.full));
        } else {
          var k = Math.min(it.full.length, Math.max(0, Math.floor(u * CPS))), typing = on && k < it.full.length;
          var caret = typing || (it.caret && on && !typing && Math.floor(t * 2) % 2 === 0);
          set(el, esc(it.full.slice(0, k)) + (caret ? CUR : '') + '<span class="invisible">' + esc(it.full.slice(typing ? k + 1 : k)) + '</span>');
          el.style.opacity = fade * (it.blink && t >= it.blink[0] && t < it.blink[1] && Math.floor(t * 2) % 2 ? 0.35 : 1);
        }
      });
      today.el.style.opacity = keys(TODAY_OP, t);
      imbo.el.style.opacity = keys(IMBO_OP, t);
      rush = keys(TODAY_MIN, t + 0.02) > keys(TODAY_MIN, t);
      set($('[data-elapsed="today"]'), hm(keys(TODAY_MIN, t)));
      set($('[data-elapsed="imbo"]'), hm(keys(IMBO_MIN, t)));
      people($('[data-people="today"]'), t >= 4.5 ? 2 : t >= 2.3 ? 1 : 0);
      people($('[data-people="imbo"]'), 0);
      meter($('[data-meter="today"]'), t >= 9.5 ? 1 : 0);
      meter($('[data-meter="imbo"]'), t >= 17.8 ? 4 : 0);
      var k = trail.getBoundingClientRect().width / 400, off = trail.getBoundingClientRect().left - wire.getBoundingClientRect().left;
      dots.forEach(function (d, i) {
        var e = pulse(off + d.cx.baseVal.value * k);
        d.setAttribute('r', (dotR[i] + (4.2 - dotR[i]) * e).toFixed(2));
        d.setAttribute('fill-opacity', (dotO[i] + (1 - dotO[i]) * e).toFixed(2));
      });
    }

    function tick() {
      // Today lane: a noisy channel that surges while the clock jumps hours
      var p = rush ? 0.07 : 0.012, rows = [];
      for (var r = 0; r < today.rows; r++) { var s = ''; for (var c = 0; c < today.cols; c++) s += Math.random() < p ? rnd(NOISE) : today.base[r][c]; rows.push(s); }
      today.field.textContent = rows.join('\n');
      // Imbo lane: the grid around the dot line wakes as the wave fronts pass
      var Wr = wire.getBoundingClientRect(), L = imbo.el.getBoundingClientRect();
      var E = imbo.energy, n = imbo.cols, x0 = Wr.left - L.left, hy = Wr.top - L.top + Wr.height / 2;
      for (var i = 0; i < E.length; i++) E[i] *= 0.78;
      if (stream) for (var r2 = 0; r2 < imbo.rows; r2++) {
        var ey = (r2 + 0.5) * LH - hy;
        if (Math.abs(ey) > 24) continue;
        for (var c2 = 0; c2 < n; c2++) {
          var e = pulse((c2 + 0.5) * cw - x0) * (1 - Math.abs(ey) / 24);
          if (e > E[r2 * n + c2]) E[r2 * n + c2] = e;
        }
      }
      var w = [];
      for (var r3 = 0; r3 < imbo.rows; r3++) { var q = ''; for (var c3 = 0; c3 < n; c3++) q += WAKE[Math.min(5, Math.floor(E[r3 * n + c3] * 6))] || ' '; w.push(q); }
      imbo.fx.textContent = w.join('\n');
    }

    function decode(el) {
      var full = el.textContent, t0 = performance.now(), at = [];
      for (var i = 0; i < full.length; i++) at.push(120 + i * 22 + Math.random() * 160);
      (function step() {
        var ms = performance.now() - t0, out = '', done = true;
        for (var i = 0; i < full.length; i++) {
          if (full[i] === ' ' || ms >= at[i]) out += full[i]; else { done = false; out += rnd(GLYPH); }
        }
        el.textContent = out;
        if (!done) requestAnimationFrame(step);
      })();
    }

    var visible = false, raf = 0, t0 = 0, last = 0, decoded = false;
    function frame() {
      var now = performance.now();
      if (!visible) { raf = 0; return; }
      render(((now - t0) / 1000) % CYCLE);
      if (now - last > 60) { last = now; tick(); }
      raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !decoded) { decoded = true; decode($('[data-decode]')); }
      if (visible && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    }, { threshold: 0.2 }).observe(sec);
  })();
}
