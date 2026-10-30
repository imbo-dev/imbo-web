import { useEffect, useState } from "react"

/** Seconds until `at`, worked out from the clock on every tick, so a background tab can't slow it down. */
export function useSecondsUntil(at: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(() => (tick(), Date.now() >= at && clearInterval(t)), 1000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [at])
  return Math.max(0, Math.ceil((at - now) / 1000))
}
