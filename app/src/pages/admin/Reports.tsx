import { useCallback, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ArrowLeft, Ban, Check, ChevronDown, FileText, Flag, Info, Link2, RotateCw, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Avatar, Sep, Tag } from "@/components/bits"
import type { Report, ReportParty, ReportsPage } from "@/data/contract"
import { ApiError, messageOf, type ResolveAction } from "@/data/layer"
import { admin, type Load } from "@/data/store"
import { ago, clock, dateTime, fileSize, langOf, sameDay, shortDate } from "@/lib/format"
import { onLinkClick, onFilterClick, useQuery } from "@/lib/router"
import { useCopy } from "@/lib/useCopy"
import { EmptyState, ErrorState, ListSkeleton, ThreadSkeleton } from "@/pages/inbox/states"
import { BanDialog, BannedTag, Refusal, appStoreNote, nameOf, retryCancel } from "./Admin"

// The Reports tab of PAGE-WEB-ADMIN (FLOW-BAN S1–S3): open reports or all of them on the left (API-062), the one in
// `?report=<id>` on the right (API-063) with Ban, Remove picture and Dismiss (API-064). The link in the report email
// is /admin?report=<id>, so it opens straight on that report. On phones the list and the report stack like chats.

const REASONS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_avatar: "Inappropriate picture",
  other: "Something else",
}
const reasonOf = (r: Report) => REASONS[r.reason] ?? r.reason
const PER_PAGE = 50
const SHOWN_FIRST = 7

/** The Reports address with some parameters changed (undefined drops one); the others stay. */
function withParams(change: Record<string, string | number | undefined>) {
  const q = new URLSearchParams(location.search)
  for (const [key, value] of Object.entries(change)) {
    if (value === undefined) q.delete(key)
    else q.set(key, String(value))
  }
  const qs = q.toString()
  return `/admin${qs ? `?${qs}` : ""}`
}

/** Where it happened: the group, or the direct chat between the two. */
const placeOf = (r: Report) => (r.group ? `in ${r.group.name}` : "direct chat")

/**
 * The status tag: open, or what was done with it. The list (API-062) carries no `action`, so there an actioned report
 * shows Banned while the account still is, and Resolved otherwise (a removed picture, or a ban since lifted).
 */
function StatusTag({ r }: { r: Report }) {
  if (r.status === "open") return <Tag>Open</Tag>
  if (r.status === "dismissed") return <Tag>Dismissed</Tag>
  if (r.action === "remove_avatar") return <Tag>Picture removed</Tag>
  if (r.action === "ban" || r.target.banned) return <BannedTag />
  return <Tag>Resolved</Tag>
}

