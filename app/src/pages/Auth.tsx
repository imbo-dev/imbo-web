import { useId, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { PixelSwap } from "@/components/PixelSwap"
import { AuthStage } from "@/components/Stage"
import { Wordmark } from "@/components/Wordmark"
import { Command, CopyId } from "@/components/bits"
import { t } from "@/i18n"
import { ApiError, messageOf } from "@/data/layer"
import { dataOf, requestCode, useStore, verify } from "@/data/store"
import { emailSchema, nameSchema, problem } from "@/data/schema"
import { daysUntil } from "@/lib/format"
import { navigate, onLinkClick } from "@/lib/router"
import { useSecondsUntil } from "@/lib/useSecondsUntil"

// Sign-in and sign-up are one flow, as in the terminal (FLOW-WEB-LOGIN): email → 6-digit code → a name if the
// email is new. The two pages only differ in their wording; an existing email on /register just signs in. Once the
// server accepts, the store holds the account and the router moves on (/welcome for a new account).

type Mode = "login" | "register"
type Page = Mode | "welcome"
/** `resendAt`: when the server takes another code request for this email (it allows one a minute). */
type Step =
  | { kind: "email" }
  | { kind: "code"; email: string; resendAt: number; error?: string }
  | { kind: "name"; email: string; code: string; resendAt: number }

const CODE_ERRORS = ["/errors/code-invalid", "/errors/code-expired", "/errors/code-locked"]

/** /login, /register and /welcome share one card, so moving between them (and between steps) is one pixel swap. */
export function AuthFlow({ page }: { page: Page }) {
  const [step, setStep] = useState<Step>({ kind: "email" })
  const [stepPage, setStepPage] = useState(page)
  if (stepPage !== page) {
    setStepPage(page)
    setStep({ kind: "email" })
  }
  return (
    <AuthStage wide={page === "welcome"}>
      <PixelSwap swapKey={page === "welcome" ? page : `${page}:${step.kind}`}>
        <Home />
        {page === "welcome" ? (
          <Welcome />
        ) : step.kind === "email" ? (
          <EmailStep mode={page} onSent={(email, wait) => setStep({ kind: "code", email, resendAt: Date.now() + wait * 1000 })} />
        ) : step.kind === "code" ? (
          <CodeStep
            key={step.error}
            step={step}
            onBack={() => setStep({ kind: "email" })}
            onNeedName={(code, resendAt) => setStep({ kind: "name", email: step.email, code, resendAt })}
          />
        ) : (
          <NameStep step={step} onCodeError={(error) => setStep({ kind: "code", email: step.email, resendAt: step.resendAt, error })} />
        )}
      </PixelSwap>
    </AuthStage>
  )
}

const Home = () => (
  <a href="https://imbo.dev/" className="focus-ring mb-8 block w-fit rounded-sm" aria-label={t("Imbo home")}>
    <Wordmark />
  </a>
)

function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="text-heading2 text-foreground">{title}</h1>
      {children && <p className="text-body text-muted-foreground">{children}</p>}
    </div>
  )
}

/**
 * What a refused sign-in says. A banned account (`/errors/account-banned`, FLOW-BAN) gets the server's words with the
 * email address in them as a link.
 */
function refusalOf(e: unknown): React.ReactNode {
  if (!(e instanceof ApiError) || e.type !== "/errors/account-banned") return messageOf(e)
  return e.message.split(/(\S+@\S+\.[a-z]{2,})(?=\.?(?:\s|$))/i).map((part, i) =>
    i % 2 ? (
      <a key={i} href={`mailto:${part}`} className="focus-ring rounded-sm underline underline-offset-4">
        {part}
      </a>
    ) : (
      part
    )
  )
}

function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="min-h-5 text-caption text-destructive">
      {children}
    </p>
  )
}

