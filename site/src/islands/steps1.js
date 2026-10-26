// Quilt q1471: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  (function () {
    var sec = document.getElementById('steps');
    if (!sec || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var $$ = function (s) { return Array.prototype.slice.call(sec.querySelectorAll(s)); };
    var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var CUR = '<span class="text-on-surface">▌</span>', CPS = 40, END = 12.8;
    // shell tools spin braille dots; Claude Code cycles its star glyphs; Codex shows a timer
    var GLYPHS = { sh: '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', claude: '·✢✳✶✻✽✻✶✳✢', codex: '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' };
    var tabs = $$('[data-step]').map(function (el) { return { el: el, at: parseFloat(el.getAttribute('data-step')) }; });
    var items = $$('[data-at]').map(function (el) {
      var spin = el.getAttribute('data-spin');
      return {
        el: el, at: parseFloat(el.getAttribute('data-at')), full: el.textContent, html: el.innerHTML, kind: el.getAttribute('data-kind'),
        flash: parseFloat(el.getAttribute('data-flash')) || 0,
        mode: el.hasAttribute('data-pop') ? 'pop' : el.hasAttribute('data-show') ? 'show' : 'type',
        phases: spin ? spin.split(';').map(function (p) { p = p.split('|'); return { at: parseFloat(p[0]), label: p[1], bar: p[2] === 'bar' }; }) : null
      };
    });
    var cache = new WeakMap();
    function set(el, html) { if (cache.get(el) !== html) { cache.set(el, html); el.innerHTML = html; } }
    function spinner(it, t) {
      var ph = null;
      it.phases.forEach(function (p, i) { if (t >= p.at) ph = { p: p, end: i + 1 < it.phases.length ? it.phases[i + 1].at : it.at }; });
      var g = GLYPHS[it.kind], u = t - it.phases[0].at;
      var out = '<span class="text-on-surface-variant">' + g[Math.floor(u / (it.kind === 'claude' ? 0.12 : 0.08)) % g.length] + '</span><span class="flex gap-3"><span>' + esc(ph.p.label) + '</span>';
      if (ph.p.bar) {
        var k = Math.min(1, (t - ph.p.at) / (ph.end - ph.p.at)), n = Math.round(k * 20);
        out += '<span class="text-on-surface-variant">[' + '#'.repeat(n) + '.'.repeat(20 - n) + '] ' + Math.round(k * 100) + '%</span>';
      }
      if (it.kind !== 'sh') out += '<span class="text-on-surface-variant">' + (Math.floor(u * 2) + 1) + 's</span>';
      return out + '</span>';
    }
    function render(t) {
      items.forEach(function (it) {
        var u = t - it.at, el = it.el;
        if (it.phases) {
          var start = it.phases[0].at;
          el.style.opacity = t < start ? 0 : Math.min(1, (t - start) / 0.18);
          set(el, t < it.at ? spinner(it, Math.max(t, start)) : it.html);
        } else if (it.mode === 'show') el.style.opacity = u < 0 ? 0 : Math.min(1, u / 0.18);
        else if (it.mode === 'pop') el.style.transform = 'scale(' + (u < 0 ? 0 : u < 0.12 ? u / 0.12 * 1.5 : u < 0.28 ? 1.5 - (u - 0.12) / 0.16 * 0.5 : 1) + ')';
        else {
          var k = Math.min(it.full.length, Math.max(0, Math.floor(u * CPS))), typing = u >= 0 && k < it.full.length;
          set(el, esc(it.full.slice(0, k)) + (typing ? CUR : '') + '<span class="invisible">' + esc(it.full.slice(typing ? k + 1 : k)) + '</span>');
        }
        if (it.flash) el.classList.toggle('bg-surface', u >= 0 && u < it.flash && Math.floor(u / 0.15) % 2 === 0);
      });
      tabs.forEach(function (b, i) {
        var on = t >= b.at && (i === tabs.length - 1 || t < tabs[i + 1].at);
        b.el.classList.toggle('bg-on-surface', on); b.el.classList.toggle('text-background', on); b.el.classList.toggle('text-on-surface-variant', !on);
      });
    }
    render(0);
    var t0 = 0;
    function frame() {
      var t = (performance.now() - t0) / 1000;
      render(Math.min(t, END));
      if (t < END) requestAnimationFrame(frame);
    }
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      t0 = performance.now();
      requestAnimationFrame(frame);
    }, { threshold: 0.35 });
    io.observe(sec);
  })();
}
