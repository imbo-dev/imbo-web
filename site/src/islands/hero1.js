// Quilt q1012: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
/* 首屏背景：ASCII 信号波场。从中心向外扩散的波纹叠加缓慢流动的等高纹理，标题区留白。黑白灰，只用正文墨色的不同透明度 */
(() => {
  window.__imboHeroField?.stop();
  const me = script;
  const sec = me && me.closest("section");
  const cv = sec && sec.querySelector(".imbo-hero__field");
  const ctx = cv && cv.getContext && cv.getContext("2d");
  if (!ctx) return;
  const CW = 10, CH = 16, RAMP = " .·:-=+*#%@";
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // In the draft this script runs inline before the title block is parsed, so it never finds [data-quiet]
  // and the field runs under the title with no blank zone. The site keeps that look.
  const block = null;
  let w = 0, h = 0, cols = 0, rows = 0, fg = "#EDEAE2", q = null, raf = 0, last = 0, t = 0;
  function measure() {
    const c = cv.getBoundingClientRect();
    if (block) {
      const b = block.getBoundingClientRect();
      q = { x0: b.left - c.left, y0: b.top - c.top, x1: b.right - c.left, y1: b.bottom - c.top };
    }
  }
  function draw() {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    ctx.font = "500 12px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fg;
    const cx = w / 2, cy = h * 0.48;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * CW;
      for (let j = 0; j < rows; j++) {
        const y = (j + 0.5) * CH;
        const d = Math.hypot(x - cx, (y - cy) * 1.6);
        let v = Math.sin(d * 0.034 - t * 1.4) * 0.6
              + Math.sin(x * 0.012 + t * 0.25) * Math.cos(y * 0.02 - t * 0.2) * 0.5
              + Math.sin((x - y) * 0.01 + t * 0.35) * 0.3;
        v = Math.min(1, Math.max(0, (v + 1.4) / 2.8));
        let a = v * 0.42 * (0.55 + 0.45 * Math.exp(-((d / (w * 0.55)) ** 2)));
        if (q) {
          const gx = Math.max(q.x0 - 32 - x, 0, x - q.x1 - 32);
          const gy = Math.max(q.y0 - 24 - y, 0, y - q.y1 - 24);
          a *= Math.min(1, Math.hypot(gx, gy) / 110);
        }
        a *= Math.min(1, y / (h * 0.18)) * Math.min(1, (h - y) / (h * 0.22));
        const idx = Math.floor(v * (RAMP.length - 1));
        if (idx < 1 || a < 0.03) continue;
        ctx.globalAlpha = a;
        ctx.fillText(RAMP[idx], x, y);
      }
    }
    ctx.globalAlpha = 1;
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    w = r.width; h = r.height;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CW); rows = Math.ceil(h / CH);
    fg = getComputedStyle(cv).color || fg;
    measure(); draw();
  }
  function tick(now) {
    if (!cv.isConnected) { stop(); return; }
    raf = requestAnimationFrame(tick);
    if (last && now - last < 1000 / 24 - 2) return;
    t += last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(cv);
  resize();
  setTimeout(() => { measure(); draw(); }, 1400);
  document.fonts && document.fonts.ready.then(() => { measure(); draw(); });
  if (!still) raf = requestAnimationFrame(tick);
  function stop() { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); }
  window.__imboHeroField = { stop };
})();
}
