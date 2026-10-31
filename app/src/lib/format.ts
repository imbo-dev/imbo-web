import { currentLang, t } from "@/i18n"

// Times arrive as ISO 8601 strings, the way the server sends them. Dates are written the way the page's language writes them.
const DAY = 86_400_000
const startOfDay = (t: string | number) => new Date(t).setHours(0, 0, 0, 0)
const daysBetween = (a: string, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)

export const clock = (t: string) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })

const locale = () => (currentLang() === "zh" ? "zh-CN" : "en-US")

/** List rows: time today, "Yesterday", weekday within a week, then the date. */
export function shortWhen(at: string) {
  const d = daysBetween(at, Date.now())
  if (d === 0) return clock(at)
  if (d === 1) return t("Yesterday")
  if (d < 7) return new Date(at).toLocaleDateString(locale(), { weekday: "short" })
  return new Date(at).toLocaleDateString(locale(), { month: "short", day: "numeric" })
}

/** Day dividers in a thread. */
export function dayLabel(at: string) {
  const d = daysBetween(at, Date.now())
  if (d === 0) return t("Today")
  if (d === 1) return t("Yesterday")
  return new Date(at).toLocaleDateString(locale(), { weekday: "long", month: "short", day: "numeric" })
}

export const sameDay = (a: string, b: string) => startOfDay(a) === startOfDay(b)

export function ago(at: string) {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000)
  if (m < 60) return t("{n} min ago", { n: Math.max(m, 1) })
  const h = Math.round(m / 60)
  if (h < 24) return t("{n} h ago", { n: h })
  return t("{n} d ago", { n: Math.round(h / 24) })
}

const PLATFORMS: Record<string, string> = { macos: "macOS", linux: "Linux", windows: "Windows" }
/** API-006 `platform`, "macos-aarch64" → "macOS"; a system this page doesn't know shows as the server sent it. */
export const platformName = (p: string) => PLATFORMS[p.split("-")[0]] ?? p

export const fileSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(1)} MB`

/** "Oct 26" */
export const shortDate = (at: string) => new Date(at).toLocaleDateString(locale(), { month: "short", day: "numeric" })
/** "Oct 27, 09:52" */
export const dateTime = (at: string) => `${shortDate(at)}, ${clock(at)}`

export const longDate = (at: string) => new Date(at).toLocaleDateString(locale(), { month: "short", day: "numeric", year: "numeric" })
/** "Fri, Oct 31, 2026": the shared image says which day, since whoever sees it may see it days later. */
export const fullDate = (at: string) => new Date(at).toLocaleDateString(locale(), { weekday: "short", month: "short", day: "numeric", year: "numeric" })

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
}
/** Display name of a server `tool` value; one this app doesn't know yet shows as sent. */
export const toolName = (tool: string) => (tool === "terminal" ? t("Terminal") : (TOOLS[tool] ?? tool))

/** Chinese text gets lang="zh-CN" so tokens.css switches to the CJK stack and line height. */
export const langOf = (s: string) => (/[㐀-鿿]/.test(s) ? "zh-CN" : undefined)
