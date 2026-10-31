import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, Bot, Clock, ExternalLink, FlaskConical, ListChecks, MessageSquare, Pencil, Share, ShieldCheck, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Avatar, Command, CopyId, Presence, Sep, Tag } from "@/components/bits"
import type { Billing, Conversation, Message, MyAgent, Request } from "@/data/contract"
import { messageOf, type Plan } from "@/data/layer"
import {
  PRICES,
  acceptRequest,
  addressOf,
  checkout,
  chosenSession,
  contactOf,
  conversationOf,
  conversationTitle,
  conversationWith,
  dataOf,
  declineRequest,
  isBlocked,
  isMe,
  loadThread,
  openThread,
  portalUrl,
  refreshList,
  renameAgent,
  retry,
  signOut,
  watchCheckout,
  type Load,
  type State,
  type ThreadKey,
} from "@/data/store"
import { RadioGroup } from "radix-ui"
import { setLanguage, t, useLanguage, type Choice } from "@/i18n"
import { daysUntil, langOf, longDate, shortWhen, toolName } from "@/lib/format"
import { navigate, onLinkClick } from "@/lib/router"
import { Composer, RecipientPicker, SendingClosed } from "./composer"
import { ComputersField, DeleteAccount, NameField } from "./account"
import { ChangeEmail } from "./email"
import { openAddContact } from "./contacts"
import { openGroupDetails, openNewGroup } from "./groups"
import { MessageList, Outbox, PaneHeader, type Picking } from "./messages"
import { RenameButtons, RenameHint, RenameInput, useRename, useReturnFocus } from "./rename"
import { BlockedField, BlockedNote, BlockedTag, GroupMembers, PeerMenu, PictureField, unblockNow } from "./safety"
import { MAX_PICKED, ShareDialogContent } from "./share"
import { EmptyState, ErrorState, ListSkeleton, ThreadSkeleton } from "./states"

const INSTALL = "curl -fsSL https://imbo.dev/install | sh"

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="icon">
      <a href={to} onClick={onLinkClick} aria-label={label}>
        <ArrowLeft size={20} aria-hidden="true" />
      </a>
    </Button>
  )
}

/** A row in the left column; the open item is marked with the selected surface (brand: selection is not a state layer). */
function ListRow({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={onLinkClick}
      aria-current={current ? "page" : undefined}
      className="state-layer focus-ring grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-foreground aria-[current=page]:bg-accent"
    >
      {children}
    </a>
  )
}

/**
 * API-030 `pending`: sent to me, not yet picked up by a session nor read in a terminal. Looking here changes nothing.
 * Also API-014 `unread`, with `sr` saying what the number counts.
 */
export function PendingBadge({ n, small, labelled, sr = t("waiting for delivery") }: { n: number; small?: boolean; labelled?: boolean; sr?: string }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full bg-(--semantic-color-signal-unread) px-1 text-caption leading-none font-bold tabular-nums text-(--semantic-color-signal-on-unread)",
        small ? "h-4 min-w-4" : "h-5 min-w-5"
      )}
    >
      {n}
      {!labelled && <span className="sr-only"> {sr}</span>}
    </span>
  )
}

/** Placeholder for the right pane when nothing is open (wide screens only). */
export function NothingOpen({ children }: { children: string }) {
  return (
    <div className="grid flex-1 place-items-center p-6 max-sm:hidden">
      <p className="flex items-center gap-2 text-body text-(--semantic-color-text-tertiary)">
        <MessageSquare size={16} aria-hidden="true" />
        {children}
      </p>
    </div>
  )
}

/** Right pane of a new account with nothing in it yet (wide screens; phones get the command in the list's empty state). */
export function GetStarted() {
  return (
    <div className="grid flex-1 place-items-center p-6 max-sm:hidden">
      <div className="flex w-full max-w-96 flex-col gap-3">
        <h2 className="text-heading3 text-foreground">{t("Connect your first computer")}</h2>
        <p className="text-body text-muted-foreground">
          {t("Run this in a terminal and sign in with the same email. The agent sessions on that computer join Imbo, and their messages show up here.")}
        </p>
        <Command text={INSTALL} />
        <p className="text-caption text-muted-foreground">{t("To message someone, add each other by account ID.")}</p>
      </div>
    </div>
  )
}

// ── Chats ────────────────────────────────────────────────────────────────────

