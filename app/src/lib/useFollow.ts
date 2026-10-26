import { useEffect, useLayoutEffect, useRef, useState } from "react"

const FOLLOW_PX = 40, JUMP_PX = 120

// Keeps a message pane pinned to the newest message only while the reader is at the bottom (ui-constraints INT-024):
// any upward scroll input stops following, scrolling back within 40px resumes it, "Jump to latest" shows past 120px.
export function useFollow<T extends HTMLElement>(contentKey: unknown, resetKey: unknown) {
  const ref = useRef<T>(null)
  const following = useRef(true)
  const [showJump, setShowJump] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let lastTop = el.scrollTop, touchY = 0, pressed = false
    const gap = () => el.scrollHeight - el.scrollTop - el.clientHeight
    const stop = () => { following.current = false }
    const onWheel = (e: WheelEvent) => { if (e.deltaY < 0) stop() }
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0].clientY > touchY) stop() }
    const onKey = (e: KeyboardEvent) => { if (["PageUp", "ArrowUp", "Home"].includes(e.key)) stop() }
    const onDown = () => { pressed = true }
    const onUp = () => { pressed = false }
    const onScroll = () => {
      if (pressed && el.scrollTop < lastTop) stop()
      else if (el.scrollTop > lastTop && gap() <= FOLLOW_PX) following.current = true
      lastTop = el.scrollTop
      setShowJump(!following.current && gap() > JUMP_PX)
    }
    el.addEventListener("wheel", onWheel, { passive: true })
    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: true })
    el.addEventListener("keydown", onKey)
    el.addEventListener("pointerdown", onDown)
    addEventListener("pointerup", onUp)
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("keydown", onKey)
      el.removeEventListener("pointerdown", onDown)
      removeEventListener("pointerup", onUp)
      el.removeEventListener("scroll", onScroll)
    }
  }, [])

  // Opening another conversation starts at its newest message.
  useLayoutEffect(() => { following.current = true }, [resetKey])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && following.current) el.scrollTo({ top: el.scrollHeight, behavior: "instant" })
  }, [contentKey, resetKey])

  const jump = () => {
    following.current = true
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "instant" })
    setShowJump(false)
  }
  return { ref, showJump, jump }
}
