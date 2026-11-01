import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"
import {
  BellOff,
  Camera,
  Check,
  ChevronDown,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DrawerContent } from "@/components/ui/dialog"
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
import { t } from "@/i18n"
import { toolName } from "@/lib/format"
import { navigate } from "@/lib/router"
import { ConfirmContent } from "./confirm"
import { RenameRow, useRename, useReturnFocus } from "./rename"
import { pictureRefusal } from "./safety"
import { ListSkeleton } from "./states"

// Groups on the web (FLOW-GROUP-CREATE, FLOW-GROUP-SESSIONS, FLOW-GROUP-JOIN): New group, and a group's details with
// its members, inviting contacts and which of my sessions get its messages; for its owner also its name and picture,
// removing members, handing it on and dissolving it, for everyone else leaving it. One drawer for the whole page
// (rendered by the inbox shell), so the chats list, a group chat's title and an accepted invitation can all open it;
// inviting and the questions before removing, handing on, dissolving or leaving open over it.

type Open = { kind: "new" } | { kind: "details"; groupId: number }
let opened: Open | undefined
/** Where focus goes back to on close: nothing triggers these drawers in Radix's sense. */
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
  if (!name) return t("Give the group a name.")
  if ([...name].length > 64) return t("A group name is at most 64 characters.")
  if (name.includes("/")) return t("A group name can't contain /.")
  if (name.startsWith("#")) return t("A group name can't start with #.")
  if (/[\u0000-\u001f\u007f]/.test(name)) return t("A group name can't contain control characters.")
}

export const flip = <K,>(set: Set<K>, k: K) => {
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

export function Note({ children }: { children: ReactNode }) {
  return <p className="px-2 text-caption text-muted-foreground">{children}</p>
}

export function DialogError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 text-caption text-destructive">
      <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
      {children}
    </p>
  )
}

/**
 * A row that is all label for its checkbox, so a click anywhere on it ticks the box. `appear`: fades in, as rows Load more
 * adds. `disabled`: ticked by something else and can't be changed here.
 */
export function Pick({ checked, onChange, appear, disabled, children }: { checked: boolean; onChange: () => void; appear?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <li className={cn(appear && "pick-in")}>
      <label className={cn("grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-1.5", disabled ? "opacity-60" : "state-layer cursor-pointer")}>
        <Checkbox checked={checked} onCheckedChange={onChange} disabled={disabled} />
        {children}
      </label>
    </li>
  )
}

const PAGE = 20

/**
 * My sessions (API-014: online first, then by when they were last online), the first 20 and then 20 more each time Load
 * more is pressed (RULE-016); the first `keep` always show. One picked in the group that API-014 no longer lists (not
 * seen for 7 days) shows by name. `covered`: all ticked by their computer, so none can be changed. `bare`: listed under
 * their computer, so the computer's name is left out.
 */
