import { Bot, Check, Copy, Hash, SquareTerminal } from "lucide-react"
import { cn } from "@/lib/cn"
import { ago } from "@/lib/format"
import { useCopy } from "@/lib/useCopy"

// Round 32 px avatar on the selected surface (brand/examples/source/product.css .avatar).
export function Avatar({ kind, label, size = "md" }: { kind: "agent" | "terminal" | "group" | "person"; label?: string; size?: "sm" | "md" }) {
  const Icon = kind === "agent" ? Bot : kind === "terminal" ? SquareTerminal : kind === "group" ? Hash : null
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid flex-none place-items-center rounded-full bg-accent text-label text-foreground",
        size === "sm" ? "size-6 text-caption" : "size-8"
      )}
    >
      {Icon ? <Icon size={size === "sm" ? 14 : 16} /> : label?.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** A message with no `from.agent`, or one delivered to a terminal inbox, shows the terminal icon. */
export const agentAvatar = (tool?: string) => (!tool || tool === "terminal" ? "terminal" : "agent")

// Outlined caption tag (product.css .tag); `tone="ok"` is the success color with its icon, never color alone.
export function Tag({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 flex-none items-center gap-1 rounded-sm border-(length:--semantic-layout-hairline) px-2 text-caption whitespace-nowrap",
        tone === "ok" ? "border-current text-(--semantic-color-feedback-success)" : tone === "warn" ? "border-current text-(--semantic-color-feedback-warning)" : "border-input text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/** `plain` drops the tag outline, for the second line of a list row. */
export function Presence({ s, plain }: { s: { online: boolean; last_online_at?: string }; plain?: boolean }) {
  if (s.online && !plain) return <Tag tone="ok"><Check size={12} aria-hidden="true" />Online</Tag>
  if (s.online)
    return (
      <span className="inline-flex flex-none items-center gap-1 text-caption whitespace-nowrap text-(--semantic-color-feedback-success)">
        <Check size={12} aria-hidden="true" />
        Online
      </span>
    )
  return <span className="flex-none text-caption whitespace-nowrap text-(--semantic-color-text-tertiary)">{s.last_online_at ? `Seen ${ago(s.last_online_at)}` : "Offline"}</span>
}

/** Thin 10 px divider between items on one line (instead of a middle dot). */
export const Sep = () => <span aria-hidden="true" className="h-2.5 w-(--semantic-layout-hairline) flex-none bg-border" />

/** "Mia" + "orders-api": the server's sender label, as two pieces. */
export function SessionName({ owner, title, strong }: { owner: string; title: string; strong?: boolean }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className={cn("truncate", strong ? "text-body-strong" : "text-body")}>{owner}</span>
      <span className="truncate text-muted-foreground">{title}</span>
    </span>
  )
}

export function CopyId({ id, label = "Copy account ID" }: { id: string; label?: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(id)}
      className="state-layer focus-ring inline-flex h-6 items-center gap-1.5 rounded-sm px-1.5 font-(family-name:--semantic-typography-code-font-family) text-code tabular-nums text-foreground"
      aria-label={`${label} ${id}`}
    >
      {id}
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" className="text-muted-foreground" />}
      <span aria-live="polite" className="sr-only">{copied ? "Copied" : ""}</span>
    </button>
  )
}

/** A shell command with a copy button; a long command wraps instead of pushing its container wider. */
export function Command({ text }: { text: string }) {
  const { copied, copy } = useCopy()
  return (
    <div className="flex items-start gap-2 rounded-md border-(length:--semantic-layout-hairline) border-border bg-muted py-2 pr-2 pl-3 text-left">
      <code className="min-w-0 flex-1 py-0.5 font-(family-name:--semantic-typography-code-font-family) text-code wrap-anywhere text-foreground">{text}</code>
      <button
        type="button"
        onClick={() => copy(text)}
        aria-label="Copy command"
        className="state-layer focus-ring inline-grid size-6 flex-none place-items-center rounded-sm text-muted-foreground"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        <span aria-live="polite" className="sr-only">{copied ? "Copied" : ""}</span>
      </button>
    </div>
  )
}
