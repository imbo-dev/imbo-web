import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  BellOff,
  Camera,
  Check,
  CircleAlert,
  Crown,
  LogOut,
  MessageSquareOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  Undo2,
  Upload,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Avatar, Presence, Sep, Tag } from "@/components/bits"
import type { AgentRef, Contact, Group, Member, MyAgent } from "@/data/contract"
import { ApiError, messageOf } from "@/data/layer"
import {
  PICTURE_TYPES,
  createGroup,
  dataOf,
  dissolveGroup,
  groupOf,
  invite,
  isBlocked,
  isMe,
  leaveGroup,
  refreshList,
  removeGroupPicture,
  removeMember,
  renameGroup,
  retry,
  setGroupSessions,
  transferGroup,
  uploadGroupPicture,
  type State,
} from "@/data/store"
import { toolName } from "@/lib/format"
import { navigate } from "@/lib/router"
import { ConfirmContent } from "./confirm"
import { RenameRow, useRename, useReturnFocus } from "./rename"
import { pictureRefusal } from "./safety"
import { ListSkeleton } from "./states"

// Groups on the web (FLOW-GROUP-CREATE, FLOW-GROUP-SESSIONS, FLOW-GROUP-JOIN): New group, and a group's details with
// its members, which of my sessions get its messages, and inviting contacts; for its owner also its name and picture,
// removing members, handing it on and dissolving it, for everyone else leaving it. One dialog for the whole page
// (rendered by the inbox shell), so the chats list, a group chat's title and an accepted invitation can all open it.

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

/** Menus opened from the group's details sit over the dialog, not under it. */
const IN_DIALOG = "z-(--semantic-layout-z-index-modal)"

