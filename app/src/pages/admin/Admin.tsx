import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, Ban, CreditCard, Flag, LogOut, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { AppStage } from "@/components/Stage"
import { Wordmark } from "@/components/Wordmark"
import { Tag } from "@/components/bits"
import type { AdminAccount, ReportParty } from "@/data/contract"
import { ApiError, messageOf } from "@/data/layer"
import { admin, useStore } from "@/data/store"
import { onLinkClick } from "@/lib/router"
import { AccountMenu, Inbox } from "@/pages/inbox/Shell"
import { Dashboard } from "./Dashboard"
import { Reports } from "./Reports"
import { Users } from "./Users"

// PAGE-WEB-ADMIN: reports, users and the dashboard, for ROLE-Admin only. The server answers 404 to anyone else, and
// so does this page: it shows the inbox's "not here" instead.

export type AdminTab = "reports" | "users" | "dashboard"

const TABS: { id: AdminTab; label: string; href: string }[] = [
  { id: "reports", label: "Reports", href: "/admin" },
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
]

/** What the admin pages share: the open-report count in the Reports tab, asked again after anything that changes it. */
export type AdminContext = { recount: () => void }

export function Admin({ tab }: { tab: AdminTab }) {
  const s = useStore()
  const [open, setOpen] = useState<number>()
  const [missing, setMissing] = useState(false)
  const recount = useCallback(async () => {
    try {
      setOpen((await admin.reports("open", 1)).total)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true)
    }
  }, [])
  useEffect(() => void recount(), [recount])
  if (missing) return <Inbox tab="chats" missing />
  if (!s.account) return null
  return (
    <AppStage wide>
      <header className="flex flex-none flex-wrap items-center gap-x-4 border-b-(length:--semantic-layout-hairline) border-border px-4 sm:h-12">
        <a href="/chats" onClick={onLinkClick} className="focus-ring flex-none rounded-sm max-sm:py-2.5" aria-label="Imbo, chats">
          <Wordmark />
        </a>
        <Tag>Admin</Tag>
        <nav aria-label="Admin sections" className="flex items-center gap-1 sm:h-full max-sm:order-last max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:border-t-(length:--semantic-layout-hairline) max-sm:border-border max-sm:px-2 max-sm:py-1.5">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={t.href}
              onClick={onLinkClick}
              aria-current={tab === t.id ? "page" : undefined}
              className="state-layer focus-ring flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-label whitespace-nowrap text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground max-sm:flex-1"
            >
              {t.label}
              {t.id === "reports" && !!open && (
                <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-caption leading-none tabular-nums text-foreground">
                  {open}
                  <span className="sr-only"> open</span>
                </span>
              )}
            </a>
          ))}
        </nav>
        <span className="flex-1" />
        <Button asChild variant="ghost" size="sm" className="text-foreground">
          <a href="/chats" onClick={onLinkClick} aria-label="Back to chats">
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="max-sm:hidden">Back to chats</span>
          </a>
        </Button>
        <AccountMenu s={s} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "reports" ? <Reports recount={recount} /> : tab === "users" ? <Users recount={recount} /> : <Dashboard />}
      </div>
    </AppStage>
  )
}

/** A deleted account has no name left (API-063 sends it empty). */
export const nameOf = (p: { name: string }) => p.name || "Deleted account"

export const BannedTag = ({ on }: { on?: string }) => (
  <Tag tone="warn">
    <Ban size={12} aria-hidden="true" />
    {on ? `Banned ${on}` : "Banned"}
  </Tag>
)

/** Red text above a dialog's or a bar's buttons when the server refused. */
export function Refusal({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-caption text-destructive">
      {children}
    </p>
  )
}

function Consequence({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-body text-foreground">
      <span aria-hidden="true" className="mt-1 flex-none text-muted-foreground">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}

/**
 * FLOW-BAN S2: what a ban does (API-066), then Ban or Cancel; focus starts on Cancel. `ban` runs it (API-064 `ban` from
 * a report, API-066 from Users) and throws ApiError, shown above the buttons.
 */
export function BanDialog({ who, ban, onDone }: { who: ReportParty | AdminAccount; ban: () => Promise<void>; onDone: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const name = nameOf(who)
  const go = async () => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await ban()
      onDone()
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <DialogContent
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        cancel.current?.focus()
      }}
    >
      <DialogTitle>Ban {name}?</DialogTitle>
      <p className="text-body text-muted-foreground">This takes effect right away and {name} isn't told first.</p>
      <ul className="flex flex-col gap-3">
        <Consequence icon={<LogOut size={16} />}>Signs {name} out on every computer, browser and phone. Their sessions stop sending.</Consequence>
        <Consequence icon={<Undo2 size={16} />}>Takes back undelivered messages to and from {name}, and closes their pending requests and invites.</Consequence>
        <Consequence icon={<CreditCard size={16} />}>Cancels {name}'s subscription on Waffo. Payments already made aren't refunded.</Consequence>
        <Consequence icon={<Flag size={16} />}>Closes {name}'s other open reports.</Consequence>
      </ul>
      <p className="text-caption text-muted-foreground">You can unban {name} later in Users. Sign-ins and the subscription don't come back.</p>
      <Refusal>{error}</Refusal>
      <DialogFooter>
        <Button ref={cancel} variant="ghost" className="text-foreground" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="destructive" aria-disabled={busy} onClick={go}>
          <Ban size={16} aria-hidden="true" />
          {busy ? "Banning…" : `Ban ${name}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** API-066 again on a banned account only retries canceling the subscription (FLOW-BAN S4). */
export async function retryCancel(id: number) {
  return (await admin.ban(id)).subscription_canceled
}
