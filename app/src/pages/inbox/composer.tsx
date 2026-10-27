import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowUp, Bot, ChevronDown, Inbox, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sep } from "@/components/bits"
import type { Conversation } from "@/data/contract"
import { chooseRecipient, chosenSession, contactOf, draftOf, keepDraft, send, type State, type ThreadKey } from "@/data/store"
import { ago, toolName } from "@/lib/format"

// The text box at the bottom of an open chat or session (FLOW-WEB-CHAT S3, FLOW-WEB-SEND S3): text only, sent as me
// from my terminal inbox. Enter sends, Shift+Enter starts a new line.

const MAX_CHARS = 32_000
const INBOX = "inbox"
/** Safari fires compositionend before the Enter keydown that picks a candidate (ui-constraints INT-023). */
const isSafari = typeof navigator !== "undefined" && /Apple Computer/.test(navigator.vendor)
const fieldSizing = typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")

/**
 * The box grows with its text: the textarea is already its new height, and the outline follows it with a short
 * transition (ui-constraints MOTION-031). Where `field-sizing` isn't supported the textarea is measured instead.
 */
function useGrow(text: string) {
  const shell = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const sh = shell.current!, ta = area.current!
    const edge = sh.offsetHeight - sh.clientHeight
    let last = ta.offsetHeight
    sh.style.height = `${last + edge}px`
    const ro = new ResizeObserver(() => {
      const h = ta.offsetHeight
      if (h === last) return
      sh.dataset.dir = h > last ? "grow" : "shrink"
      sh.style.height = `${h + edge}px`
      last = h
    })
    ro.observe(ta)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const ta = area.current
    if (fieldSizing || !ta) return
    ta.style.height = "auto"
    ta.style.height = `${ta.scrollHeight}px`
  }, [text])
  return { shell, area }
}

/** `to`: the API-015 address in a chat; a session pane sends to its own session. `label` names who it goes to. */
export function Composer({ threadKey, to, label, note }: { threadKey: ThreadKey; to: string; label: string; note?: ReactNode }) {
  const [text, setText] = useState(() => draftOf(threadKey))
  const { shell, area } = useGrow(text)
  const composedAt = useRef(-Infinity)
  const errorId = useId()
  // Counted the way the server counts: code points, not UTF-16 units.
  const length = [...text].length
  const tooLong = length > MAX_CHARS
  const blank = !text.trim()

  const update = (v: string) => {
    setText(v)
    keepDraft(threadKey, v)
  }
  const submit = () => {
    if (blank || tooLong) return
    send(threadKey, to, text)
    update("")
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return
    // This Enter picks an input method candidate.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (isSafari && e.timeStamp - composedAt.current < 500) {
      composedAt.current = -Infinity
      e.preventDefault()
      return
    }
    e.preventDefault()
    submit()
  }

  return (
    <div className="flex flex-none flex-col gap-2 border-t-(length:--semantic-layout-hairline) border-border px-4 py-3">
      {note && <p className="text-caption text-muted-foreground">{note}</p>}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div ref={shell} className="composer-shell state-layer focus-ring is-field min-w-0 flex-1 rounded-md border border-input bg-muted">
          <textarea
            ref={area}
            rows={1}
            value={text}
            onChange={(e) => update(e.target.value)}
            onKeyDown={onKeyDown}
            onCompositionEnd={(e) => (composedAt.current = e.timeStamp)}
            placeholder={`Message ${label}`}
            aria-label={`Message ${label}`}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? errorId : undefined}
            className="composer block w-full resize-none bg-transparent px-3 py-2 text-body text-foreground outline-none placeholder:text-(--semantic-color-text-tertiary)"
          />
        </div>
        <Button type="submit" size="icon" aria-label="Send" aria-disabled={blank || tooLong} className="mb-1">
          <ArrowUp size={16} aria-hidden="true" />
        </Button>
      </form>
      {tooLong && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          Messages can be up to 32,000 characters. This one has {length.toLocaleString("en-US")}.
        </p>
      )}
    </div>
  )
}

/** In place of the text box when nothing can be sent from here. */
export function SendingClosed({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-none items-center gap-2 border-t-(length:--semantic-layout-hairline) border-border px-4 py-3 text-caption text-muted-foreground">
      <Pause size={14} aria-hidden="true" className="flex-none" />
      <span className="text-pretty">{children}</span>
    </p>
  )
}

/**
 * Who a direct chat sends to: the peer's terminal inbox by default, or one of their sessions online or seen in the last
 * 7 days (FLOW-WEB-CHAT S2). The choice stays with the chat while the page is open.
 */
export function RecipientPicker({ s, c }: { s: State; c: Conversation }) {
  const name = c.peer?.name ?? ""
  const sessions = (c.peer && contactOf(s, c.peer.id)?.sessions) ?? []
  const chosen = chosenSession(s, c)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-44 px-2 text-foreground" aria-label={`Sending to ${chosen ? `${name}'s session ${chosen.title}` : `${name}'s terminal inbox`}. Change`}>
          {chosen ? <Bot size={16} aria-hidden="true" /> : <Inbox size={16} aria-hidden="true" />}
          <span className="truncate max-sm:hidden">{chosen ? chosen.title : "Inbox"}</span>
          <ChevronDown size={14} aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-body-strong">Send to</span>
          <span className="text-caption text-muted-foreground">You send as yourself, from your terminal inbox. Replies show up here.</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={chosen?.short_id ?? INBOX} onValueChange={(v) => chooseRecipient(c.id, v === INBOX ? undefined : v)}>
          <DropdownMenuRadioItem value={INBOX}>
            <Inbox size={16} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate">{name}'s inbox</span>
              <span className="block text-caption text-muted-foreground">{name} reads it in a terminal</span>
            </span>
          </DropdownMenuRadioItem>
          {sessions.map((x) => (
            <DropdownMenuRadioItem key={x.short_id} value={x.short_id}>
              <Bot size={16} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate">{x.title}</span>
                <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
                  <span>{x.online ? "Online" : x.last_online_at ? `Seen ${ago(x.last_online_at)}` : "Offline"}</span>
                  <Sep />
                  <span className="truncate">{toolName(x.tool)}</span>
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {!sessions.length && <p className="px-2 py-1.5 text-caption text-muted-foreground">None of {name}'s sessions were online in the last 7 days.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
