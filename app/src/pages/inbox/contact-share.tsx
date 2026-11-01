import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react"
import { Laptop, Pencil } from "lucide-react"
import { RadioGroup } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Dialog, DrawerContent } from "@/components/ui/dialog"
import { Avatar } from "@/components/bits"
import type { AgentRef, Contact, ContactShare, Device, MyAgent, ShareLevel } from "@/data/contract"
import { messageOf } from "@/data/layer"
import { dataOf, openShare, refreshList, retry, retryShare, setShare, type State } from "@/data/store"
import { t } from "@/i18n"
import { DialogError, Note, Pick, Retry, SessionPicks, flip } from "./groups"
import { ListSkeleton } from "./states"

// A contact's page, under their sessions: which of mine they can see (FLOW-CONTACT-SHARE, API-081, API-082). All and
// None save as soon as they're picked, like the language; Only the ones I pick opens a drawer of my computers with their
// sessions, and saves from there.

/** How many picks show on the contact's page before "N more". */
const SHOWN = 8

export function ShareSection({ s, p }: { s: State; p: Contact }) {
  const heading = useId()
  const [saving, setSaving] = useState<ShareLevel>()
  const [failed, setFailed] = useState<{ level: ShareLevel; message: string }>()
  const [open, setOpen] = useState(false)
  // A new drawer each time it opens, starting from what's saved.
  const [round, setRound] = useState(0)
  useEffect(() => void openShare(p.id), [p.id])
  const l = s.shares[p.id]
  const shared = dataOf(s.groups)?.some((g) => g.members.some((m) => m.id === p.id))

  const save = async (level: ShareLevel) => {
    setSaving(level)
    setFailed(undefined)
    try {
      await setShare(p.id, level)
    } catch (e) {
      setFailed({ level, message: messageOf(e) })
    } finally {
      setSaving(undefined)
    }
  }
  const pick = () => {
    setFailed(undefined)
    setRound(round + 1)
    setOpen(true)
    refreshList("devices")
    refreshList("agents")
  }

  return (
    <section aria-labelledby={heading} className="mt-6">
      <h2 id={heading} className="mb-2 text-label text-muted-foreground">
        {t("Your sessions {name} can see", { name: p.name })}
      </h2>
      {!l || l.status === "loading" ? (
        <ListSkeleton rows={3} />
      ) : l.status === "error" ? (
        <Retry failed={t("Couldn't load what {name} can see.", { name: p.name })} message={l.error.message} onRetry={() => retryShare(p.id)} />
      ) : (
        <>
          <RadioGroup.Root
            value={saving ?? l.data.share}
            onValueChange={(v) => (v === "chosen" ? pick() : save(v as ShareLevel))}
            disabled={!!saving}
            aria-labelledby={heading}
            className="-mx-2 flex flex-col"
          >
            <Option value="all" title={t("All your sessions")} hint={t("Ones you start later too.")} />
            <Option
              value="chosen"
              title={t("Only the ones you pick")}
              onClick={l.data.share === "chosen" ? pick : undefined}
              hint={
                l.data.share !== "chosen"
                  ? t("Computers or single sessions.")
                  : l.data.devices.length || l.data.sessions.length
                    ? undefined
                    : t("Nothing picked yet, so {name} can only message your inbox.", { name: p.name })
              }
            >
              {l.data.share === "chosen" && <Picked share={l.data} onChange={pick} disabled={!!saving} />}
            </Option>
            <Option value="none" title={t("None")} hint={t("{name} can only message your inbox.", { name: p.name })} />
          </RadioGroup.Root>
          {saving && (
            <p aria-live="polite" className="mt-1 text-caption text-muted-foreground">
              {t("Saving…")}
            </p>
          )}
          {failed && (
            <div role="alert" className="mt-2 flex items-center justify-between gap-3">
              <p className="min-w-0 text-caption text-destructive">
                {t("Couldn't save.")} {failed.message}
              </p>
              <Button variant="outline" size="sm" onClick={() => save(failed.level)}>
                {t("Try again")}
              </Button>
            </div>
          )}
          {shared && <p className="mt-3 text-caption text-muted-foreground">{t("Sessions you put in a group you share with {name} show to {name} in that group too.", { name: p.name })}</p>}
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {l?.status === "ready" && <ShareDrawer key={round} s={s} p={p} share={l.data} onSaved={() => setOpen(false)} />}
      </Dialog>
    </section>
  )
}

/**
 * One level: the whole row picks it. `onClick`: the row is already picked and opens something. `children` go under the
 * row, outside it, so a button there doesn't pick.
 */
function Option({ value, title, hint, onClick, children }: { value: ShareLevel; title: string; hint?: string; onClick?: () => void; children?: ReactNode }) {
  const id = useId()
  return (
    <>
      <RadioGroup.Item
        value={value}
        aria-labelledby={`${id}-title`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={onClick}
        className="state-layer focus-ring grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md px-2 py-2 text-left disabled:cursor-default"
      >
        <span aria-hidden="true" className="mt-0.5 grid size-4 flex-none place-items-center rounded-full border-(length:--primitive-dimension-ring-width) border-muted-foreground">
          <RadioGroup.Indicator className="size-2 rounded-full bg-foreground" />
        </span>
        <span className="min-w-0">
          <span id={`${id}-title`} className="block text-body text-foreground">
            {title}
          </span>
          {hint && (
            <span id={`${id}-hint`} className="block text-caption text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
      </RadioGroup.Item>
      {children}
    </>
  )
}

/** What's picked, computers first, and the button that opens the drawer to change it. */
function Picked({ share, onChange, disabled }: { share: ContactShare; onChange: () => void; disabled: boolean }) {
  const all = [
    ...share.devices.map((d) => ({ key: d.id, icon: <Laptop size={14} aria-hidden="true" className="flex-none text-muted-foreground" />, label: t("{computer}, every session on it", { computer: d.name }) })),
    ...share.sessions.map((x) => ({ key: x.id, icon: <Avatar kind="agent" tool={x.tool} size="sm" />, label: x.title })),
  ]
  const rest = all.length - SHOWN
  return (
    <div className="flex flex-col items-start gap-2 pr-2 pb-2 pl-9">
      {all.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("Picked")}>
          {all.slice(0, SHOWN).map((x) => (
            <li key={x.key} className="flex max-w-full min-w-0 items-center gap-1.5 rounded-md border-(length:--semantic-layout-hairline) border-border py-0.5 pr-2 pl-1.5 text-caption text-foreground">
              {x.icon}
              <span className="truncate">{x.label}</span>
            </li>
          ))}
          {rest > 0 && <li className="py-0.5 text-caption text-muted-foreground">{t("{n} more", { n: rest })}</li>}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={onChange} disabled={disabled}>
        <Pencil size={14} aria-hidden="true" />
        {all.length ? t("Change…") : t("Pick…")}
      </Button>
    </div>
  )
}

type Listed = MyAgent | AgentRef

/**
 * API-082 with `chosen`: my computers (API-006, signed-out ones aren't listed) each with its sessions (API-014), and
 * sessions on no listed computer last. Ticking a computer ticks every session on it, ones started later too. A picked
 * session that API-014 no longer lists comes from API-081 and shows by name. Picked rows come first in each list.
 */
function ShareDrawer({ s, p, share, onSaved }: { s: State; p: Contact; share: ContactShare; onSaved: () => void }) {
  const formId = useId()
  const chosen = share.share === "chosen"
  const [devices, setDevices] = useState(() => new Set(chosen ? share.devices.map((d) => d.id) : []))
  const [sessions, setSessions] = useState(() => new Set(chosen ? share.sessions.map((x) => x.id) : []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // Which were picked when the drawer opened: they stay first, however the ticks change.
  const [first] = useState(() => new Set(chosen ? share.sessions.map((x) => x.id) : []))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(undefined)
    // A session on a ticked computer is covered by it, so only the computer is saved.
    const on = new Map([...(dataOf(s.agents) ?? []), ...share.sessions].map((x) => [x.id, x.device_id]))
    const single = [...sessions].filter((id) => !devices.has(on.get(id) ?? ""))
    try {
      await setShare(p.id, "chosen", [...devices], single)
      onSaved()
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  let body: ReactNode
  if (s.devices.status === "loading" || s.agents.status === "loading") body = <ListSkeleton rows={4} />
  else if (s.devices.status === "error") body = <Retry failed={t("Couldn't load your computers.")} message={s.devices.error.message} onRetry={() => retry("devices")} />
  else if (s.agents.status === "error") body = <Retry failed={t("Couldn't load your sessions.")} message={s.agents.error.message} onRetry={() => retry("agents")} />
  else {
    const agents = s.agents.data
    const listed = new Set(agents.map((a) => a.id))
    const old = share.sessions.filter((x) => !listed.has(x.id))
    const ids = new Set(s.devices.data.map((d) => d.id))
    const on = (device: string | null) => [
      ...agents.filter((a) => a.device_id === device || (device === null && !ids.has(a.device_id ?? ""))),
      ...old.filter((x) => x.device_id === device || (device === null && !ids.has(x.device_id ?? ""))).map(({ id, short_id, title, tool }) => ({ id, short_id, title, tool })),
    ]
    const firstUp = (list: Listed[]) => [...list.filter((x) => first.has(x.id)), ...list.filter((x) => !first.has(x.id))]
    const rest = on(null)
    body =
      s.devices.data.length || rest.length ? (
        <>
          {s.devices.data.map((d) => {
            const list = firstUp(on(d.id))
            return (
              <Computer key={d.id} d={d} checked={devices.has(d.id)} onChange={() => setDevices(flip(devices, d.id))}>
                {list.length ? (
                  <SessionPicks list={list} chosen={sessions} onChange={setSessions} keep={list.filter((x) => first.has(x.id)).length} covered={devices.has(d.id)} bare />
                ) : (
                  <Note>{t("No sessions on it online or seen in the last 7 days.")}</Note>
                )}
              </Computer>
            )
          })}
          {rest.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-label text-foreground">{t("Other sessions")}</h3>
              <div className="-mx-2">
                <SessionPicks list={firstUp(rest)} chosen={sessions} onChange={setSessions} keep={rest.filter((x) => first.has(x.id)).length} />
              </div>
            </section>
          )}
        </>
      ) : (
        <Note>{t("No computers are signed in to Imbo. Run imbo login on one, and its sessions show up here.")}</Note>
      )
  }

  return (
    <DrawerContent
      title={t("What {name} can see", { name: p.name })}
      description={t("Tick a computer for every session on it, ones you start later too, or tick single sessions.")}
      action={
        <Button type="submit" form={formId} aria-disabled={busy}>
          {busy ? t("Saving…") : t("Save")}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {body}
      </form>
      <DialogError>{error}</DialogError>
    </DrawerContent>
  )
}

/** A computer's row: ticking it covers all its sessions, listed under it. */
function Computer({ d, checked, onChange, children }: { d: Device; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <ul className="-mx-2">
        <Pick checked={checked} onChange={onChange}>
          <span aria-hidden="true" className="inline-grid size-8 flex-none place-items-center rounded-full bg-accent text-foreground">
            <Laptop size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-body-strong text-foreground">{d.name}</span>
            <span className="block text-caption text-muted-foreground">{t("Every session on it, ones you start later too")}</span>
          </span>
        </Pick>
      </ul>
      <div className="-mx-2 pl-7">{children}</div>
    </section>
  )
}