export function ChatList({ s, open }: { s: State; open?: string }) {
  const l = s.conversations
  if (l.status === "loading") return <ListSkeleton />
  if (l.status === "error") return <ErrorState title={t("Couldn't load chats")} error={l.error} onRetry={() => retry("conversations")} />
  const newGroup = (
    <div className="flex justify-end px-4 pt-2">
      <Button variant="outline" size="sm" onClick={openNewGroup}>
        <Users size={14} aria-hidden="true" />
        {t("New group")}
      </Button>
    </div>
  )
  if (!l.data.length)
    return (
      <>
        {newGroup}
        <EmptyState icon={<MessageSquare size={24} />} title={t("No chats yet")}>
          <p>{t("Chats show up here when your sessions message a contact, or a contact's sessions message yours.")}</p>
          <div className="sm:hidden">
            <Command text={INSTALL} />
          </div>
        </EmptyState>
      </>
    )
  return (
    <>
      {newGroup}
      <nav aria-label={t("Chats")} className="flex flex-col gap-0.5 p-2">
        {l.data.map((c) => {
          const title = conversationTitle(c)
          const last = c.last_message
          const who = !last ? "" : isMe(s, last.from.account_id) ? t("You") : c.kind === "group" ? last.from.name : (last.from.agent?.title ?? t("Terminal"))
          return (
            <ListRow key={c.id} href={`/chats/${c.id}`} current={String(c.id) === open}>
              <Avatar kind={c.kind === "group" ? "group" : "person"} label={title} src={(c.group ?? c.peer)?.avatar_url} />
              <span className="min-w-0">
                <span className="block truncate text-body">{title}</span>
                {last && (
                  <span lang={langOf(last.preview)} className="block truncate text-caption text-muted-foreground">
                    {who}: {last.preview}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end gap-1">
                {last && (
                  <time dateTime={last.created_at} className="text-caption tabular-nums text-(--semantic-color-text-tertiary)">
                    {shortWhen(last.created_at)}
                  </time>
                )}
                {c.pending > 0 ? <PendingBadge n={c.pending} /> : <span className="h-5" />}
              </span>
            </ListRow>
          )
        })}
      </nav>
    </>
  )
}

/** The header while picking messages to share: how many are picked, the limit, and Cancel. */
function PickHeader({ n, onCancel }: { n: number; onCancel: () => void }) {
  return (
    <PaneHeader
      back={null}
      end={
        <Button variant="ghost" className="text-foreground" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      }
    >
      <h1 className="min-w-0 flex-1 truncate text-body-strong text-foreground">{n ? t("{n} selected", { n }) : t("Select messages")}</h1>
      <span className="flex-none text-caption text-muted-foreground">{t("Up to {n} messages", { n: MAX_PICKED })}</span>
    </PaneHeader>
  )
}

/** In place of the composer while picking. */
function ShareBar({ n, onShare }: { n: number; onShare: () => void }) {
  return (
    <div className="flex flex-none items-center justify-end border-t-(length:--semantic-layout-hairline) border-border px-4 py-3">
      <Button disabled={!n} onClick={onShare}>
        <Share size={16} aria-hidden="true" />
        {n ? t("Share as image ({n})", { n }) : t("Pick messages to share")}
      </Button>
    </div>
  )
}

export function ChatPane({ s, id }: { s: State; id: string }) {
  const key: ThreadKey = `c:${Number(id)}`
  useEffect(() => {
    if (/^\d+$/.test(id)) return openThread(key)
  }, [id, key])
  // Messages picked to share as one image, up to 50; picking belongs to the chat it started in. `shot`: what the
  // Share as image dialog draws, kept while the dialog closes.
  const [pick, setPick] = useState<{ chat: string; ids: ReadonlySet<number> }>()
  const [shot, setShot] = useState<Message[]>()
  const [sharing, setSharing] = useState(false)
  const back = <BackLink to="/chats" label={t("Back to chats")} />
  const early = paneState(s.conversations, back, t("Couldn't load this chat"), () => retry("conversations"))
  if (early) return early
  const c = conversationOf(s, Number(id))
  if (!c) return <NotFound back={back} title={t("This chat isn't here")} />

  const title = conversationTitle(c)
  const peer = c.peer && contactOf(s, c.peer.id)
  // I blocked them: nothing to pick a recipient for (FLOW-BLOCK S5).
  const blocked = !!c.peer && isBlocked(s, c.peer.id)
  const thread = s.threads[key]
  const messages = thread?.status === "ready" ? thread.data.messages : []
  const picked = pick?.chat === id ? pick.ids : undefined
  const picking: Picking | undefined = picked && {
    picked,
    toggle: (m) => {
      if (!picked.has(m.id) && picked.size >= MAX_PICKED) return void toast(t("You can share up to {n} messages at a time.", { n: MAX_PICKED }))
      const next = new Set(picked)
      if (!next.delete(m.id)) next.add(m.id)
      setPick({ chat: id, ids: next })
    },
  }
  const select = messages.length > 0 && (
    <Button variant="ghost" size="icon" aria-label={t("Select messages")} onClick={() => setPick({ chat: id, ids: new Set() })}>
      <ListChecks size={16} aria-hidden="true" />
    </Button>
  )
  const header = (end: ReactNode, count?: ReactNode) => (
      <PaneHeader back={back} end={end}>
        <Avatar kind={c.group ? "group" : "person"} label={title} src={(c.group ?? c.peer)?.avatar_url} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate text-body-strong text-foreground">
              {c.group ? (
                <button
                  type="button"
                  onClick={() => openGroupDetails(c.group!.id)}
                  aria-haspopup="dialog"
                  className="state-layer focus-ring max-w-full truncate rounded-sm text-left"
                >
                  {title}
                </button>
              ) : (
                title
              )}
            </h1>
            {c.pending > 0 && (
              <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
                <PendingBadge n={c.pending} small labelled />
                <span className="truncate">{t("waiting for delivery")}</span>
              </span>
            )}
          </div>
          <p className="flex min-w-0 items-center gap-2 overflow-hidden text-caption whitespace-nowrap text-muted-foreground">
            {c.group ? (
              <>
                <span className="tabular-nums">#{c.group.id}</span>
                <Sep />
                {count}
              </>
            ) : c.peer ? (
              <>
                <a href={`/contacts/${c.peer.id}`} onClick={onLinkClick} className="focus-ring rounded-sm tabular-nums underline-offset-4 hover:underline">
                  {t("ID {id}", { id: c.peer.id })}
                </a>
                {peer && (
                  <>
                    <Sep />
                    {t("{n} of {total} sessions online", { n: peer.sessions.filter((x) => x.online).length, total: peer.sessions.length })}
                  </>
                )}
              </>
            ) : null}
          </p>
        </div>
      </PaneHeader>
  )
  return (
    <>
      {picked ? (
        <PickHeader n={picked.size} onCancel={() => setPick(undefined)} />
      ) : c.group ? (
        <GroupMembers s={s} c={c}>
          {({ stack, count }) =>
            header(
              <span className="flex flex-none items-center gap-1">
                {select}
                {stack}
              </span>,
              count
            )
          }
        </GroupMembers>
      ) : (
        header(
          c.peer && (
            <span className="flex flex-none items-center gap-1">
              {select}
              {peer?.active && !blocked && <RecipientPicker s={s} c={c} />}
              <PeerMenu s={s} who={c.peer} />
            </span>
          )
        )
      )}
      <ThreadBody s={s} id={key} label={t("Messages with {name}", { name: title })} pick={picking} />
      {picked ? (
        <ShareBar
          n={picked.size}
          onShare={() => {
            setShot(messages.filter((m) => picked.has(m.id)))
            setSharing(true)
          }}
        />
      ) : (
        <ChatComposer s={s} c={c} title={title} />
      )}
      <Dialog open={sharing} onOpenChange={setSharing}>
        {shot && <ShareDialogContent s={s} c={c} messages={shot} />}
      </Dialog>
    </>
  )
}

/** Why this account can't send right now (RULE-008), or undefined when it can. */
function sendingPaused(s: State) {
  const b = dataOf(s.billing)
  return b?.enabled && b.access.state === "expired" ? t("Sending is paused until you subscribe.") : undefined
}

/** A group sends to everyone in it; a direct chat to the peer's inbox or the session picked in the header. */
function ChatComposer({ s, c, title }: { s: State; c: Conversation; title: string }) {
  const key: ThreadKey = `c:${c.id}`
  if (s.threads[key]?.status !== "ready") return null
  const who = c.peer
  if (who && isBlocked(s, who.id))
    return (
      <SendingClosed
        action={
          <Button variant="outline" size="sm" onClick={() => unblockNow(who)}>
            {t("Unblock")}
          </Button>
        }
      >
        {t("You blocked {name}. Unblock {name} to send messages.", { name: title })}
      </SendingClosed>
    )
  const paused = sendingPaused(s)
  if (paused) return <SendingClosed>{paused}</SendingClosed>
  if (c.kind === "group") return <Composer key={key} s={s} threadKey={key} to={addressOf(s, c)} label={title} />
  const contacts = dataOf(s.contacts)
  const peer = contactOf(s, c.peer!.id)
  if (contacts && !peer) return <SendingClosed>{t("{name} is no longer your contact, so messages can't be sent here.", { name: title })}</SendingClosed>
  if (peer && !peer.active) return <SendingClosed>{t("{name}'s account is inactive, so messages can't reach them.", { name: title })}</SendingClosed>
  const x = chosenSession(s, c)
  return (
    <Composer
      key={key}
      s={s}
      threadKey={key}
      to={addressOf(s, c)}
      label={x ? `${title} ${x.title}` : t("{name}'s inbox", { name: title })}
      note={x && !x.online ? t("{name} is offline. It gets your message when it comes back online.", { name: x.title }) : undefined}
    />
  )
}

export function NotFound({ back, title }: { back: ReactNode; title: string }) {
  return (
    <>
      <PaneHeader back={back}>
        <span />
      </PaneHeader>
      <EmptyState icon={<MessageSquare size={24} />} title={title}>
        <p>{t("It may belong to another account, or the link is incomplete.")}</p>
      </EmptyState>
    </>
  )
}

/** Loading and failed states every detail pane shares while its list loads; null when the list is there. */
function paneState(l: Load<unknown>, back: ReactNode, failed: string, onRetry: () => void, body: ReactNode = <ThreadSkeleton />) {
  if (l.status === "loading")
    return (
      <>
        <PaneHeader back={back}>
          <span className="skeleton h-4 w-40" />
        </PaneHeader>
        {body}
      </>
    )
  // The header only carries the back link here, which phones need and wide screens don't show.
  if (l.status === "error")
    return (
      <>
        <div className="sm:hidden">
          <PaneHeader back={back}>
            <span />
          </PaneHeader>
        </div>
        <div className="grid flex-1 place-items-center">
          <ErrorState title={failed} error={l.error} onRetry={onRetry} />
        </div>
      </>
    )
  return null
}

/** The messages of a chat or session under its header: skeleton, failure with retry, `empty`, or the list. */
function ThreadBody({ s, id, label, empty, pick }: { s: State; id: ThreadKey; label: string; empty?: ReactNode; pick?: Picking }) {
  const thread = s.threads[id]
  if (!thread || thread.status === "loading") return <ThreadSkeleton />
  if (thread.status === "error")
    return (
      <div className="grid flex-1 place-items-center">
        <ErrorState title={t("Couldn't load the messages")} error={thread.error} onRetry={() => loadThread(id)} />
      </div>
    )
  if (!thread.data.messages.length && !s.outbox[id]?.length && empty) return empty
  return <MessageList s={s} id={id} thread={thread.data} label={label} pick={pick} />
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/** Tool and computer name; only my own sessions have a computer name (API-014 `device_name`). */
function ToolLine({ x }: { x: MyAgent }) {
  return (
    <>
      <span className="truncate">{toolName(x.tool)}</span>
      <Sep />
      <span className="truncate">{x.device_name}</span>
    </>
  )
}

export function SessionList({ s, open }: { s: State; open?: string }) {
  const l = s.agents
  if (l.status === "loading") return <ListSkeleton rows={4} />
  if (l.status === "error") return <ErrorState title={t("Couldn't load sessions")} error={l.error} onRetry={() => retry("agents")} />
  if (!l.data.length)
    return (
      <EmptyState icon={<Bot size={24} />} title={t("No sessions yet")}>
        <p>{t("After you install Imbo, every Claude Code, Codex, opencode, Cursor, MiniMax Code or ZCode session on that computer shows up here.")}</p>
        <div className="sm:hidden">
          <Command text={INSTALL} />
        </div>
      </EmptyState>
    )
  return (
    <nav aria-label={t("My sessions")} className="flex flex-col gap-0.5 p-2">
      {l.data.map((x) => (
        <ListRow key={x.id} href={`/sessions/${x.id}`} current={x.id === open}>
          <Avatar kind="agent" tool={x.tool} />
          <span className="min-w-0">
            <span className="block truncate text-body">{x.title}</span>
            <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
              <Presence s={x} plain />
              <Sep />
              <span className="truncate">{toolName(x.tool)}</span>
            </span>
          </span>
          {x.unread > 0 && <PendingBadge n={x.unread} sr={x.unread === 1 ? t("new reply") : t("new replies")} />}
        </ListRow>
      ))}
    </nav>
  )
}

/**
 * The line over the box while the session is offline (FLOW-WAKE): when the server says sending can open it on its computer,
 * then the latest try at that until it comes online.
 */
function offlineNote(x: MyAgent) {
  if (x.online) return undefined
  const on = x.device_name ?? t("its computer")
  const name = x.title
  if (x.wake?.state === "waking") return t("Opening {name} on {on}…", { name, on })
  if (x.wake?.state === "failed")
    return x.wake.detail
      ? t("Couldn't open {name} on {on}: {detail} It gets your message when it comes back online.", { name, on, detail: x.wake.detail })
      : t("Couldn't open {name} on {on}. It gets your message when it comes back online.", { name, on })
  if (x.wakeable) return t("{name} is offline. Sending opens it in the background on {on}.", { name, on })
  return t("{name} is offline. It gets your message when it comes back online.", { name })
}

/** API-073 on a session's page: the pencil turns its name into a text box; empty goes back to the tool's title. */
function SessionHeader({ x, back }: { x: MyAgent; back: ReactNode }) {
  const [renaming, setRenaming] = useState(false)
  const pencil = useReturnFocus(renaming)
  if (renaming) return <RenamingSession x={x} back={back} onDone={() => setRenaming(false)} />
  return (
    <PaneHeader back={back} end={<Presence s={x} />}>
      <Avatar kind="agent" tool={x.tool} />
      <div className="min-w-0">
        <h1 className="flex min-w-0 items-center gap-1 text-body-strong text-foreground">
          <span className="truncate">{x.title}</span>
          <Button ref={pencil} variant="ghost" size="icon-sm" aria-label={t("Rename {name}", { name: x.title })} className="flex-none text-muted-foreground" onClick={() => setRenaming(true)}>
            <Pencil size={14} aria-hidden="true" />
          </Button>
        </h1>
        <p className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
          <ToolLine x={x} />
          <Sep />
          <span className="font-(family-name:--semantic-typography-code-font-family)">{x.short_id}</span>
        </p>
      </div>
    </PaneHeader>
  )
}

function RenamingSession({ x, back, onDone }: { x: MyAgent; back: ReactNode; onDone: () => void }) {
  const r = useRename(x.title, (title) => renameAgent(x.id, title), onDone, (v) =>
    [...v].length > 200 ? t("A session name can be at most 200 characters.") : undefined,
  )
  const formId = useId()
  return (
    <>
      <PaneHeader back={back}>
        {/* On a phone the box needs the room: no avatar, and Save and Cancel go under it, after the hint. */}
        <span className="max-sm:hidden">
          <Avatar kind="agent" tool={x.tool} />
        </span>
        <form id={formId} onSubmit={r.submit} noValidate className="flex min-w-0 flex-1 items-center gap-2">
          <RenameInput r={r} label={t("Session name")} className="h-8 min-w-0 flex-1 px-2.5" />
          <span className="flex gap-2 max-sm:hidden">
            <RenameButtons r={r} />
          </span>
        </form>
      </PaneHeader>
      <div className="flex flex-none flex-col gap-2 border-b-(length:--semantic-layout-hairline) border-border px-4 py-2">
        <RenameHint r={r}>
          {t("The new name replaces the title from {tool} everywhere in Imbo, for you and your contacts. Leave it empty to go back to that title.", { tool: toolName(x.tool) })}
        </RenameHint>
        <span className="flex gap-2 sm:hidden">
          <RenameButtons r={r} form={formId} />
        </span>
      </div>
    </>
  )
}

export function SessionPane({ s, id }: { s: State; id: string }) {
  const key: ThreadKey = `a:${id}`
  useEffect(() => openThread(key), [key])
  const back = <BackLink to="/sessions" label={t("Back to sessions")} />
  const early = paneState(s.agents, back, t("Couldn't load this session"), () => retry("agents"))
  if (early) return early
  const x = dataOf(s.agents)?.find((a) => a.id === id)
  if (!x) return <NotFound back={back} title={t("This session isn't here")} />
  const paused = sendingPaused(s)
  return (
    <>
      <SessionHeader key={x.id} x={x} back={back} />
      <ThreadBody
        s={s}
        id={key}
        label={t("Messages sent and received by {name}", { name: x.title })}
        empty={
          <div className="flex-1">
            <EmptyState icon={<MessageSquare size={24} />} title={t("Nothing sent or received yet")} />
          </div>
        }
      />
      {s.threads[key]?.status === "ready" &&
        (paused ? (
          <SendingClosed>{paused}</SendingClosed>
        ) : (
          <Composer
            key={key}
            s={s}
            threadKey={key}
            to=""
            label={x.title}
            note={offlineNote(x)}
          />
        ))}
    </>
  )
}

// ── Contacts ─────────────────────────────────────────────────────────────────

/** API-009 to API-011: a contact request or group invitation waiting for me, with its note, Accept and Decline. */
function RequestRow({ r }: { r: Request }) {
  const [busy, setBusy] = useState(false)
  const title = r.group ? t("{name} invited you to {group}", { name: r.from.name, group: r.group.name }) : r.from.name
  const answer = async (accept: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      if (!accept) return void (await declineRequest(r))
      const done = await acceptRequest(r)
      // Joined a group: its chat, with the details open to pick which sessions get its messages (FLOW-GROUP-JOIN).
      if (done.group) {
        if (done.chat) navigate(`/chats/${done.chat}`)
        openGroupDetails(done.group.id)
        toast(t("You joined {group}. Pick which sessions get its messages.", { group: done.group.name }))
      } else if (done.contact) toast(t("You and {name} are now contacts.", { name: done.contact.name }))
    } catch (e) {
      setBusy(false)
      toast.error(messageOf(e))
    }
  }
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-2 py-2">
      <Avatar kind={r.group ? "group" : "person"} label={r.from.name} />
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <p className="text-body wrap-anywhere text-foreground">{title}</p>
          <p className="text-caption tabular-nums text-muted-foreground">{r.group ? t("Group {id}", { id: r.group.id }) : t("ID {id}", { id: r.from.id })}</p>
          {r.note && (
            <p lang={langOf(r.note)} className="mt-1 text-body wrap-anywhere text-foreground">
              {r.note}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" aria-disabled={busy} onClick={() => answer(true)} aria-label={t("Accept, {title}", { title })}>
            {t("Accept")}
          </Button>
          <Button size="sm" variant="outline" aria-disabled={busy} onClick={() => answer(false)} aria-label={t("Decline, {title}", { title })}>
            {t("Decline")}
          </Button>
        </div>
      </div>
    </li>
  )
}

function ListHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="px-4 pt-3 pb-1 text-label text-muted-foreground">
      {children}
    </h2>
  )
}

/** API-009 `direction=out`: a contact request I sent, until they answer. */
function SentRow({ r }: { r: Request }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-2 py-2">
      <Avatar kind="person" label={r.to.name} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-body text-foreground">{r.to.name}</span>
          <span className="flex-none text-caption tabular-nums text-muted-foreground">{t("ID {id}", { id: r.to.id })}</span>
        </p>
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Clock size={12} aria-hidden="true" className="flex-none" />
          <span className="truncate">{t("Waiting for {name} to accept", { name: r.to.name })}</span>
        </p>
      </div>
    </li>
  )
}

