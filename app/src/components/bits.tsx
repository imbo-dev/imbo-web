import { useState } from "react"
import { Bot, Check, Copy, Hash, SquareTerminal } from "lucide-react"
import { pictureSrc } from "@/data/store"
import { cn } from "@/lib/cn"
import { ago } from "@/lib/format"
import { useCopy } from "@/lib/useCopy"

const AVATAR_SIZES = { sm: "size-6 text-caption", md: "size-8", lg: "size-10 text-body", xl: "size-16 text-heading3" }

/**
 * Round avatar on the selected surface (brand/examples/source/product.css .avatar), 24 to 64 px. A person or group
 * with a picture (`src`, the API's `avatar_url`) shows it cropped round; without one, or when it doesn't load, the
 * first letter of `label`. Sessions and terminals keep their icon.
 */
export function Avatar({ kind, label, size = "md", src }: { kind: "agent" | "terminal" | "group" | "person"; label?: string; size?: keyof typeof AVATAR_SIZES; src?: string }) {
  const url = pictureSrc(src)
  const [broken, setBroken] = useState<string>()
  const Icon = kind === "agent" ? Bot : kind === "terminal" ? SquareTerminal : kind === "group" ? Hash : null
  const box = cn("inline-grid flex-none place-items-center overflow-hidden rounded-full bg-accent text-label text-foreground", AVATAR_SIZES[size])
  if (url && broken !== url && (kind === "person" || kind === "group"))
    return <img src={url} alt="" aria-hidden="true" draggable={false} onError={() => setBroken(url)} className={cn(box, "object-cover")} />
  return (
    <span aria-hidden="true" className={box}>
      {Icon ? <Icon size={size === "sm" ? 14 : size === "md" ? 16 : 20} /> : label?.slice(0, 1).toUpperCase()}
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

/** "Mia" + "orders-api": the server's sender label, as two pieces. In a group the session leads: "orders-api" + "#Mia". */
export function SessionName({ owner, title, strong, group }: { owner: string; title: string; strong?: boolean; group?: boolean }) {
  const lead = cn("truncate", strong ? "text-body-strong" : "text-body")
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className={lead}>{group ? title : owner}</span>
      <span className="truncate text-muted-foreground">{group ? `#${owner}` : title}</span>
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
