import { useEffect } from "react"
import { LogOut, TriangleAlert, UserRound } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AppStage } from "@/components/Stage"
import { Wordmark } from "@/components/Wordmark"
import { Avatar, CopyId } from "@/components/bits"
import { messageOf } from "@/data/layer"
import { dataOf, pendingTotal, refreshList, signOut, unreadTotal, useStore, type State } from "@/data/store"
import { daysUntil, longDate } from "@/lib/format"
import { navigate, onLinkClick } from "@/lib/router"
import { BlocksPane, SafetyDialogs } from "./safety"
import { AccountPane, BackLink, ChatList, ChatPane, ContactList, ContactPane, GetStarted, NothingOpen, NotFound, PendingBadge, SessionList, SessionPane } from "./views"

export type Tab = "chats" | "sessions" | "contacts" | "account"

const goAccount = () => navigate("/account")

export function AccountMenu({ s }: { s: State }) {
  const a = s.account!
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="state-layer focus-ring flex-none rounded-full" aria-label="Account menu">
        <Avatar kind="person" label={a.name} src={a.avatar_url} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-body-strong">{a.name}</span>
          <span className="truncate text-caption text-muted-foreground">{a.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={goAccount}>
          <UserRound size={16} aria-hidden="true" />
          Account and plan
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut().catch((e) => toast.error(messageOf(e)))}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Plan status in the top bar (API-032): only what needs acting on or knowing. Nothing when billing is off or hasn't
 * started, or while a subscription renews normally; an inactive account gets the strip below.
 */
function PlanStatus({ s }: { s: State }) {
  const b = dataOf(s.billing)
  if (!b?.enabled) return null
  const sub = b.subscription
  const [text, action] =
    b.access.state === "trial"
      ? [<>Trial: <span className="tabular-nums">{daysUntil(b.trial_ends_at!)}</span> days left</>, "Subscribe"]
      : b.access.state === "paid" && sub?.status === "past_due"
        ? [<span className="text-(--semantic-color-feedback-warning)">Payment failed</span>, "Details"]
        : b.access.state === "paid"
          ? [
              sub?.status === "active"
                ? undefined
                : sub?.status === "scheduled_cancel" || sub?.status === "canceled"
                  ? `Ends ${longDate(sub.paid_until)}`
                  : `Paid until ${longDate(b.access.until!)}`,
              undefined,
            ]
          : [undefined, undefined]
  if (!text) return null
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-caption text-muted-foreground">{text}</span>
      {action && (
        <Button variant="outline" size="sm" onClick={goAccount}>
          {action}
        </Button>
      )}
    </span>
  )
}

function EndedStrip({ s }: { s: State }) {
  const b = dataOf(s.billing)
  if (!b?.enabled || b.access.state !== "expired") return null
  return (
    <div role="status" className="flex flex-none items-center gap-3 border-b-(length:--semantic-layout-hairline) border-border bg-muted px-4 py-2">
      <TriangleAlert size={16} aria-hidden="true" className="flex-none text-(--semantic-color-feedback-warning)" />
      <p className="min-w-0 flex-1 text-caption text-foreground">
        Inactive since {longDate(b.access.until!)}: your sessions can't send messages until you subscribe.
      </p>
      <Button size="sm" onClick={goAccount}>
        Subscribe
      </Button>
    </div>
  )
}

const TABS = [
  { id: "chats", label: "Chats" },
  { id: "sessions", label: "Sessions" },
  { id: "contacts", label: "Contacts" },
] as const

function Tabs({ s, tab }: { s: State; tab: Tab }) {
  const pending = pendingTotal(s)
  const unread = unreadTotal(s)
  return (
    <nav aria-label="Sections" className="flex flex-none border-b-(length:--semantic-layout-hairline) border-border px-2">
      {TABS.map((t) => (
        <a
          key={t.id}
          href={`/${t.id}`}
          onClick={onLinkClick}
          aria-current={tab === t.id ? "page" : undefined}
          className="state-layer focus-ring relative flex h-10 flex-1 items-center justify-center gap-1.5 text-label whitespace-nowrap text-muted-foreground aria-[current=page]:text-foreground aria-[current=page]:after:hidden"
        >
          {t.label}
          {t.id === "chats" && pending > 0 && <PendingBadge n={pending} small />}
          {t.id === "sessions" && unread > 0 && <PendingBadge n={unread} small sr={unread === 1 ? "new reply" : "new replies"} />}
          {tab === t.id && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-(--primitive-dimension-ring-width) rounded-full bg-primary" />}
        </a>
      ))}
    </nav>
  )
}

/** `missing`: an address that isn't one of the inbox's pages, shown as not found in the right pane. */
export function Inbox({ tab, item, missing }: { tab: Tab; item?: string; missing?: boolean }) {
  const s = useStore()
  useEffect(() => {
    if (tab === "sessions") refreshList("agents")
    if (tab === "contacts") refreshList("contacts")
  }, [tab])
  if (!s.account) return null
  const detail = !!item || tab === "account" || !!missing
  const listTab = tab === "account" ? "chats" : tab
  // Nothing in this tab's list yet: the right pane says how things get here.
  const list = dataOf<unknown[]>(listTab === "chats" ? s.conversations : listTab === "sessions" ? s.agents : s.contacts)

  return (
    <AppStage>
      <header className="flex h-12 flex-none items-center gap-3 border-b-(length:--semantic-layout-hairline) border-border pr-3 pl-4">
        <a href="/chats" onClick={onLinkClick} className="focus-ring flex-none rounded-sm" aria-label="Imbo, chats">
          <Wordmark />
        </a>
        <span className="flex min-w-0 flex-1 justify-end">
          <PlanStatus s={s} />
        </span>
        <AccountMenu s={s} />
      </header>
      <EndedStrip s={s} />
      <div className="grid min-h-0 flex-1 sm:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className={cn("flex min-h-0 flex-col sm:border-r-(length:--semantic-layout-hairline) sm:border-border", detail && "max-sm:hidden")}>
          <div className="flex flex-none items-center gap-2 px-4 py-2">
            <span className="text-caption text-muted-foreground">Your ID</span>
            <CopyId id={String(s.account.id)} />
          </div>
          <Tabs s={s} tab={tab} />
          <div className="nav-scroll min-h-0 flex-1">
            {listTab === "chats" && <ChatList s={s} open={item} />}
            {listTab === "sessions" && <SessionList s={s} open={item} />}
            {listTab === "contacts" && <ContactList s={s} open={item} />}
          </div>
        </aside>
        <main className={cn("flex min-h-0 min-w-0 flex-col", !detail && "max-sm:hidden")}>
          {missing ? (
            <NotFound back={<BackLink to="/chats" label="Back to chats" />} what="page" />
          ) : tab === "account" && item === "blocks" ? (
            <BlocksPane back={<BackLink to="/account" label="Back to account" />} />
          ) : tab === "account" ? (
            <AccountPane s={s} />
          ) : !item && list?.length === 0 ? (
            <GetStarted />
          ) : !item ? (
            <NothingOpen>
              {tab === "chats" ? "Pick a chat to read it." : tab === "sessions" ? "Pick a session to see what it sent and received." : "Pick a contact to see their sessions."}
            </NothingOpen>
          ) : tab === "chats" ? (
            <ChatPane key={item} s={s} id={item} />
          ) : tab === "sessions" ? (
            <SessionPane key={item} s={s} id={item} />
          ) : (
            <ContactPane key={item} s={s} id={item} />
          )}
        </main>
      </div>
      <SafetyDialogs s={s} />
    </AppStage>
  )
}
