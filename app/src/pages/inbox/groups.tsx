import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"
import { ArrowLeft, Check, CircleAlert, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, Presence, Sep, Tag } from "@/components/bits"
import type { AgentRef, Contact, Group, MyAgent } from "@/data/contract"
import { messageOf } from "@/data/layer"
import { createGroup, dataOf, groupOf, invite, isBlocked, isMe, refreshList, retry, setGroupSessions, type State } from "@/data/store"
import { toolName } from "@/lib/format"
import { navigate } from "@/lib/router"
import { ListSkeleton } from "./states"

// Groups on the web (FLOW-GROUP-CREATE, FLOW-GROUP-SESSIONS, FLOW-GROUP-JOIN): New group, and a group's details with
// its members, which of my sessions get its messages, and inviting contacts. One dialog for the whole page (rendered
// by the inbox shell), so the chats list, a group chat's title and an accepted invitation can all open it.

type Open = { kind: "new" } | { kind: "details"; groupId: number }
let opened: Open | undefined
/** Where focus goes back to on close: nothing triggers these dialogs in Radix's sense. */
let returnTo: Element | null = null
const listeners = new Set<() => void>()
function setOpened(o: Open | undefined) {
  if (o && !opened) returnTo = document.activeElement
  opened = o
  listeners.forEach((l) => l())
}
function giveFocusBack(e: Event) {
  e.preventDefault()
  if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus()
}
const close = () => setOpened(undefined)
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const openNewGroup = () => setOpened({ kind: "new" })
export const openGroupDetails = (groupId: number) => setOpened({ kind: "details", groupId })

export function GroupDialogs({ s }: { s: State }) {
  const o = useSyncExternalStore(subscribe, () => opened)
  const change = (open: boolean) => !open && close()
  return (
    <>
      <Dialog open={o?.kind === "new"} onOpenChange={change}>
        {o?.kind === "new" && <NewGroupDialog s={s} />}
      </Dialog>
      <Dialog open={o?.kind === "details"} onOpenChange={change}>
        {o?.kind === "details" && <GroupDetailsDialog key={o.groupId} s={s} groupId={o.groupId} />}
      </Dialog>
    </>
  )
}

/** The first line is the toast; any more go under it. */
function say(lines: string[]) {
  const [first, ...rest] = lines
  if (first) toast(first, rest.length ? { description: rest.join(" ") } : undefined)
}

/** The server's rules for a group name (API-018), checked before sending. */
function nameProblem(name: string) {
  if (!name) return "Give the group a name."
  if ([...name].length > 64) return "A group name is at most 64 characters."
  if (name.includes("/")) return "A group name can't contain /."
  if (name.startsWith("#")) return "A group name can't start with #."
  if (/[\u0000-\u001f\u007f]/.test(name)) return "A group name can't contain control characters."
}

const flip = <K,>(set: Set<K>, k: K) => {
  const next = new Set(set)
  if (!next.delete(k)) next.add(k)
  return next
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-label text-foreground">{title}</h3>
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
      <div className="-mx-2 mt-1">{children}</div>
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-2 text-caption text-muted-foreground">{children}</p>
}

function DialogError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 text-caption text-destructive">
      <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
      {children}
    </p>
  )
}

/** A row that is all label for its checkbox, so a click anywhere on it ticks the box. */
function Pick({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <li>
      <label className="state-layer grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-1.5">
        <Checkbox checked={checked} onCheckedChange={onChange} />
        {children}
      </label>
    </li>
  )
}

/** My sessions (API-014); one picked in the group that API-014 no longer lists (not seen for 7 days) shows by name. */
function SessionPicks({ list, chosen, onChange }: { list: (MyAgent | AgentRef)[]; chosen: Set<string>; onChange: (next: Set<string>) => void }) {
  return (
    <ul className="flex flex-col">
      {list.map((a) => (
        <Pick key={a.id} checked={chosen.has(a.id)} onChange={() => onChange(flip(chosen, a.id))}>
          <Avatar kind="agent" />
          <span className="min-w-0">
            <span className="block truncate text-body text-foreground">{a.title}</span>
            <span className="flex min-w-0 items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
              {"online" in a && (
                <>
                  <Presence s={a} plain />
                  <Sep />
                </>
              )}
              <span className="truncate">{toolName(a.tool)}</span>
              {"online" in a && a.device_name && (
                <>
                  <Sep />
                  <span className="truncate">{a.device_name}</span>
                </>
              )}
            </span>
          </span>
        </Pick>
      ))}
    </ul>
  )
}

function ContactPicks({ list, chosen, onChange }: { list: Contact[]; chosen: Set<number>; onChange: (next: Set<number>) => void }) {
  return (
    <ul className="flex flex-col">
      {list.map((p) => (
        <Pick key={p.id} checked={chosen.has(p.id)} onChange={() => onChange(flip(chosen, p.id))}>
          <Avatar kind="person" label={p.name} src={p.avatar_url} />
          <span className="min-w-0">
            <span className="block truncate text-body text-foreground">{p.name}</span>
            <span className="block text-caption tabular-nums text-muted-foreground">ID {p.id}</span>
          </span>
        </Pick>
      ))}
    </ul>
  )
}

