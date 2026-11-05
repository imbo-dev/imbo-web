import { Fragment, useEffect, useState, type ReactNode } from "react"
import { ArrowDown, CheckCheck, CircleAlert, Clock, Download, FileText, Play } from "lucide-react"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog } from "@/components/ui/dialog"
import { agentAvatar, Avatar, SessionName, Sep, Tag } from "@/components/bits"
import { SenderName, unblockNow } from "./safety"
import type { FileRef, Message, Via } from "@/data/contract"
import type { ApiError } from "@/data/layer"
import {
  contactOf,
  dataOf,
  discard,
  fetchedFile,
  fetchFile,
  fileExpired,
  fileUrl,
  groupOf,
  isMe,
  loadOlder,
  mediaOf,
  photoOf,
  PICTURE_SHOWN_BYTES,
  recipientOf,
  resend,
  resendTo,
  type Outgoing,
  type State,
  type Thread,
  type ThreadKey,
} from "@/data/store"
import { t } from "@/i18n"
import { clock, dayLabel, fileSize, langOf, sameDay } from "@/lib/format"
import { pieces } from "@/lib/links"
import { useFollow } from "@/lib/useFollow"
import { useObjectUrl } from "@/lib/useObjectUrl"
import { PictureViewer, VideoViewer } from "./viewer"

// Messages as bubbles, as in the App. What I sent in person is on the right in the primary color, my picture after it;
// everything else, my sessions' messages included, is on the left after its sender's picture: a session's product mark,
// or the picture of whoever sent it in person, from whichever terminal, App or web page. Above each bubble a heading says who sent it — "Mia orders-api", "Mia · App" —
// and, where it matters, which session or inbox it went to; under it, how its delivery is going.

const DownloadLink = ({ f }: { f: FileRef }) => (
  <Button asChild variant="ghost" size="icon">
    <a href={fileUrl(f)} download={f.name} aria-label={t("Download {name}", { name: f.name })}>
      <Download size={16} aria-hidden="true" />
    </a>
  </Button>
)

/**
 * A file as a card: its name, size and download until it expires. `lead` takes the icon's place; `action` sits before
 * the download.
 */
