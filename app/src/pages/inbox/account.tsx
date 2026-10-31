import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { CreditCard, Laptop, LogOut, MessageSquareX, Pencil, PlugZap, Server, SquareTerminal, Trash2, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Device } from "@/data/contract"
import { messageOf } from "@/data/layer"
import { nameSchema, problem } from "@/data/schema"
import { dataOf, deleteAccount, renameMe, retry, revokeDevice, type State } from "@/data/store"
import { ago, platformName, shortDate } from "@/lib/format"
import { ConfirmContent } from "./confirm"
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
      <Button ref={edit} variant="outline" size="sm" aria-label="Edit name" onClick={() => setEditing(true)}>
        <Pencil size={14} aria-hidden="true" />
        Edit
      </Button>
    </div>
  )
}

function NameForm({ name, onDone }: { name: string; onDone: () => void }) {
  const r = useRename(name, renameMe, onDone, (v) => problem(nameSchema, v))
  return (
    <form onSubmit={r.submit} noValidate className="flex flex-col gap-2">
      <RenameInput r={r} label="Name" className="h-9" />
      <RenameHint r={r}>Contacts and group members see this name next to your ID. 1–32 characters.</RenameHint>
      <div className="flex gap-2">
        <RenameButtons r={r} size="sm" />
      </div>
    </form>
  )
}

/** "Seen 2 min ago"; a computer that hasn't sent anything since signing in hasn't been seen. */
const seen = (d: Device) => (d.last_seen_at ? `Seen ${ago(d.last_seen_at)}` : "Not seen since signing in")

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
            Try again
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
                  {platformName(d.platform)}, signed in {shortDate(d.created_at)}
                </span>
              </span>
              <Button variant="outline" size="sm" aria-label={`Sign out ${d.name}`} onClick={() => setAsking(d)}>
                Sign out
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No computers yet.</p>
      )}
      <p className="text-caption text-muted-foreground">Each computer you ran imbo login on. Signing one out stops its sessions until you sign in there again.</p>
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
      toast(`${d.name} was signed out.`)
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <ConfirmContent
      title={`Sign out ${d.name}?`}
      consequences={[
        [<PlugZap size={16} />, `Sessions on ${d.name} stop sending and receiving right away.`],
        [<SquareTerminal size={16} />, `To use Imbo there again, run imbo login on ${d.name}.`],
      ]}
      action={{ label: "Sign out", busyLabel: "Signing out…", icon: <LogOut size={16} aria-hidden="true" /> }}
      busy={busy}
      error={error}
      onConfirm={go}
      onCancel={onDone}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  )
}

const CONFIRM_WORD = "DELETE"

/** API-052: Delete account… asks, with DELETE typed in, before anything is deleted. */
export function DeleteAccount({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 size={16} aria-hidden="true" />
          Delete account…
        </Button>
      </DialogTrigger>
      {open && <DeleteAccountDialog id={id} onCancel={() => setOpen(false)} />}
    </Dialog>
  )
}

function DeleteAccountDialog({ id, onCancel }: { id: number; onCancel: () => void }) {
  const fieldId = useId()
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const confirmed = typed.trim() === CONFIRM_WORD
  const go = async () => {
    if (busy) return
    if (!confirmed) return setError(`Type ${CONFIRM_WORD} to delete your account.`)
    setBusy(true)
    setError(undefined)
    try {
      await deleteAccount()
      toast("Your Imbo account was deleted.")
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
    }
  }
  return (
    <ConfirmContent
      title="Delete your Imbo account?"
      description="This can't be undone."
      consequences={[
        [<UserX size={16} />, `Account ${id} and your name are deleted. The ID is never reused.`],
        [<MessageSquareX size={16} />, "Your messages, contacts and group memberships are deleted. Groups you own are dissolved."],
        [<Laptop size={16} />, "Imbo stops working on every computer you signed in on."],
        [<CreditCard size={16} />, "Deleting doesn't cancel an App Store subscription. Cancel it on your iPhone first."],
      ]}
      action={{ label: "Delete account", busyLabel: "Deleting…", icon: <Trash2 size={16} aria-hidden="true" />, destructive: true }}
      busy={busy}
      unavailable={!confirmed}
      error={error}
      onConfirm={go}
      onCancel={onCancel}
    >
      <form
        noValidate
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
      >
        <label htmlFor={fieldId} className="text-label text-foreground">
          Type {CONFIRM_WORD} to confirm
        </label>
        <Input id={fieldId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </form>
    </ConfirmContent>
  )
}