/** Contacts an invitation can go to: not inactive, not blocked by me. */
const invitable = (s: State) => (dataOf(s.contacts) ?? []).filter((p) => p.active && !isBlocked(s, p.id))

/**
 * PAGE-WEB-GROUP-NEW (FLOW-GROUP-CREATE): a name, my sessions that get its messages, contacts to invite. The group is
 * made first (API-018), then each invitation goes out (API-020); one refused doesn't undo the group.
 */
function NewGroupDialog({ s }: { s: State }) {
  const formId = useId()
  const nameId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [problem, setProblem] = useState<string>()
  const [error, setError] = useState<string>()
  const [sessions, setSessions] = useState(new Set<string>())
  const [people, setPeople] = useState(new Set<number>())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    refreshList("agents")
    refreshList("contacts")
  }, [])
  const contacts = invitable(s)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const n = name.trim()
    const p = nameProblem(n)
    setProblem(p)
    if (p) return input.current?.focus()
    setBusy(true)
    setError(undefined)
    try {
      const chosen = contacts.filter((x) => people.has(x.id))
      const made = await createGroup(n, [...sessions], chosen)
      close()
      if (made.chat) navigate(`/chats/${made.chat}`)
      say(made.refused.length ? [`${n} created.`, ...made.refused] : [chosen.length ? `${n} created. Invitations sent.` : `${n} created.`])
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }

  const agents = s.agents
  return (
    <DialogContent aria-describedby={undefined} onCloseAutoFocus={giveFocusBack}>
      <DialogTitle>New group</DialogTitle>
      <form id={formId} onSubmit={create} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-label text-foreground">
            Group name
          </label>
          <Input
            ref={input}
            id={nameId}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (problem) setProblem(nameProblem(e.target.value.trim()))
            }}
            invalid={!!problem}
            aria-describedby={`${nameId}-problem`}
            autoComplete="off"
            autoFocus
          />
          <p id={`${nameId}-problem`} role="alert" className="min-h-5 text-caption text-destructive">
            {problem}
          </p>
        </div>
        <Section title="Your sessions" hint="They get the group's messages and can reply. You can change this later in the group's details.">
          {agents.status === "loading" ? (
            <ListSkeleton rows={2} />
          ) : agents.status === "error" ? (
            <Retry what="your sessions" message={agents.error.message} onRetry={() => retry("agents")} />
          ) : agents.data.length ? (
            <SessionPicks list={agents.data} chosen={sessions} onChange={setSessions} />
          ) : (
            <Note>No sessions online or seen in the last 7 days. You can pick some later.</Note>
          )}
        </Section>
        <Section title="Invite contacts" hint="They can accept it in Contacts, or run imbo group join.">
          {s.contacts.status === "loading" ? (
            <ListSkeleton rows={2} />
          ) : s.contacts.status === "error" ? (
            <Retry what="contacts" message={s.contacts.error.message} onRetry={() => retry("contacts")} />
          ) : contacts.length ? (
            <ContactPicks list={contacts} chosen={people} onChange={setPeople} />
          ) : (
            <Note>No contacts to invite yet.</Note>
          )}
        </Section>
      </form>
      <DialogError>{error}</DialogError>
      <DialogFooter>
        <Button variant="ghost" className="text-foreground" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={!name.trim()} aria-disabled={busy}>
          {busy ? "Creating…" : "Create group"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function Retry({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2">
      <p className="min-w-0 text-caption text-muted-foreground">
        Couldn't load {what}. {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

const same = (a: Set<string>, b: AgentRef[]) => a.size === b.length && b.every((x) => a.has(x.id))

/** API-021: my sessions in API-014, then any picked in the group that API-014 no longer lists. Save shows once changed. */
function MySessions({ s, g }: { s: State; g: Group }) {
  const [chosen, setChosen] = useState(() => new Set(g.my_sessions.map((x) => x.id)))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      await setGroupSessions(g.id, [...chosen])
      const n = chosen.size
      toast(n ? `Saved. ${n === 1 ? "1 session gets" : `${n} sessions get`} ${g.name}'s messages.` : `Saved. None of your sessions get ${g.name}'s messages.`)
    } catch (e) {
      toast.error(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  const agents = s.agents
  if (agents.status === "loading") return <ListSkeleton rows={2} />
  if (agents.status === "error") return <Retry what="your sessions" message={agents.error.message} onRetry={() => retry("agents")} />
  const listed = new Set(agents.data.map((a) => a.id))
  const list = [...agents.data, ...g.my_sessions.filter((x) => !listed.has(x.id))]
  if (!list.length) return <Note>No sessions online or seen in the last 7 days.</Note>
  return (
    <>
      <SessionPicks list={list} chosen={chosen} onChange={setChosen} />
      {!same(chosen, g.my_sessions) && (
        <div className="px-2 pt-2">
          <Button aria-disabled={busy} onClick={save}>
            <Check size={16} aria-hidden="true" />
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </>
  )
}

function Members({ s, g }: { s: State; g: Group }) {
  return (
    <ul className="flex flex-col">
      {g.members.map((m) => (
        <li key={m.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-2 py-1.5">
          <Avatar kind="person" label={m.name} src={m.avatar_url} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-body wrap-anywhere text-foreground">{m.name}</span>
              {g.owner?.id === m.id && <Tag>Owner</Tag>}
              {isMe(s, m.id) && <Tag>You</Tag>}
              {!m.active && <Tag>Inactive</Tag>}
            </span>
            <span className="block text-caption tabular-nums text-muted-foreground">ID {m.id}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function CloseFooter() {
  return (
    <DialogFooter>
      <Button variant="ghost" className="text-foreground" onClick={close}>
        Close
      </Button>
    </DialogFooter>
  )
}

/**
 * PAGE-WEB-GROUP (FLOW-GROUP-SESSIONS): who is in the group and who owns it (API-019), which of my sessions get its
 * messages (API-021), and inviting contacts (API-020), who accept in Contacts or from a terminal.
 */
function GroupDetailsDialog({ s, groupId }: { s: State; groupId: number }) {
  const [inviting, setInviting] = useState(false)
  useEffect(() => {
    refreshList("groups")
    refreshList("agents")
    refreshList("contacts")
  }, [])
  const l = s.groups
  const g = groupOf(s, groupId)
  if (l.status === "loading" || (l.status === "ready" && !g))
    return (
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={giveFocusBack}>
        <DialogTitle>Group details</DialogTitle>
        {l.status === "loading" ? <ListSkeleton rows={3} /> : <p className="text-body text-muted-foreground">This group isn't here. It may have been dissolved, or you left it.</p>}
        <CloseFooter />
      </DialogContent>
    )
  if (l.status === "error" || !g)
    return (
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={giveFocusBack}>
        <DialogTitle>Group details</DialogTitle>
        <Retry what="this group" message={l.status === "error" ? l.error.message : ""} onRetry={() => retry("groups")} />
        <CloseFooter />
      </DialogContent>
    )
  if (inviting) return <InviteView s={s} g={g} onDone={() => setInviting(false)} />
  const n = g.members.length
  return (
    <DialogContent aria-describedby={undefined} onCloseAutoFocus={giveFocusBack}>
      <div className="flex items-center gap-3">
        <Avatar kind="group" label={g.name} src={g.avatar_url} size="lg" />
        <div className="min-w-0">
          <DialogTitle className="wrap-anywhere">{g.name}</DialogTitle>
          <p className="flex items-center gap-2 text-caption tabular-nums text-muted-foreground">
            Group {g.id}
            <Sep />
            {n === 1 ? "1 member" : `${n} members`}
          </p>
        </div>
      </div>
      <Section title="Your sessions in this group" hint="They get the group's messages and can reply.">
        <MySessions key={g.my_sessions.map((x) => x.id).join()} s={s} g={g} />
      </Section>
      <Section title="Members">
        <Members s={s} g={g} />
      </Section>
      <div>
        <Button variant="outline" onClick={() => setInviting(true)}>
          <UserPlus size={16} aria-hidden="true" />
          Invite contacts
        </Button>
      </div>
      <CloseFooter />
    </DialogContent>
  )
}

/** Invitations from the group's details; back to the details when sent, with what was refused in the toast. */
function InviteView({ s, g, onDone }: { s: State; g: Group; onDone: () => void }) {
  const [people, setPeople] = useState(new Set<number>())
  const [busy, setBusy] = useState(false)
  const inGroup = new Set(g.members.map((m) => m.id))
  const list = invitable(s).filter((p) => !inGroup.has(p.id))
  const go = async () => {
    if (busy || !people.size) return
    setBusy(true)
    const chosen = list.filter((p) => people.has(p.id))
    const refused = await invite(g.id, chosen)
    const sent = chosen.length - refused.length
    onDone()
    say([sent ? (sent === 1 ? "Invitation sent." : `${sent} invitations sent.`) : "", ...refused].filter(Boolean))
  }
  return (
    <DialogContent onCloseAutoFocus={giveFocusBack}>
      <div className="flex flex-col gap-1">
        <DialogTitle className="wrap-anywhere">Invite to {g.name}</DialogTitle>
        <DialogDescription>They can accept it in Contacts, or run imbo group join #{g.id}.</DialogDescription>
      </div>
      <div className="-mx-2">
        {s.contacts.status === "loading" ? (
          <ListSkeleton rows={2} />
        ) : list.length ? (
          <ContactPicks list={list} chosen={people} onChange={setPeople} />
        ) : (
          <Note>{dataOf(s.contacts)?.length ? "All your contacts are already in this group." : "No contacts to invite yet."}</Note>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" className="text-foreground" onClick={onDone}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Button>
        <Button disabled={!people.size} aria-disabled={busy} onClick={go}>
          <Users size={16} aria-hidden="true" />
          {busy ? "Inviting…" : "Invite"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
