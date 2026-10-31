import { useId, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DrawerContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { ApiError, messageOf } from "@/data/layer"
import { emailSchema, problem } from "@/data/schema"
import { changeEmail, requestEmailChange } from "@/data/store"
import { t } from "@/i18n"
import { useSecondsUntil } from "@/lib/useSecondsUntil"

// FLOW-EMAIL-CHANGE on the web: Change on the account page opens a drawer with the new email (S2), then the 6-digit
// code sent to it (S4). Only the new email gets a code (ADR-047). Back from the code goes back to the email. The button
// in the drawer's bar sends whichever step is showing.

export function ChangeEmail() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("Change email")}>
          {t("Change")}
        </Button>
      </DialogTrigger>
      {open && <ChangeEmailDialog onDone={() => setOpen(false)} />}
    </Dialog>
  )
}

/** What the step shows in the drawer's bar: whether its request is out, and for the code, what's typed and whether it's locked. */
type Bar = { busy: boolean; code: string; locked: boolean }
const FRESH: Bar = { busy: false, code: "", locked: false }

function ChangeEmailDialog({ onDone }: { onDone: () => void }) {
  const formId = useId()
  const [sent, setSent] = useState<{ email: string; resendAt: number }>()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string>()
  const [bar, setBar] = useState(FRESH)
  // Back from the code: the email box takes focus as it comes back. On opening the drawer focuses it (data-autofocus).
  const [returned, setReturned] = useState(false)
  const patch = (p: Partial<Bar>) => setBar((b) => ({ ...b, ...p }))
  const back = (why?: string) => {
    setReturned(true)
    setSent(undefined)
    setBar(FRESH)
    setError(why)
  }
  const [sentTo, expires] = t("Enter the code we sent to {email}. It expires in 10 minutes.").split("{email}")
  return (
    <DrawerContent
      title={t("Change email")}
      description={
        sent && (
          <>
            {sentTo}
            <span className="text-foreground wrap-anywhere">{sent.email}</span>
            {expires}
          </>
        )
      }
      action={
        sent ? (
          <Button type="submit" form={formId} aria-disabled={bar.busy || bar.locked || bar.code.length < 6}>
            {bar.busy ? t("Changing…") : t("Change email")}
          </Button>
        ) : (
          <Button type="submit" form={formId} disabled={!email.trim()} aria-disabled={bar.busy}>
            {bar.busy ? t("Sending code…") : t("Send code")}
          </Button>
        )
      }
    >
      {sent ? (
        <CodeStep key={sent.email} formId={formId} email={sent.email} resendAt={sent.resendAt} bar={bar} patch={patch} onBack={back} onDone={onDone} />
      ) : (
        <EmailStep
          formId={formId}
          returned={returned}
          email={email}
          setEmail={setEmail}
          error={error}
          setError={setError}
          busy={bar.busy}
          setBusy={(busy) => patch({ busy })}
          onSent={(e, wait) => (setBar(FRESH), setSent({ email: e, resendAt: Date.now() + wait * 1000 }))}
        />
      )}
    </DrawerContent>
  )
}

/** API-075. A taken email, the current one or the review email are refused here, before any code goes out. */
function EmailStep({
  formId,
  returned,
  email,
  setEmail,
  error,
  setError,
  busy,
  setBusy,
  onSent,
}: {
  formId: string
  returned: boolean
  email: string
  setEmail: (v: string) => void
  error?: string
  setError: (v?: string) => void
  busy: boolean
  setBusy: (v: boolean) => void
  onSent: (email: string, wait: number) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
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
    <form id={formId} onSubmit={send} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-label text-foreground">
          {t("New email")}
        </label>
        <Input
          ref={input}
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          data-autofocus
          autoFocus={returned}
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
          {error ?? t("We'll send a code to the new email.")}
        </p>
      </div>
    </form>
  )
}

/** API-076. Someone signing up with this email after the code went out sends you back to pick another one. */
function CodeStep({
  formId,
  email,
  resendAt: firstResendAt,
  bar,
  patch,
  onBack,
  onDone,
}: {
  formId: string
  email: string
  resendAt: number
  bar: Bar
  patch: (p: Partial<Bar>) => void
  onBack: (why?: string) => void
  onDone: () => void
}) {
  const id = useId()
  const { code, locked, busy: checking } = bar
  const setCode = (v: string) => patch({ code: v })
  const setLocked = (v: boolean) => patch({ locked: v })
  const setChecking = (v: boolean) => patch({ busy: v })
  const [error, setError] = useState<string>()
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
      toast(t("Email changed to {email}.", { email: a.email ?? email }))
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
    <form id={formId} onSubmit={check} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-code`} className="text-label text-foreground">
          {t("Code")}
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
          {checking ? t("Checking…") : resent ? t("We sent a new code.") : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" aria-disabled={cooldown > 0 || sending} onClick={resend} className="tabular-nums">
            {sending ? t("Sending code…") : cooldown > 0 ? t("Send a new code in {n} s", { n: cooldown }) : t("Send a new code")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-foreground" onClick={() => onBack()}>
            <ArrowLeft size={14} aria-hidden="true" />
            {t("Use a different email")}
          </Button>
        </div>
      </div>
    </form>
  )
}
