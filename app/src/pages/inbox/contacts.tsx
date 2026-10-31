import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import { toast } from "sonner"
import { CircleAlert, History, MessageSquareOff, UserMinus, UserPlus } from "lucide-react"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Dialog, DrawerContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Profile } from "@/data/contract"
import { ApiError, messageOf } from "@/data/layer"
import { askContact, dataOf, removeContact, type State } from "@/data/store"
import { t } from "@/i18n"
import { navigate } from "@/lib/router"
import { ConfirmContent } from "./confirm"

// Adding and removing contacts on the web (FLOW-CONTACT-ADD, FLOW-CONTACT-REMOVE): one drawer or dialog for the whole
// page (rendered by the inbox shell), opened from the Contacts list or a contact's "…" menu.

type Open = { kind: "add" } | { kind: "remove"; who: Profile }
let opened: Open | undefined
/** Where focus goes back to when Add contact closes: nothing triggers it in Radix's sense. */
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
const invalid = () => t("That isn't an 8-digit account ID or an email address.")

/** Who the box names, as API-008 takes it; undefined when it's neither an account ID nor an email. */
function target(text: string) {
  const v = text.trim()
  if (ID.test(v)) return { account_id: Number(v) }
  if (EMAIL.test(v)) return { email: v }
}

/**
 * Why a request didn't go out, in the words of FLOW-CONTACT-ADD; anything else in the server's own words. Their name
 * is known when the box held the ID of someone in my lists.
 */
function refusal(e: unknown, s: State, text: string) {
  if (!(e instanceof ApiError)) return messageOf(e)
  const v = text.trim()
  const known = ID.test(v) ? [...s.outgoing.map((r) => r.to), ...(dataOf(s.contacts) ?? [])].find((p) => p.id === Number(v)) : undefined
  const name = known?.name
  switch (e.type) {
    case "/errors/account-not-found":
      return ID.test(v)
        ? t("No Imbo account has the ID {id}. Check the number, or ask them for their email.", { id: v })
        : t("No Imbo account uses {email}. Check the spelling, or ask them for their account ID.", { email: v })
    case "/errors/invalid-email":
      return invalid()
    case "/errors/cannot-add-self":
      return t("That's your own account.")
    case "/errors/already-contacts":
      return name ? t("{name} is already one of your contacts.", { name }) : e.message
    case "/errors/request-pending":
      return name ? t("You already asked {name}. They haven't answered yet.", { name }) : e.message
    case "/errors/unblock-first":
      return name ? t("You blocked {name}. Unblock them in Account first.", { name }) : e.message.replace(/ first\.$/, " in Account first.")
    case "/errors/rate-limited":
      return t("You've sent 20 requests today. Try again tomorrow.")
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
      setProblem(invalid())
      return input.current?.focus()
    }
    setBusy(true)
    setProblem(undefined)
    try {
      const r = await askContact(to, note.trim() || undefined)
      close()
      if ("request" in r) toast(t("Request sent to {name} (ID {id}).", { name: r.request.to.name, id: r.request.to.id }))
      else toast(t("{name} had already asked to add you. You're contacts now.", { name: r.contact.name }))
    } catch (e) {
      setBusy(false)
      setProblem(refusal(e, s, who))
      input.current?.focus()
    }
  }

  return (
    <DrawerContent
      title={t("Add a contact")}
      description={t("They get your request in Imbo and in their terminal. You can message each other once they accept.")}
      onCloseAutoFocus={giveFocusBack}
      action={
        <Button type="submit" form={formId} disabled={!who.trim()} aria-disabled={busy || long}>
          <UserPlus size={16} aria-hidden="true" />
          {busy ? t("Sending…") : t("Send request")}
        </Button>
      }
    >
      <form id={formId} onSubmit={send} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={whoId} className="text-label text-foreground">
            {t("Account ID or email")}
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
            data-autofocus
          />
          {problem ? (
            <p id={`${whoId}-note`} role="alert" className="flex items-start gap-1.5 text-caption text-destructive">
              <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
              {problem}
            </p>
          ) : (
            <p id={`${whoId}-note`} className="text-caption text-muted-foreground">
              {t("An 8-digit account ID, or the email they sign in to Imbo with.")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-label text-foreground">
            {t("Note")} <span className="text-muted-foreground">{t("(optional)")}</span>
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
            {long
              ? t("A note can be up to {max} characters. This one has {n}.", { max: NOTE_MAX, n: [...note.trim()].length })
              : t("They see it with your request. Up to {max} characters.", { max: NOTE_MAX })}
          </p>
        </div>
      </form>
    </DrawerContent>
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
      toast(t("{name} was removed from your contacts.", { name: who.name }))
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <ConfirmContent
      title={t("Remove {name} from your contacts?", { name: who.name })}
      consequences={[
        [<MessageSquareOff size={16} />, t("You and {name} can't send each other direct messages until you add each other again.", { name: who.name })],
        [<History size={16} />, t("Your chat with {name} stays, and you both stay in the groups you share.", { name: who.name })],
      ]}
      action={{ label: t("Remove contact"), busyLabel: t("Removing…"), icon: <UserMinus size={16} aria-hidden="true" />, destructive: true }}
      busy={busy}
      error={error}
      onConfirm={go}
      onCancel={close}
    />
  )
}
