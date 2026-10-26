// Quilt q1000: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
/* 全页 ASCII 字符雨背景：黑白灰，只用正文墨色的不同透明度。看板换版本时脚本会重跑，先停掉上一份 */
(() => {
  window.__imboRain?.stop();
  const s = script;
  const cv = s && s.previousElementSibling;
  const ctx = cv && cv.getContext && cv.getContext("2d");
  if (!ctx) return;
  const FS = 15, CW = 13;
  const G = "01<>/\\|=+-*#$%&:;.~^{}[]imbo$>_";
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, cols = [], fg = "#EDEAE2", raf = 0, last = 0;
  const rnd = () => G[Math.floor(Math.random() * G.length)];
  const mk = (c, init) => {
    const len = 8 + Math.floor(Math.random() * 24);
    const rows = Math.ceil(h / FS) + 2;
    return {
      x: c * CW + CW / 2,
      y: init ? Math.random() * (rows + len) : -Math.random() * rows * 0.6,
      v: 6 + Math.random() * 16,
      len,
      ch: Array.from({ length: 64 }, rnd),
      on: Math.random() < 0.62
    };
  };
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.font = "500 " + (FS - 3) + "px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = fg;
    for (const d of cols) {
      if (!d.on) continue;
      const hy = Math.floor(d.y);
      for (let k = 0; k < d.len; k++) {
        const row = hy - k;
        if (row < 0) break;
        const y = row * FS;
        if (y > h) continue;
        ctx.globalAlpha = k === 0 ? 0.42 : k === 1 ? 0.24 : 0.15 * (1 - k / d.len) + 0.02;
        ctx.fillText(d.ch[row % d.ch.length], d.x, y);
      }
    }
    ctx.globalAlpha = 1;
  }
  function step(dt) {
    for (let i = 0; i < cols.length; i++) {
      const d = cols[i];
      d.y += d.v * dt;
      if (Math.random() < 0.08) d.ch[Math.floor(Math.random() * d.ch.length)] = rnd();
      if ((d.y - d.len) * FS > h) { cols[i] = mk(i, false); }
    }
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    w = r.width; h = r.height;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Array.from({ length: Math.ceil(w / CW) }, (_, i) => mk(i, true));
    fg = getComputedStyle(cv).color || fg;
    draw();
  }
  function tick(now) {
    if (!cv.isConnected) { stop(); return; }
    raf = requestAnimationFrame(tick);
    if (last && now - last < 1000 / 30 - 2) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    step(dt); draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(cv);
  resize();
  document.fonts && document.fonts.ready.then(draw);
  if (!still) raf = requestAnimationFrame(tick);
  function stop() { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); }
  window.__imboRain = { stop };
})();
}
