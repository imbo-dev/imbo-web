// Quilt q1605: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('delivery');
    if (!sec) return;
    var $$ = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };
    var TURN = 5.6, DROP = 0.55, TRAY = 22, CPS = 40;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function num(el, k) { var v = el.getAttribute(k); return v === null ? null : +v; }
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
    function show(el, on) { el.style.display = on ? '' : 'none'; }
    var cards = $$('[data-card]').map(function (c) {
      var m = c.querySelector('[data-msg]'), st = c.querySelector('[data-state]'), h = c.querySelector('[data-hatch]'), rp = c.querySelector('[data-reply]');
      var seq = st.getAttribute('data-seq').split(',').map(function (s) { s = s.split(':'); return [+s[0], s[1]]; });
      return {
        el: c, dim: c.querySelector('[data-dim]'), final: num(c, 'data-final'), body: c.querySelector('[data-body]'), empty: c.querySelector('[data-empty]'), turn: c.querySelector('[data-turn]'),
        slot: c.querySelector('[data-slot]'), wire: c.querySelector('[data-wire]'),
        hatch: h && { el: h, out: num(h, 'data-out'), stripes: h.querySelector('[data-stripes]') },
        reply: rp && { el: rp, a: num(rp, 'data-in'), y: num(rp, 'data-y') },
        rows: $$('[data-row]', c).map(function (el) {
          return { el: el, a: num(el, 'data-in'), done: num(el, 'data-done'), typed: el.hasAttribute('data-typed'), spin: el.querySelector('[data-spin]'),
                   check: el.querySelector('[data-check]'), path: el.querySelector('[data-check-path]'), bar: el.querySelector('[data-bar]'),
                   parts: $$('[data-t]', el).map(function (p) { return { el: p, text: p.getAttribute('data-t') }; }) };
        }),
        msg: { el: m, a: num(m, 'data-in'), drop: num(m, 'data-drop'), y: num(m, 'data-y'), dot: m.querySelector('[data-dot]'), rings: $$('[data-ring]', m),
               timer: m.querySelector('[data-timer]') },
        state: { dot: st.querySelector('[data-state-dot]'), ring: st.querySelector('[data-state-ring]'), label: st.querySelector('[data-state-label]'), seq: seq,
                 wake: seq.filter(function (e) { return e[0] > 0 && e[1] === 'working'; }).map(function (e) { return e[0]; })[0] }
      };
    });
    function draw(c, t, final) {
      c.rows.forEach(function (r) {
        var p = clamp((t - r.a) / 0.25), running = r.done === null || t < r.done;
        show(r.el, p > 0);
        r.el.style.opacity = p * (running ? 1 : 0.7);
        r.el.style.transform = 'translateY(' + (4 * (1 - p)) + 'px)';
        var n = r.typed ? Math.max(0, Math.floor((t - r.a) * CPS)) : 1e9;
        r.parts.forEach(function (part) { part.el.textContent = part.text.slice(0, n); n = Math.max(0, n - part.text.length); });
        show(r.spin, running); show(r.check, !running);
        r.spin.style.transform = 'rotate(' + (final ? 0 : t * 420) + 'deg)';
        r.path.style.strokeDashoffset = 11 * (1 - clamp((t - r.done) / 0.25));
        if (r.bar) r.bar.style.transform = 'scaleX(' + clamp((t - r.a) / (r.done - r.a)) + ')';
      });
      // the message: slides onto the server, waits (red, pulsing), then drops into the session
      var m = c.msg, enter = ease(clamp((t - m.a) / 0.35)), q = ease(clamp((t - m.drop) / DROP)), landed = q >= 1;
      show(m.el, t >= m.a);
      m.el.style.top = (TRAY + (m.y - TRAY) * q) + 'px';
      m.el.style.left = m.el.style.right = (4 * (1 - q)) + 'px';
      m.el.style.opacity = enter;
      m.el.style.transform = 'translateX(' + (-16 * (1 - enter)) + 'px) scale(' + (1 + 0.03 * Math.sin(Math.PI * q)) + ')';
      m.el.style.borderColor = landed && !final && t - m.drop - DROP < 0.7 ? 'var(--acc)' : '';
      m.dot.classList.toggle('bg-tertiary', !landed); m.dot.classList.toggle('bg-outline', landed);
      m.rings.forEach(function (ring, k) {
        var s = ((t - m.a) * 1.1 + k * 0.5) % 1;
        ring.style.opacity = landed || final || t < m.a ? 0 : 0.7 * (1 - s);
        show(ring, ring.style.opacity > 0);
        ring.style.transform = 'scale(' + (1 + 1.8 * s) + ')';
      });
      if (m.timer) {
        var mins = Math.round(num(m.timer, 'data-timer') * clamp((t - m.a) / (m.drop - 0.5 - m.a)));
        m.timer.textContent = 'held ' + (mins >= 60 ? Math.floor(mins / 60) + 'h ' : '') + (mins % 60) + 'm';
      }
      c.empty.style.opacity = t >= m.a && t < m.drop + DROP * 0.5 ? 0 : 1;
      var w = ease(clamp((t - m.a - 0.35) / 0.4));
      show(c.wire, w > 0 && q < 1 && !final);
      c.wire.style.clipPath = 'inset(0 0 ' + (100 - w * 100) + '% 0)';
      c.wire.style.opacity = 1 - q;
      var o = ease(clamp((t - m.drop + 0.25) / 0.2));
      show(c.slot, o > 0 && q < 1 && !final);
      c.slot.style.transform = 'scaleY(' + o + ')';
      // the answer leaves the session and goes back up through the server
      if (c.reply) {
        var u = clamp((t - c.reply.a) / 1.1);
        show(c.reply.el, u > 0 && u < 1 && !final);
        c.reply.el.style.top = (c.reply.y + (-44 - c.reply.y) * ease(u)) + 'px';
        c.reply.el.style.opacity = u < 0.6 ? clamp(u / 0.12) : 1 - (u - 0.6) / 0.4;
      }
      if (c.hatch) {
        var hp = ease(clamp((t - c.hatch.out) / 0.45));
        show(c.hatch.el, hp < 1);
        c.hatch.el.style.clipPath = 'inset(' + (hp * 100) + '% 0 0 0)';
        c.hatch.stripes.setAttribute('patternTransform', 'rotate(45) translate(' + (final ? 0 : (t * 10) % 8) + ' 0)');
      }
      var s = c.state.seq[0][1];
      c.state.seq.forEach(function (e) { if (t >= e[0]) s = e[1]; });
      if (c.state.label.textContent !== s) {
        c.state.label.textContent = s;
        c.state.dot.className = 'absolute inset-0 rounded-full' + (s === 'working' ? '' : ' border border-dashed border-outline');
        c.state.dot.style.background = s === 'working' ? 'var(--acc)' : '';
      }
      var wu = c.state.wake == null || final ? 1 : clamp((t - c.state.wake) / 0.7);
      c.state.ring.style.opacity = t < c.state.wake || wu >= 1 ? 0 : 0.9 * (1 - wu);
      show(c.state.ring, c.state.ring.style.opacity > 0);
      c.state.ring.style.transform = 'scale(' + (1 + 2.2 * wu) + ')';
    }
    function rest() { cards.forEach(function (c) { draw(c, c.final, true); }); }
    if (reduce) { rest(); return; }
    var LOOP = TURN * cards.length, t0 = 0, raf = 0, visible = false;
    function frame() {
      raf = 0;
      if (!visible) return;
      var T = ((performance.now() - t0) / 1000) % LOOP, act = Math.floor(T / TURN), local = T - act * TURN, f = ease(clamp(local / 0.4));
      cards.forEach(function (c, i) {
        var on = i === act, prev = i === (act + cards.length - 1) % cards.length && T >= TURN;
        draw(c, on ? local : c.final, !on);
        // the playing card lights up in its agent's colour; the other one steps back
        // (only its content fades: the card itself stays opaque over the landing's animated background)
        c.dim.style.opacity = on ? 0.45 + 0.55 * f : prev ? 1 - 0.55 * f : 0.45;
        c.el.style.borderColor = on ? 'color-mix(in srgb, var(--acc) ' + Math.round(60 * f) + '%, var(--color-outline-variant))' : '';
        c.body.style.opacity = on ? clamp(local / 0.2) : 1;
        c.turn.style.transform = 'scaleX(' + (on ? local / TURN : 0) + ')';
      });
      raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(function (es) {
      var was = visible; visible = es[0].isIntersecting;
      if (visible && !was) { t0 = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
    }, { threshold: 0.35 }).observe(sec);
    rest();
  })();
}
