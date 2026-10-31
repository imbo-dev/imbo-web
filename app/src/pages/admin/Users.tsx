import { useCallback, useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { RotateCw, Search, Trash2, TriangleAlert, Users as UsersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Avatar, Tag } from "@/components/bits"
import type { AdminAccount, AdminAccountsPage } from "@/data/contract"
import { ApiError, messageOf } from "@/data/layer"
import { admin, type Load } from "@/data/store"
import { clock, daysUntil, sameDay, shortDate } from "@/lib/format"
import { navigate, useQuery } from "@/lib/router"
import { EmptyState, ErrorState, ListSkeleton } from "@/pages/inbox/states"
import { BanDialog, BannedTag, Refusal, appStoreNote, nameOf, retryCancel } from "./Admin"
import { Pager } from "./Reports"

// The Users tab of PAGE-WEB-ADMIN (API-065, FLOW-BAN S2, S5, S7): every account, newest first, 50 a page, searchable by
// account ID or email; ban, unban, retry a subscription cancel that didn't go through, and delete a banned account.

/** A subscription that would still charge: a ban cancels it, unless Waffo didn't answer (FLOW-BAN S4). */
const charging = (a: AdminAccount) => a.subscription?.status === "active" || a.subscription?.status === "past_due"
/** Only the person can stop an App Store subscription (FLOW-BAN S7). */
const appStore = (a: AdminAccount) => a.subscription?.provider === "apple"

/** The Plan column, from API-065 `access` and the latest `subscription`. */
function planOf(a: AdminAccount) {
  const until = a.access.until
  const sub = a.subscription
  switch (a.access.state) {
    case "free":
      return "Free"
    case "trial":
      return `Trial, ${daysUntil(until!)} days left`
    case "paid":
      if (sub?.status === "active") return `Subscribed, renews ${shortDate(sub.paid_until)}`
      if (sub?.status === "past_due") return "Payment failed"
      if (sub) return `Ends ${shortDate(sub.paid_until)}`
      return `Paid until ${shortDate(until!)}`
    case "expired":
      return sub ? `Ended ${shortDate(until!)}` : `Trial ended ${shortDate(until!)}`
  }
}

function lastActive(t?: string) {
  if (!t) return "Never"
  const m = (Date.now() - Date.parse(t)) / 60_000
  if (m < 1) return "Now"
  if (m < 60) return `${Math.round(m)} min ago`
  if (sameDay(t, new Date().toISOString())) return `Today ${clock(t)}`
  if (sameDay(t, new Date(Date.now() - 86_400_000).toISOString())) return "Yesterday"
  return shortDate(t)
}

type Dialogs = { kind: "ban" | "delete"; who: AdminAccount }

export function Users({ recount }: { recount: () => void }) {
  const query = useQuery()
  const q = query.get("q") ?? ""
  const page = Math.max(1, Number(query.get("page")) || 1)
  const [typed, setTyped] = useState(q)
  const [list, setList] = useState<Load<AdminAccountsPage>>({ status: "loading" })
  const [dialog, setDialog] = useState<Dialogs>()
  const [busy, setBusy] = useState<number>()

  const load = useCallback(async () => {
    setList({ status: "loading" })
    try {
      setList({ status: "ready", data: await admin.accounts(q, page) })
    } catch (e) {
      setList({ status: "error", error: e as ApiError })
    }
  }, [q, page])
  useEffect(() => void load(), [load])

  // The search goes into the address a moment after typing stops (replacing it: Back skips each keystroke).
  useEffect(() => {
    if (typed.trim() === q) return
    const t = setTimeout(() => {
      const p = new URLSearchParams()
      if (typed.trim()) p.set("q", typed.trim())
      navigate(`/admin/users${p.size ? `?${p}` : ""}`, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [typed, q])

  const replace = (a: AdminAccount) => setList((l) => (l.status === "ready" ? { status: "ready", data: { ...l.data, accounts: l.data.accounts.map((x) => (x.id === a.id ? a : x)) } } : l))
  const act = async (id: number, f: () => Promise<void>) => {
    if (busy) return
    setBusy(id)
    try {
      await f()
    } catch (e) {
      toast.error(messageOf(e))
    } finally {
      setBusy(undefined)
    }
  }
  const unban = (a: AdminAccount) =>
    act(a.id, async () => {
      replace(await admin.unban(a.id))
      toast(`${nameOf(a)} is unbanned.`)
    })
  const retry = (a: AdminAccount) =>
    act(a.id, async () => {
      const ok = await retryCancel(a.id)
      // Retrying cancels only the web subscription; an App Store one stays as it is.
      if (!appStore(a)) replace({ ...a, subscription: ok && a.subscription ? { ...a.subscription, status: "canceled" } : a.subscription })
      if (ok) toast(appStore(a) ? `Nothing left to cancel on the web. ${appStoreNote(nameOf(a))}` : `${nameOf(a)}'s subscription is canceled.`)
      else toast.error("Waffo still didn't confirm the cancel. Try again later.")
      if (ok) load()
    })

  const base = (p: number) => {
    const qs = new URLSearchParams()
    if (q) qs.set("q", q)
    if (p > 1) qs.set("page", String(p))
    return `/admin/users${qs.size ? `?${qs}` : ""}`
  }

  return (
    <>
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b-(length:--semantic-layout-hairline) border-border px-5 py-3">
        <div className="state-layer focus-ring is-field flex h-10 w-full max-w-80 items-center gap-2 rounded-md border border-input bg-muted px-3">
          <Search size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Search by account ID or email"
            aria-label="Search by account ID or email"
            autoComplete="off"
            className="w-full min-w-0 bg-transparent text-body text-foreground outline-none placeholder:text-(--semantic-color-text-tertiary)"
          />
        </div>
        {list.status === "ready" && (
          <p role="status" className="text-caption text-muted-foreground">
            {q
              ? `${list.data.total.toLocaleString("en-US")} ${list.data.total === 1 ? "match" : "matches"}`
              : `${list.data.total.toLocaleString("en-US")} accounts, newest first`}
          </p>
        )}
      </div>
      <div className="scroll-pane min-h-0 flex-1 px-5">
        {list.status === "loading" ? (
          <ListSkeleton rows={7} />
        ) : list.status === "error" ? (
          <ErrorState title="Couldn't load accounts" error={list.error} onRetry={load} />
        ) : !list.data.accounts.length ? (
          <EmptyState icon={<UsersIcon size={24} />} title={q ? "No account matches" : "No accounts yet"}>
            {q && <p>Search by the 8-digit account ID, or by part of the email.</p>}
          </EmptyState>
        ) : (
          <table className="w-full border-collapse text-left max-sm:block">
            <thead className="max-sm:sr-only">
              <tr className="text-caption text-muted-foreground">
                <th scope="col" className="py-3 pr-4 font-normal">Account</th>
                <th scope="col" className="py-3 pr-4 font-normal">Email</th>
                <th scope="col" className="py-3 pr-4 font-normal">Plan</th>
                <th scope="col" className="py-3 pr-4 font-normal">Last active</th>
                <th scope="col" className="py-3 pr-4 font-normal">Status</th>
                <th scope="col" className="py-3 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {list.data.accounts.map((a) => (
                <UserRow key={a.id} a={a} busy={busy === a.id} onBan={() => setDialog({ kind: "ban", who: a })} onDelete={() => setDialog({ kind: "delete", who: a })} onUnban={() => unban(a)} onRetry={() => retry(a)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      {list.status === "ready" && list.data.total > 50 && <Pager page={page} total={list.data.total} href={base} />}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(undefined)}>
        {dialog?.kind === "ban" && (
          <BanDialog
            who={dialog.who}
            ban={async () => {
              const r = await admin.ban(dialog.who.id)
              replace(r.account)
              recount()
              const name = nameOf(r.account)
              toast(!r.subscription_canceled ? `${name} is banned, but the subscription isn't canceled yet.` : r.app_store_subscription ? `${name} is banned. ${appStoreNote(name)}` : `${name} is banned.`)
            }}
            onDone={() => setDialog(undefined)}
          />
        )}
        {dialog?.kind === "delete" && (
          <DeleteDialog
            who={dialog.who}
            onDeleted={() => {
              setDialog(undefined)
              toast(`${nameOf(dialog.who)}'s account is deleted.`)
              load()
            }}
            onCancel={() => setDialog(undefined)}
          />
        )}
      </Dialog>
    </>
  )
}

function UserRow({ a, busy, onBan, onUnban, onDelete, onRetry }: { a: AdminAccount; busy: boolean; onBan: () => void; onUnban: () => void; onDelete: () => void; onRetry: () => void }) {
  const renewing = !!a.banned_at && charging(a)
  const stuck = renewing && !appStore(a)
  const cell = "py-3 pr-4 align-middle max-sm:block max-sm:py-0.5 max-sm:pr-0"
  return (
    <tr className="border-t-(length:--semantic-layout-hairline) border-border max-sm:grid max-sm:gap-1 max-sm:py-3">
      <td className={cell}>
        <span className="flex items-center gap-3">
          <Avatar kind="person" label={nameOf(a)} src={a.avatar_url} />
          <span className="min-w-0">
            <span className="block truncate text-body text-foreground">{nameOf(a)}</span>
            <span className="block text-caption tabular-nums text-muted-foreground">{a.id}</span>
          </span>
        </span>
      </td>
      <td className={`${cell} text-body wrap-anywhere text-foreground`}>{a.email}</td>
      <td className={`${cell} text-body text-foreground`}>
        {stuck ? (
          <Tag tone="warn">
            <TriangleAlert size={12} aria-hidden="true" />
            Subscription not canceled
          </Tag>
        ) : renewing ? (
          <Tag>App Store: only they can cancel</Tag>
        ) : (
          planOf(a)
        )}
      </td>
      <td className={`${cell} text-caption whitespace-nowrap text-muted-foreground`}>
        <span className="sm:hidden">Last active: </span>
        {lastActive(a.last_active_at)}
      </td>
      <td className={cell}>{a.admin ? <Tag>Admin</Tag> : a.banned_at ? <BannedTag on={shortDate(a.banned_at)} /> : <span className="text-caption text-muted-foreground">Active</span>}</td>
      <td className={`${cell} text-right max-sm:text-left`}>
        {a.admin ? (
          <span className="text-caption whitespace-nowrap text-muted-foreground">Admins can't be banned</span>
        ) : (
          <span className="inline-flex flex-wrap items-center justify-end gap-1 max-sm:justify-start">
            {a.banned_at ? (
              <>
                {renewing && (
                  <Button variant="outline" size="sm" aria-disabled={busy} onClick={onRetry}>
                    <RotateCw size={12} aria-hidden="true" />
                    Retry cancel
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-foreground" aria-disabled={busy} onClick={() => !busy && onUnban()}>
                  Unban
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" aria-disabled={busy} onClick={() => !busy && onDelete()}>
                  Delete…
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive" aria-disabled={busy} onClick={() => !busy && onBan()}>
                Ban…
              </Button>
            )}
          </span>
        )}
      </td>
    </tr>
  )
}

/** API-070, FLOW-BAN S7: a banned account only. Typing DELETE unlocks the button; focus starts on the field. */
function DeleteDialog({ who, onDeleted, onCancel }: { who: AdminAccount; onDeleted: () => void; onCancel: () => void }) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const field = useRef<HTMLInputElement>(null)
  const id = useId()
  const name = nameOf(who)
  const ready = typed === "DELETE"
  const go = async () => {
    if (busy || !ready) return
    setBusy(true)
    setError(undefined)
    try {
      await admin.deleteAccount(who.id)
      onDeleted()
    } catch (e) {
      setBusy(false)
      setError(e instanceof ApiError && e.status === 502 ? `Couldn't cancel ${name}'s subscription, so nothing was deleted. Try again later.` : messageOf(e))
    }
  }
  return (
    <DialogContent
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        field.current?.focus()
      }}
    >
      <DialogTitle>Delete {name}'s account?</DialogTitle>
      <p className="text-body text-muted-foreground">
        {name} is banned. Deleting removes the account the same way as when someone deletes their own, and groups {name} owns are dissolved. Reports about {name} are kept.
      </p>
      <p className="text-body text-muted-foreground">Afterwards, {who.email} can sign up again as a new account. This can't be undone.</p>
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
      >
        <label htmlFor={id} className="text-label text-foreground">
          Type DELETE to confirm
        </label>
        <div className="state-layer focus-ring is-field flex h-10 items-center rounded-md border border-input bg-muted px-3">
          <input
            ref={field}
            id={id}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent text-body text-foreground outline-none"
          />
        </div>
      </form>
      <Refusal>{error}</Refusal>
      <DialogFooter>
        <Button variant="ghost" className="text-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={!ready} aria-disabled={busy} onClick={go}>
          <Trash2 size={16} aria-hidden="true" />
          {busy ? "Deleting…" : "Delete account"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
