import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

// Pixel dissolve between panels of the sign-in card: the old panel breaks into square blocks of the card background
// until the card is covered (base duration), the new panel takes its place underneath, then the blocks clear in
// random order (slow duration). 180 + 280 ms sits in the 200–500 ms budget for a panel change. With reduced motion the
// same cover is a plain fade through the background, fast duration each way.

const CELL = 10 // CSS px per block

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const ms = (name: string) => parseFloat(css(name)) || 0

type Phase = "cover" | "reveal"

export function PixelSwap({ swapKey, children }: { swapKey: string; children: ReactNode }) {
  const [shownKey, setShownKey] = useState(swapKey)
  // While the old panel is being covered it keeps rendering what it rendered last.
  const held = useRef(children)
  if (shownKey === swapKey) held.current = children
  const latest = useRef(swapKey)
  latest.current = swapKey

  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useRef<Phase | null>(null)
  const frame = useRef(0)
  const revealNext = useRef(false)

  const play = (kind: Phase, done?: () => void) => {
    const el = canvas.current
    const ctx = el?.getContext("2d")
    if (!el || !ctx) return done?.()
    cancelAnimationFrame(frame.current)
    phase.current = kind
    el.style.pointerEvents = "auto"

    const dpr = devicePixelRatio || 1
    const w = el.clientWidth, h = el.clientHeight
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL)
    const order = Float32Array.from({ length: cols * rows }, Math.random)
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    const duration = reduced ? ms("--semantic-motion-duration-fast") : ms(kind === "cover" ? "--semantic-motion-duration-base" : "--semantic-motion-duration-slow")
    const bg = css("--semantic-color-surface-background")
    const start = performance.now()

    const draw = (now: number) => {
      const p = duration ? Math.min(1, (now - start) / duration) : 1
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.fillStyle = bg
      if (reduced) {
        ctx.globalAlpha = kind === "cover" ? p : 1 - p
        ctx.fillRect(0, 0, el.width, el.height)
        ctx.globalAlpha = 1
      } else {
        ctx.beginPath()
        for (let i = 0; i < order.length; i++) {
          // cover: a block shows once progress passes it; reveal: it shows until progress passes it
          if (kind === "cover" ? p < order[i] : p >= order[i]) continue
          const c = i % cols, r = (i / cols) | 0
          const x0 = Math.round(c * CELL * dpr), y0 = Math.round(r * CELL * dpr)
          ctx.rect(x0, y0, Math.round((c + 1) * CELL * dpr) - x0, Math.round((r + 1) * CELL * dpr) - y0)
        }
        ctx.fill()
      }
      if (p < 1) frame.current = requestAnimationFrame(draw)
      else {
        phase.current = null
        if (kind === "reveal") el.style.pointerEvents = "none"
        done?.()
      }
    }
    draw(start)
  }

  useEffect(() => {
    if (swapKey === shownKey || phase.current === "cover") return
    play("cover", () => {
      if (latest.current === shownKey) return play("reveal")
      revealNext.current = true
      setShownKey(latest.current)
    })
    // play only reads refs and the canvas; the cover runs once per key change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapKey])

  // The new panel is in the DOM (and the card may have changed height): start clearing before it paints.
  useLayoutEffect(() => {
    if (!revealNext.current) return
    revealNext.current = false
    play("reveal")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <>
      {shownKey === swapKey ? children : held.current}
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
    </>
  )
}
