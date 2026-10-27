import { useSyncExternalStore } from "react"

// Path-based routing: the URL holds the tab, the open item and the admin pages' filters, so a refresh lands on the same
// screen.
const subscribe = (cb: () => void) => {
  addEventListener("popstate", cb)
  return () => removeEventListener("popstate", cb)
}
export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname, () => "/")
/** The query string's parameters, read again whenever the address changes. */
export const useQuery = () => new URLSearchParams(useSyncExternalStore(subscribe, () => location.search, () => ""))

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === location.pathname + location.search) return
  history[opts.replace ? "replaceState" : "pushState"](null, "", to)
  dispatchEvent(new PopStateEvent("popstate"))
}

/** Left click without modifiers stays in the app; anything else falls through to the browser. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  navigate(e.currentTarget.getAttribute("href")!)
}
/** A filter or page link: same as onLinkClick, but it replaces the history entry, so Back skips the filter changes. */
export function onFilterClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  navigate(e.currentTarget.getAttribute("href")!, { replace: true })
}