/** The owner's "…" on each other member: hand the group on, or remove them. */
function MemberActions({ m, onAsk }: { m: Member; onAsk: (kind: "transfer" | "remove") => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${m.name}`} className="text-muted-foreground">
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={IN_DIALOG}>
        <DropdownMenuItem onSelect={() => onAsk("transfer")}>
          <Crown size={16} aria-hidden="true" />
          Make {m.name} the owner…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAsk("remove")} className="text-destructive [&_svg]:text-destructive">
          <UserMinus size={16} aria-hidden="true" />
          Remove {m.name}…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Members({ s, g, onAsk }: { s: State; g: Group; onAsk?: (kind: "transfer" | "remove", m: Member) => void }) {
  return (
    <ul className="flex flex-col">
      {g.members.map((m) => (
        <li key={m.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2 py-1.5">
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
          {onAsk && !isMe(s, m.id) ? <MemberActions m={m} onAsk={(kind) => onAsk(kind, m)} /> : <span />}
        </li>
      ))}
    </ul>
  )
}

/** `start`: a button on the other side, such as Leave group…. */
function CloseFooter({ start }: { start?: ReactNode }) {
  return (
    <DialogFooter className={cn(start && "sm:justify-between")}>
      {start}
      <Button variant="ghost" className="text-foreground" onClick={close}>
        Close
      </Button>
    </DialogFooter>
  )
}

/** The owner's picture menu (API-056, API-057): upload a JPEG or PNG, or remove the one there. */
function GroupPicture({ g }: { g: Group }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const run = async (f: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await f()
      toast(done)
    } catch (e) {
      // Pictures of my own and of my groups share the day's 20 changes.
      toast.error(e instanceof ApiError && e.status === 429 ? "You've changed pictures 20 times today. Try again tomorrow." : pictureRefusal(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="state-layer focus-ring relative flex-none rounded-full"
          aria-label="Change group picture"
          aria-disabled={busy}
          onPointerDown={(e) => busy && e.preventDefault()}
        >
          <span className={cn("block", busy && "opacity-60")}>
            <Avatar kind="group" label={g.name} src={g.avatar_url} size="lg" />
          </span>
          <span aria-hidden="true" className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-(length:--semantic-layout-hairline) border-border bg-popover text-muted-foreground">
            <Camera size={12} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={cn("max-w-64", IN_DIALOG)}>
          <DropdownMenuItem onSelect={() => file.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Upload picture…
          </DropdownMenuItem>
          {g.avatar_url && (
            <DropdownMenuItem onSelect={() => run(() => removeGroupPicture(g.id), "Group picture removed.")} className="text-destructive [&_svg]:text-destructive">
              <Trash2 size={16} aria-hidden="true" />
              Remove picture
            </DropdownMenuItem>
          )}
          <p className="mt-1 border-t-(length:--semantic-layout-hairline) border-border px-2 pt-2 pb-1 text-caption text-muted-foreground">
            JPEG or PNG, up to 5 MB. Imbo crops it to a square.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={file}
        type="file"
        accept={PICTURE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (f) run(() => uploadGroupPicture(g.id, f), "Group picture updated.")
        }}
      />
    </>
  )
}

/** API-077: the owner renames the group in place. The rules are API-018's. */
function RenameGroup({ g, onDone }: { g: Group; onDone: () => void }) {
  const r = useRename(g.name, (name) => renameGroup(g.id, name), onDone, nameProblem)
  return (
    <>
      <DialogTitle className="sr-only">{g.name}</DialogTitle>
      <RenameRow r={r} label="Group name" hint="Members see the new name in their group list. 1–64 characters, can't start with #." />
    </>
  )
}

type View =
  | { kind: "details" }
  | { kind: "invite" }
  | { kind: "remove" | "transfer"; m: Member }
  | { kind: "dissolve" | "leave" }

/** Out of the group or the group is gone: the dialog closes, and its chat with it if that's where I am. */
function left(g: Group, s: State, say: string) {
  close()
  const chat = dataOf(s.conversations)?.find((c) => c.group?.id === g.id)?.id
  if (chat && location.pathname === `/chats/${chat}`) navigate("/chats", { replace: true })
  toast(say)
}

/** One of the owner's or a member's questions in place of the details; Cancel goes back to them. */
function GroupConfirm({ s, g, v, onBack }: { s: State; g: Group; v: Exclude<View, { kind: "details" | "invite" }>; onBack: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const run = async (f: () => Promise<void>, then: () => void) => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await f()
      then()
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  const common = { busy, error, onCancel: onBack, onCloseAutoFocus: giveFocusBack }
  const n = g.members.length
  switch (v.kind) {
    case "remove":
      return (
        <ConfirmContent
          {...common}
          title={`Remove ${v.m.name} from ${g.name}?`}
          consequences={[
            [<BellOff size={16} />, `${v.m.name}'s sessions stop getting this group's messages.`],
            [<Undo2 size={16} />, `Messages to ${v.m.name} from this group that haven't been delivered yet are taken back.`],
            [<UserRound size={16} />, `${v.m.name} sees a notice in their terminal inbox. You can invite them again later.`],
          ]}
          action={{ label: `Remove ${v.m.name}`, busyLabel: "Removing…", icon: <UserMinus size={16} aria-hidden="true" />, destructive: true }}
          onConfirm={() =>
            run(
              () => removeMember(g.id, v.m.id),
              () => (onBack(), toast(`${v.m.name} was removed from ${g.name}.`)),
            )
          }
        />
      )
    case "transfer":
      return (
        <ConfirmContent
          {...common}
          title={`Make ${v.m.name} the owner of ${g.name}?`}
          consequences={[
            [<Crown size={16} />, `${v.m.name} can rename the group, change its picture, remove members, hand it on and dissolve it.`],
            [<UserRound size={16} />, "You stay in the group as a member, and can't undo this yourself."],
          ]}
          action={{ label: `Make ${v.m.name} the owner`, busyLabel: "Handing it on…", icon: <Crown size={16} aria-hidden="true" /> }}
          onConfirm={() =>
            run(
              () => transferGroup(g.id, v.m.id),
              () => (onBack(), toast(`${v.m.name} is now the owner of ${g.name}.`)),
            )
          }
        />
      )
    case "dissolve":
      return (
        <ConfirmContent
          {...common}
          title={`Dissolve ${g.name}?`}
          consequences={[
            [<Users size={16} />, n === 1 ? "You leave the group, and nobody is left in it." : `All ${n} members leave the group, you included.`],
            [<Undo2 size={16} />, "Messages to the group that haven't been delivered yet are taken back."],
            [<MessageSquareOff size={16} />, `Nobody can message or join ${g.name} again. This can't be undone.`],
          ]}
          action={{ label: "Dissolve group", busyLabel: "Dissolving…", icon: <Trash2 size={16} aria-hidden="true" />, destructive: true }}
          onConfirm={() => run(() => dissolveGroup(g.id), () => left(g, s, `${g.name} was dissolved.`))}
        />
      )
    case "leave":
      return (
        <ConfirmContent
          {...common}
          title={`Leave ${g.name}?`}
          consequences={[
            [<BellOff size={16} />, "Your sessions stop getting this group's messages."],
            [<Undo2 size={16} />, "Messages to you from this group that haven't been delivered yet are taken back."],
            [<UserPlus size={16} />, "To come back, someone in the group has to invite you again."],
          ]}
          action={{ label: "Leave group", busyLabel: "Leaving…", icon: <LogOut size={16} aria-hidden="true" />, destructive: true }}
          onConfirm={() => run(() => leaveGroup(g.id), () => left(g, s, `You left ${g.name}.`))}
        />
      )
  }
}

