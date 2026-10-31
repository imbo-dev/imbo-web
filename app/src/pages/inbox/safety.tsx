import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { toast } from "sonner"
import {
  Ban,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  EyeOff,
  Flag,
  Lock,
  MessageSquareOff,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  UserMinus,
  UserRound,
} from "lucide-react"
import { Popover, RadioGroup } from "radix-ui"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, CopyId, Sep, Tag } from "@/components/bits"
import type { Conversation, Member, Profile } from "@/data/contract"
import { ApiError, messageOf, type ReportReason } from "@/data/layer"
import {
  PICTURE_TYPES,
  block,
  contactOf,
  dataOf,
  groupOf,
  isBlocked,
  isMe,
  refreshList,
  removePicture,
  report,
  retry,
  unblock,
  uploadPicture,
  useStore,
  type State,
} from "@/data/store"
import { shortDate } from "@/lib/format"
import { navigate, onLinkClick } from "@/lib/router"
import { askRemoveContact } from "./contacts"
import { EmptyState, ErrorState, ListSkeleton } from "./states"

// Pictures, blocking and reporting on the web (FLOW-AVATAR, FLOW-BLOCK, FLOW-REPORT): the account's picture, the
// blocked list, the "…" menu on a contact or direct chat, a group's members and the profile card, and the block and
// report dialogs they open.

type GroupRef = { id: number; name: string }

// ── Dialogs ──────────────────────────────────────────────────────────────────
// One block dialog and one report dialog for the whole page (rendered by the inbox shell), so a menu or a profile card
// can close as the dialog opens.

type Ask = { kind: "block"; who: Profile } | { kind: "report"; who: Profile; group?: GroupRef }
let asking: Ask | undefined
const askListeners = new Set<() => void>()
function setAsk(a: Ask | undefined) {
  asking = a
  askListeners.forEach((l) => l())
}
const subscribeAsk = (l: () => void) => (askListeners.add(l), () => askListeners.delete(l))
/** Opened on the next frame, after the menu or popover that asked has closed and handed focus back. */
const later = (a: Ask) => requestAnimationFrame(() => setAsk(a))
export const askBlock = (who: Profile) => later({ kind: "block", who })
export const askReport = (who: Profile, group?: GroupRef) => later({ kind: "report", who, group })

/** Unblocking needs no confirmation (it can be undone by blocking again); a failure says why. */
export async function unblockNow(who: Profile) {
  try {
    await unblock(who.id)
    toast(`${who.name} is unblocked.`)
  } catch (e) {
    toast.error(messageOf(e))
  }
}

export function SafetyDialogs({ s }: { s: State }) {
  const a = useSyncExternalStore(subscribeAsk, () => asking)
  const close = (open: boolean) => !open && setAsk(undefined)
  return (
    <>
      <Dialog open={a?.kind === "block"} onOpenChange={close}>
        {a?.kind === "block" && <BlockDialog s={s} who={a.who} />}
      </Dialog>
      <Dialog open={a?.kind === "report"} onOpenChange={close}>
        {a?.kind === "report" && <ReportDialog s={s} who={a.who} group={a.group} />}
      </Dialog>
    </>
  )
}

/** Red text above a dialog's buttons when the server refused. */
export function DialogError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 text-caption text-destructive">
      <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
      {children}
    </p>
  )
}

