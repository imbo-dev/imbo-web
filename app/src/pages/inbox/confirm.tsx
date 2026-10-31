import { useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Consequence, DialogError } from "./safety"

/**
 * A question before something that can't simply be taken back (removing a contact, signing out a computer, the
 * group owner's actions): what it does, line by line, then Cancel or the action. Focus starts on Cancel; the
 * action stays unavailable while it runs, and a refusal shows above the buttons.
 */
export function ConfirmContent({
  title,
  description,
  consequences,
  action,
  busy,
  unavailable,
  error,
  onConfirm,
  onCancel,
  children,
  onCloseAutoFocus,
}: {
  title: string
  /** A line under the title. */
  description?: string
  consequences: [ReactNode, ReactNode][]
  action: { label: string; busyLabel: string; icon: ReactNode; destructive?: boolean }
  busy: boolean
  /** The action can't be taken yet, such as until a word is typed in. */
  unavailable?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
  /** Anything to fill in first, under the consequences. */
  children?: ReactNode
  onCloseAutoFocus?: (e: Event) => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <DialogContent
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        cancel.current?.focus()
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {description ? (
        <div className="flex flex-col gap-1">
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          <p className="text-body text-muted-foreground">{description}</p>
        </div>
      ) : (
        <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
      )}
      <ul className="flex flex-col gap-3">
        {consequences.map(([icon, text], i) => (
          <Consequence key={i} icon={icon}>
            {text}
          </Consequence>
        ))}
      </ul>
      {children}
      <DialogError>{error}</DialogError>
      <DialogFooter>
        <Button ref={cancel} variant="ghost" className="text-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={action.destructive ? "destructive" : "default"} aria-disabled={busy || unavailable} onClick={onConfirm}>
          {action.icon}
          {busy ? action.busyLabel : action.label}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
