import { useSyncExternalStore } from "react"

// Path-based routing for the demo: the URL holds the tab and the open item, so a refresh lands on the same screen.
const subscribe = (cb: () => void) => {
  addEventListener("popstate", cb)
  return () => removeEventListener("popstate", cb)
}
export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname, () => "/")

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === location.pathname) return
  history[opts.replace ? "replaceState" : "pushState"](null, "", to)
  dispatchEvent(new PopStateEvent("popstate"))
}

/** Left click without modifiers stays in the app; anything else falls through to the browser. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  navigate(e.currentTarget.getAttribute("href")!)
}
