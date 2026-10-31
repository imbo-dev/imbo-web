import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Check, CircleAlert } from "lucide-react"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { messageOf } from "@/data/layer"
import { t } from "@/i18n"

// Renaming in place (my name, a session, a group): the name turns into a text box with Save and Cancel, and a line
// under it says who sees the new name, or why it wasn't saved. Escape cancels.

export type Rename = ReturnType<typeof useRename>

/** The button that opened the box (Edit, the pencil) gets focus back once the name shows again. */
export function useReturnFocus(renaming: boolean) {
  const button = useRef<HTMLButtonElement>(null)
  const was = useRef(renaming)
  useEffect(() => {
    if (was.current && !renaming) button.current?.focus()
    was.current = renaming
  }, [renaming])
  return button
}

/** `check` is the server's rule, checked before sending; an unchanged name just closes the box. */
export function useRename(initial: string, save: (name: string) => Promise<unknown>, onDone: () => void, check?: (name: string) => string | undefined) {
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const name = value.trim()
    if (name === initial) return onDone()
    const p = check?.(name)
    if (p) return setError(p), input.current?.focus()
    setBusy(true)
    setError(undefined)
    try {
      await save(name)
      onDone()
    } catch (e) {
      setBusy(false)
      setError(messageOf(e))
      input.current?.focus()
    }
  }
  const change = (v: string) => {
    setValue(v)
    if (error) setError(undefined)
  }
  return { input, hintId, value, change, error, busy, submit, cancel: onDone }
}

export function RenameInput({ r, label, className }: { r: Rename; label: string; className?: string }) {
  return (
    <Input
      ref={r.input}
      value={r.value}
      onChange={(e) => r.change(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return
        e.preventDefault()
        r.cancel()
      }}
      aria-label={label}
      aria-describedby={r.hintId}
      invalid={!!r.error}
      autoComplete="off"
      autoFocus
      className={className}
    />
  )
}

/** `form` is the box's form, when the buttons sit outside it. */
export function RenameButtons({ r, size, form }: { r: Rename; size?: "sm"; form?: string }) {
  return (
    <>
      <Button type="submit" form={form} size={size} aria-disabled={r.busy} className="flex-none">
        <Check size={size ? 14 : 16} aria-hidden="true" />
        {r.busy ? t("Saving…") : t("Save")}
      </Button>
      <Button type="button" variant="ghost" size={size} className="flex-none text-foreground" onClick={r.cancel}>
        {t("Cancel")}
      </Button>
    </>
  )
}

/** Who sees the new name, or why it wasn't saved. */
export function RenameHint({ r, className, children }: { r: Rename; className?: string; children: ReactNode }) {
  return (
    <p id={r.hintId} role={r.error ? "alert" : undefined} className={cn("flex items-start gap-1.5 text-caption", r.error ? "text-destructive" : "text-muted-foreground", className)}>
      {r.error && <CircleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />}
      {r.error ?? children}
    </p>
  )
}

/** The box, Save and Cancel on one line (Save and Cancel go under the box where it's narrow), with the hint under them. */
export function RenameRow({ r, label, hint }: { r: Rename; label: string; hint: ReactNode }) {
  return (
    <form onSubmit={r.submit} noValidate className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <RenameInput r={r} label={label} className="h-8 min-w-40 flex-1 px-2.5" />
        <div className="flex gap-2">
          <RenameButtons r={r} />
        </div>
      </div>
      <RenameHint r={r}>{hint}</RenameHint>
    </form>
  )
}