function FileCard({ f, lead, action }: { f: FileRef; lead?: ReactNode; action?: ReactNode }) {
  const expired = fileExpired(f)
  return (
    <li className={cn("flex items-center gap-3 rounded-md border-(length:--semantic-layout-hairline) border-border bg-card py-2 pr-2", lead ? "pl-2" : "pl-3")}>
      {lead ?? <FileText size={20} aria-hidden="true" className="flex-none text-muted-foreground" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body wrap-anywhere text-foreground">{f.name}</span>
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          {fileSize(f.size)}
          {expired && (
            <>
              <Sep />
              {t("Files are kept 7 days")}
            </>
          )}
        </span>
      </span>
      {expired ? (
        <Tag>{t("Expired")}</Tag>
      ) : (
        <>
          {action}
          <DownloadLink f={f} />
        </>
      )}
    </li>
  )
}

/**
 * RULE-020: a picture up to 10 MB shows in the message by itself, a bigger one once Load image has fetched it; clicking
 * it opens it full screen. One that can't be fetched or doesn't decode stays a file card. The box keeps one shape from
 * the start, so the thread doesn't move when the picture arrives.
 */
function Picture({ f, right }: { f: FileRef; right: boolean }) {
  const shown = f.size <= PICTURE_SHOWN_BYTES
  // "wait": over 10 MB, not asked for yet.
  const [got, setGot] = useState<Blob | "wait" | "fetch" | "failed">(() => fetchedFile(f) ?? (shown ? "fetch" : "wait"))
  const [open, setOpen] = useState(false)
  const url = useObjectUrl(got instanceof Blob ? got : undefined)
  useEffect(() => {
    if (got !== "fetch") return
    let live = true
    fetchFile(f).then(
      (blob) => live && setGot(blob),
      () => live && setGot("failed")
    )
    return () => {
      live = false
    }
  }, [got, f.id])

  if (got === "failed") return <FileCard f={f} />
  if (!(got instanceof Blob) && !shown)
    return (
      <FileCard
        f={f}
        action={
          <Button variant="secondary" size="sm" data-testid={`file-load-${f.id}`} aria-disabled={got === "fetch"} onClick={() => setGot("fetch")}>
            {got === "fetch" ? t("Loading…") : t("Load image")}
          </Button>
        }
      />
    )
  return (
    <li className={cn("flex w-64 max-w-full flex-col gap-1.5", right && "self-end")}>
      {url && got instanceof Blob ? (
        <>
          <button
            type="button"
            data-testid={`file-thumb-${f.id}`}
            onClick={() => setOpen(true)}
            className="state-layer focus-ring aspect-4/3 w-full cursor-zoom-in overflow-hidden rounded-md border-(length:--semantic-layout-hairline) border-border bg-muted"
          >
            <img src={url} alt={f.name} draggable={false} onError={() => setGot("failed")} className="size-full object-cover" />
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <PictureViewer f={f} blob={got} url={url} onClose={() => setOpen(false)} />
          </Dialog>
        </>
      ) : (
        <span aria-hidden="true" className="block aspect-4/3 w-full overflow-hidden rounded-md">
          <span className="skeleton block size-full" />
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-caption wrap-anywhere text-foreground">{f.name}</span>
          <span className="text-caption text-muted-foreground">{fileSize(f.size)}</span>
        </span>
        <DownloadLink f={f} />
      </div>
    </li>
  )
}

/** RULE-021: a video is a card with a play button, which opens it full screen to download and play. */
function Video({ f }: { f: FileRef }) {
  const [open, setOpen] = useState(false)
  return (
    <FileCard
      f={f}
      lead={
        <>
          <Button size="icon" data-testid={`file-video-${f.id}`} aria-label={t("Play {name}", { name: f.name })} onClick={() => setOpen(true)} className="size-10 rounded-full">
            {/* Optical centering: a play triangle's weight sits left of its box, so it moves 2px right. */}
            <Play size={16} aria-hidden="true" className="ml-0.5" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <VideoViewer f={f} />
          </Dialog>
        </>
      }
    />
  )
}

/** `right`: the message is on my side, where a picture lines up on the right too. */
function Attachments({ files, right }: { files: FileRef[]; right: boolean }) {
  return (
    <ul className="mt-2 flex max-w-sm flex-col gap-2">
      {files.map((f) => {
        const media = mediaOf(f)
        if (media === "image") return <Picture key={f.id} f={f} right={right} />
        if (media === "video") return <Video key={f.id} f={f} />
        return <FileCard key={f.id} f={f} />
      })}
    </ul>
  )
}

/** Sent by me in person, so on the right: from this page, the App or a terminal. My sessions' messages aren't. */
export const mine = (s: State, m: Message) => isMe(s, m.from.account_id) && !m.from.agent

/**
 * Where a message sent in person came from (ADR-056), as it leads a group heading ("App #Mia") and after a name
 * ("Mia | App", a hairline between). Messages from before `via` came from a terminal.
 */
export const leadOf = (via?: Via) => (via === "app" ? t("App") : via === "web" ? t("Web") : t("Terminal"))
export const sourceOf = (via?: Via) => (via === "app" ? t("App") : via === "web" ? t("Web") : t("terminal"))
/** What follows the sender's name: its session ("orders-api"), or where it was sent in person from ("App"). */
export const afterName = (from: { agent?: { title: string }; via?: Via }) => from.agent?.title ?? sourceOf(from.via)

/** Who a one-to-one message went to: "to Mia orders-api", or "to Mia's inbox". */
const toText = (to: { owner: string; title: string; inbox: boolean }) =>
  to.inbox ? t("to {owner}'s inbox", { owner: to.owner }) : t("to {owner} {title}", { owner: to.owner, title: to.title })

/**
 * The message's text, in the primary color on my side; 3rem short of the far side, so a long one still reads as one side's.
 * Its http:// and https:// addresses are underlined links that open in a new tab (RULE-022).
 */
function Bubble({ body, right }: { body: string; right: boolean }) {
  return (
    <div className={cn("mt-1 max-w-[min(calc(100%_-_3rem),42rem)] rounded-lg px-3.5 py-2.5", right ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-accent text-foreground")}>
      <p lang={langOf(body)} className="text-body whitespace-pre-wrap wrap-anywhere">
        {pieces(body).map(({ text, url }, i) =>
          url ? (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("focus-ring rounded-sm underline underline-offset-4", right ? "text-(--semantic-color-text-link-on-action)" : "text-(--semantic-color-text-link)")}
            >
              {text}
            </a>
          ) : (
            <Fragment key={i}>{text}</Fragment>
          ),
        )}
      </p>
    </div>
  )
}

/** A message's row: the sender's picture before it on the left, mine after it on the right. */
function Row({ right, picture, children }: { right: boolean; picture: ReactNode; children: ReactNode }) {
  return (
    <article className="flex gap-3">
      {!right && picture}
      <div className={cn("flex min-w-0 flex-1 flex-col", right ? "items-end" : "items-start")}>{children}</div>
      {right && picture}
    </article>
  )
}

const Me = ({ s }: { s: State }) => <Avatar kind="person" label={s.account?.name} src={s.account?.avatar_url} />

/** A session's mark; sent in person, the sender's own picture, wherever they sent it from. */
export const SenderAvatar = ({ s, from, size }: { s: State; from: Message["from"]; size?: "sm" }) =>
  from.agent ? (
    <Avatar kind={agentAvatar(from.agent.tool)} tool={from.agent.tool} size={size} />
  ) : (
    <Avatar kind="person" label={from.name} src={photoOf(s, from.account_id)} size={size} />
  )

/** One line under a message, in the caption size: its delivery state or why it wasn't sent. */
function StatusLine({ icon, tone, children }: { icon: ReactNode; tone?: "error"; children: ReactNode }) {
  return (
    <div className={cn("mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption", tone ? "text-destructive" : "text-(--semantic-color-text-tertiary)")}>
      {icon}
      {children}
    </div>
  )
}

/**
 * API-036 `state` of what I sent one of my sessions (FLOW-WEB-SEND S8); a state this page doesn't know shows nothing. In
 * a chat, API-031 `state` is on what reached my sessions and isn't in them yet: it says so while they're offline
 * (FLOW-WEB-CHAT S1). In a group the line names mine, else counts them: a bare "your sessions" reads as the others'
 * sessions, online and replying.
 */
function Delivery({ s, m }: { s: State; m: Message }) {
  if (!m.state) return null
  if (m.state === "delivered" && m.to) return <StatusLine icon={<CheckCheck size={14} aria-hidden="true" />}>{t("Delivered")}</StatusLine>
  if (m.state === "canceled" && m.to) return <StatusLine icon={<CircleAlert size={14} aria-hidden="true" />}>{t("Not delivered")}</StatusLine>
  if (m.state !== "pending" && m.state !== "pushed") return null
  const online = (id: string) => !!dataOf(s.agents)?.some((a) => a.id === id && a.online)
  const line = (text: string) => <StatusLine icon={<Clock size={14} aria-hidden="true" />}>{text}</StatusLine>
  if (!m.to) {
    const mine = (m.conversation.group && groupOf(s, m.conversation.group.id)?.my_sessions) || []
    if (mine.some((x) => online(x.id))) return null
    return line(
      mine.length === 1
        ? t("Waiting for your session {name} to come online", { name: mine[0].title })
        : mine.length > 1
          ? t("Waiting for your {n} sessions in this group to come online", { n: mine.length })
          : t("Waiting for your sessions to come online")
    )
  }
  if (!online(m.to.id)) return line(t("Waiting for {name} to come online", { name: m.to.title }))
  return mine(s, m) ? line(t("Sending…")) : null
}

/**
 * In a group the session or the source leads ("orders-api #Mia", "App #Mia"); what I sent in person there is "You".
 * Elsewhere the name leads: "Mia orders-api", "Mia | App". `session` only when a session sent it.
 */
function Sender({ owner, session, via, group, you }: { owner: string; session?: string; via?: Via; group: boolean; you: boolean }) {
  if (group && you) return <span className="truncate text-body-strong">{t("You")}</span>
  if (session !== undefined || group) return <SessionName owner={owner} title={session ?? leadOf(via)} strong group={group} />
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-body-strong">{owner}</span>
      <Sep />
      <span className="flex-none text-muted-foreground">{sourceOf(via)}</span>
    </span>
  )
}

/** A message with no `from.agent` was sent in person, from `from.via`. Group messages have no `to`. */
export function MessageRow({ s, m }: { s: State; m: Message }) {
  const to = recipientOf(s, m)
  const right = mine(s, m)
  return (
    <Row right={right} picture={right ? <Me s={s} /> : <SenderAvatar s={s} from={m.from} />}>
      <header className="flex max-w-full min-w-0 items-baseline gap-2">
        <SenderName s={s} from={m.from} group={m.conversation.group}>
          <Sender owner={m.from.name} session={m.from.agent?.title} via={m.from.via} group={!!m.conversation.group} you={right} />
        </SenderName>
        {to && <span className="min-w-0 truncate text-caption text-(--semantic-color-text-tertiary)">{toText(to)}</span>}
        <time dateTime={m.created_at} className="flex-none text-caption tabular-nums text-(--semantic-color-text-tertiary)">
          {clock(m.created_at)}
        </time>
      </header>
      {m.body && <Bubble body={m.body} right={right} />}
      {m.files.length > 0 && <Attachments files={m.files} right={right} />}
      <Delivery s={s} m={m} />
    </Row>
  )
}

/** Refusals worth another try: no answer, over the rate limit, a server fault. The same `client_msg_id` makes it safe. */
const retryable = (e: ApiError) => e.status === 0 || e.status === 429 || e.status >= 500 || e.type === "contract"

/** Why a send was refused, in the words of FLOW-WEB-CHAT and FLOW-WEB-SEND; anything else in the server's own words. */
function refusal(e: ApiError, group: boolean, who: string) {
  switch (e.type) {
    case "/errors/body-invalid":
      return t("Messages are 1 to 32,000 characters.")
    case "/errors/rate-limited":
      return e.retryAfter ? t("Sending too fast. Try again in {n} s.", { n: e.retryAfter }) : t("Sending too fast. Wait a moment, then try again.")
    case "/errors/subscription-required":
      return t("Subscribe to send and receive again.")
    case "/errors/not-contact":
      return t("{name} is no longer your contact.", { name: who })
    case "/errors/not-member":
      return t("You're no longer in this group.")
    case "/errors/recipient-not-found":
      return group ? t("This group was dissolved.") : e.message
    case "/errors/session-not-found":
      return t("That session is gone. Send it to {name}'s inbox instead.", { name: who })
    case "/errors/recipient-inactive":
      return group ? t("No one else in this group can receive messages right now.") : t("{name}'s account is inactive, so they can't receive messages.", { name: who })
    case "/errors/blocked":
      return t("{name} doesn't accept your messages.", { name: who })
    case "/errors/unblock-first":
      return t("You blocked {name}. Unblock {name} to send messages.", { name: who })
  }
  return e.status === 0 ? t("Check your connection, then try again.") : e.message
}

/** Who an outgoing message is addressed to: my own session, the group (nobody named), or a contact's inbox or session. */
function addressee(s: State, key: ThreadKey, to: string) {
  if (key.startsWith("a:")) return { owner: s.account?.name ?? "", title: dataOf(s.agents)?.find((a) => a.id === key.slice(2))?.title ?? "", inbox: false }
  if (to.startsWith("#")) return undefined
  const [account, short] = to.split("/")
  const p = contactOf(s, Number(account))
  return { owner: p?.name ?? account, title: short ? (p?.sessions.find((x) => x.short_id === short)?.title ?? short) : "", inbox: !short }
}

/** A message on its way, or refused: shown under the thread until the server's copy takes its place. */
function OutgoingRow({ s, id, o }: { s: State; id: ThreadKey; o: Outgoing }) {
  const to = addressee(s, id, o.to)
  const e = o.status === "failed" ? o.error : undefined
  return (
    <Row right picture={<Me s={s} />}>
      <header className="flex max-w-full min-w-0 items-baseline gap-2">
        <Sender owner={s.account?.name ?? ""} via="web" group={o.to.startsWith("#")} you />
        {to && <span className="min-w-0 truncate text-caption text-(--semantic-color-text-tertiary)">{toText(to)}</span>}
      </header>
      {o.body && <Bubble body={o.body} right />}
      {o.files.length > 0 && <Attachments files={o.files} right />}
      {!e ? (
        <StatusLine icon={<Clock size={14} aria-hidden="true" />}>{t("Sending…")}</StatusLine>
      ) : (
        <div role="alert" className="flex flex-col items-end">
          <StatusLine icon={<CircleAlert size={14} aria-hidden="true" />} tone="error">
            <span>{t("Not sent. {reason}", { reason: refusal(e, o.to.startsWith("#"), to?.owner ?? "") })}</span>
          </StatusLine>
          <div className="mt-1 -mr-2 flex flex-wrap justify-end gap-1">
            {retryable(e) && (
              <Button variant="ghost" size="sm" onClick={() => resend(id, o.cid)}>
                {t("Try again")}
              </Button>
            )}
            {e.type === "/errors/session-not-found" && (
              <Button variant="ghost" size="sm" onClick={() => resendTo(id, o.cid, o.to.split("/")[0])}>
                {t("Send to inbox")}
              </Button>
            )}
            {e.type === "/errors/unblock-first" && (
              <Button variant="ghost" size="sm" onClick={() => unblockNow({ id: Number(o.to.split("/")[0]), name: to?.owner ?? "" })}>
                {t("Unblock")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => discard(id, o.cid)}>
              {t("Discard")}
            </Button>
          </div>
        </div>
      )}
    </Row>
  )
}

function DayDivider({ at }: { at: string }) {
  return (
    <div role="separator" className="flex items-center gap-3 text-caption text-(--semantic-color-text-tertiary)">
      <span className="h-(--semantic-layout-hairline) flex-1 bg-border" />
      {dayLabel(at)}
      <span className="h-(--semantic-layout-hairline) flex-1 bg-border" />
    </div>
  )
}

/** The thread opens on its newest 50 messages; older pages load on request, above what's shown. */
function Earlier({ id, thread }: { id: ThreadKey; thread: Thread }) {
  if (!thread.hasMore) return null
  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="ghost" size="sm" aria-disabled={thread.older === "loading"} onClick={() => loadOlder(id)}>
        {thread.older === "loading" ? t("Loading…") : t("Show earlier messages")}
      </Button>
      {thread.older === "error" && (
        <p role="alert" className="text-caption text-destructive">
          {t("Couldn't load them. Try again.")}
        </p>
      )}
    </div>
  )
}

/** Picking messages to share as an image (views.tsx ChatPane): which are picked, and what picking one does. */
export type Picking = { picked: ReadonlySet<number>; toggle: (m: Message) => void }

/** A message while picking: a click anywhere on it picks it or lets it go, and its own links and buttons rest. */
function PickRow({ s, m, pick }: { s: State; m: Message; pick: Picking }) {
  const on = pick.picked.has(m.id)
  return (
    <div onClick={() => pick.toggle(m)} className={cn("state-layer -mx-2 -my-1.5 grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md px-2 py-1.5", on && "bg-card")}>
      <Checkbox
        checked={on}
        onCheckedChange={() => pick.toggle(m)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${m.from.name} ${afterName(m.from)} ${clock(m.created_at)}`}
        className="mt-1.5 size-5 rounded-full"
      />
      <div inert>
        <MessageRow s={s} m={m} />
      </div>
    </div>
  )
}

/** Scrolling message list that stays on the newest message while you're at the bottom, with a day divider per day. */
export function MessageList({ s, id, thread, label, pick }: { s: State; id: ThreadKey; thread: Thread; label: string; pick?: Picking }) {
  const { messages } = thread
  const outbox = s.outbox[id] ?? []
  // Sending something follows the thread to the bottom again.
  const { ref, showJump, jump } = useFollow<HTMLDivElement>(`${messages.at(-1)?.id}:${outbox.length}`, `${id}:${s.sent[id] ?? 0}`)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} tabIndex={0} aria-label={label} className="scroll-pane focus-ring min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <Earlier id={id} thread={thread} />
          {messages.map((m, i) => (
            <Fragment key={m.id}>
              {(i === 0 || !sameDay(messages[i - 1].created_at, m.created_at)) && <DayDivider at={m.created_at} />}
              {pick ? <PickRow s={s} m={m} pick={pick} /> : <MessageRow s={s} m={m} />}
            </Fragment>
          ))}
          {outbox.map((o) => (
            <OutgoingRow key={o.cid} s={s} id={id} o={o} />
          ))}
        </div>
      </div>
      {showJump && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Button variant="secondary" size="sm" onClick={jump} className="shadow-raised">
            <ArrowDown size={14} aria-hidden="true" />
            {t("Jump to latest")}
          </Button>
        </div>
      )}
    </div>
  )
}

/** What's on its way in a chat that doesn't exist yet: the first message, until the chat it makes opens. */
export function Outbox({ s, id }: { s: State; id: ThreadKey }) {
  return (
    <div className="scroll-pane min-h-0 flex-1">
      <div className="flex flex-col gap-4 p-4">
        {(s.outbox[id] ?? []).map((o) => (
          <OutgoingRow key={o.cid} s={s} id={id} o={o} />
        ))}
      </div>
    </div>
  )
}

/** Header bar shared by every detail pane; `back` is the list this pane came from (shown on phones only). */
export function PaneHeader({ back, children, end }: { back: ReactNode; children: ReactNode; end?: ReactNode }) {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b-(length:--semantic-layout-hairline) border-border px-4 max-sm:pl-2">
      <span className="sm:hidden">{back}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {end}
    </header>
  )
}
