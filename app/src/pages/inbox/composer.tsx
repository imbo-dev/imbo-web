import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { ArrowUp, Bot, ChevronDown, CircleAlert, FileText, Inbox, Paperclip, Pause, X } from "lucide-react"
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
import { agentAvatar, Avatar, Sep } from "@/components/bits"
import type { Conversation, Group } from "@/data/contract"
import { cn } from "@/lib/cn"
import {
  attach,
  chooseRecipient,
  chosenSession,
  contactOf,
  detach,
  draftOf,
  keepDraft,
  refreshList,
  send,
  type Attachment,
  type State,
  type ThreadKey,
} from "@/data/store"
import { t } from "@/i18n"
import { ago, fileSize, toolName } from "@/lib/format"

// The text box at the bottom of an open chat or session (FLOW-WEB-CHAT S3, FLOW-WEB-SEND S3): text and files, sent as me
// from my inbox. Enter sends, Shift+Enter starts a new line. Files pasted into it are attached like picked ones. In a group,
// typing @ lists who can be mentioned.

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

/** A file waiting to go with the next message: uploading, uploaded, or why it can't go. */
function FileChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  return (
    <li className={cn("flex min-h-9 max-w-64 items-center gap-2 rounded-md border bg-background py-1 pr-1 pl-2.5", a.error ? "border-destructive" : "border-border")}>
      {a.error ? (
        <CircleAlert size={16} aria-hidden="true" className="flex-none text-destructive" />
      ) : (
        <FileText size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-caption text-foreground">{a.file.name}</span>
        <span className={cn("block text-caption", a.error ? "text-pretty text-destructive" : "truncate text-muted-foreground")}>
          {a.error ?? (a.ref ? fileSize(a.file.size) : t("Uploading…"))}
        </span>
      </span>
      <Button variant="ghost" size="icon-sm" aria-label={t("Remove {name}", { name: a.file.name })} className="flex-none text-muted-foreground" onClick={onRemove}>
        <X size={14} aria-hidden="true" />
      </Button>
    </li>
  )
}

/** Someone @ can name in a group: what the row shows, and what picking it writes after the @. */
type Mention = { key: string; name: string; insert: string } & ({ member: true; src?: string } | { member: false; tool: string; owner: string })

/**
 * Who @ lists in a group (REQ-107): the other active members, then the sessions every active member picked for it, mine
 * too. A name that shows twice, in any case and even once as a member and once as a session, is written as the
 * account ID or short ID instead, so the server can tell them apart (RULE-015).
 */
function mentionsOf(g: Group, me?: number) {
  const active = g.members.filter((m) => m.active)
  const all = [
    ...active.filter((m) => m.id !== me).map((m) => ({ key: `m${m.id}`, name: m.name, id: String(m.id), member: true as const, src: m.avatar_url })),
    ...active.flatMap((m) => m.sessions.map((x) => ({ key: `s${x.id}`, name: x.title, id: x.short_id, member: false as const, tool: x.tool, owner: m.name }))),
  ]
  const seen = new Map<string, number>()
  for (const x of all) seen.set(x.name.toLowerCase(), (seen.get(x.name.toLowerCase()) ?? 0) + 1)
  return all.map(({ id, ...x }): Mention => ({ ...x, insert: seen.get(x.name.toLowerCase())! > 1 ? id : x.name }))
}

/** The @ being typed just before the caret, if any: where it starts and what follows it. An @ inside a word (an email) isn't one. */
function mentionAt(text: string, caret: number) {
  const m = /(?:^|[^\w.+-])@([^\s@]*)$/.exec(text.slice(0, caret))
  return m ? { start: caret - m[1].length - 1, query: m[1] } : undefined
}

/**
 * Where the box has an @name: an @ where the list opens (as in mentionAt), then a row's name or what picking it writes,
 * in any case; the longest wins, and a name ending in a letter or digit can't run on into another one, - or _ (RULE-015).
 */
function namedAt(text: string, all: Mention[]) {
  const names = [...new Set(all.flatMap((x) => [x.name, x.insert]).map((n) => n.toLowerCase()))].filter(Boolean)
  const spans: [number, number][] = []
  for (const m of text.matchAll(/(?:^|[^\w.+-])@/g)) {
    const from = m.index + m[0].length
    let best = 0
    for (const n of names) {
      if (text.slice(from, from + n.length).toLowerCase() !== n) continue
      if (/[A-Za-z0-9]$/.test(n) && /^[A-Za-z0-9_-]/.test(text.slice(from + n.length))) continue
      best = Math.max(best, n.length)
    }
    if (best) spans.push([from - 1, from + best])
  }
  return spans
}

/**
 * A deletion that reaches into an @name takes all of it (REQ-107), so no half name is left to read as text; the space
 * after the name goes on its own. `next` is `prev` with one run of characters gone; undefined when nothing changes.
 */
function deleteWhole(prev: string, next: string, all: Mention[]) {
  if (next.length >= prev.length) return undefined
  let head = 0
  while (head < next.length && prev[head] === next[head]) head++
  let tail = 0
  while (tail < next.length - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++
  if (head + tail !== next.length) return undefined
  let [from, to] = [head, prev.length - tail]
  for (const [s, e] of namedAt(prev, all)) {
    if (s < to && e > from) [from, to] = [Math.min(from, s), Math.max(to, e)]
  }
  return from === head && to === prev.length - tail ? undefined : { text: prev.slice(0, from) + prev.slice(to), cursor: from }
}

/**
 * Behind the box, its text laid out the same way, see-through but for a highlight under each @name (REQ-107); a
 * textarea can't style part of its text. It scrolls with the box; a closing line break gets a space so both scroll as far.
 */
function Named({ text, spans, ref }: { text: string; spans: [number, number][]; ref: RefObject<HTMLDivElement | null> }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const [s, e] of spans) {
    parts.push(
      text.slice(at, s),
      <mark key={s} className="rounded-sm bg-accent text-transparent">
        {text.slice(s, e)}
      </mark>
    )
    at = e
  }
  parts.push(text.slice(at) + (text.endsWith("\n") ? " " : ""))
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 text-body break-words whitespace-pre-wrap text-transparent">
      {parts}
    </div>
  )
}

