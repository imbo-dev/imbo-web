import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import { toast } from "sonner"
import { CircleAlert, History, MessageSquareOff, UserMinus, UserPlus } from "lucide-react"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Profile } from "@/data/contract"
import { ApiError, messageOf } from "@/data/layer"
import { askContact, dataOf, removeContact, type State } from "@/data/store"
import { navigate } from "@/lib/router"
import { ConfirmContent } from "./confirm"

// Adding and removing contacts on the web (FLOW-CONTACT-ADD, FLOW-CONTACT-REMOVE): one dialog for the whole page
// (rendered by the inbox shell), opened from the Contacts list or a contact's "…" menu.

type Open = { kind: "add" } | { kind: "remove"; who: Profile }
let opened: Open | undefined
const listeners = new Set<() => void>()
function setOpened(o: Open | undefined) {
  opened = o
  listeners.forEach((l) => l())
}
const close = () => setOpened(undefined)
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const openAddContact = () => setOpened({ kind: "add" })
/** Opened on the next frame, after the menu that asked has closed and handed focus back. */
export const askRemoveContact = (who: Profile) => requestAnimationFrame(() => setOpened({ kind: "remove", who }))

export function ContactDialogs({ s }: { s: State }) {
  const o = useSyncExternalStore(subscribe, () => opened)
  const change = (open: boolean) => !open && close()
  return (
    <>
      <Dialog open={o?.kind === "add"} onOpenChange={change}>
        {o?.kind === "add" && <AddContactDialog s={s} />}
      </Dialog>
      <Dialog open={o?.kind === "remove"} onOpenChange={change}>
        {o?.kind === "remove" && <RemoveContactDialog who={o.who} />}
      </Dialog>
    </>
  )
}

/** The server counts the note's characters (code points) after trimming, up to 200. */
const NOTE_MAX = 200
const ID = /^\d{8}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const INVALID = "That isn't an 8-digit account ID or an email address."

/** Who the box names, as API-008 takes it; undefined when it's neither an account ID nor an email. */
function target(text: string) {
  const t = text.trim()
  if (ID.test(t)) return { account_id: Number(t) }
  if (EMAIL.test(t)) return { email: t }
}

/**
 * Why a request didn't go out, in the words of FLOW-CONTACT-ADD; anything else in the server's own words. Their name
 * is known when the box held the ID of someone in my lists.
 */
function refusal(e: unknown, s: State, text: string) {
  if (!(e instanceof ApiError)) return messageOf(e)
  const t = text.trim()
  const known = ID.test(t) ? [...s.outgoing.map((r) => r.to), ...(dataOf(s.contacts) ?? [])].find((p) => p.id === Number(t)) : undefined
  const name = known?.name
  switch (e.type) {
    case "/errors/account-not-found":
      return ID.test(t) ? `No Imbo account has the ID ${t}. Check the number, or ask them for their email.` : `No Imbo account uses ${t}. Check the spelling, or ask them for their account ID.`
    case "/errors/invalid-email":
      return INVALID
    case "/errors/cannot-add-self":
      return "That's your own account."
    case "/errors/already-contacts":
      return name ? `${name} is already one of your contacts.` : e.message
    case "/errors/request-pending":
      return name ? `You already asked ${name}. They haven't answered yet.` : e.message
    case "/errors/unblock-first":
      return name ? `You blocked ${name}. Unblock them in Account first.` : e.message.replace(/ first\.$/, " in Account first.")
    case "/errors/rate-limited":
      return "You've sent 20 requests today. Try again tomorrow."
  }
  return e.message
}

/**
 * PAGE-WEB-CONTACTS Add a contact (FLOW-CONTACT-ADD): an account ID or the email they sign in with, and a note. Sent
 * means waiting under Sent; when they had asked first, they're a contact at once.
 */
function AddContactDialog({ s }: { s: State }) {
  const formId = useId()
  const whoId = useId()
  const noteId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [who, setWho] = useState("")
  const [note, setNote] = useState("")
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)
  const long = [...note.trim()].length > NOTE_MAX

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || long) return
    const to = target(who)
    if (!to) {
      setProblem(INVALID)
      return input.current?.focus()
    }
    setBusy(true)
    setProblem(undefined)
    try {
      const r = await askContact(to, note.trim() || undefined)
      close()
      if ("request" in r) toast(`Request sent to ${r.request.to.name} (ID ${r.request.to.id}).`)
      else toast(`${r.contact.name} had already asked to add you. You're contacts now.`)
    } catch (e) {
      setBusy(false)
      setProblem(refusal(e, s, who))
      input.current?.focus()
    }
  }

  return (
    <DialogContent>
      <div className="flex flex-col gap-1">
        <DialogTitle>Add a contact</DialogTitle>
        <DialogDescription>They get your request in Imbo and in their terminal. You can message each other once they accept.</DialogDescription>
      </div>
      <form id={formId} onSubmit={send} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={whoId} className="text-label text-foreground">
            Account ID or email
          </label>
          <Input
            ref={input}
            id={whoId}
            value={who}
            onChange={(e) => {
              setWho(e.target.value)
              if (problem) setProblem(undefined)
            }}
            invalid={!!problem}
            aria-describedby={`${whoId}-note`}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          {problem ? (
            <p id={`${whoId}-note`} role="alert" className="flex items-start gap-1.5 text-caption text-destructive">
              <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
              {problem}
            </p>
          ) : (
            <p id={`${whoId}-note`} className="text-caption text-muted-foreground">
              An 8-digit account ID, or the email they sign in to Imbo with.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-label text-foreground">
            Note <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className={cn("state-layer focus-ring is-field rounded-md border bg-muted", long ? "border-destructive" : "border-input")}>
            <textarea
              id={noteId}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={long || undefined}
              aria-describedby={`${noteId}-hint`}
              className="block w-full resize-none bg-transparent px-3 py-2 text-body text-foreground outline-none"
            />
          </div>
          <p id={`${noteId}-hint`} role={long ? "alert" : undefined} className={cn("text-caption", long ? "text-destructive" : "text-muted-foreground")}>
            {long ? `A note can be up to ${NOTE_MAX} characters. This one has ${[...note.trim()].length}.` : `They see it with your request. Up to ${NOTE_MAX} characters.`}
          </p>
        </div>
      </form>
      <DialogFooter>
        <Button variant="ghost" className="text-foreground" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={!who.trim()} aria-disabled={busy || long}>
          <UserPlus size={16} aria-hidden="true" />
          {busy ? "Sending…" : "Send request"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** FLOW-CONTACT-REMOVE: both lose each other as contacts; the chat and shared groups stay. */
function RemoveContactDialog({ who }: { who: Profile }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const go = async () => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await removeContact(who.id)
      close()
      if (location.pathname === `/contacts/${who.id}`) navigate("/contacts", { replace: true })
      toast(`${who.name} was removed from your contacts.`)
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <ConfirmContent
      title={`Remove ${who.name} from your contacts?`}
      consequences={[
        [<MessageSquareOff size={16} />, `You and ${who.name} can't send each other direct messages until you add each other again.`],
        [<History size={16} />, `Your chat with ${who.name} stays, and you both stay in the groups you share.`],
      ]}
      action={{ label: "Remove contact", busyLabel: "Removing…", icon: <UserMinus size={16} aria-hidden="true" />, destructive: true }}
      busy={busy}
      error={error}
      onConfirm={go}
      onCancel={close}
    />
  )
}