export function ContactList({ s, open }: { s: State; open?: string }) {
  const l = s.contacts
  if (l.status === "loading") return <ListSkeleton rows={3} />
  if (l.status === "error") return <ErrorState title={t("Couldn't load contacts")} error={l.error} onRetry={() => retry("contacts")} />
  const add = (
    <div className="flex justify-end px-4 pt-2">
      <Button variant="outline" size="sm" onClick={openAddContact}>
        <UserPlus size={14} aria-hidden="true" />
        {t("Add contact")}
      </Button>
    </div>
  )
  const requests = s.requests.length > 0 && (
    <section aria-labelledby="requests-heading">
      <ListHeading id="requests-heading">{t("Requests")}</ListHeading>
      <ul className="flex flex-col px-2">
        {s.requests.map((r) => (
          <RequestRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  )
  const sent = s.outgoing.length > 0 && (
    <section aria-labelledby="sent-heading">
      <ListHeading id="sent-heading">{t("Sent")}</ListHeading>
      <ul className="flex flex-col px-2">
        {s.outgoing.map((r) => (
          <SentRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  )
  if (!l.data.length)
    return (
      <>
        {add}
        {requests}
        {sent}
        <EmptyState icon={<Users size={24} />} title={t("No contacts yet")}>
          <p>{t("Add someone with their account ID or email, or share your own ID from Account so they can add you.")}</p>
        </EmptyState>
      </>
    )
  return (
    <>
      {add}
      {requests}
      {sent}
      {(requests || sent) && <ListHeading id="contacts-heading">{t("Contacts")}</ListHeading>}
      <nav aria-label={t("Contacts")} className="flex flex-col gap-0.5 p-2">
        {l.data.map((p) => {
          const online = p.sessions.filter((x) => x.online).length
          return (
            <ListRow key={p.id} href={`/contacts/${p.id}`} current={String(p.id) === open}>
              <Avatar kind="person" label={p.name} src={p.avatar_url} />
              <span className="min-w-0">
                <span className="block truncate text-body">{p.name}</span>
                <span className="block text-caption tabular-nums text-muted-foreground">{t("ID {id}", { id: p.id })}</span>
              </span>
              {isBlocked(s, p.id) ? (
                <BlockedTag />
              ) : p.active ? (
                <span className="text-caption whitespace-nowrap text-(--semantic-color-text-tertiary)">{online ? t("{n} online", { n: online }) : t("Offline")}</span>
              ) : (
                <Tag>{t("Inactive")}</Tag>
              )}
            </ListRow>
          )
        })}
      </nav>
    </>
  )
}

export function ContactPane({ s, id }: { s: State; id: string }) {
  const back = <BackLink to="/contacts" label={t("Back to contacts")} />
  const early = paneState(s.contacts, back, t("Couldn't load this contact"), () => retry("contacts"), <ListSkeleton rows={3} />)
  if (early) return early
  const p = dataOf(s.contacts)?.find((c) => String(c.id) === id)
  if (!p) return <NotFound back={back} title={t("This contact isn't here")} />
  const chat = conversationWith(s, p.id)
  const blocked = isBlocked(s, p.id)
  return (
    <>
      <PaneHeader
        back={back}
        end={
          <span className="flex flex-none items-center gap-1">
            {chat ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/chats/${chat}`} onClick={onLinkClick}>
                  <MessageSquare size={14} aria-hidden="true" />
                  {t("Open chat")}
                </a>
              </Button>
            ) : (
              p.active &&
              !blocked && (
                <Button asChild variant="outline" size="sm">
                  <a href={`/contacts/${p.id}/chat`} onClick={onLinkClick}>
                    <MessageSquare size={14} aria-hidden="true" />
                    {t("Message")}
                  </a>
                </Button>
              )
            )}
            <PeerMenu s={s} who={p} />
          </span>
        }
      >
        <Avatar kind="person" label={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 text-body-strong text-foreground">
            <span className="truncate">{p.name}</span>
            {blocked && <BlockedTag />}
            {!p.active && <Tag>{t("Inactive")}</Tag>}
          </h1>
          <div className="-ml-1.5">
            <CopyId id={String(p.id)} label={t("Copy {name}'s account ID", { name: p.name })} />
          </div>
        </div>
      </PaneHeader>
      <section aria-labelledby="contact-sessions" className="scroll-pane min-h-0 flex-1 p-4">
        {blocked && <BlockedNote who={p} />}
        <h2 id="contact-sessions" className="mb-2 text-label text-muted-foreground">
          {t("Sessions")}
        </h2>
        {!p.active && <p className="mb-3 text-caption text-muted-foreground">{t("{name}'s account is inactive, so their sessions can't send messages.", { name: p.name })}</p>}
        {p.sessions.length ? (
          <ul className="flex flex-col">
            {p.sessions.map((x) => (
              <li key={x.short_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t-(length:--semantic-layout-hairline) border-border py-3">
                <Avatar kind="agent" tool={x.tool} />
                <span className="min-w-0">
                  <span className="block truncate text-body">{x.title}</span>
                  <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
                    <span className="truncate">{toolName(x.tool)}</span>
                    <Sep />
                    <span className="font-(family-name:--semantic-typography-code-font-family)">{x.short_id}</span>
                  </span>
                </span>
                <Presence s={x} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-(--semantic-color-text-tertiary)">
            {t("{name} has no sessions online or seen in the last 7 days. Messages go to {name}'s terminal inbox.", { name: p.name })}
          </p>
        )}
      </section>
    </>
  )
}

/**
 * A chat with a contact I haven't messaged yet (FLOW-WEB-CHAT S1): empty until the first message, which makes the chat
 * and opens it in Chats. Until then the recipient choice is kept under minus their account ID.
 */
export function NewChatPane({ s, id }: { s: State; id: string }) {
  const back = <BackLink to={`/contacts/${id}`} label={t("Back to contact")} />
  const early = paneState(s.contacts, back, t("Couldn't load this contact"), () => retry("contacts"), <ListSkeleton rows={3} />)
  const p = dataOf(s.contacts)?.find((c) => String(c.id) === id)
  const chat = p && conversationWith(s, p.id)
  useEffect(() => {
    if (chat) navigate(`/chats/${chat}`, { replace: true })
  }, [chat])
  if (early) return early
  if (!p) return <NotFound back={back} title={t("This contact isn't here")} />
  if (chat) return null
  const key: ThreadKey = `n:${p.id}`
  const c: Conversation = { id: -p.id, kind: "direct", peer: { id: p.id, name: p.name, avatar_url: p.avatar_url }, pending: 0 }
  const x = chosenSession(s, c)
  const online = p.sessions.filter((y) => y.online).length
  const paused = sendingPaused(s)
  return (
    <>
      <PaneHeader back={back} end={p.active && !isBlocked(s, p.id) && <RecipientPicker s={s} c={c} />}>
        <Avatar kind="person" label={p.name} src={p.avatar_url} />
        <div className="min-w-0">
          <h1 className="truncate text-body-strong text-foreground">{p.name}</h1>
          <p className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
            <a href={`/contacts/${p.id}`} onClick={onLinkClick} className="focus-ring rounded-sm tabular-nums underline-offset-4 hover:underline">
              {t("ID {id}", { id: p.id })}
            </a>
            <Sep />
            {online ? t("{n} of {total} sessions online", { n: online, total: p.sessions.length }) : t("Offline")}
          </p>
        </div>
      </PaneHeader>
      {s.outbox[key]?.length ? (
        <Outbox s={s} id={key} />
      ) : (
        <div className="flex-1">
          <EmptyState icon={<MessageSquare size={24} />} title={t("No messages with {name} yet", { name: p.name })}>
            <p>
              {x
                ? t("Your first message goes to {name}'s session {session}. The chat shows up in Chats once it's sent.", { name: p.name, session: x.title })
                : t("Your first message goes to {name}'s terminal inbox. The chat shows up in Chats once it's sent.", { name: p.name })}
            </p>
          </EmptyState>
        </div>
      )}
      {isBlocked(s, p.id) ? (
        <SendingClosed
          action={
            <Button variant="outline" size="sm" onClick={() => unblockNow(p)}>
              {t("Unblock")}
            </Button>
          }
        >
          {t("You blocked {name}. Unblock {name} to send messages.", { name: p.name })}
        </SendingClosed>
      ) : !p.active ? (
        <SendingClosed>{t("{name}'s account is inactive, so messages can't reach them.", { name: p.name })}</SendingClosed>
      ) : paused ? (
        <SendingClosed>{paused}</SendingClosed>
      ) : (
        <Composer
          key={key}
          s={s}
          threadKey={key}
          to={addressOf(s, c)}
          label={x ? `${p.name} ${x.title}` : t("{name}'s inbox", { name: p.name })}
          note={x && !x.online ? t("{name} is offline. It gets your message when it comes back online.", { name: x.title }) : undefined}
        />
      )}
    </>
  )
}

// ── Account ──────────────────────────────────────────────────────────────────

/** Both buttons stay unavailable from the click until checkout opens or fails (docs/DESIGN.md「网页的界面状态」). */
function Subscribe() {
  const [opening, setOpening] = useState<Plan>()
  const go = async (plan: Plan) => {
    if (opening) return
    setOpening(plan)
    try {
      if (!(await checkout(plan))) setOpening(undefined)
    } catch (e) {
      setOpening(undefined)
      toast.error(messageOf(e))
      retry("billing")
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button aria-disabled={!!opening} onClick={() => go("yearly")}>
          {opening === "yearly" ? t("Opening checkout…") : t("{price} a year", { price: PRICES.yearly })}
        </Button>
        <Button variant="outline" aria-disabled={!!opening} onClick={() => go("monthly")}>
          {opening === "monthly" ? t("Opening checkout…") : t("{price} a month", { price: PRICES.monthly })}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">{t("Tax is added at checkout. Cancel any time.")}</p>
    </div>
  )
}

/** Waffo's customer page opens in a new tab (API-034). */
function ManageSubscription({ note }: { note: string }) {
  const [opening, setOpening] = useState(false)
  const open = async () => {
    if (opening) return
    setOpening(true)
    // Opened during the click so pop-up blockers allow it; it gets its address once the server answers.
    const tab = window.open("", "_blank")
    try {
      const url = await portalUrl()
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else location.assign(url)
    } catch (e) {
      tab?.close()
      toast.error(messageOf(e))
    } finally {
      setOpening(false)
    }
  }
  return (
    <>
      <div>
        <Button variant="outline" aria-disabled={opening} onClick={open}>
          {opening ? t("Opening…") : t("Manage subscription")}
          <ExternalLink size={14} aria-hidden="true" />
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">{note}</p>
    </>
  )
}

const cycleName = (plan: string) => (plan === "monthly" ? t("Monthly") : plan === "yearly" ? t("Yearly") : plan)

/** An App Store subscription is managed only on the iPhone, so it gets this note instead of Manage subscription (ADR-043). */
function AppStoreNote() {
  return <p className="text-caption text-muted-foreground">{t("Billed through the App Store. Manage it in Settings on your iPhone.")}</p>
}

/** The Plan row, one branch per API-032 state. `confirming`: back from checkout, waiting for the payment notice. */
function PlanDetails({ b, confirming }: { b: Billing; confirming: boolean }) {
  const sub = b.subscription
  const appStore = sub?.provider === "apple"
  const manage = (note: string) => (appStore ? <AppStoreNote /> : <ManageSubscription note={note} />)
  switch (b.access.state) {
    case "free":
      return <p>{t("Free while billing hasn't started.")}</p>
    case "trial":
      return (
        <>
          <p className="tabular-nums">{t("Free trial, {n} days left", { n: daysUntil(b.trial_ends_at!) })}</p>
          <p className="text-caption text-muted-foreground">{t("Subscribe now and your first payment is taken 30 days later.")}</p>
          {!confirming && <Subscribe />}
        </>
      )
    case "paid":
      if (!sub) return <p>{t("Paid until {date}", { date: longDate(b.access.until!) })}</p>
      if (sub.status === "past_due")
        return (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Tag tone="warn">{t("Payment failed")}</Tag>
              {cycleName(sub.plan)}
            </p>
            <p className="text-caption text-muted-foreground">{t("{provider} is retrying the charge.", { provider: appStore ? "Apple" : "Waffo" })}</p>
            {manage(t("Change your card in Manage subscription."))}
          </>
        )
      if (sub.status === "scheduled_cancel" || sub.status === "canceled")
        return (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Tag>{t("Won't renew")}</Tag>
              {t("{plan}, ends {date}", { plan: cycleName(sub.plan), date: longDate(sub.paid_until) })}
            </p>
            {manage(t("Renew, change your card or download invoices on Waffo."))}
          </>
        )
      if (sub.status === "active")
        return (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Tag tone="ok">{t("Subscribed")}</Tag>
              {t("{plan}, renews {date}", { plan: cycleName(sub.plan), date: longDate(sub.paid_until) })}
            </p>
            {manage(t("Cancel, change your card or download invoices on Waffo."))}
          </>
        )
      // A status this app doesn't know is shown as the server sent it; access.state already says the plan is paid.
      return (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Tag>{sub.status}</Tag>
            {t("{plan}, paid until {date}", { plan: cycleName(sub.plan), date: longDate(sub.paid_until) })}
          </p>
          {manage(t("Details are on Waffo."))}
        </>
      )
    case "expired":
      return (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Tag tone="warn">{t("Inactive")}</Tag>
            {t("Since {date}", { date: longDate(b.access.until!) })}
          </p>
          <p className="text-caption text-muted-foreground">{t("Your sessions can't send messages until you subscribe. You can still read history and download files.")}</p>
          {!confirming && <Subscribe />}
        </>
      )
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1 border-t-(length:--semantic-layout-hairline) border-border py-4 first:border-t-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <h2 className="text-label text-muted-foreground">{label}</h2>
      <div className="flex min-w-0 flex-col gap-2 text-body text-foreground">{children}</div>
    </div>
  )
}

const LANGUAGES: { value: Choice; label: () => string; lang?: string }[] = [
  { value: "en", label: () => "English", lang: "en" },
  { value: "zh", label: () => "简体中文", lang: "zh-CN" },
  { value: "system", label: () => t("Follow system") },
]

/** Set when a pick redraws the page, so focus lands back on the picked language rather than on nothing. */
let picked = false

/** The page's language (ADR-053): English, Chinese, or the browser's. Picking one draws the whole page again in it, here. */
function LanguageField() {
  const { choice } = useLanguage()
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!picked) return
    picked = false
    root.current?.querySelector<HTMLElement>("[data-state=checked]")?.focus()
  }, [])
  const pick = (v: string) => {
    picked = true
    setLanguage(v as Choice)
  }
  return (
    <>
      <RadioGroup.Root ref={root} value={choice} onValueChange={pick} aria-label={t("Language")} className="-mx-2 flex flex-col">
        {LANGUAGES.map((l) => (
          <RadioGroup.Item key={l.value} value={l.value} className="state-layer focus-ring flex items-center gap-3 rounded-md px-2 py-1.5 text-left">
            <span aria-hidden="true" className="grid size-4 flex-none place-items-center rounded-full border-(length:--primitive-dimension-ring-width) border-muted-foreground">
              <RadioGroup.Indicator className="size-2 rounded-full bg-foreground" />
            </span>
            <span lang={l.lang}>{l.label()}</span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <p className="text-caption text-muted-foreground">{t("Follow system uses your browser's language.")}</p>
    </>
  )
}

function PlanRow({ s }: { s: State }) {
  const l = s.billing
  if (l.status === "loading")
    return (
      <Row label={t("Plan")}>
        <span className="skeleton h-4 w-48" />
      </Row>
    )
  if (l.status === "error")
    return (
      <Row label={t("Plan")}>
        <p className="text-muted-foreground">{l.error.message}</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => retry("billing")}>
            {t("Try again")}
          </Button>
        </div>
      </Row>
    )
  const b = l.data
  if (!b.enabled) return null
  const viaAppStore = b.access.state === "paid" && b.subscription?.provider === "apple"
  return (
    <Row label={t("Plan")}>
      {b.mode === "test" && !viaAppStore && (
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <FlaskConical size={14} aria-hidden="true" className="mt-0.5 flex-none text-(--semantic-color-feedback-warning)" />
          {t("Test mode: checkout takes test card numbers and never charges.")}
        </p>
      )}
      {s.checkout && (
        <p role="status" className="text-caption text-muted-foreground">
          {s.checkout === "waiting" ? t("Confirming your payment…") : t("Payment received. Your plan will update here shortly.")}
        </p>
      )}
      <PlanDetails b={b} confirming={!!s.checkout} />
    </Row>
  )
}

export function AccountPane({ s }: { s: State }) {
  // Waffo sends the payer back to /account?checkout=done.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("checkout") !== "done") return
    history.replaceState(null, "", "/account")
    watchCheckout()
  }, [])
  useEffect(() => refreshList("devices"), [])
  const a = s.account
  if (!a) return null
  return (
    <>
      <PaneHeader back={<BackLink to="/chats" label={t("Back to chats")} />}>
        <h1 className="text-body-strong text-foreground">{t("Account")}</h1>
      </PaneHeader>
      <div className="scroll-pane min-h-0 flex-1 px-4 pb-6">
        <Row label={t("Picture")}>
          <PictureField s={s} />
        </Row>
        <Row label={t("Name")}>
          <NameField name={a.name} />
        </Row>
        <Row label={t("Email")}>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 wrap-anywhere">{a.email}</span>
            <ChangeEmail />
          </div>
        </Row>
        <Row label={t("Account ID")}>
          <div className="-ml-1.5">
            <CopyId id={String(a.id)} />
          </div>
          <p className="text-caption text-muted-foreground">{t("People add you as a contact with this ID.")}</p>
        </Row>
        <PlanRow s={s} />
        <Row label={t("Language")}>
          <LanguageField />
        </Row>
        <Row label={t("Computers")}>
          <ComputersField s={s} />
        </Row>
        <Row label={t("Blocked")}>
          <BlockedField s={s} />
        </Row>
        {a.admin && (
          <Row label={t("Admin")}>
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2">
                <ShieldCheck size={16} aria-hidden="true" className="text-muted-foreground" />
                {t("You're an Imbo admin.")}
              </p>
              <Button asChild variant="outline" size="sm">
                <a href="/admin" onClick={onLinkClick}>
                  {t("Open admin")}
                </a>
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">{t("Reports, users and the dashboard.")}</p>
          </Row>
        )}
        <div className="flex flex-wrap gap-2 border-t-(length:--semantic-layout-hairline) border-border pt-4">
          <Button variant="outline" onClick={() => signOut().catch((e) => toast.error(messageOf(e)))}>
            {t("Sign out")}
          </Button>
          <DeleteAccount id={a.id} />
        </div>
      </div>
    </>
  )
}
