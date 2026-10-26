import { useEffect, useRef } from "react"

// The imbo.dev landing background (web/site/src/islands/asciiRain1.js): columns of characters in the body ink at low
// opacity, 30 fps. With reduced motion it draws one still frame.
const FS = 15, CW = 13
const GLYPHS = "01<>/\\|=+-*#$%&:;.~^{}[]imbo$>_"

type Drop = { x: number; y: number; v: number; len: number; ch: string[]; on: boolean }

export function AsciiRain() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    let w = 0, h = 0, cols: Drop[] = [], fg = "#EDEAE2", raf = 0, last = 0
    const rnd = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
    const mk = (c: number, init: boolean): Drop => {
      const len = 8 + Math.floor(Math.random() * 24)
      const rows = Math.ceil(h / FS) + 2
      return {
        x: c * CW + CW / 2,
        y: init ? Math.random() * (rows + len) : -Math.random() * rows * 0.6,
        v: 6 + Math.random() * 16,
        len,
        ch: Array.from({ length: 64 }, rnd),
        on: Math.random() < 0.62,
      }
    }
    function draw() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.font = `500 ${FS - 3}px 'JetBrains Mono', ui-monospace, monospace`
      ctx!.textAlign = "center"
      ctx!.textBaseline = "top"
      ctx!.fillStyle = fg
      for (const d of cols) {
        if (!d.on) continue
        const hy = Math.floor(d.y)
        for (let k = 0; k < d.len; k++) {
          const row = hy - k
          if (row < 0) break
          const y = row * FS
          if (y > h) continue
          ctx!.globalAlpha = k === 0 ? 0.42 : k === 1 ? 0.24 : 0.15 * (1 - k / d.len) + 0.02
          ctx!.fillText(d.ch[row % d.ch.length], d.x, y)
        }
      }
      ctx!.globalAlpha = 1
    }
    function step(dt: number) {
      for (let i = 0; i < cols.length; i++) {
        const d = cols[i]
        d.y += d.v * dt
        if (Math.random() < 0.08) d.ch[Math.floor(Math.random() * d.ch.length)] = rnd()
        if ((d.y - d.len) * FS > h) cols[i] = mk(i, false)
      }
    }
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const r = cv.getBoundingClientRect()
      w = r.width; h = r.height
      if (!w || !h) return
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Array.from({ length: Math.ceil(w / CW) }, (_, i) => mk(i, true))
      fg = getComputedStyle(cv).color || fg
      draw()
    }
    function tick(t: number) {
      raf = requestAnimationFrame(tick)
      if (last && t - last < 1000 / 30 - 2) return
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0
      last = t
      step(dt); draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    resize()
    document.fonts?.ready.then(draw)
    if (!still) raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 block size-full text-foreground" />
}