function EmailStep({ mode, onSent }: { mode: Mode; onSent: (email: string, resendAfter: number) => void }) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<React.ReactNode>()
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setTried(true)
    const err = problem(emailSchema, email)
    setError(err)
    if (err) return input.current?.focus()
    setSending(true)
    try {
      const r = await requestCode(email.trim())
      onSent(email.trim(), r.retry_after_s)
    } catch (e) {
      setSending(false)
      setError(refusalOf(e))
      input.current?.focus()
    }
  }

  return (
    <>
      {mode === "login" ? (
        <Heading title={t("Sign in to Imbo")}>{t("We'll email you a 6-digit code.")}</Heading>
      ) : (
        <Heading title={t("Create your account")}>{t("Free for 30 days, no card needed. We'll email you a 6-digit code.")}</Heading>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor={`${id}-email`}>{t("Email")}</Label>
        <Input
          ref={input}
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          invalid={!!error}
          aria-describedby={`${id}-error`}
          onChange={(e) => {
            setEmail(e.target.value)
            if (tried) setError(problem(emailSchema, e.target.value))
          }}
        />
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <Button type="submit" size="lg" aria-disabled={sending} className="mt-2 w-full">
          {sending ? t("Sending code…") : t("Continue")}
        </Button>
      </form>
      <p className="mt-6 text-body text-muted-foreground">
        {mode === "login" ? t("New to Imbo?") : t("Already have an account?")}{" "}
        <a href={mode === "login" ? "/register" : "/login"} onClick={onLinkClick} className="focus-ring rounded-sm text-foreground underline underline-offset-4">
          {mode === "login" ? t("Create an account") : t("Sign in")}
        </a>
      </p>
      {mode === "register" && <Agreement />}
    </>
  )
}

function Agreement() {
  const [before, rest] = t("By continuing you agree to the {terms} and {privacy}.").split("{terms}")
  const [between, after] = rest.split("{privacy}")
  return (
    <p className="mt-3 text-caption text-(--semantic-color-text-tertiary)">
      {before}
      <a href="https://imbo.dev/terms" className="focus-ring rounded-sm underline underline-offset-4">{t("Terms")}</a>
      {between}
      <a href="https://imbo.dev/privacy" className="focus-ring rounded-sm underline underline-offset-4">{t("Privacy Policy")}</a>
      {after}
    </p>
  )
}

function CodeStep({
  step,
  onBack,
  onNeedName,
}: {
  step: Extract<Step, { kind: "code" }>
  onBack: () => void
  onNeedName: (code: string, resendAt: number) => void
}) {
  const id = useId()
  const [code, setCode] = useState("")
  const [error, setError] = useState<React.ReactNode>(step.error)
  const [locked, setLocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resendAt, setResendAt] = useState(step.resendAt)
  const [sending, setSending] = useState(false)
  const [resent, setResent] = useState(false)
  const cooldown = useSecondsUntil(resendAt)
  const [sentTo, expires] = t("We sent a code to {email}. It expires in 10 minutes.").split("{email}")

  const check = async (value: string) => {
    if (checking) return
    setChecking(true)
    try {
      await verify(step.email, value)
    } catch (e) {
      setChecking(false)
      if (e instanceof ApiError && e.type === "/errors/name-required") return onNeedName(value, resendAt)
      setCode("")
      if (e instanceof ApiError && e.type === "/errors/code-locked") setLocked(true)
      setError(refusalOf(e))
    }
  }

  const resend = async () => {
    if (cooldown > 0 || sending) return
    setSending(true)
    try {
      const r = await requestCode(step.email)
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
    <>
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-4">
        <ArrowLeft size={14} aria-hidden="true" />
        {t("Use a different email")}
      </Button>
      <Heading title={t("Check your email")}>
        {sentTo}
        <span className="text-foreground wrap-anywhere">{step.email}</span>
        {expires}
      </Heading>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-code`}>{t("Code")}</Label>
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
          }}
          onComplete={check}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} invalid={!!error} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <p aria-live="polite" className="min-h-5 text-caption text-muted-foreground">
          {checking ? t("Checking…") : resent ? t("We sent a new code.") : ""}
        </p>
      </div>
      <Button variant="outline" aria-disabled={cooldown > 0 || sending} onClick={resend} className="mt-2 w-full tabular-nums">
        {sending ? t("Sending code…") : cooldown > 0 ? t("Send a new code in {n} s", { n: cooldown }) : t("Send a new code")}
      </Button>
    </>
  )
}

/** The code is kept from the step before: the server didn't use it up when it asked for a name. */
function NameStep({ step, onCodeError }: { step: Extract<Step, { kind: "name" }>; onCodeError: (message: string) => void }) {
  const id = useId()
  const [name, setName] = useState("")
  const [error, setError] = useState<string>()
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setTried(true)
    const err = problem(nameSchema, name)
    setError(err)
    if (err) return input.current?.focus()
    setSaving(true)
    try {
      await verify(step.email, step.code, name.trim())
    } catch (e) {
      setSaving(false)
      if (e instanceof ApiError && CODE_ERRORS.includes(e.type)) return onCodeError(e.message)
      setError(messageOf(e))
      input.current?.focus()
    }
  }

  return (
    <>
      <Heading title={t("Pick a name")}>{t("People see it next to your session titles. It doesn't have to be unique.")}</Heading>
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>{t("Name")}</Label>
        <Input
          ref={input}
          id={`${id}-name`}
          autoComplete="nickname"
          autoFocus
          placeholder="Dana"
          value={name}
          invalid={!!error}
          aria-describedby={`${id}-error`}
          onChange={(e) => {
            setName(e.target.value)
            if (tried) setError(problem(nameSchema, e.target.value))
          }}
        />
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <Button type="submit" size="lg" aria-disabled={saving} className="mt-2 w-full">
          {saving ? t("Creating account…") : t("Create account")}
        </Button>
      </form>
    </>
  )
}

/** After sign-up: the new account ID, the trial, and the one command that connects a computer. */
function Welcome() {
  const { account, billing } = useStore()
  const b = dataOf(billing)
  if (!account) return null
  return (
    <>
      <Heading title={t("You're in, {name}.", { name: account.name })}>
        {b?.enabled && b.access.state === "trial" && b.access.until && t("Your {n}-day free trial has started.", { n: daysUntil(b.access.until) })}
      </Heading>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-1">
          <h2 className="text-label text-foreground">{t("Your account ID")}</h2>
          <div className="-ml-1.5">
            <CopyId id={String(account.id)} />
          </div>
          <p className="text-caption text-muted-foreground">{t("People add you as a contact with this ID.")}</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-foreground">{t("Connect your agents")}</h2>
          <p className="text-body text-muted-foreground">{t("Run this in a terminal on each computer, then sign in with the same email.")}</p>
          <Command text="curl -fsSL https://imbo.dev/install | sh" />
        </section>
        <Button size="lg" className="w-full" onClick={() => navigate("/chats", { replace: true })}>
          {t("Open Imbo")}
        </Button>
      </div>
    </>
  )
}
