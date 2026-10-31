import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { CreditCard, Laptop, LogOut, MessageSquareX, Pencil, PlugZap, Server, SquareTerminal, Trash2, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DrawerContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Device } from "@/data/contract"
import { messageOf } from "@/data/layer"
import { nameSchema, problem } from "@/data/schema"
import { dataOf, deleteAccount, renameMe, retry, revokeDevice, type State } from "@/data/store"
import { t } from "@/i18n"
import { ago, platformName, shortDate } from "@/lib/format"
import { ConfirmContent } from "./confirm"
import { Consequence, DialogError } from "./safety"
import { RenameButtons, RenameHint, RenameInput, useRename, useReturnFocus } from "./rename"

// The account page's rows that change the account itself (PAGE-WEB-ACCOUNT): my name, the computers signed in to it,
// and deleting it.

/** API-005: Edit turns the name into a text box. */
export function NameField({ name }: { name: string }) {
  const [editing, setEditing] = useState(false)
  const edit = useReturnFocus(editing)
  if (editing) return <NameForm name={name} onDone={() => setEditing(false)} />
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 wrap-anywhere">{name}</span>
      <Button ref={edit} variant="outline" size="sm" aria-label={t("Edit name")} onClick={() => setEditing(true)}>
        <Pencil size={14} aria-hidden="true" />
        {t("Edit")}
      </Button>
    </div>
  )
}

function NameForm({ name, onDone }: { name: string; onDone: () => void }) {
  const r = useRename(name, renameMe, onDone, (v) => problem(nameSchema, v))
  return (
    <form onSubmit={r.submit} noValidate className="flex flex-col gap-2">
      <RenameInput r={r} label={t("Name")} className="h-9" />
      <RenameHint r={r}>{t("Contacts and group members see this name next to your ID. 1–32 characters.")}</RenameHint>
      <div className="flex gap-2">
        <RenameButtons r={r} size="sm" />
      </div>
    </form>
  )
}

/** "Seen 2 min ago"; a computer that hasn't sent anything since signing in hasn't been seen. */
const seen = (d: Device) => (d.last_seen_at ? t("Seen {when}", { when: ago(d.last_seen_at) }) : t("Not seen since signing in"))

/** API-006, API-007: each computer that ran imbo login, and signing one out. */
export function ComputersField({ s }: { s: State }) {
  const [asking, setAsking] = useState<Device>()
  const list = useRef<HTMLUListElement>(null)
  const l = s.devices
  if (l.status === "loading") return <span className="skeleton h-4 w-48" />
  if (l.status === "error")
    return (
      <>
        <p className="text-muted-foreground">{l.error.message}</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => retry("devices")}>
            {t("Try again")}
          </Button>
        </div>
      </>
    )
  return (
    <>
      {l.data.length ? (
        <ul ref={list} className="flex flex-col gap-3">
          {l.data.map((d) => (
            <li key={d.id} className="flex items-start gap-3">
              {platformName(d.platform) === "Linux" ? (
                <Server size={16} aria-hidden="true" className="mt-1 flex-none text-muted-foreground" />
              ) : (
                <Laptop size={16} aria-hidden="true" className="mt-1 flex-none text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block wrap-anywhere">{d.name}</span>
                <span className="block text-caption text-muted-foreground">{seen(d)}</span>
                <span className="block text-caption text-muted-foreground">
                  {t("{platform}, signed in {date}", { platform: platformName(d.platform), date: shortDate(d.created_at) })}
                </span>
              </span>
              <Button variant="outline" size="sm" aria-label={t("Sign out {name}", { name: d.name })} onClick={() => setAsking(d)}>
                {t("Sign out")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("No computers yet.")}</p>
      )}
      <p className="text-caption text-muted-foreground">{t("Each computer you ran imbo login on. Signing one out stops its sessions until you sign in there again.")}</p>
      <Dialog open={!!asking} onOpenChange={(open) => !open && setAsking(undefined)}>
        {asking && (
          <SignOutComputer
            d={asking}
            onDone={() => setAsking(undefined)}
            // The row is gone: focus goes to the first computer's Sign out, or stays on the page.
            onCloseAutoFocus={(e) => {
              if (dataOf(s.devices)?.some((d) => d.id === asking.id)) return
              e.preventDefault()
              list.current?.querySelector("button")?.focus()
            }}
          />
        )}
      </Dialog>
    </>
  )
}

function SignOutComputer({ d, onDone, onCloseAutoFocus }: { d: Device; onDone: () => void; onCloseAutoFocus: (e: Event) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const go = async () => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await revokeDevice(d.id)
      onDone()
      toast(t("{name} was signed out.", { name: d.name }))
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <ConfirmContent
      title={t("Sign out {name}?", { name: d.name })}
      consequences={[
        [<PlugZap size={16} />, t("Sessions on {name} stop sending and receiving right away.", { name: d.name })],
        [<SquareTerminal size={16} />, t("To use Imbo there again, run imbo login on {name}.", { name: d.name })],
      ]}
      action={{ label: t("Sign out"), busyLabel: t("Signing out…"), icon: <LogOut size={16} aria-hidden="true" /> }}
      busy={busy}
      error={error}
      onConfirm={go}
      onCancel={onDone}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  )
}

const CONFIRM_WORD = "DELETE"

/** API-052: Delete account… opens a drawer that asks, with DELETE typed in, before anything is deleted. */
export function DeleteAccount({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 size={16} aria-hidden="true" />
          {t("Delete account…")}
        </Button>
      </DialogTrigger>
      {open && <DeleteAccountDialog id={id} />}
    </Dialog>
  )
}

function DeleteAccountDialog({ id }: { id: number }) {
  const formId = useId()
  const fieldId = useId()
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const confirmed = typed.trim() === CONFIRM_WORD
  const go = async () => {
    if (busy) return
    if (!confirmed) return setError(t("Type {word} to delete your account.", { word: CONFIRM_WORD }))
    setBusy(true)
    setError(undefined)
    try {
      await deleteAccount()
      toast(t("Your Imbo account was deleted."))
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <DrawerContent
      title={t("Delete your Imbo account?")}
      description={t("This can't be undone.")}
      action={
        <Button type="submit" form={formId} variant="destructive" aria-disabled={busy || !confirmed}>
          <Trash2 size={16} aria-hidden="true" />
          {busy ? t("Deleting…") : t("Delete account")}
        </Button>
      }
    >
      <ul className="flex flex-col gap-3">
        <Consequence icon={<UserX size={16} />}>{t("Account {id} and your name are deleted. The ID is never reused.", { id })}</Consequence>
        <Consequence icon={<MessageSquareX size={16} />}>{t("Your messages, contacts and group memberships are deleted. Groups you own are dissolved.")}</Consequence>
        <Consequence icon={<Laptop size={16} />}>{t("Imbo stops working on every computer you signed in on.")}</Consequence>
        <Consequence icon={<CreditCard size={16} />}>{t("Deleting doesn't cancel an App Store subscription. Cancel it on your iPhone first.")}</Consequence>
      </ul>
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
      >
        <label htmlFor={fieldId} className="text-label text-foreground">
          {t("Type {word} to confirm", { word: CONFIRM_WORD })}
        </label>
        <Input id={fieldId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </form>
      <DialogError>{error}</DialogError>
    </DrawerContent>
  )
}
