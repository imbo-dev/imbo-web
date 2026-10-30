// Times arrive as ISO 8601 strings, the way the server sends them.
const DAY = 86_400_000
const startOfDay = (t: string | number) => new Date(t).setHours(0, 0, 0, 0)
const daysBetween = (a: string, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)

export const clock = (t: string) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })

/** List rows: time today, "Yesterday", weekday within a week, then the date. */
export function shortWhen(t: string) {
  const d = daysBetween(t, Date.now())
  if (d === 0) return clock(t)
  if (d === 1) return "Yesterday"
  if (d < 7) return new Date(t).toLocaleDateString("en-US", { weekday: "short" })
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Day dividers in a thread. */
export function dayLabel(t: string) {
  const d = daysBetween(t, Date.now())
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  return new Date(t).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

export const sameDay = (a: string, b: string) => startOfDay(a) === startOfDay(b)

export function ago(t: string) {
  const m = Math.round((Date.now() - Date.parse(t)) / 60_000)
  if (m < 60) return `${Math.max(m, 1)} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export const fileSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(1)} MB`

/** "Oct 26" */
export const shortDate = (t: string) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
/** "Oct 27, 09:52" */
export const dateTime = (t: string) => `${shortDate(t)}, ${clock(t)}`

export const longDate = (t: string) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

/** Whole days from now until `t`, never below 0. */
export const daysUntil = (t: string) => Math.max(0, Math.ceil((Date.parse(t) - Date.now()) / DAY))

const TOOLS: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "opencode",
  cursor: "Cursor",
  "minimax-code": "MiniMax Code",
  zcode: "ZCode",
  "kimi-code": "Kimi Code",
  pi: "pi",
  hermes: "Hermes Agent",
  "deepseek-harness": "DeepSeek Harness",
  terminal: "Terminal",
}
/** Display name of a server `tool` value; one this app doesn't know yet shows as sent. */
export const toolName = (tool: string) => TOOLS[tool] ?? tool

/** Chinese text gets lang="zh-CN" so tokens.css switches to the CJK stack and line height. */
export const langOf = (s: string) => (/[㐀-鿿]/.test(s) ? "zh-CN" : undefined)