export function Consequence({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-body text-foreground">
      <span aria-hidden="true" className="mt-1 flex-none text-muted-foreground">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}

/** API-058, FLOW-BLOCK S1: what blocking does (S3 to S5), then Block or Cancel. Focus starts on Cancel. */
function BlockDialog({ s, who }: { s: State; who: Profile }) {
  const cancel = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const contact = !!contactOf(s, who.id)
  const go = async () => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await block(who.id)
      setAsk(undefined)
      toast(`${who.name} is blocked.`)
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
      <DialogTitle>Block {who.name}?</DialogTitle>
      <ul className="flex flex-col gap-3">
        <Consequence icon={<MessageSquareOff size={16} />}>
          {who.name} can't send you direct messages, contact requests or group invites. If they try, they're told you don't accept their messages.
        </Consequence>
        <Consequence icon={<EyeOff size={16} />}>Their messages in groups you share are hidden from you.</Consequence>
        <Consequence icon={<Undo2 size={16} />}>
          Messages between you that haven't been delivered yet are taken back, and pending contact requests and group invites between you are closed.
        </Consequence>
        <Consequence icon={<UserRound size={16} />}>
          {contact ? `${who.name} stays in your contacts, and you can unblock them any time.` : `You can unblock ${who.name} any time in Account.`}
        </Consequence>
      </ul>
      <DialogError>{error}</DialogError>
      <DialogFooter>
        <Button ref={cancel} variant="ghost" className="text-foreground" onClick={() => setAsk(undefined)}>
          Cancel
        </Button>
        <Button variant="destructive" aria-disabled={busy} onClick={go}>
          <Ban size={16} aria-hidden="true" />
          {busy ? "Blocking…" : "Block"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "spam", label: "Spam", hint: "Ads, scams or messages nobody asked for" },
  { value: "harassment", label: "Harassment", hint: "Insults, threats or pressure to do something" },
  { value: "inappropriate_avatar", label: "Inappropriate picture", hint: "Their profile picture is offensive" },
  { value: "other", label: "Something else", hint: "Tell us in the details" },
]
/** The server counts the note's characters (code points) after trimming, up to 500. */
const NOTE_MAX = 500
const noteLength = (note: string) => [...note.trim()].length

/** Why a report didn't go through, in the words of FLOW-REPORT; anything else in the server's own words. */
function reportRefusal(e: unknown, group?: GroupRef) {
  if (!(e instanceof ApiError)) return messageOf(e)
  if (e.status === 429) return "You've sent too many reports today. Try again tomorrow."
  if (e.type === "/errors/not-member" && group) return `You're no longer in ${group.name}.`
  return e.message
}

/**
 * API-061, FLOW-REPORT S1–S3: a reason, optional details, and what gets attached; then "Report sent" with an offer to
 * block. An open report already on file (409) counts as sent.
 */
function ReportDialog({ s, who, group }: { s: State; who: Profile; group?: GroupRef }) {
  const [reason, setReason] = useState<ReportReason>()
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState<"new" | "already">()
  const noteId = useId()
  const reasonError = useId()
  const noteError = useId()
  const firstReason = useRef<HTMLButtonElement>(null)
  const [missing, setMissing] = useState(false)
  const long = noteLength(note) > NOTE_MAX
  const send = async () => {
    if (busy || long) return
    if (!reason) {
      setMissing(true)
      firstReason.current?.focus()
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await report(who.id, reason, note.trim() || undefined, group?.id)
      setSent("new")
    } catch (e) {
      if (e instanceof ApiError && e.type === "/errors/already-reported") setSent("already")
      else setError(reportRefusal(e, group))
    } finally {
      setBusy(false)
    }
  }
  if (sent) return <ReportSent s={s} who={who} already={sent === "already"} />
  return (
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>Report {who.name}</DialogTitle>
      <RadioGroup.Root
        value={reason}
        onValueChange={(v) => (setReason(v as ReportReason), setMissing(false))}
        aria-label={`Why are you reporting ${who.name}?`}
        aria-describedby={missing ? reasonError : undefined}
        className="flex flex-col gap-2"
      >
        <p aria-hidden="true" className="text-label text-foreground">
          Why are you reporting {who.name}?
        </p>
        {REASONS.map((r, i) => (
          <RadioGroup.Item
            key={r.value}
            ref={i === 0 ? firstReason : undefined}
            value={r.value}
            className="state-layer focus-ring grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-md border-(length:--semantic-layout-hairline) border-border px-3 py-2.5 text-left data-[state=checked]:border-foreground data-[state=checked]:bg-accent"
          >
            <span aria-hidden="true" className="mt-0.5 grid size-4 place-items-center rounded-full border-(length:--primitive-dimension-ring-width) border-muted-foreground">
              <RadioGroup.Indicator className="size-2 rounded-full bg-foreground" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body text-foreground">{r.label}</span>
              <span className="text-caption text-muted-foreground">{r.hint}</span>
            </span>
          </RadioGroup.Item>
        ))}
        {missing && (
          <p id={reasonError} role="alert" className="text-caption text-destructive">
            Pick a reason first.
          </p>
        )}
      </RadioGroup.Root>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-label text-foreground">
          Details <span className="text-muted-foreground">(optional)</span>
        </label>
        <div className="state-layer focus-ring is-field rounded-md border border-input bg-muted">
          <textarea
            id={noteId}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={long || undefined}
            aria-describedby={long ? noteError : undefined}
            placeholder="What happened?"
            className="block w-full resize-none bg-transparent px-3 py-2 text-body text-foreground outline-none placeholder:text-(--semantic-color-text-tertiary)"
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <p id={noteError} role={long ? "alert" : undefined} className="text-caption text-destructive">
            {long && `Details can be up to ${NOTE_MAX} characters.`}
          </p>
          <p className={cn("flex-none text-caption tabular-nums", long ? "text-destructive" : "text-muted-foreground")}>
            {noteLength(note)} / {NOTE_MAX}
          </p>
        </div>
      </div>
      <p className="flex items-start gap-2 text-caption text-muted-foreground">
        <Lock size={14} aria-hidden="true" className="mt-0.5 flex-none" />
        <span>
          {group ? `Imbo attaches the last 20 messages ${who.name} sent in ${group.name}.` : `Imbo attaches the last 20 messages between you and ${who.name}.`} Only Imbo's
          admins see them, and {who.name} isn't told.
        </span>
      </p>
      <DialogError>{error}</DialogError>
      <DialogFooter>
        <Button variant="ghost" className="text-foreground" onClick={() => setAsk(undefined)}>
          Cancel
        </Button>
        <Button aria-disabled={busy || long} onClick={send}>
          {busy ? "Sending…" : "Send report"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** FLOW-REPORT S3: done, and the offer to block (S7), unless they're blocked already. */
function ReportSent({ s, who, already }: { s: State; who: Profile; already: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const blocked = isBlocked(s, who.id)
  const blockToo = async () => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await block(who.id)
      setAsk(undefined)
      toast(`${who.name} is blocked.`)
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>Report sent</DialogTitle>
      <p role="status" className="flex items-start gap-2 text-body text-foreground">
        <CircleCheck size={16} aria-hidden="true" className="mt-1 flex-none text-(--semantic-color-feedback-success)" />
        {already ? `You've already reported ${who.name}. We'll review it within 24 hours.` : "Thanks. We review reports within 24 hours."}
      </p>
      {blocked ? (
        <DialogFooter>
          <Button onClick={() => setAsk(undefined)}>Done</Button>
        </DialogFooter>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 border-t-(length:--semantic-layout-hairline) border-border pt-4">
            <h3 className="text-body-strong text-foreground">Block {who.name} too?</h3>
            <p className="text-body text-muted-foreground">
              {who.name} won't be able to send you direct messages, contact requests or group invites, and you won't see their messages in shared groups. You can
              unblock them in Account.
            </p>
          </div>
          <DialogError>{error}</DialogError>
          <DialogFooter>
            <Button variant="ghost" className="text-foreground" onClick={() => setAsk(undefined)}>
              Not now
            </Button>
            <Button variant="destructive" aria-disabled={busy} onClick={blockToo}>
              <Ban size={16} aria-hidden="true" />
              {busy ? "Blocking…" : `Block ${who.name}`}
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  )
}

// ── Menus, members and the profile card ──────────────────────────────────────

/** The "…" menu on a contact and in a direct chat's header: report, and block or unblock. */
export function PeerMenu({ s, who }: { s: State; who: Profile }) {
  const blocked = isBlocked(s, who.id)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`More for ${who.name}`}>
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => askReport(who)}>
          <Flag size={16} aria-hidden="true" />
          Report {who.name}…
        </DropdownMenuItem>
        {blocked ? (
          <DropdownMenuItem onSelect={() => unblockNow(who)}>
            <ShieldCheck size={16} aria-hidden="true" />
            Unblock {who.name}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => askBlock(who)} className="text-destructive [&_svg]:text-destructive">
            <Ban size={16} aria-hidden="true" />
            Block {who.name}…
          </DropdownMenuItem>
        )}
        {contactOf(s, who.id) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => askRemoveContact(who)} className="text-destructive [&_svg]:text-destructive">
              <UserMinus size={16} aria-hidden="true" />
              Remove contact…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The "Blocked" tag next to a blocked account's name. */
export const BlockedTag = () => (
  <Tag>
    <Ban size={12} aria-hidden="true" />
    Blocked
  </Tag>
)

/** On a blocked contact's page, above their sessions. */
export function BlockedNote({ who }: { who: Profile }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border-(length:--semantic-layout-hairline) border-border p-3">
      <Ban size={16} aria-hidden="true" className="mt-0.5 flex-none text-muted-foreground" />
      <p className="min-w-0 flex-1 text-caption text-muted-foreground">
        You blocked {who.name}. They can't send you direct messages, contact requests or group invites, and their messages in shared groups are hidden from you.{" "}
        {who.name} stays in your contacts.
      </p>
      <Button variant="outline" size="sm" onClick={() => unblockNow(who)}>
        Unblock
      </Button>
    </div>
  )
}

const POPOVER =
  "z-(--semantic-layout-z-index-dropdown) rounded-lg border-(length:--semantic-layout-hairline) border-border bg-popover text-popover-foreground shadow-overlay outline-none"

const relation = (s: State, id: number) => (isMe(s, id) ? "You" : contactOf(s, id) ? "Contact" : "Not a contact")

/**
 * Someone in a group, from the members list or a message's sender name: their picture, ID and how they relate to me,
 * with Open contact (contacts only), Report and Block or Unblock (FLOW-REPORT S1, FLOW-BLOCK S1).
 */
function ProfileCard({ s, who, group, onClose }: { s: State; who: Profile; group: GroupRef; onClose: () => void }) {
  const contact = !!contactOf(s, who.id)
  const blocked = isBlocked(s, who.id)
  const act = (f: () => void) => () => (onClose(), f())
  return (
    <div className="flex w-72 flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Avatar kind="person" label={who.name} src={who.avatar_url} size="lg" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 text-body-strong text-foreground">
            <span className="truncate">{who.name}</span>
            {blocked && <BlockedTag />}
          </p>
          <div className="-ml-1.5">
            <CopyId id={String(who.id)} label={`Copy ${who.name}'s account ID`} />
          </div>
        </div>
      </div>
      <p className="text-caption text-muted-foreground">
        {contact ? "In your contacts." : "Not a contact."} You share {group.name}.
      </p>
      <div className="flex flex-wrap gap-2">
        {contact && (
          <Button variant="outline" size="sm" onClick={act(() => navigate(`/contacts/${who.id}`))}>
            <UserRound size={14} aria-hidden="true" />
            Open contact
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={act(() => askReport(who, group))}>
          <Flag size={14} aria-hidden="true" />
          Report
        </Button>
        {blocked ? (
          <Button variant="outline" size="sm" onClick={act(() => unblockNow(who))}>
            <ShieldCheck size={14} aria-hidden="true" />
            Unblock
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={act(() => askBlock(who))}>
            <Ban size={14} aria-hidden="true" />
            Block
          </Button>
        )}
      </div>
    </div>
  )
}

/** A group message's sender name opens their profile card; my own name stays plain text. */
export function SenderName({ s, from, group, children }: { s: State; from: { account_id: number; name: string }; group?: GroupRef; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  if (!group || isMe(s, from.account_id)) return <>{children}</>
  const member = groupOf(s, group.id)?.members.find((x) => x.id === from.account_id)
  const who: Profile = member ?? { id: from.account_id, name: from.name }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="state-layer focus-ring -mx-1 min-w-0 rounded-sm px-1 text-left" aria-label={`${from.name}'s profile`}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12} className={POPOVER}>
          <ProfileCard s={s} who={who} group={group} onClose={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * A group header's members (API-019): up to four stacked avatars (`stack`) and "N members ▾" (`count`, for the
 * subtitle) both open the list, under the avatars; picking someone shows their profile card in its place.
 */
export function GroupMembers({ s, c, children }: { s: State; c: Conversation; children: (parts: { stack: ReactNode; count: ReactNode }) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Member>()
  const group = c.group!
  const g = groupOf(s, group.id)
  const toggle = (v: boolean) => {
    setOpen(v)
    if (v) refreshList("groups")
    else setPicked(undefined)
  }
  const members = g?.members ?? []
  const label = g ? `${members.length} ${members.length === 1 ? "member" : "members"}` : "Members"
  const stack = (
    <Popover.Trigger className="state-layer focus-ring flex flex-none items-center rounded-full p-0.5" aria-label={`${label} of ${group.name}`}>
      <span className="flex -space-x-2">
        {members.slice(0, 4).map((x) => (
          <span key={x.id} className="rounded-full ring-(length:--primitive-dimension-ring-width) ring-background">
            <Avatar kind="person" label={x.name} src={x.avatar_url} size="sm" />
          </span>
        ))}
        {!g && <span className="skeleton size-6 rounded-full!" />}
      </span>
    </Popover.Trigger>
  )
  const count = (
    <button type="button" onClick={() => toggle(true)} className="state-layer focus-ring inline-flex items-center gap-1 rounded-sm px-1 text-caption text-muted-foreground">
      {label}
      <ChevronDown size={12} aria-hidden="true" />
    </button>
  )
  const row = "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left"
  return (
    <Popover.Root open={open} onOpenChange={toggle}>
      {children({ stack, count })}
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className={POPOVER} aria-label={picked ? `${picked.name}'s profile` : label}>
          {picked ? (
            <ProfileCard s={s} who={picked} group={group} onClose={() => toggle(false)} />
          ) : (
            <div className="flex w-80 max-w-[calc(100vw-1.5rem)] flex-col p-1">
              <p className="px-2 py-1.5 text-caption text-muted-foreground">{g ? label : "Loading members…"}</p>
              <ul className="scroll-pane flex max-h-80 flex-col">
                {members.map((x) => {
                  const body = (
                    <>
                      <Avatar kind="person" label={x.name} src={x.avatar_url} />
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2 text-body text-foreground">
                          <span className="truncate">{x.name}</span>
                          {isBlocked(s, x.id) && <BlockedTag />}
                        </span>
                        <span className="block text-caption tabular-nums text-muted-foreground">ID {x.id}</span>
                      </span>
                      <span className="text-caption whitespace-nowrap text-muted-foreground">{relation(s, x.id)}</span>
                    </>
                  )
                  return (
                    <li key={x.id}>
                      {isMe(s, x.id) ? (
                        <div className={row}>{body}</div>
                      ) : (
                        <button type="button" className={cn("state-layer focus-ring", row)} onClick={() => setPicked(x)}>
                          {body}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Account page ─────────────────────────────────────────────────────────────

/** Why a picture wasn't taken, in the words of FLOW-AVATAR; anything else in the server's own words. */
export function pictureRefusal(e: unknown) {
  if (!(e instanceof ApiError)) return messageOf(e)
  if (e.type === "/errors/file-too-large") return "That image is larger than 5 MB. Pick a JPEG or PNG up to 5 MB."
  if (e.type === "/errors/image-invalid") return "Imbo can't read that image. Pick a JPEG or PNG."
  if (e.status === 429) return "You've changed your picture 20 times today. Try again tomorrow."
  return e.message
}

/** API-045, API-046, the account page's Picture row: a camera badge on it, and a menu that uploads or removes it. */
export function PictureField({ s }: { s: State }) {
  const a = s.account!
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"upload" | "remove">()
  const [error, setError] = useState<string>()
  const run = async (kind: "upload" | "remove", f: () => Promise<void>) => {
    setBusy(kind)
    setError(undefined)
    try {
      await f()
    } catch (e) {
      setError(pictureRefusal(e))
    } finally {
      setBusy(undefined)
    }
  }
  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (f) run("upload", () => uploadPicture(f))
  }
  return (
    <>
      <div className="flex items-start gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="state-layer focus-ring relative flex-none rounded-full"
            aria-label={a.avatar_url ? "Change picture" : "Add a picture"}
            aria-disabled={!!busy}
            onPointerDown={(e) => busy && e.preventDefault()}
          >
            <span className={cn("block", busy && "opacity-60")}>
              <Avatar kind="person" label={a.name} src={a.avatar_url} size="xl" />
            </span>
            <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-(length:--semantic-layout-hairline) border-border bg-popover text-muted-foreground">
              <Camera size={12} />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => file.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              Upload a picture…
            </DropdownMenuItem>
            {a.avatar_url && (
              <DropdownMenuItem onSelect={() => run("remove", removePicture)} className="text-destructive [&_svg]:text-destructive">
                <Trash2 size={16} aria-hidden="true" />
                Remove picture
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={file} type="file" accept={PICTURE_TYPES.join(",")} hidden onChange={picked} />
        <p className="max-w-64 text-caption text-muted-foreground">
          {busy === "upload" ? "Uploading…" : busy === "remove" ? "Removing…" : "JPEG or PNG, up to 5 MB. Imbo crops it to a square. Your contacts and group members see it."}
        </p>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-caption text-destructive">
          <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
          {error}
        </p>
      )}
    </>
  )
}

/** The account page's Blocked row: how many, and the way to the list (PAGE-WEB-BLOCKS). */
export function BlockedField({ s }: { s: State }) {
  const n = dataOf(s.blocks)?.length
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p>{n === undefined ? <span className="skeleton inline-block h-4 w-24 align-middle" /> : n ? `${n} ${n === 1 ? "account" : "accounts"}` : "No one"}</p>
        <Button asChild variant="outline" size="sm">
          <a href="/account/blocks" onClick={onLinkClick}>
            Manage
            <ChevronRight size={14} aria-hidden="true" />
          </a>
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">Blocked accounts can't send you messages, requests or invites.</p>
    </>
  )
}

/** PAGE-WEB-BLOCKS (API-060, API-059): newest first; Unblock takes effect at once and the row goes. */
export function BlocksPane({ back }: { back: ReactNode }) {
  const s = useStore()
  const l = s.blocks
  return (
    <>
      <header className="flex h-14 flex-none items-center gap-3 border-b-(length:--semantic-layout-hairline) border-border px-4 max-sm:pl-2">
        {back}
        <h1 className="text-body-strong text-foreground">Blocked accounts</h1>
      </header>
      <div className="scroll-pane min-h-0 flex-1 px-4 pb-6">
        {l.status === "loading" ? (
          <ListSkeleton rows={2} />
        ) : l.status === "error" ? (
          <ErrorState what="blocked accounts" error={l.error} onRetry={() => retry("blocks")} />
        ) : (
          <>
            <p className="max-w-prose py-4 text-body text-muted-foreground">
              They can't send you direct messages, contact requests or group invites, and their messages in groups you share are hidden from you. After you unblock
              someone, their group messages show again. Messages and requests turned away while they were blocked don't come back.
            </p>
            {!l.data.length ? (
              <EmptyState icon={<ShieldCheck size={24} />} title="No blocked accounts">
                <p>To block someone, open their profile from a chat or from Contacts.</p>
              </EmptyState>
            ) : (
              <ul className="flex flex-col">
                {l.data.map((b) => (
                  <li key={b.account.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t-(length:--semantic-layout-hairline) border-border py-3 first:border-t-0">
                    <Avatar kind="person" label={b.account.name} src={b.account.avatar_url} />
                    <span className="min-w-0">
                      <span className="block truncate text-body text-foreground">{b.account.name}</span>
                      <span className="flex items-center gap-2 text-caption whitespace-nowrap text-muted-foreground">
                        <span className="tabular-nums">ID {b.account.id}</span>
                        <Sep />
                        <span>Blocked {shortDate(b.created_at)}</span>
                      </span>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => unblockNow(b.account)} aria-label={`Unblock ${b.account.name}`}>
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  )
}

