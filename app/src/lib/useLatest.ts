import { useCallback, useRef } from "react"

/**
 * For loads that run again when their inputs change: call `start()` when a load begins; the `current()` it returns is
 * false once a later load has started, so an answer that comes back late is dropped (§16 管理端连着取两次列表或举报).
 */
export function useLatest() {
  const last = useRef(0)
  return useCallback(() => {
    const mine = ++last.current
    return () => mine === last.current
  }, [])
}
