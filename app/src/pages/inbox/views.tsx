import { useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, Bot, ExternalLink, FlaskConical, MessageSquare, ShieldCheck, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Avatar, Command, CopyId, Presence, Sep, Tag } from "@/components/bits"
import type { Billing, Conversation, MyAgent } from "@/data/contract"
import { messageOf, type Plan } from "@/data/layer"
import {
  PRICES,
  addressOf,
  checkout,
  chosenSession,
  contactOf,
  conversationOf,
  conversationTitle,
  conversationWith,
  dataOf,
  isBlocked,
  isMe,
  loadThread,
  openThread,
  portalUrl,
  retry,
  signOut,
  watchCheckout,
  type Load,
  type State,
  type ThreadKey,
} from "@/data/store"
import { daysUntil, langOf, longDate, shortWhen, toolName } from "@/lib/format"
import { onLinkClick } from "@/lib/router"
import { Composer, RecipientPicker, SendingClosed } from "./composer"
import { MessageList, PaneHeader } from "./messages"
import { BlockedField, BlockedNote, BlockedTag, GroupMembers, PeerMenu, PictureField, unblockNow } from "./safety"
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
export function PendingBadge({ n, small, labelled, sr = "waiting for delivery" }: { n: number; small?: boolean; labelled?: boolean; sr?: string }) {
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
        <h2 className="text-heading3 text-foreground">Connect your first computer</h2>
        <p className="text-body text-muted-foreground">
          Run this in a terminal and sign in with the same email. The agent sessions on that computer join Imbo, and their messages show up here.
        </p>
        <Command text={INSTALL} />
        <p className="text-caption text-muted-foreground">To message someone, add each other by account ID.</p>
      </div>
    </div>
  )
}

// ── Chats ────────────────────────────────────────────────────────────────────