export function Reports({ recount }: { recount: () => void }) {
  const q = useQuery()
  const status = q.get("status") === "all" ? "all" : "open"
  const page = Math.max(1, Number(q.get("page")) || 1)
  const open = Number(q.get("report")) || undefined
  const [list, setList] = useState<Load<ReportsPage>>({ status: "loading" })
  const [openCount, setOpenCount] = useState<number>()

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setList({ status: "loading" })
      try {
        const data = await admin.reports(status, page)
        setList({ status: "ready", data })
        if (status === "open") setOpenCount(data.total)
        else setOpenCount((await admin.reports("open", 1)).total)
      } catch (e) {
        if (!quiet) setList({ status: "error", error: e as ApiError })
      }
    },
    [status, page]
  )
  useEffect(() => void load(), [load])
  /** A report changed: the list, its count and the tab's count follow. */
  const changed = () => {
    load(true)
    recount()
  }

  return (
    <div className="grid min-h-0 flex-1 sm:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className={cn("flex min-h-0 flex-col sm:border-r-(length:--semantic-layout-hairline) sm:border-border", open && "max-sm:hidden")}>
        <div className="flex-none p-3">
          <nav aria-label="Which reports" className="grid grid-cols-2 rounded-md border-(length:--semantic-layout-hairline) border-input p-0.5">
            {(["open", "all"] as const).map((v) => (
              <a
                key={v}
                href={withParams({ status: v === "all" ? "all" : undefined, page: undefined })}
                onClick={onFilterClick}
                aria-current={status === v ? "page" : undefined}
                className="state-layer focus-ring flex h-7 items-center justify-center gap-1.5 rounded-sm text-label text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
              >
                {v === "open" ? "Open" : "All"}
                {v === "open" && openCount !== undefined && <span className="tabular-nums">{openCount}</span>}
              </a>
            ))}
          </nav>
        </div>
        <div className="nav-scroll min-h-0 flex-1">
          {list.status === "loading" ? (
            <ListSkeleton rows={4} />
          ) : list.status === "error" ? (
            <ErrorState what="reports" error={list.error} onRetry={() => load()} />
          ) : !list.data.reports.length ? (
            <EmptyState icon={<Flag size={24} />} title={status === "open" ? "No open reports" : "No reports yet"}>
              {status === "open" && <p>New reports show up here, and their email links open them.</p>}
            </EmptyState>
          ) : (
            <nav aria-label="Reports" className="flex flex-col gap-0.5 px-2 pb-2">
              {list.data.reports.map((r) => (
                <ReportRow key={r.id} r={r} current={r.id === open} />
              ))}
            </nav>
          )}
        </div>
        {list.status === "ready" && list.data.total > PER_PAGE && (
          <Pager page={page} total={list.data.total} href={(p) => withParams({ page: p > 1 ? p : undefined })} />
        )}
      </aside>
      <main className={cn("flex min-h-0 min-w-0 flex-col", !open && "max-sm:hidden")}>
        {open ? (
          <ReportDetail key={open} id={open} onChanged={changed} />
        ) : (
          <div className="grid flex-1 place-items-center p-6 max-sm:hidden">
            <p className="flex items-center gap-2 text-body text-(--semantic-color-text-tertiary)">
              <Flag size={16} aria-hidden="true" />
              Pick a report to read it.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function ReportRow({ r, current }: { r: Report; current: boolean }) {
  return (
    <a
      href={withParams({ report: r.id })}
      onClick={onLinkClick}
      aria-current={current ? "page" : undefined}
      className="state-layer focus-ring grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-foreground aria-[current=page]:bg-accent"
    >
      <Avatar kind="person" label={nameOf(r.target)} src={r.target.avatar_url} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2 text-body">
          <span className="max-w-[70%] flex-none truncate">{nameOf(r.target)}</span>
          <Sep />
          <span className="min-w-0 truncate text-muted-foreground">{reasonOf(r)}</span>
        </span>
        <span className="block truncate text-caption text-muted-foreground">
          by {nameOf(r.reporter)}, {placeOf(r)}
        </span>
      </span>
      {r.status !== "open" ? (
        <StatusTag r={r} />
      ) : (
        <time dateTime={r.created_at} className="text-caption whitespace-nowrap tabular-nums text-(--semantic-color-text-tertiary)">
          {Date.now() - Date.parse(r.created_at) < 86_400_000 ? ago(r.created_at) : sameDay(r.created_at, new Date(Date.now() - 86_400_000).toISOString()) ? "Yesterday" : shortDate(r.created_at)}
        </time>
      )}
    </a>
  )
}

/** "1–50 of 1,284" with Previous and Next, as links so the page number stays in the address. */
export function Pager({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
  const last = Math.max(1, Math.ceil(total / PER_PAGE))
  const from = (page - 1) * PER_PAGE + 1
  const to = Math.min(total, page * PER_PAGE)
  const link = (p: number, label: string, enabled: boolean) =>
    enabled ? (
      <Button asChild variant="outline" size="sm">
        <a href={href(p)} onClick={onFilterClick}>
          {label}
        </a>
      </Button>
    ) : (
      <Button variant="ghost" size="sm" disabled>
        {label}
      </Button>
    )
  return (
    <div className="flex flex-none items-center gap-2 border-t-(length:--semantic-layout-hairline) border-border px-4 py-3">
      <p className="flex-1 text-caption tabular-nums text-muted-foreground">
        {total ? `${from.toLocaleString("en-US")}–${to.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}` : "None"}
      </p>
      {link(page - 1, "Previous", page > 1)}
      {link(page + 1, "Next", page < last)}
    </div>
  )
}

/** Name, ID, ban, and for the reported account its email and whether the picture changed since. */
function PartyRow({ label, p }: { label: string; p: ReportParty }) {
  return (
    <div className="grid grid-cols-[6.5rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 max-sm:grid-cols-[auto_minmax(0,1fr)]">
      <span className="text-caption text-muted-foreground max-sm:col-span-2">{label}</span>
      <Avatar kind="person" label={nameOf(p)} src={p.avatar_url} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body text-foreground">{nameOf(p)}</span>
          <span className="text-caption tabular-nums text-muted-foreground">ID {p.id}</span>
          {p.banned && <BannedTag />}
        </span>
        {p.email && <span className="block text-caption wrap-anywhere text-muted-foreground">{p.email}</span>}
        {p.avatar_changed && (
          <span className="flex items-center gap-1 text-caption text-(--semantic-color-feedback-warning)">
            <TriangleAlert size={12} aria-hidden="true" />
            Picture changed since the report
          </span>
        )}
      </span>
    </div>
  )
}

function CopyLink({ id }: { id: number }) {
  const { copied, copy } = useCopy()
  return (
    <Button variant="ghost" size="sm" className="text-foreground" onClick={() => copy(`${location.origin}/admin?report=${id}`)}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
      {copied ? "Copied" : "Copy link"}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </Button>
  )
}

/** The messages copied into the report (ADR-039): the newest seven, the rest behind "N earlier messages". */
function Copied({ r }: { r: Report }) {
  const [all, setAll] = useState(false)
  const messages = r.messages ?? []
  const hidden = all ? 0 : Math.max(0, messages.length - SHOWN_FIRST)
  const today = new Date().toISOString()
  return (
    <section aria-labelledby="report-messages" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="report-messages" className="text-label text-foreground">
          {r.group ? `Messages ${nameOf(r.target)} sent in ${r.group.name}` : `Messages between ${nameOf(r.target)} and ${nameOf(r.reporter)}`}
        </h2>
        <span className="text-caption text-muted-foreground">Last 20, copied when reported</span>
      </div>
      {messages.length ? (
        <ol className="flex flex-col rounded-md border-(length:--semantic-layout-hairline) border-border px-3">
          {hidden > 0 && (
            <li className="border-b-(length:--semantic-layout-hairline) border-border py-2">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setAll(true)}>
                <ChevronDown size={14} aria-hidden="true" />
                {hidden} earlier {hidden === 1 ? "message" : "messages"}
              </Button>
            </li>
          )}
          {messages.slice(hidden).map((m, i) => (
            <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-t-(length:--semantic-layout-hairline) border-border py-3 first:border-t-0">
              <time dateTime={m.created_at} className="text-caption tabular-nums text-muted-foreground">
                {sameDay(m.created_at, today) ? clock(m.created_at) : shortDate(m.created_at)}
              </time>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-caption text-muted-foreground">
                  {m.from.name || "Deleted account"}
                  {m.kind === "request_note" && <Tag>Contact request note</Tag>}
                </p>
                <p lang={langOf(m.body)} className="text-body whitespace-pre-wrap wrap-anywhere text-foreground">
                  {m.body}
                </p>
                {m.files.map((f, j) => (
                  <p key={j} className="mt-1 flex items-center gap-2 text-caption text-muted-foreground">
                    <FileText size={14} aria-hidden="true" className="flex-none" />
                    <span className="truncate text-foreground">{f.name}</span>
                    <Sep />
                    <span className="flex-none">{fileSize(f.size)}</span>
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-body text-(--semantic-color-text-tertiary)">No messages were copied.</p>
      )}
      <p className="text-caption text-muted-foreground">Files show their name and size only. Imbo doesn't keep their contents in reports.</p>
    </section>
  )
}

/** Why an action on a report didn't go through; anything unexpected in the server's own words. */
function actionRefusal(e: unknown) {
  if (e instanceof ApiError && e.type === "/errors/report-closed") return "This report was already resolved."
  return messageOf(e)
}

function ReportDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [r, setR] = useState<Load<Report>>({ status: "loading" })
  const [busy, setBusy] = useState<ResolveAction>()
  const [error, setError] = useState<string>()
  const [banning, setBanning] = useState(false)
  /** false after a ban that couldn't cancel the subscription (FLOW-BAN S4). */
  const [canceled, setCanceled] = useState<boolean>()
  const [retrying, setRetrying] = useState(false)
  /** true after a ban when the person still has an App Store subscription that renews (FLOW-BAN S7). */
  const [appStore, setAppStore] = useState(false)

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setR({ status: "loading" })
      try {
        setR({ status: "ready", data: await admin.report(id) })
      } catch (e) {
        setR({ status: "error", error: e as ApiError })
      }
    },
    [id]
  )
  useEffect(() => void load(), [load])

  const back = (
    <Button asChild variant="ghost" size="icon" className="sm:hidden">
      <a href={withParams({ report: undefined })} onClick={onLinkClick} aria-label="Back to reports">
        <ArrowLeft size={20} aria-hidden="true" />
      </a>
    </Button>
  )
  if (r.status === "loading")
    return (
      <>
        <div className="flex h-16 flex-none items-center gap-3 border-b-(length:--semantic-layout-hairline) border-border px-5 max-sm:pl-2">
          {back}
          <span className="skeleton h-4 w-40" />
        </div>
        <ThreadSkeleton />
      </>
    )
  if (r.status === "error")
    return (
      <>
        <div className="flex-none p-2 sm:hidden">{back}</div>
        <div className="grid flex-1 place-items-center">
          {r.error.status === 404 ? (
            <EmptyState icon={<Flag size={24} />} title="This report isn't here">
              <p>Check the number in the link.</p>
            </EmptyState>
          ) : (
            <ErrorState what="this report" error={r.error} onRetry={() => load()} />
          )}
        </div>
      </>
    )

  const rep = r.data
  const target = nameOf(rep.target)
  const resolve = async (action: ResolveAction) => {
    if (busy) return
    setBusy(action)
    setError(undefined)
    try {
      const res = await admin.resolve(id, action)
      setR({ status: "ready", data: res.report })
      if (res.subscription_canceled !== undefined) setCanceled(res.subscription_canceled)
      if (res.app_store_subscription) setAppStore(true)
      toast(action === "ban" ? `${target} is banned.` : action === "remove_avatar" ? `${target}'s picture is removed.` : `Report #${id} is dismissed.`)
      onChanged()
    } catch (e) {
      setError(actionRefusal(e))
      if (e instanceof ApiError && e.type === "/errors/report-closed") (setBanning(false), load(true), onChanged())
      throw e
    } finally {
      setBusy(undefined)
    }
  }
  const retry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const ok = await retryCancel(rep.target.id)
      setCanceled(ok)
      if (ok) toast(`${target}'s subscription is canceled.`)
    } catch (e) {
      toast.error(messageOf(e))
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      <header className="flex flex-none items-start gap-3 border-b-(length:--semantic-layout-hairline) border-border px-5 py-3 max-sm:pl-2">
        {back}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-body-strong text-foreground">
            Report #{rep.id}
            <StatusTag r={rep} />
          </h1>
          <p className="text-caption text-muted-foreground">
            {reasonOf(rep)}, {rep.group ? `in ${rep.group.name} (#${rep.group.id})` : "direct chat"}, {dateTime(rep.created_at)}
          </p>
        </div>
        <CopyLink id={rep.id} />
      </header>
      <div className="scroll-pane flex min-h-0 flex-1 flex-col gap-6 p-5">
        {canceled === false && (
          <div role="status" className="flex items-start gap-3 rounded-md border-(length:--semantic-layout-hairline) border-(--semantic-color-feedback-warning) p-3">
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none text-(--semantic-color-feedback-warning)" />
            <div className="min-w-0 flex-1">
              <p className="text-body text-foreground">{target} is banned, but the subscription isn't canceled yet.</p>
              <p className="text-caption text-muted-foreground">Waffo didn't confirm it. {target} is signed out everywhere and can't sign in again either way.</p>
            </div>
            <Button variant="outline" size="sm" aria-disabled={retrying} onClick={retry}>
              <RotateCw size={14} aria-hidden="true" />
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </div>
        )}
        {appStore && (
          <div role="status" className="flex items-start gap-3 rounded-md border-(length:--semantic-layout-hairline) border-border p-3">
            <Info size={16} aria-hidden="true" className="mt-0.5 flex-none text-muted-foreground" />
            <p className="min-w-0 flex-1 text-body text-foreground">{appStoreNote(target)}</p>
          </div>
        )}
        {rep.status !== "open" && <Refusal>{error}</Refusal>}
        {rep.resolved_at && <p className="text-caption text-muted-foreground">Resolved {dateTime(rep.resolved_at)}.</p>}
        <div className="flex flex-col gap-3">
          <PartyRow label="Reported" p={rep.target} />
          <PartyRow label="Reported by" p={rep.reporter} />
        </div>
        {rep.note && (
          <section aria-labelledby="report-note" className="flex flex-col gap-2">
            <h2 id="report-note" className="text-label text-foreground">
              Details from {nameOf(rep.reporter)}
            </h2>
            <p lang={langOf(rep.note)} className="rounded-md border-(length:--semantic-layout-hairline) border-border bg-muted px-3 py-2.5 text-body whitespace-pre-wrap wrap-anywhere text-foreground">
              {rep.note}
            </p>
          </section>
        )}
        <Copied r={rep} />
      </div>
      {rep.status === "open" && (
        <Actions r={rep} busy={busy} error={error} onBan={() => setBanning(true)} onResolve={(a) => resolve(a).catch(() => {})} />
      )}
      <Dialog open={banning} onOpenChange={setBanning}>
        {banning && <BanDialog who={rep.target} ban={() => resolve("ban")} onDone={() => setBanning(false)} />}
      </Dialog>
    </>
  )
}

/** The bar under an open report (FLOW-BAN S1–S3). Remove picture needs a picture to remove. */
function Actions({ r, busy, error, onBan, onResolve }: { r: Report; busy?: ResolveAction; error?: string; onBan: () => void; onResolve: (a: ResolveAction) => void }) {
  const name = nameOf(r.target)
  const noPicture = !r.target.avatar_url
  const note: ReactNode = error ? <Refusal>{error}</Refusal> : noPicture ? <p className="text-caption text-muted-foreground">{name} has no picture, so there's nothing to remove.</p> : null
  return (
    <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-t-(length:--semantic-layout-hairline) border-border px-5 py-3">
      <div className="flex flex-wrap gap-2 max-sm:w-full">
        <Button variant="destructive" aria-disabled={!!busy} onClick={() => !busy && onBan()}>
          <Ban size={16} aria-hidden="true" />
          Ban {name}
        </Button>
        <Button variant="outline" disabled={noPicture} aria-disabled={!!busy} onClick={() => onResolve("remove_avatar")}>
          {busy === "remove_avatar" ? "Removing…" : "Remove picture"}
        </Button>
        <Button variant="ghost" className="text-foreground" aria-disabled={!!busy} onClick={() => onResolve("dismiss")}>
          {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
        </Button>
      </div>
      <div className="min-w-0 flex-1 text-right max-sm:text-left">{note}</div>
    </div>
  )
}