/** `to`: the API-015 address in a chat; a session pane sends to its own session. `label` names who it goes to. */
export function Composer({ s, threadKey, to, label, note, group }: { s: State; threadKey: ThreadKey; to: string; label: string; note?: string; group?: Group }) {
  const [text, setText] = useState(() => draftOf(threadKey))
  const { shell, area } = useGrow(text)
  const composedAt = useRef(-Infinity)
  const picker = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const files = s.attachments[threadKey] ?? []
  // Counted the way the server counts: code points, not UTF-16 units.
  const length = [...text].length
  const tooLong = length > MAX_CHARS
  const blank = !text.trim() && !files.length
  // A file that can't go has to be removed first; one still uploading holds the message until it's done.
  const refused = files.some((a) => a.error)
  const uploading = files.some((a) => !a.ref && !a.error)
  const [held, setHeld] = useState(false)
  // In a group, the @ just before the caret lists who to mention (REQ-107); Esc closes the list for that @ only.
  const mentions = useMemo(() => (group ? mentionsOf(group, s.account?.id) : []), [group, s.account?.id])
  const [caret, setCaret] = useState<number>()
  const [closedAt, setClosedAt] = useState<number>()
  const [nav, setNav] = useState({ at: "", i: 0 })
  const listId = useId()
  const typing = caret === undefined || !mentions.length ? undefined : mentionAt(text, caret)
  const shown = typing && typing.start !== closedAt ? mentions.filter((x) => x.name.toLowerCase().includes(typing.query.toLowerCase())) : []
  const at = typing ? `${typing.start}:${typing.query}` : ""
  const active = nav.at === at && nav.i < shown.length ? nav.i : 0
  const placeAt = useRef<number>(undefined)
  const spans = useMemo(() => (mentions.length ? namedAt(text, mentions) : []), [text, mentions])
  const named = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (named.current && area.current) named.current.scrollTop = area.current.scrollTop
  })
  // Groups load at sign-in; opening a group's chat brings its members and their sessions up to date for @.
  const groupId = group?.id
  useEffect(() => {
    if (groupId) refreshList("groups")
  }, [groupId])
  useLayoutEffect(() => {
    const p = placeAt.current
    if (p === undefined) return
    placeAt.current = undefined
    area.current?.setSelectionRange(p, p)
    setCaret(p)
  }, [text])
  useEffect(() => {
    if (shown.length) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" })
  }, [at, active, shown.length])
  /** Where the caret is while the box has focus and nothing is selected. */
  const track = (el: HTMLTextAreaElement) => setCaret(document.activeElement === el && el.selectionStart === el.selectionEnd ? el.selectionStart : undefined)

  const update = (v: string) => {
    setText(v)
    keepDraft(threadKey, v)
  }
  /** Writes the picked name over the @ and what's typed after it, then a space, and puts the caret after that. */
  const pick = (x: Mention) => {
    if (!typing || caret === undefined) return
    const head = `${text.slice(0, typing.start)}@${x.insert} `
    placeAt.current = head.length
    update(head + text.slice(caret))
  }
  const submit = () => {
    if (blank || tooLong || refused) return setHeld(false)
    if (uploading) return setHeld(true)
    setHeld(false)
    send(threadKey, to, text)
    update("")
  }
  useEffect(() => {
    if (held && !uploading) submit()
  }, [held, uploading])
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // This key goes to the input method; an Enter picks a candidate.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const enter = e.key === "Enter" && !e.shiftKey
    if (enter && isSafari && e.timeStamp - composedAt.current < 500) {
      composedAt.current = -Infinity
      e.preventDefault()
      return
    }
    // While the list is open, Enter and Tab put in the highlighted row instead of sending.
    if (shown.length) {
      const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
      if (step) {
        e.preventDefault()
        return setNav({ at, i: (active + step + shown.length) % shown.length })
      }
      if (enter || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault()
        return pick(shown[active])
      }
      if (e.key === "Escape") {
        e.preventDefault()
        return setClosedAt(typing!.start)
      }
    }
    if (!enter) return
    e.preventDefault()
    submit()
  }

  return (
    <div className="flex flex-none flex-col gap-2 border-t-(length:--semantic-layout-hairline) border-border px-4 py-3">
      {note && (
        <p key={note} className="composer-note text-caption text-muted-foreground">
          {note}
        </p>
      )}
      {files.length > 0 && (
        <ul aria-label={t("Attached files")} className="flex flex-wrap gap-2">
          {files.map((a) => (
            <FileChip
              key={a.key}
              a={a}
              onRemove={() => {
                detach(threadKey, a.key)
                area.current?.focus()
              }}
            />
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])]
            e.target.value = ""
            if (picked.length) attach(threadKey, picked)
          }}
        />
        <Button type="button" variant="ghost" size="icon" aria-label={t("Attach files")} className="mb-1 flex-none text-muted-foreground" onClick={() => picker.current?.click()}>
          <Paperclip size={16} aria-hidden="true" />
        </Button>
        <div className="relative min-w-0 flex-1">
          {shown.length > 0 && <MentionList id={listId} rows={shown} active={active} onPick={pick} onHover={(i) => setNav({ at, i })} />}
          <div ref={shell} className="composer-shell state-layer focus-ring is-field rounded-md border border-input bg-muted">
            {spans.length > 0 && <Named text={text} spans={spans} ref={named} />}
            <textarea
              ref={area}
              rows={1}
              value={text}
              onChange={(e) => {
                const whole = mentions.length ? deleteWhole(text, e.target.value, mentions) : undefined
                if (whole) {
                  placeAt.current = whole.cursor
                  update(whole.text)
                  if (!mentionAt(whole.text, whole.cursor)) setClosedAt(undefined)
                  return
                }
                update(e.target.value)
                track(e.target)
                if (!mentionAt(e.target.value, e.target.selectionStart)) setClosedAt(undefined)
              }}
              onSelect={(e) => track(e.currentTarget)}
              onScroll={(e) => named.current && (named.current.scrollTop = e.currentTarget.scrollTop)}
              onFocus={(e) => track(e.currentTarget)}
              onBlur={() => setCaret(undefined)}
              onKeyDown={onKeyDown}
              onPaste={(e) => {
                // Pasted files go with the message like picked ones (REQ-105); text pasted along with them is left out.
                const pasted = [...e.clipboardData.files]
                if (!pasted.length) return
                e.preventDefault()
                attach(threadKey, pasted)
              }}
              onCompositionEnd={(e) => (composedAt.current = e.timeStamp)}
              placeholder={t("Message {name}", { name: label })}
              aria-label={t("Message {name}", { name: label })}
              aria-invalid={tooLong || undefined}
              aria-describedby={tooLong ? errorId : undefined}
              aria-autocomplete={group ? "list" : undefined}
              aria-controls={shown.length ? listId : undefined}
              aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
              className="composer relative block w-full resize-none bg-transparent px-3 py-2 text-body text-foreground outline-none placeholder:text-(--semantic-color-text-tertiary)"
            />
          </div>
        </div>
        <Button type="submit" size="icon" aria-label={t("Send")} aria-disabled={blank || tooLong || refused || held} className="mb-1">
          <ArrowUp size={16} aria-hidden="true" />
        </Button>
      </form>
      {held && (
        <p role="status" className="text-caption text-muted-foreground">
          {t("Sending when the files finish uploading…")}
        </p>
      )}
      {tooLong && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {t("Messages can be up to 32,000 characters. This one has {n}.", { n: length.toLocaleString("en-US") })}
        </p>
      )}
    </div>
  )
}