export function ChatList({ s, open }: { s: State; open?: string }) {
  const l = s.conversations
  if (l.status === "loading") return <ListSkeleton />
  if (l.status === "error") return <ErrorState what="chats" error={l.error} onRetry={() => retry("conversations")} />
  if (!l.data.length)
    return (
      <EmptyState icon={<MessageSquare size={24} />} title="No chats yet">
        <p>Chats show up here when your sessions message a contact, or a contact's sessions message yours.</p>
        <div className="sm:hidden">
          <Command text={INSTALL} />
        </div>
      </EmptyState>
    )
  return (
    <nav aria-label="Chats" className="flex flex-col gap-0.5 p-2">
      {l.data.map((c) => {
        const title = conversationTitle(c)
        const last = c.last_message
        const who = !last ? "" : isMe(s, last.from.account_id) ? "You" : c.kind === "group" ? last.from.name : (last.from.agent?.title ?? "Terminal")
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
  )
}

export function ChatPane({ s, id }: { s: State; id: string }) {
  const key: ThreadKey = `c:${Number(id)}`
  useEffect(() => {
    if (/^\d+$/.test(id)) return openThread(key)
  }, [id, key])
  const back = <BackLink to="/chats" label="Back to chats" />
  const early = paneState(s.conversations, back, "chat", () => retry("conversations"))
  if (early) return early
  const c = conversationOf(s, Number(id))
  if (!c) return <NotFound back={back} what="chat" />

  const title = conversationTitle(c)
  const peer = c.peer && contactOf(s, c.peer.id)
  // I blocked them: nothing to pick a recipient for (FLOW-BLOCK S5).
  const blocked = !!c.peer && isBlocked(s, c.peer.id)
  const header = (end: ReactNode, count?: ReactNode) => (
      <PaneHeader back={back} end={end}>
        <Avatar kind={c.group ? "group" : "person"} label={title} src={(c.group ?? c.peer)?.avatar_url} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-body-strong text-foreground">{title}</h1>
            {c.pending > 0 && (
              <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
                <PendingBadge n={c.pending} small labelled />
                <span className="truncate">waiting for delivery</span>
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
                  ID {c.peer.id}
                </a>
                {peer && (
                  <>
                    <Sep />
                    {peer.sessions.filter((x) => x.online).length} of {peer.sessions.length} sessions online
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
      {c.group ? (
        <GroupMembers s={s} c={c}>
          {({ stack, count }) => header(stack, count)}
        </GroupMembers>
      ) : (
        header(
          c.peer && (
            <span className="flex flex-none items-center gap-1">
              {peer?.active && !blocked && <RecipientPicker s={s} c={c} />}
              <PeerMenu s={s} who={c.peer} />
            </span>
          )
        )
      )}
      <ThreadBody s={s} id={key} label={`Messages with ${title}`} />
      <ChatComposer s={s} c={c} title={title} />
    </>
  )
}

/** Why this account can't send right now (RULE-008), or undefined when it can. */
function sendingPaused(s: State) {
  const b = dataOf(s.billing)
  return b?.enabled && b.access.state === "expired" ? "Sending is paused until you subscribe." : undefined
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
            Unblock
          </Button>
        }
      >
        You blocked {title}. Unblock {title} to send messages.
      </SendingClosed>
    )
  const paused = sendingPaused(s)
  if (paused) return <SendingClosed>{paused}</SendingClosed>
  if (c.kind === "group") return <Composer key={key} threadKey={key} to={addressOf(s, c)} label={title} />
  const contacts = dataOf(s.contacts)
  const peer = contactOf(s, c.peer!.id)
  if (contacts && !peer) return <SendingClosed>{title} is no longer your contact, so messages can't be sent here.</SendingClosed>
  if (peer && !peer.active) return <SendingClosed>{title}'s account is inactive, so messages can't reach them.</SendingClosed>
  const x = chosenSession(s, c)
  return (
    <Composer
      key={key}
      threadKey={key}
      to={addressOf(s, c)}
      label={x ? `${title} ${x.title}` : `${title}'s inbox`}
      note={x && !x.online ? `${x.title} is offline. It gets your message when it comes back online.` : undefined}
    />
  )
}

export function NotFound({ back, what }: { back: ReactNode; what: string }) {
  return (
    <>
      <PaneHeader back={back}>
        <span />
      </PaneHeader>
      <EmptyState icon={<MessageSquare size={24} />} title={`This ${what} isn't here`}>
        <p>It may belong to another account, or the link is incomplete.</p>
      </EmptyState>
    </>
  )
}

/** Loading and failed states every detail pane shares while its list loads; null when the list is there. */
function paneState(l: Load<unknown>, back: ReactNode, what: string, onRetry: () => void, body: ReactNode = <ThreadSkeleton />) {
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
          <ErrorState what={`this ${what}`} error={l.error} onRetry={onRetry} />
        </div>
      </>
    )
  return null
}

/** The messages of a chat or session under its header: skeleton, failure with retry, `empty`, or the list. */
function ThreadBody({ s, id, label, empty }: { s: State; id: ThreadKey; label: string; empty?: ReactNode }) {
  const t = s.threads[id]
  if (!t || t.status === "loading") return <ThreadSkeleton />
  if (t.status === "error")
    return (
      <div className="grid flex-1 place-items-center">
        <ErrorState what="the messages" error={t.error} onRetry={() => loadThread(id)} />
      </div>
    )
  if (!t.data.messages.length && !s.outbox[id]?.length && empty) return empty
  return <MessageList s={s} id={id} thread={t.data} label={label} />
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
  if (l.status === "error") return <ErrorState what="sessions" error={l.error} onRetry={() => retry("agents")} />
  if (!l.data.length)
    return (
      <EmptyState icon={<Bot size={24} />} title="No sessions yet">
        <p>After you install Imbo, every Claude Code, Codex, opencode, Cursor, MiniMax Code or ZCode session on that computer shows up here.</p>
        <div className="sm:hidden">
          <Command text={INSTALL} />
        </div>
      </EmptyState>
    )
  return (
    <nav aria-label="My sessions" className="flex flex-col gap-0.5 p-2">
      {l.data.map((x) => (
        <ListRow key={x.id} href={`/sessions/${x.id}`} current={x.id === open}>
          <Avatar kind="agent" />
          <span className="min-w-0">
            <span className="block truncate text-body">{x.title}</span>
            <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
              <Presence s={x} plain />
              <Sep />
              <span className="truncate">{toolName(x.tool)}</span>
            </span>
          </span>
          {x.unread > 0 && <PendingBadge n={x.unread} sr={x.unread === 1 ? "new reply" : "new replies"} />}
        </ListRow>
      ))}
    </nav>
  )
}

export function SessionPane({ s, id }: { s: State; id: string }) {
  const key: ThreadKey = `a:${id}`
  useEffect(() => openThread(key), [key])
  const back = <BackLink to="/sessions" label="Back to sessions" />
  const early = paneState(s.agents, back, "session", () => retry("agents"))
  if (early) return early
  const x = dataOf(s.agents)?.find((a) => a.id === id)
  if (!x) return <NotFound back={back} what="session" />
  const paused = sendingPaused(s)
  return (
    <>
      <PaneHeader back={back} end={<Presence s={x} />}>
        <Avatar kind="agent" />
        <div className="min-w-0">
          <h1 className="truncate text-body-strong text-foreground">{x.title}</h1>
          <p className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
            <ToolLine x={x} />
            <Sep />
            <span className="font-(family-name:--semantic-typography-code-font-family)">{x.short_id}</span>
          </p>
        </div>
      </PaneHeader>
      <ThreadBody
        s={s}
        id={key}
        label={`Messages sent and received by ${x.title}`}
        empty={
          <div className="flex-1">
            <EmptyState icon={<MessageSquare size={24} />} title="Nothing sent or received yet" />
          </div>
        }
      />
      {s.threads[key]?.status === "ready" &&
        (paused ? (
          <SendingClosed>{paused}</SendingClosed>
        ) : (
          <Composer
            key={key}
            threadKey={key}
            to=""
            label={x.title}
            note={!x.online ? `${x.title} is offline. It gets your message when it comes back online.` : undefined}
          />
        ))}
    </>
  )
}

// ── Contacts ─────────────────────────────────────────────────────────────────

/** API-009, count only: requests are answered in a terminal. */
function PendingRequests({ n }: { n: number }) {
  if (!n) return null
  return (
    <div className="mx-2 mt-2 flex gap-3 rounded-md border-(length:--semantic-layout-hairline) border-border px-2 py-2">
      <UserPlus size={16} aria-hidden="true" className="mt-0.5 flex-none text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-body text-foreground">
          {n} contact {n === 1 ? "request" : "requests"} waiting
        </p>
        <p className="text-caption text-muted-foreground">
          Answer in a terminal:{" "}
          <code className="font-(family-name:--semantic-typography-code-font-family) text-foreground">imbo contact requests</code>
        </p>
      </div>
    </div>
  )
}

export function ContactList({ s, open }: { s: State; open?: string }) {
  const l = s.contacts
  if (l.status === "loading") return <ListSkeleton rows={3} />
  if (l.status === "error") return <ErrorState what="contacts" error={l.error} onRetry={() => retry("contacts")} />
  if (!l.data.length)
    return (
      <EmptyState icon={<Users size={24} />} title="No contacts yet">
        <p>Ask someone for their 8-digit account ID, then add them from a terminal:</p>
        <Command text="imbo contact add <ID>" />
      </EmptyState>
    )
  return (
    <>
      <PendingRequests n={s.requests} />
      <nav aria-label="Contacts" className="flex flex-col gap-0.5 p-2">
        {l.data.map((p) => {
          const online = p.sessions.filter((x) => x.online).length
          return (
            <ListRow key={p.id} href={`/contacts/${p.id}`} current={String(p.id) === open}>
              <Avatar kind="person" label={p.name} src={p.avatar_url} />
              <span className="min-w-0">
                <span className="block truncate text-body">{p.name}</span>
                <span className="block text-caption tabular-nums text-muted-foreground">ID {p.id}</span>
              </span>
              {isBlocked(s, p.id) ? (
                <BlockedTag />
              ) : p.active ? (
                <span className="text-caption whitespace-nowrap text-(--semantic-color-text-tertiary)">{online ? `${online} online` : "Offline"}</span>
              ) : (
                <Tag>Inactive</Tag>
              )}
            </ListRow>
          )
        })}
      </nav>
    </>
  )
}

export function ContactPane({ s, id }: { s: State; id: string }) {
  const back = <BackLink to="/contacts" label="Back to contacts" />
  const early = paneState(s.contacts, back, "contact", () => retry("contacts"), <ListSkeleton rows={3} />)
  if (early) return early
  const p = dataOf(s.contacts)?.find((c) => String(c.id) === id)
  if (!p) return <NotFound back={back} what="contact" />
  const chat = conversationWith(s, p.id)
  const blocked = isBlocked(s, p.id)
  return (
    <>
      <PaneHeader
        back={back}
        end={
          <span className="flex flex-none items-center gap-1">
            {chat && (
              <Button asChild variant="outline" size="sm">
                <a href={`/chats/${chat}`} onClick={onLinkClick}>
                  <MessageSquare size={14} aria-hidden="true" />
                  Open chat
                </a>
              </Button>
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
            {!p.active && <Tag>Inactive</Tag>}
          </h1>
          <div className="-ml-1.5">
            <CopyId id={String(p.id)} label={`Copy ${p.name}'s account ID`} />
          </div>
        </div>
      </PaneHeader>
      <section aria-labelledby="contact-sessions" className="scroll-pane min-h-0 flex-1 p-4">
        {blocked && <BlockedNote who={p} />}
        <h2 id="contact-sessions" className="mb-2 text-label text-muted-foreground">
          Sessions
        </h2>
        {!p.active && <p className="mb-3 text-caption text-muted-foreground">{p.name}'s account is inactive, so their sessions can't send messages.</p>}
        {p.sessions.length ? (
          <ul className="flex flex-col">
            {p.sessions.map((x) => (
              <li key={x.short_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t-(length:--semantic-layout-hairline) border-border py-3">
                <Avatar kind="agent" />
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
          <p className="text-body text-(--semantic-color-text-tertiary)">No sessions online in the last 7 days.</p>
        )}
      </section>
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
          {opening === "yearly" ? "Opening checkout…" : `${PRICES.yearly} a year`}
        </Button>
        <Button variant="outline" aria-disabled={!!opening} onClick={() => go("monthly")}>
          {opening === "monthly" ? "Opening checkout…" : `${PRICES.monthly} a month`}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">Tax is added at checkout. Cancel any time.</p>
    </div>
  )
}

/** Creem's customer page opens in a new tab (API-034). */
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
          {opening ? "Opening…" : "Manage subscription"}
          <ExternalLink size={14} aria-hidden="true" />
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">{note}</p>
    </>
  )
}

const cycleName = (plan: string) => (plan === "monthly" ? "Monthly" : plan === "yearly" ? "Yearly" : plan)

/** The Plan row, one branch per API-032 state. `confirming`: back from checkout, waiting for the payment notice. */
function PlanDetails({ b, confirming }: { b: Billing; confirming: boolean }) {
  const sub = b.subscription
  switch (b.access.state) {
    case "free":
      return <p>Free while billing hasn't started.</p>
    case "trial":
      return (
        <>
          <p>
            Free trial, <span className="tabular-nums">{daysUntil(b.trial_ends_at!)}</span> days left
          </p>
          <p className="text-caption text-muted-foreground">Subscribing starts the paid plan right away. Trial days left don't carry over.</p>
          {!confirming && <Subscribe />}
        </>
      )
    case "paid":
      if (!sub) return <p>Paid until {longDate(b.access.until!)}</p>
      if (sub.status === "past_due")
        return (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Tag tone="warn">Payment failed</Tag>
              {cycleName(sub.plan)}
            </p>
            <p className="text-caption text-muted-foreground">Creem is retrying the charge.</p>
            <ManageSubscription note="Change your card in Manage subscription." />
          </>
        )
      if (sub.status === "scheduled_cancel" || sub.status === "canceled")
        return (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Tag>Won't renew</Tag>
              {cycleName(sub.plan)}, ends {longDate(sub.paid_until)}
            </p>
            <ManageSubscription note="Renew, change your card or download invoices on Creem." />
          </>
        )
      if (sub.status === "active")
        return (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Tag tone="ok">Subscribed</Tag>
              {cycleName(sub.plan)}, renews {longDate(sub.paid_until)}
            </p>
            <ManageSubscription note="Cancel, change your card or download invoices on Creem." />
          </>
        )
      // A status this app doesn't know is shown as Creem sent it; access.state already says the plan is paid.
      return (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Tag>{sub.status}</Tag>
            {cycleName(sub.plan)}, paid until {longDate(sub.paid_until)}
          </p>
          <ManageSubscription note="Details are on Creem." />
        </>
      )
    case "expired":
      return (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Tag tone="warn">Inactive</Tag>
            Since {longDate(b.access.until!)}
          </p>
          <p className="text-caption text-muted-foreground">Your sessions can't send messages until you subscribe. You can still read history and download files.</p>
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

function PlanRow({ s }: { s: State }) {
  const l = s.billing
  if (l.status === "loading")
    return (
      <Row label="Plan">
        <span className="skeleton h-4 w-48" />
      </Row>
    )
  if (l.status === "error")
    return (
      <Row label="Plan">
        <p className="text-muted-foreground">{l.error.message}</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => retry("billing")}>
            Try again
          </Button>
        </div>
      </Row>
    )
  const b = l.data
  if (!b.enabled) return null
  return (
    <Row label="Plan">
      {b.mode === "test" && (
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <FlaskConical size={14} aria-hidden="true" className="mt-0.5 flex-none text-(--semantic-color-feedback-warning)" />
          Test mode: checkout takes test card numbers and never charges.
        </p>
      )}
      {s.checkout && (
        <p role="status" className="text-caption text-muted-foreground">
          {s.checkout === "waiting" ? "Confirming your payment…" : "Payment received. Your plan will update here shortly."}
        </p>
      )}
      <PlanDetails b={b} confirming={!!s.checkout} />
    </Row>
  )
}

export function AccountPane({ s }: { s: State }) {
  // Creem sends the payer back to /account?checkout=done.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("checkout") !== "done") return
    history.replaceState(null, "", "/account")
    watchCheckout()
  }, [])
  const a = s.account
  if (!a) return null
  const n = s.requests
  return (
    <>
      <PaneHeader back={<BackLink to="/chats" label="Back to chats" />}>
        <h1 className="text-body-strong text-foreground">Account</h1>
      </PaneHeader>
      <div className="scroll-pane min-h-0 flex-1 px-4 pb-6">
        <Row label="Picture">
          <PictureField s={s} />
        </Row>
        <Row label="Name">{a.name}</Row>
        <Row label="Email">
          <span className="wrap-anywhere">{a.email}</span>
        </Row>
        <Row label="Account ID">
          <div className="-ml-1.5">
            <CopyId id={String(a.id)} />
          </div>
          <p className="text-caption text-muted-foreground">People add you as a contact with this ID.</p>
        </Row>
        <PlanRow s={s} />
        <Row label="Blocked">
          <BlockedField s={s} />
        </Row>
        {a.admin && (
          <Row label="Admin">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2">
                <ShieldCheck size={16} aria-hidden="true" className="text-muted-foreground" />
                You're an Imbo admin.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href="/admin" onClick={onLinkClick}>
                  Open admin
                </a>
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">Reports, users and the dashboard.</p>
          </Row>
        )}
        {n > 0 && (
          <Row label="Requests">
            <p>
              {n} contact {n === 1 ? "request" : "requests"} waiting
            </p>
            <p className="text-caption text-muted-foreground">
              Answer in a terminal:{" "}
              <code className="font-(family-name:--semantic-typography-code-font-family) text-foreground">imbo contact requests</code>
            </p>
          </Row>
        )}
        <div className="border-t-(length:--semantic-layout-hairline) border-border pt-4">
          <Button variant="outline" onClick={() => signOut().catch((e) => toast.error(messageOf(e)))}>
            Sign out
          </Button>
        </div>
      </div>
    </>
  )
}
