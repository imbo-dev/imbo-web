import { useState, type ReactNode } from "react"
import { ArrowLeft, Bot, ExternalLink, FlaskConical, Lock, MessageSquare, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Avatar, Command, CopyId, Presence, Sep, Tag } from "@/components/bits"
import type { Billing, MyAgent } from "@/data/contract"
import {
  PRICES,
  agentMessages,
  billingOf,
  contacts,
  conversationOf,
  conversationTitle,
  conversationWith,
  conversations,
  isMe,
  messagesOf,
  myAgents,
  pendingRequests,
  signOut,
  type State,
} from "@/data/store"
import { daysUntil, langOf, longDate, shortWhen, toolName } from "@/lib/format"
import { navigate, onLinkClick } from "@/lib/router"
import { MessageList, PaneHeader } from "./messages"
import { EmptyState, ErrorState, ListSkeleton, ThreadSkeleton } from "./states"

const INSTALL = "curl -fsSL https://imbo.dev/install | sh"

function BackLink({ to, label }: { to: string; label: string }) {
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

/** API-030 `pending`: sent to me, not yet picked up by a session nor read in a terminal. Looking here changes nothing. */
export function PendingBadge({ n, small, labelled }: { n: number; small?: boolean; labelled?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full bg-(--semantic-color-signal-unread) px-1 text-caption leading-none font-bold tabular-nums text-(--semantic-color-signal-on-unread)",
        small ? "h-4 min-w-4" : "h-5 min-w-5"
      )}
    >
      {n}
      {!labelled && <span className="sr-only"> waiting for delivery</span>}
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
  if (s.status === "loading") return <ListSkeleton />
  if (s.status === "error") return <ErrorState what="chats" />
  if (s.status === "empty")
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
      {conversations(s).map((c) => {
        const title = conversationTitle(c)
        const last = c.last_message
        const who = !last ? "" : isMe(s, last.from.account_id) ? "You" : c.kind === "group" ? last.from.name : (last.from.agent?.title ?? "Terminal")
        return (
          <ListRow key={c.id} href={`/chats/${c.id}`} current={String(c.id) === open}>
            <Avatar kind={c.kind === "group" ? "group" : "person"} label={title} />
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
  const back = <BackLink to="/chats" label="Back to chats" />
  const early = paneState(s, back, "chat")
  if (early) return early
  const c = conversationOf(s, Number(id))
  if (!c || s.status !== "ready") return <NotFound back={back} what="chat" />

  const title = conversationTitle(c)
  const peer = c.peer && contacts().find((p) => p.id === c.peer?.id)
  return (
    <>
      <PaneHeader back={back}>
        <Avatar kind={c.group ? "group" : "person"} label={title} />
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
              <span className="tabular-nums">#{c.group.id}</span>
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
      <MessageList s={s} messages={messagesOf(s, c.id)} resetKey={id} label={`Messages with ${title}`} />
      <ReadOnlyNote />
    </>
  )
}

function ReadOnlyNote() {
  return (
    <p className="flex flex-none items-center gap-2 border-t-(length:--semantic-layout-hairline) border-border px-4 py-3 text-caption text-muted-foreground">
      <Lock size={14} aria-hidden="true" className="flex-none" />
      <span className="text-pretty">
        Read-only on the web. Your sessions reply on their own, or send from a terminal with{" "}
        <code className="font-(family-name:--semantic-typography-code-font-family) text-foreground">imbo send</code>.
      </span>
    </p>
  )
}

function NotFound({ back, what }: { back: ReactNode; what: string }) {
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

/** Loading and failed states every detail pane shares; null when the data is there to render. */
function paneState(s: State, back: ReactNode, what: string, body: ReactNode = <ThreadSkeleton />) {
  if (s.status === "loading")
    return (
      <>
        <PaneHeader back={back}>
          <span className="skeleton h-4 w-40" />
        </PaneHeader>
        {body}
      </>
    )
  // The header only carries the back link here, which phones need and wide screens don't show.
  if (s.status === "error")
    return (
      <>
        <div className="sm:hidden">
          <PaneHeader back={back}>
            <span />
          </PaneHeader>
        </div>
        <div className="grid flex-1 place-items-center">
          <ErrorState what={`this ${what}`} />
        </div>
      </>
    )
  return null
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
  if (s.status === "loading") return <ListSkeleton rows={4} />
  if (s.status === "error") return <ErrorState what="sessions" />
  if (s.status === "empty")
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
      {myAgents().map((x) => (
        <ListRow key={x.id} href={`/sessions/${x.id}`} current={x.id === open}>
          <Avatar kind="agent" />
          <span className="col-span-2 min-w-0">
            <span className="block truncate text-body">{x.title}</span>
            <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
              <Presence s={x} plain />
              <Sep />
              <span className="truncate">{toolName(x.tool)}</span>
            </span>
          </span>
        </ListRow>
      ))}
    </nav>
  )
}

export function SessionPane({ s, id }: { s: State; id: string }) {
  const back = <BackLink to="/sessions" label="Back to sessions" />
  const early = paneState(s, back, "session")
  if (early) return early
  const x = myAgents().find((a) => a.id === id)
  if (!x || s.status !== "ready") return <NotFound back={back} what="session" />
  const log = agentMessages(s, id)
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
      {log.length ? (
        <MessageList s={s} messages={log} resetKey={id} label={`Messages sent and received by ${x.title}`} />
      ) : (
        <div className="flex-1">
          <EmptyState icon={<MessageSquare size={24} />} title="Nothing sent or received yet" />
        </div>
      )}
      <ReadOnlyNote />
    </>
  )
}

// ── Contacts ─────────────────────────────────────────────────────────────────

function PendingRequests() {
  const n = pendingRequests()
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
  if (s.status === "loading") return <ListSkeleton rows={3} />
  if (s.status === "error") return <ErrorState what="contacts" />
  if (s.status === "empty")
    return (
      <EmptyState icon={<Users size={24} />} title="No contacts yet">
        <p>Ask someone for their 8-digit account ID, then add them from a terminal:</p>
        <Command text="imbo contact add <ID>" />
      </EmptyState>
    )
  return (
    <>
      <PendingRequests />
      <nav aria-label="Contacts" className="flex flex-col gap-0.5 p-2">
        {contacts().map((p) => {
          const online = p.sessions.filter((x) => x.online).length
          return (
            <ListRow key={p.id} href={`/contacts/${p.id}`} current={String(p.id) === open}>
              <Avatar kind="person" label={p.name} />
              <span className="min-w-0">
                <span className="block truncate text-body">{p.name}</span>
                <span className="block text-caption tabular-nums text-muted-foreground">ID {p.id}</span>
              </span>
              {p.active ? (
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
  const early = paneState(s, back, "contact", <ListSkeleton rows={3} />)
  if (early) return early
  const p = contacts().find((c) => String(c.id) === id)
  if (!p || s.status !== "ready") return <NotFound back={back} what="contact" />
  const chat = conversationWith(p.id)
  return (
    <>
      <PaneHeader
        back={back}
        end={
          chat && (
            <Button asChild variant="outline" size="sm">
              <a href={`/chats/${chat}`} onClick={onLinkClick}>
                <MessageSquare size={14} aria-hidden="true" />
                Open chat
              </a>
            </Button>
          )
        }
      >
        <Avatar kind="person" label={p.name} />
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 text-body-strong text-foreground">
            <span className="truncate">{p.name}</span>
            {!p.active && <Tag>Inactive</Tag>}
          </h1>
          <div className="-ml-1.5">
            <CopyId id={String(p.id)} label={`Copy ${p.name}'s account ID`} />
          </div>
        </div>
      </PaneHeader>
      <section aria-labelledby="contact-sessions" className="scroll-pane min-h-0 flex-1 p-4">
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

type Cycle = "monthly" | "yearly"

/** Both buttons stay unavailable from the click until checkout opens or fails (docs/DESIGN.md「网页的界面状态」). */
function Subscribe() {
  const [opening, setOpening] = useState<Cycle>()
  const checkout = (cycle: Cycle) => {
    if (opening) return
    setOpening(cycle)
    setTimeout(() => {
      setOpening(undefined)
      toast(`Demo: this opens Creem checkout for ${cycle === "monthly" ? `${PRICES.monthly} a month` : `${PRICES.yearly} a year`}.`)
    }, 800)
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button aria-disabled={!!opening} onClick={() => checkout("yearly")}>
          {opening === "yearly" ? "Opening checkout…" : `${PRICES.yearly} a year`}
        </Button>
        <Button variant="outline" aria-disabled={!!opening} onClick={() => checkout("monthly")}>
          {opening === "monthly" ? "Opening checkout…" : `${PRICES.monthly} a month`}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">Tax is added at checkout. Cancel any time.</p>
    </div>
  )
}

function ManageSubscription({ note }: { note: string }) {
  return (
    <>
      <div>
        <Button variant="outline" onClick={() => toast("Demo: this opens the Creem customer portal.")}>
          Manage subscription
          <ExternalLink size={14} aria-hidden="true" />
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">{note}</p>
    </>
  )
}

const cycleName = (plan: string) => (plan === "monthly" ? "Monthly" : plan === "yearly" ? "Yearly" : plan)

/** The Plan row, one branch per API-032 state. */
function PlanDetails({ b }: { b: Billing }) {
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
          <Subscribe />
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
          <Subscribe />
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

export function AccountPane({ s }: { s: State }) {
  const a = s.account
  if (!a) return null
  const b = billingOf(s)
  const n = pendingRequests()
  return (
    <>
      <PaneHeader back={<BackLink to="/chats" label="Back to chats" />}>
        <h1 className="text-body-strong text-foreground">Account</h1>
      </PaneHeader>
      <div className="scroll-pane min-h-0 flex-1 px-4 pb-6">
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
        {b.enabled && (
          <Row label="Plan">
            {b.mode === "test" && (
              <p className="flex items-start gap-2 text-caption text-muted-foreground">
                <FlaskConical size={14} aria-hidden="true" className="mt-0.5 flex-none text-(--semantic-color-feedback-warning)" />
                Test mode: checkout takes test card numbers and never charges.
              </p>
            )}
            <PlanDetails b={b} />
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
          <Button
            variant="outline"
            onClick={() => {
              signOut()
              navigate("/login", { replace: true })
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </>
  )
}
