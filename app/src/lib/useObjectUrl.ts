import { useEffect, useState } from "react"

/** An address for `blob` while the component shows it, given back when it doesn't. */
export function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => {
      URL.revokeObjectURL(u)
      setUrl(undefined)
    }
  }, [blob])
  return url
}
