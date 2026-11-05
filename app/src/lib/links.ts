/** A run of a message's text: plain, or an address to open (`url`). */
export type Piece = { text: string; url?: string }

// RULE-022: an address starts with http:// or https:// and runs to a space, a line break or the first character outside
// ASCII, so one written straight into Chinese text stops at the Chinese.
const ADDRESS = /\bhttps?:\/\/[^\s<>"\u0080-\uFFFF]+/gi
const CLOSING: Record<string, string> = { ")": "(", "]": "[", "}": "{" }

/** Drops what ends a sentence rather than the address: final . , ; : ! ? ' and a closing bracket that opens nowhere in it. */
function trimEnd(url: string) {
  for (;;) {
    const last = url.at(-1) ?? ""
    const open = CLOSING[last]
    if (".,;:!?'".includes(last)) url = url.slice(0, -1)
    else if (open && url.split(open).length <= url.split(last).length - 1) url = url.slice(0, -1)
    else return url
  }
}

/** The message's text split into plain runs and the http:// and https:// addresses in it, in order. */
export function pieces(body: string): Piece[] {
  const out: Piece[] = []
  let at = 0
  for (const m of body.matchAll(ADDRESS)) {
    const url = trimEnd(m[0])
    if (/^https?:\/\/$/i.test(url)) continue
    if (m.index > at) out.push({ text: body.slice(at, m.index) })
    out.push({ text: url, url })
    at = m.index + url.length
  }
  if (at < body.length) out.push({ text: body.slice(at) })
  return out
}