/**
 * PAGE-WEB-GROUP (FLOW-GROUP-SESSIONS): who is in the group and who owns it (API-019), which of my sessions get its
 * messages (API-021), and inviting contacts (API-020), who accept in Contacts or from a terminal. Its owner renames
 * it, changes its picture, removes members, hands it on and dissolves it (API-077, API-056/057, API-037, API-038,
 * API-039); anyone else can leave it (API-022).
 */
function GroupDetailsDialog({ s, groupId }: { s: State; groupId: number }) {
  const [view, setView] = useState<View>({ kind: "details" })
  const [renaming, setRenaming] = useState(false)
  const pencil = useReturnFocus(renaming)
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
  const back = () => setView({ kind: "details" })
  if (view.kind === "invite") return <InviteView s={s} g={g} onDone={back} />
  if (view.kind !== "details") return <GroupConfirm s={s} g={g} v={view} onBack={back} />
  const owner = !!g.owner && isMe(s, g.owner.id)
  const n = g.members.length
  const renamed = () => setRenaming(false)
  return (
    <DialogContent
      aria-describedby={undefined}
      onCloseAutoFocus={giveFocusBack}
      // Escape while renaming leaves the name as it was and keeps the details open.
      onEscapeKeyDown={(e) => {
        if (!renaming || !owner) return
        e.preventDefault()
        renamed()
      }}
    >
      <div className="flex items-center gap-3">
        {owner ? <GroupPicture g={g} /> : <Avatar kind="group" label={g.name} src={g.avatar_url} size="lg" />}
        {owner && renaming ? (
          <RenameGroup g={g} onDone={renamed} />
        ) : (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <DialogTitle className="min-w-0 wrap-anywhere">{g.name}</DialogTitle>
              {owner && (
                <Button ref={pencil} variant="ghost" size="icon" aria-label="Rename group" className="flex-none text-muted-foreground" onClick={() => setRenaming(true)}>
                  <Pencil size={14} aria-hidden="true" />
                </Button>
              )}
            </div>
            <p className="flex items-center gap-2 text-caption tabular-nums text-muted-foreground">
              Group {g.id}
              <Sep />
              {n === 1 ? "1 member" : `${n} members`}
            </p>
          </div>
        )}
      </div>
      <Section title="Your sessions in this group" hint="They get the group's messages and can reply.">
        <MySessions key={g.my_sessions.map((x) => x.id).join()} s={s} g={g} />
      </Section>
      <Section title="Members">
        <Members s={s} g={g} onAsk={owner ? (kind, m) => setView({ kind, m }) : undefined} />
      </Section>
      <div>
        <Button variant="outline" onClick={() => setView({ kind: "invite" })}>
          <UserPlus size={16} aria-hidden="true" />
          Invite contacts
        </Button>
      </div>
      <CloseFooter
        start={
          owner ? (
            <Button variant="destructive" onClick={() => setView({ kind: "dissolve" })}>
              <Trash2 size={16} aria-hidden="true" />
              Dissolve group…
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setView({ kind: "leave" })}>
              <LogOut size={16} aria-hidden="true" />
              Leave group…
            </Button>
          )
        }
      />
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
