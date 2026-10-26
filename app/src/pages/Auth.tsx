import { useEffect, useId, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { PixelSwap } from "@/components/PixelSwap"
import { AuthStage } from "@/components/Stage"
import { Wordmark } from "@/components/Wordmark"
import { Command, CopyId } from "@/components/bits"
import { checkCode, hasAccount, signIn, useStore } from "@/data/store"
import { emailSchema, nameSchema, problem } from "@/data/schema"
import { navigate, onLinkClick } from "@/lib/router"

// Sign-in and sign-up are one flow, as in the terminal (docs/DESIGN.md REQ-002, REQ-003): email → 6-digit code → a
// name if the email is new. The two pages only differ in their wording; an existing email on /register just signs in.

type Mode = "login" | "register"
type Page = Mode | "welcome"
type Step = { kind: "email" } | { kind: "code"; email: string } | { kind: "name"; email: string }

const RESEND_SECONDS = 60 // the server refuses a new code for the same email within a minute
const MAX_TRIES = 5 // the fifth wrong code locks this one

/** /login, /register and /welcome share one card, so moving between them (and between steps) is one pixel swap. */
export function AuthFlow({ page }: { page: Page }) {
  const [step, setStep] = useState<Step>({ kind: "email" })
  const [stepPage, setStepPage] = useState(page)
  if (stepPage !== page) {
    setStepPage(page)
    setStep({ kind: "email" })
  }
  const finish = (email: string) => {
    signIn(email)
    navigate("/chats", { replace: true })
  }

  return (
    <AuthStage wide={page === "welcome"}>
      <PixelSwap swapKey={page === "welcome" ? page : `${page}:${step.kind}`}>
        <Home />
        {page === "welcome" ? (
          <Welcome />
        ) : step.kind === "email" ? (
          <EmailStep mode={page} onSent={(email) => setStep({ kind: "code", email })} />
        ) : step.kind === "code" ? (
          <CodeStep
            email={step.email}
            onBack={() => setStep({ kind: "email" })}
            onVerified={() => (hasAccount(step.email) ? finish(step.email) : setStep({ kind: "name", email: step.email }))}
          />
        ) : (
          <NameStep
            onDone={(name) => {
              signIn(step.email, name)
              navigate("/welcome", { replace: true })
            }}
          />
        )}
      </PixelSwap>
    </AuthStage>
  )
}

const Home = () => (
  <a href="https://imbo.dev/" className="focus-ring mb-8 block w-fit rounded-sm" aria-label="Imbo home">
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

function FieldError({ id, children }: { id: string; children?: string }) {
  return (
    <p id={id} role="alert" className="min-h-5 text-caption text-destructive">
      {children}
    </p>
  )
}

/** Simulated round trip so the pending state is visible in the demo. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function EmailStep({ mode, onSent }: { mode: Mode; onSent: (email: string) => void }) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string>()
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
    await wait(700)
    onSent(email.trim())
  }

  return (
    <>
      {mode === "login" ? (
        <Heading title="Sign in to Imbo">We'll email you a 6-digit code.</Heading>
      ) : (
        <Heading title="Create your account">Free for 30 days, no card needed. We'll email you a 6-digit code.</Heading>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor={`${id}-email`}>Email</Label>
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
          {sending ? "Sending code…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-body text-muted-foreground">
        {mode === "login" ? "New to Imbo? " : "Already have an account? "}
        <a href={mode === "login" ? "/register" : "/login"} onClick={onLinkClick} className="focus-ring rounded-sm text-foreground underline underline-offset-4">
          {mode === "login" ? "Create an account" : "Sign in"}
        </a>
      </p>
      {mode === "register" && (
        <p className="mt-3 text-caption text-(--semantic-color-text-tertiary)">
          By continuing you agree to the{" "}
          <a href="https://imbo.dev/terms" className="focus-ring rounded-sm underline underline-offset-4">Terms</a> and{" "}
          <a href="https://imbo.dev/privacy" className="focus-ring rounded-sm underline underline-offset-4">Privacy Policy</a>.
        </p>
      )}
    </>
  )
}

function CodeStep({ email, onBack, onVerified }: { email: string; onBack: () => void; onVerified: () => void }) {
  const id = useId()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const [tries, setTries] = useState(0)
  const [checking, setChecking] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [resent, setResent] = useState(false)
  const locked = tries >= MAX_TRIES

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = async (value: string) => {
    if (checking) return
    setChecking(true)
    await wait(500)
    setChecking(false)
    const r = checkCode(value)
    if (r === "ok") return onVerified()
    setCode("")
    if (r === "expired") return setError("This code has expired. Send a new one.")
    const n = tries + 1
    setTries(n)
    setError(n >= MAX_TRIES ? "Too many wrong codes. Send a new one." : "That code doesn't match. Check the newest email from Imbo.")
  }

  const resend = () => {
    if (cooldown > 0) return
    setCooldown(RESEND_SECONDS)
    setTries(0)
    setError(undefined)
    setCode("")
    setResent(true)
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-4">
        <ArrowLeft size={14} aria-hidden="true" />
        Use a different email
      </Button>
      <Heading title="Check your email">
        We sent a code to <span className="text-foreground wrap-anywhere">{email}</span>. It expires in 10 minutes.
      </Heading>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-code`}>Code</Label>
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
          onComplete={verify}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} invalid={!!error} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <p aria-live="polite" className="min-h-5 text-caption text-muted-foreground">
          {checking ? "Checking…" : resent ? "We sent a new code." : ""}
        </p>
      </div>
      <Button variant="outline" aria-disabled={cooldown > 0} onClick={resend} className="mt-2 w-full tabular-nums">
        {cooldown > 0 ? `Send a new code in ${cooldown} s` : "Send a new code"}
      </Button>
    </>
  )
}

function NameStep({ onDone }: { onDone: (name: string) => void }) {
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
    await wait(600)
    onDone(name.trim())
  }

  return (
    <>
      <Heading title="Pick a name">People see it next to your session titles. It doesn't have to be unique.</Heading>
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
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
          {saving ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </>
  )
}

/** After sign-up: the new account ID, the trial, and the one command that connects a computer. */
function Welcome() {
  const { account } = useStore()
  if (!account) return null
  return (
    <>
      <Heading title={`You're in, ${account.name}.`}>Your 30-day free trial has started.</Heading>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-1">
          <h2 className="text-label text-foreground">Your account ID</h2>
          <div className="-ml-1.5">
            <CopyId id={String(account.id)} />
          </div>
          <p className="text-caption text-muted-foreground">People add you as a contact with this ID.</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-foreground">Connect your agents</h2>
          <p className="text-body text-muted-foreground">Run this in a terminal on each computer, then sign in with the same email.</p>
          <Command text="curl -fsSL https://imbo.dev/install | sh" />
        </section>
        <Button size="lg" className="w-full" onClick={() => navigate("/chats", { replace: true })}>
          Open Imbo
        </Button>
      </div>
    </>
  )
}
