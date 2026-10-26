import { useEffect, useRef, useState } from "react"

/** Copies text and reports `copied` for 1.5 s. */
export function useCopy() {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    })
  return { copied, copy }
}