/**
 * What @ lists over the text box: members, then sessions, each part under its name. Focus stays in the box, which points
 * at the highlighted row (aria-activedescendant); a click puts a row in.
 */
function MentionList({ id, rows, active, onPick, onHover }: { id: string; rows: Mention[]; active: number; onPick: (x: Mention) => void; onHover: (i: number) => void }) {
  const parts = [
    { label: t("Members"), rows: rows.filter((x) => x.member) },
    { label: t("Sessions"), rows: rows.filter((x) => !x.member) },
  ]
  return (
    <div
      id={id}
      role="listbox"
      aria-label={t("Members and sessions to mention")}
      onMouseDown={(e) => e.preventDefault()}
      className="scroll-pane absolute bottom-full left-0 z-(--semantic-layout-z-index-dropdown) mb-2 max-h-72 w-full rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-overlay sm:w-80"
    >
      {parts.map(
        (p, g) =>
          p.rows.length > 0 && (
            <div key={g} role="group" aria-labelledby={`${id}-g${g}`}>
              <div id={`${id}-g${g}`} className="px-2 pt-1.5 pb-1 text-caption text-muted-foreground">
                {p.label}
              </div>
              {p.rows.map((x) => {
                const n = rows.indexOf(x)
                return (
                  <div
                    key={x.key}
                    id={`${id}-${n}`}
                    role="option"
                    aria-selected={n === active}
                    data-highlighted={n === active ? "" : undefined}
                    onPointerMove={() => n !== active && onHover(n)}
                    onClick={() => onPick(x)}
                    className="state-layer flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-body select-none"
                  >
                    {x.member ? <Avatar kind="person" size="sm" label={x.name} src={x.src} /> : <Avatar kind={agentAvatar(x.tool)} size="sm" tool={x.tool} />}
                    <span className="min-w-0 truncate">{x.name}</span>
                    {!x.member && (
                      <>
                        <Sep />
                        <span className="min-w-0 truncate text-caption text-muted-foreground">{x.owner}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )
      )}
    </div>
  )
}

/** In place of the text box when nothing can be sent from here; `action` is a button that would fix it. */
export function SendingClosed({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-3 border-t-(length:--semantic-layout-hairline) border-border px-4 py-3">
      <p className="flex min-w-0 flex-1 items-center gap-2 text-caption text-muted-foreground">
        <Pause size={14} aria-hidden="true" className="flex-none" />
        <span className="text-pretty">{children}</span>
      </p>
      {action}
    </div>
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
        <Button variant="ghost" className="max-w-44 px-2 text-foreground" aria-label={
            chosen ? t("Sending to {name}'s session {session}. Change", { name, session: chosen.title }) : t("Sending to {name}'s inbox. Change", { name })
          }>
          {chosen ? <Bot size={16} aria-hidden="true" /> : <Inbox size={16} aria-hidden="true" />}
          <span className="truncate max-sm:hidden">{chosen ? chosen.title : t("Inbox")}</span>
          <ChevronDown size={14} aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-body-strong">{t("Send to")}</span>
          <span className="text-caption text-muted-foreground">{t("You send as yourself, from your inbox. Replies show up here.")}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={chosen?.short_id ?? INBOX} onValueChange={(v) => chooseRecipient(c.id, v === INBOX ? undefined : v)}>
          <DropdownMenuRadioItem value={INBOX}>
            <Inbox size={16} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate">{t("{name}'s inbox", { name })}</span>
              <span className="block text-caption text-muted-foreground">{t("{name} reads it in a terminal", { name })}</span>
            </span>
          </DropdownMenuRadioItem>
          {sessions.map((x) => (
            <DropdownMenuRadioItem key={x.short_id} value={x.short_id}>
              <Bot size={16} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate">{x.title}</span>
                <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
                  <span>{x.online ? t("Online") : x.last_online_at ? t("Seen {when}", { when: ago(x.last_online_at) }) : t("Offline")}</span>
                  <Sep />
                  <span className="truncate">{toolName(x.tool)}</span>
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {!sessions.length && <p className="px-2 py-1.5 text-caption text-muted-foreground">{t("None of {name}'s sessions were online in the last 7 days.", { name })}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
