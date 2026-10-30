import { useId, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { ApiError, messageOf } from "@/data/layer"
import { emailSchema, problem } from "@/data/schema"
import { changeEmail, requestEmailChange } from "@/data/store"
import { useSecondsUntil } from "@/lib/useSecondsUntil"

// FLOW-EMAIL-CHANGE on the web: Change on the account page opens a dialog with the new email (S2), then the 6-digit
// code sent to it (S4). Only the new email gets a code (ADR-047). Back from the code goes back to the email.

export function ChangeEmail() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Change email">
          Change
        </Button>
      </DialogTrigger>
      {open && <ChangeEmailDialog onDone={() => setOpen(false)} />}
    </Dialog>
  )
}

function ChangeEmailDialog({ onDone }: { onDone: () => void }) {
  const [sent, setSent] = useState<{ email: string; resendAt: number }>()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string>()
  const back = (why?: string) => {
    setSent(undefined)
    setError(why)
  }
  return (
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>Change email</DialogTitle>
      {sent ? (
        <CodeStep key={sent.email} email={sent.email} resendAt={sent.resendAt} onBack={back} onDone={onDone} />
      ) : (
        <EmailStep email={email} setEmail={setEmail} error={error} setError={setError} onSent={(e, wait) => setSent({ email: e, resendAt: Date.now() + wait * 1000 })} onCancel={onDone} />
      )}
    </DialogContent>
  )
}

/** API-075. A taken email, the current one or the review email are refused here, before any code goes out. */
function EmailStep({
  email,
  setEmail,
  error,
  setError,
  onSent,
  onCancel,
}: {
  email: string
  setEmail: (v: string) => void
  error?: string
  setError: (v?: string) => void
  onSent: (email: string, wait: number) => void
  onCancel: () => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const err = problem(emailSchema, email)
    setError(err)
    if (err) return input.current?.focus()
    setBusy(true)
    try {
      const value = email.trim()
      const r = await requestEmailChange(value)
      onSent(value, r.retry_after_s)
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
      input.current?.focus()
    }
  }
  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-label text-foreground">
          New email
        </label>
        <Input
          ref={input}
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(undefined)
          }}
          invalid={!!error}
          aria-describedby={`${id}-note`}
        />
        {/* One line under the field: why it was refused, or what happens next. */}
        <p id={`${id}-note`} role={error ? "alert" : undefined} className={error ? "text-caption text-destructive" : "text-caption text-muted-foreground"}>
          {error ?? "We'll send a code to the new email."}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" className="text-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!email.trim()} aria-disabled={busy}>
          {busy ? "Sending code…" : "Send code"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** API-076. Someone signing up with this email after the code went out sends you back to pick another one. */
function CodeStep({ email, resendAt: firstResendAt, onBack, onDone }: { email: string; resendAt: number; onBack: (why?: string) => void; onDone: () => void }) {
  const id = useId()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const [locked, setLocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resendAt, setResendAt] = useState(firstResendAt)
  const [sending, setSending] = useState(false)
  const [resent, setResent] = useState(false)
  const cooldown = useSecondsUntil(resendAt)

  const check = async (e: FormEvent) => {
    e.preventDefault()
    if (checking || locked || code.length < 6) return
    setChecking(true)
    try {
      const a = await changeEmail(email, code)
      onDone()
      toast(`Email changed to ${a.email}.`)
    } catch (e) {
      setChecking(false)
      if (e instanceof ApiError && e.type === "/errors/email-taken") return onBack(e.message)
      setCode("")
      if (e instanceof ApiError && e.type === "/errors/code-locked") setLocked(true)
      setError(messageOf(e))
    }
  }

  const resend = async () => {
    if (cooldown > 0 || sending) return
    setSending(true)
    try {
      const r = await requestEmailChange(email)
      setResendAt(Date.now() + r.retry_after_s * 1000)
      setLocked(false)
      setError(undefined)
      setCode("")
      setResent(true)
    } catch (e) {
      if (e instanceof ApiError && e.retryAfter) setResendAt(Date.now() + e.retryAfter * 1000)
      setError(messageOf(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={check} noValidate className="flex flex-col gap-4">
      <DialogDescription>
        Enter the code we sent to <span className="text-foreground wrap-anywhere">{email}</span>. It expires in 10 minutes.
      </DialogDescription>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-code`} className="text-label text-foreground">
          Code
        </label>
        <InputOTP
          id={`${id}-code`}
          maxLength={6}
          inputMode="numeric"
          pattern="^[0-9]*$"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          disabled={locked}
          aria-describedby={`${id}-error`}
          onChange={(v) => {
            setCode(v)
            if (v) setResent(false)
            if (v && error && !locked) setError(undefined)
          }}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} invalid={!!error} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <p id={`${id}-error`} role="alert" className="min-h-5 text-caption text-destructive">
          {error}
        </p>
        <p aria-live="polite" className="-mt-2 min-h-5 text-caption text-muted-foreground">
          {checking ? "Checking…" : resent ? "We sent a new code." : ""}
        </p>
        <div>
          <Button type="button" variant="outline" size="sm" aria-disabled={cooldown > 0 || sending} onClick={resend} className="tabular-nums">
            {sending ? "Sending code…" : cooldown > 0 ? `Send a new code in ${cooldown} s` : "Send a new code"}
          </Button>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" className="text-foreground" onClick={() => onBack()}>
          <ArrowLeft size={16} aria-hidden="true" />
          Use a different email
        </Button>
        <Button type="submit" aria-disabled={checking || locked || code.length < 6}>
          {checking ? "Changing…" : "Change email"}
        </Button>
      </DialogFooter>
    </form>
  )
}