export function SessionPicks({
  list,
  chosen,
  onChange,
  keep = 0,
  covered,
  bare,
}: {
  list: (MyAgent | AgentRef)[]
  chosen: Set<string>
  onChange: (next: Set<string>) => void
  keep?: number
  covered?: boolean
  bare?: boolean
}) {
  const first = Math.max(PAGE, keep)
  const [limit, setLimit] = useState(first)
  const ul = useRef<HTMLUListElement>(null)
  const rest = list.length - limit
  // Focus moves to the first row just shown, so the keyboard carries on down the list.
  const more = () => {
    setLimit(limit + PAGE)
    requestAnimationFrame(() => ul.current?.querySelectorAll<HTMLElement>("[role=checkbox]")[limit]?.focus())
  }
  return (
    <>
      <ul ref={ul} className="flex flex-col">
        {list.slice(0, limit).map((a, i) => (
          <Pick key={a.id} checked={covered || chosen.has(a.id)} onChange={() => onChange(flip(chosen, a.id))} appear={i >= first} disabled={covered}>
            <Avatar kind="agent" tool={a.tool} />
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
                {"online" in a && a.device_name && !bare && (
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
      {rest > 0 && (
        <div className="px-2 pt-2">
          <Button variant="outline" size="sm" onClick={more} aria-label={t("Load more sessions, {n} left", { n: rest })}>
            <ChevronDown size={14} aria-hidden="true" />
            <span className="flex gap-2">
              {t("Load more")}
              <span className="text-muted-foreground">{t("{n} left", { n: rest })}</span>
            </span>
          </Button>
        </div>
      )}
    </>
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
            <span className="block text-caption tabular-nums text-muted-foreground">{t("ID {id}", { id: p.id })}</span>
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
      say(made.refused.length ? [t("{group} created.", { group: n }), ...made.refused] : [chosen.length ? t("{group} created. Invitations sent.", { group: n }) : t("{group} created.", { group: n })])
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }

  const agents = s.agents
  return (
    <DrawerContent
      title={t("New group")}
      onCloseAutoFocus={giveFocusBack}
      action={
        <Button type="submit" form={formId} disabled={!name.trim()} aria-disabled={busy}>
          {busy ? t("Creating…") : t("Create group")}
        </Button>
      }
    >
      <form id={formId} onSubmit={create} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-label text-foreground">
            {t("Group name")}
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
            data-autofocus
          />
          <p id={`${nameId}-problem`} role="alert" className="min-h-5 text-caption text-destructive">
            {problem}
          </p>
        </div>
        <Section title={t("Your sessions")} hint={t("They get the group's messages and can reply. You can change this later in the group's details.")}>
          {agents.status === "loading" ? (
            <ListSkeleton rows={2} />
          ) : agents.status === "error" ? (
            <Retry failed={t("Couldn't load your sessions.")} message={agents.error.message} onRetry={() => retry("agents")} />
          ) : agents.data.length ? (
            <SessionPicks list={agents.data} chosen={sessions} onChange={setSessions} />
          ) : (
            <Note>{t("No sessions online or seen in the last 7 days. You can pick some later.")}</Note>
          )}
        </Section>
        <Section title={t("Invite contacts")} hint={t("They can accept it in Contacts, or run imbo group join.")}>
          {s.contacts.status === "loading" ? (
            <ListSkeleton rows={2} />
          ) : s.contacts.status === "error" ? (
            <Retry failed={t("Couldn't load contacts.")} message={s.contacts.error.message} onRetry={() => retry("contacts")} />
          ) : contacts.length ? (
            <ContactPicks list={contacts} chosen={people} onChange={setPeople} />
          ) : (
            <Note>{t("No contacts to invite yet.")}</Note>
          )}
        </Section>
      </form>
      <DialogError>{error}</DialogError>
    </DrawerContent>
  )
}

/** `failed` says what didn't load; `message` is why. */
export function Retry({ failed, message, onRetry }: { failed: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2">
      <p className="min-w-0 text-caption text-muted-foreground">
        {failed} {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("Try again")}
      </Button>
    </div>
  )
}

const same = (a: Set<string>, b: AgentRef[]) => a.size === b.length && b.every((x) => a.has(x.id))

/**
 * API-021: the sessions already in the group first, then the rest of API-014, then any in the group that API-014 no
 * longer lists. Save shows once changed.
 */
function MySessions({ s, g }: { s: State; g: Group }) {
  const [chosen, setChosen] = useState(() => new Set(g.my_sessions.map((x) => x.id)))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      await setGroupSessions(g.id, [...chosen])
      const n = chosen.size
      toast(
        n === 0
          ? t("Saved. None of your sessions get {group}'s messages.", { group: g.name })
          : n === 1
            ? t("Saved. 1 session gets {group}'s messages.", { group: g.name })
            : t("Saved. {n} sessions get {group}'s messages.", { n, group: g.name })
      )
    } catch (e) {
      toast.error(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  const agents = s.agents
  if (agents.status === "loading") return <ListSkeleton rows={2} />
  if (agents.status === "error") return <Retry failed={t("Couldn't load your sessions.")} message={agents.error.message} onRetry={() => retry("agents")} />
  const listed = new Set(agents.data.map((a) => a.id))
  const picked = new Set(g.my_sessions.map((x) => x.id))
  const all = [...agents.data, ...g.my_sessions.filter((x) => !listed.has(x.id))]
  const list = [...all.filter((a) => picked.has(a.id)), ...all.filter((a) => !picked.has(a.id))]
  if (!list.length) return <Note>{t("No sessions online or seen in the last 7 days.")}</Note>
  return (
    <>
      <SessionPicks list={list} chosen={chosen} onChange={setChosen} keep={picked.size} />
      {!same(chosen, g.my_sessions) && (
        <div className="px-2 pt-2">
          <Button aria-disabled={busy} onClick={save}>
            <Check size={16} aria-hidden="true" />
            {busy ? t("Saving…") : t("Save")}
          </Button>
        </div>
      )}
    </>
  )
}

/** Menus opened from the group's details sit over the drawer, not under it. */
const IN_DIALOG = "z-(--semantic-layout-z-index-modal)"

/** The owner's "…" on each other member: hand the group on, or remove them. */
function MemberActions({ m, onAsk }: { m: Member; onAsk: (kind: "transfer" | "remove") => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("Actions for {name}", { name: m.name })} className="text-muted-foreground">
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={IN_DIALOG}>
        <DropdownMenuItem onSelect={() => onAsk("transfer")}>
          <Crown size={16} aria-hidden="true" />
          {t("Make {name} the owner…", { name: m.name })}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAsk("remove")} className="text-destructive [&_svg]:text-destructive">
          <UserMinus size={16} aria-hidden="true" />
          {t("Remove {name}…", { name: m.name })}
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
              {g.owner?.id === m.id && <Tag>{t("Owner")}</Tag>}
              {isMe(s, m.id) && <Tag>{t("You")}</Tag>}
              {!m.active && <Tag>{t("Inactive")}</Tag>}
            </span>
            <span className="block text-caption tabular-nums text-muted-foreground">{t("ID {id}", { id: m.id })}</span>
          </span>
          {onAsk && !isMe(s, m.id) ? <MemberActions m={m} onAsk={(kind) => onAsk(kind, m)} /> : <span />}
        </li>
      ))}
    </ul>
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
      toast.error(e instanceof ApiError && e.status === 429 ? t("You've changed pictures 20 times today. Try again tomorrow.") : pictureRefusal(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="state-layer focus-ring relative flex-none rounded-full"
          aria-label={t("Change group picture")}
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
            {t("Upload picture…")}
          </DropdownMenuItem>
          {g.avatar_url && (
            <DropdownMenuItem onSelect={() => run(() => removeGroupPicture(g.id), t("Group picture removed."))} className="text-destructive [&_svg]:text-destructive">
              <Trash2 size={16} aria-hidden="true" />
              {t("Remove picture")}
            </DropdownMenuItem>
          )}
          <p className="mt-1 border-t-(length:--semantic-layout-hairline) border-border px-2 pt-2 pb-1 text-caption text-muted-foreground">
            {t("JPEG or PNG, up to 5 MB. Imbo crops it to a square.")}
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
          if (f) run(() => uploadGroupPicture(g.id, f), t("Group picture updated."))
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
      <RenameRow r={r} label={t("Group name")} hint={t("Members see the new name in their group list. 1–64 characters, can't start with #.")} />
    </>
  )
}

type View =
  | { kind: "details" }
  | { kind: "invite" }
  | { kind: "remove" | "transfer"; m: Member }
  | { kind: "dissolve" | "leave" }

/** Out of the group or the group is gone: the drawer closes, and its chat with it if that's where I am. */
function left(g: Group, s: State, say: string) {
  close()
  const chat = dataOf(s.conversations)?.find((c) => c.group?.id === g.id)?.id
  if (chat && location.pathname === `/chats/${chat}`) navigate("/chats", { replace: true })
  toast(say)
}

/** One of the owner's or a member's questions over the details; Cancel goes back to them. */
function GroupConfirm({
  s,
  g,
  v,
  onBack,
  onCloseAutoFocus,
}: {
  s: State
  g: Group
  v: Exclude<View, { kind: "details" | "invite" }>
  onBack: () => void
  onCloseAutoFocus: (e: Event) => void
}) {
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
  const common = { busy, error, onCancel: onBack, onCloseAutoFocus }
  const n = g.members.length
  switch (v.kind) {
    case "remove":
      return (
        <ConfirmContent
          {...common}
          title={t("Remove {name} from {group}?", { name: v.m.name, group: g.name })}
          consequences={[
            [<BellOff size={16} />, t("{name}'s sessions stop getting this group's messages.", { name: v.m.name })],
            [<Undo2 size={16} />, t("Messages to {name} from this group that haven't been delivered yet are taken back.", { name: v.m.name })],
            [<UserRound size={16} />, t("{name} sees a notice in their inbox. You can invite them again later.", { name: v.m.name })],
          ]}
          action={{ label: t("Remove {name}", { name: v.m.name }), busyLabel: t("Removing…"), icon: <UserMinus size={16} aria-hidden="true" />, destructive: true }}
          onConfirm={() =>
            run(
              () => removeMember(g.id, v.m.id),
              () => (onBack(), toast(t("{name} was removed from {group}.", { name: v.m.name, group: g.name }))),
            )
          }
        />
      )
    case "transfer":
      return (
        <ConfirmContent
          {...common}
          title={t("Make {name} the owner of {group}?", { name: v.m.name, group: g.name })}
          consequences={[
            [<Crown size={16} />, t("{name} can rename the group, change its picture, remove members, hand it on and dissolve it.", { name: v.m.name })],
            [<UserRound size={16} />, t("You stay in the group as a member, and can't undo this yourself.")],
          ]}
          action={{ label: t("Make {name} the owner", { name: v.m.name }), busyLabel: t("Handing it on…"), icon: <Crown size={16} aria-hidden="true" /> }}
          onConfirm={() =>
            run(
              () => transferGroup(g.id, v.m.id),
              () => (onBack(), toast(t("{name} is now the owner of {group}.", { name: v.m.name, group: g.name }))),
            )
          }
        />
      )
    case "dissolve":
      return (
        <ConfirmContent
          {...common}
          title={t("Dissolve {group}?", { group: g.name })}
          consequences={[
            [<Users size={16} />, n === 1 ? t("You leave the group, and nobody is left in it.") : t("All {n} members leave the group, you included.", { n })],
            [<Undo2 size={16} />, t("Messages to the group that haven't been delivered yet are taken back.")],
            [<MessageSquareOff size={16} />, t("Nobody can message or join {group} again. This can't be undone.", { group: g.name })],
          ]}
          action={{ label: t("Dissolve group"), busyLabel: t("Dissolving…"), icon: <Trash2 size={16} aria-hidden="true" />, destructive: true }}
          onConfirm={() => run(() => dissolveGroup(g.id), () => left(g, s, t("{group} was dissolved.", { group: g.name })))}
        />
      )
    case "leave":
      return (
        <ConfirmContent
          {...common}
          title={t("Leave {group}?", { group: g.name })}
          consequences={[
            [<BellOff size={16} />, t("Your sessions stop getting this group's messages.")],
            [<Undo2 size={16} />, t("Messages to you from this group that haven't been delivered yet are taken back.")],
            [<UserPlus size={16} />, t("To come back, someone in the group has to invite you again.")],
          ]}
          action={{ label: t("Leave group"), busyLabel: t("Leaving…"), icon: <LogOut size={16} aria-hidden="true" />, destructive: true }}
          onConfirm={() => run(() => leaveGroup(g.id), () => left(g, s, t("You left {group}.", { group: g.name })))}
        />
      )
  }
}

/**
 * PAGE-WEB-GROUP (FLOW-GROUP-SESSIONS): who is in the group and who owns it (API-019), inviting contacts (API-020), who
 * accept in Contacts or from a terminal, and which of my sessions get its messages (API-021). Its owner renames it,
 * changes its picture, removes members, hands it on and dissolves it (API-077, API-056/057, API-037, API-038,
 * API-039); anyone else can leave it (API-022). Nothing here is one form, so the drawer's bar has only Close.
 */
function GroupDetailsDialog({ s, groupId }: { s: State; groupId: number }) {
  const [view, setView] = useState<View>({ kind: "details" })
  const [renaming, setRenaming] = useState(false)
  const pencil = useReturnFocus(renaming)
  // What had focus when a question or the invitations opened over the details, to have it back after.
  const opener = useRef<Element | null>(null)
  useEffect(() => {
    refreshList("groups")
    refreshList("agents")
    refreshList("contacts")
  }, [])
  const l = s.groups
  const g = groupOf(s, groupId)
  if (l.status !== "ready" || !g)
    return (
      <DrawerContent title={t("Group details")} cancel={t("Close")} onCloseAutoFocus={giveFocusBack}>
        {l.status === "loading" ? (
          <ListSkeleton rows={3} />
        ) : l.status === "error" ? (
          <Retry failed={t("Couldn't load this group.")} message={l.error.message} onRetry={() => retry("groups")} />
        ) : (
          <p className="text-body text-muted-foreground">{t("This group isn't here. It may have been dissolved, or you left it.")}</p>
        )}
      </DrawerContent>
    )
  const owner = !!g.owner && isMe(s, g.owner.id)
  const n = g.members.length
  const renamed = () => setRenaming(false)
  const ask = (v: View) => {
    opener.current = document.activeElement
    setView(v)
  }
  const back = () => setView({ kind: "details" })
  const focusOpener = (e: Event) => {
    e.preventDefault()
    if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus()
  }
  return (
    <DrawerContent
      cancel={t("Close")}
      onCloseAutoFocus={giveFocusBack}
      // Escape while renaming leaves the name as it was and keeps the details open.
      onEscapeKeyDown={(e) => {
        if (!renaming || !owner) return
        e.preventDefault()
        renamed()
      }}
      header={
        <div className="flex items-center gap-3">
          {owner ? <GroupPicture g={g} /> : <Avatar kind="group" label={g.name} src={g.avatar_url} size="lg" />}
          {owner && renaming ? (
            <RenameGroup g={g} onDone={renamed} />
          ) : (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <DialogTitle className="min-w-0 wrap-anywhere">{g.name}</DialogTitle>
                {owner && (
                  <Button ref={pencil} variant="ghost" size="icon" aria-label={t("Rename group")} className="flex-none text-muted-foreground" onClick={() => setRenaming(true)}>
                    <Pencil size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
              <p className="flex items-center gap-2 text-caption tabular-nums text-muted-foreground">
                {t("Group {id}", { id: g.id })}
                <Sep />
                {n === 1 ? t("1 member") : t("{n} members", { n })}
              </p>
            </div>
          )}
        </div>
      }
    >
      <Section title={t("Members")}>
        {/* The owner's menu asks on the next frame, once it has closed and handed focus back to its "…". */}
        <Members s={s} g={g} onAsk={owner ? (kind, m) => requestAnimationFrame(() => ask({ kind, m })) : undefined} />
      </Section>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => ask({ kind: "invite" })}>
          <UserPlus size={16} aria-hidden="true" />
          {t("Invite contacts")}
        </Button>
        {owner ? (
          <Button variant="destructive" onClick={() => ask({ kind: "dissolve" })}>
            <Trash2 size={16} aria-hidden="true" />
            {t("Dissolve group…")}
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => ask({ kind: "leave" })}>
            <LogOut size={16} aria-hidden="true" />
            {t("Leave group…")}
          </Button>
        )}
      </div>
      <Section title={t("Your sessions in this group")} hint={t("They get the group's messages and can reply.")}>
        <MySessions key={g.my_sessions.map((x) => x.id).join()} s={s} g={g} />
      </Section>
      <Dialog open={view.kind !== "details"} onOpenChange={(open) => !open && back()}>
        {view.kind === "invite" ? (
          <InviteView s={s} g={g} onDone={back} onCloseAutoFocus={focusOpener} />
        ) : (
          view.kind !== "details" && <GroupConfirm s={s} g={g} v={view} onBack={back} onCloseAutoFocus={focusOpener} />
        )}
      </Dialog>
    </DrawerContent>
  )
}

/** Invitations over the group's details; back to the details when sent, with what was refused in the toast. */
function InviteView({ s, g, onDone, onCloseAutoFocus }: { s: State; g: Group; onDone: () => void; onCloseAutoFocus: (e: Event) => void }) {
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
    say([sent ? (sent === 1 ? t("Invitation sent.") : t("{n} invitations sent.", { n: sent })) : "", ...refused].filter(Boolean))
  }
  return (
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <div className="flex flex-col gap-1">
        <DialogTitle className="wrap-anywhere">{t("Invite to {group}", { group: g.name })}</DialogTitle>
        <DialogDescription>{t("They can accept it in Contacts, or run imbo group join #{id}.", { id: g.id })}</DialogDescription>
      </div>
      <div className="-mx-2">
        {s.contacts.status === "loading" ? (
          <ListSkeleton rows={2} />
        ) : list.length ? (
          <ContactPicks list={list} chosen={people} onChange={setPeople} />
        ) : (
          <Note>{dataOf(s.contacts)?.length ? t("All your contacts are already in this group.") : t("No contacts to invite yet.")}</Note>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" className="text-foreground" onClick={onDone}>
          {t("Cancel")}
        </Button>
        <Button disabled={!people.size} aria-disabled={busy} onClick={go}>
          <Users size={16} aria-hidden="true" />
          {busy ? t("Inviting…") : t("Invite")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
