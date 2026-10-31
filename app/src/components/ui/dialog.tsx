import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { t } from "@/i18n"
import { cn } from "@/lib/cn"
import { Button } from "./button"

// Radix Dialog in the brand's dress: a plain scrim (brand/DESIGN.md has no blur, see 遮罩), a popover-surface panel
// centered on wide screens and a bottom sheet on phones. Every dialog needs a DialogTitle. A dialog with fields to fill
// in is a drawer instead (DrawerContent). Motion lives in index.css.

const Dialog = DialogPrimitive.Root
const DialogClose = DialogPrimitive.Close
const DialogTrigger = DialogPrimitive.Trigger

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-scrim fixed inset-0 z-(--semantic-layout-z-index-overlay) bg-(--semantic-color-surface-scrim)" />
      <DialogPrimitive.Content
        className={cn(
          "dialog-panel scroll-pane fixed z-(--semantic-layout-z-index-modal) flex max-h-[min(90dvh,48rem)] flex-col gap-4 border-(length:--semantic-layout-hairline) border-border bg-popover p-6 text-popover-foreground shadow-overlay outline-none",
          "sm:top-1/2 sm:left-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-lg max-sm:px-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          className
        )}
        {...props}
      >
        <span aria-hidden="true" className="mx-auto -mt-2 mb-1 h-1 w-9 flex-none rounded-full bg-border sm:hidden" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// How many drawers are open, so the page's notices can keep clear of a drawer's top bar on phones (App.tsx).
let drawers = 0
const drawerListeners = new Set<() => void>()
const countDrawers = (n: number) => ((drawers += n), drawerListeners.forEach((l) => l()))
export const useDrawerOpen = () =>
  React.useSyncExternalStore((l) => (drawerListeners.add(l), () => drawerListeners.delete(l)), () => drawers > 0)
/** Counts its drawer while the drawer is on screen: rendered inside Radix's Content, which mounts only then. */
function Counted() {
  React.useEffect(() => (countDrawers(1), () => countDrawers(-1)), [])
  return null
}

/**
 * A panel with fields to fill in (RULE-017): Cancel and the main button (`action`) in a bar at its top, then the title,
 * the line under it and the fields, which scroll when they don't fit. Wider than 40rem it slides in from the right at
 * full height; narrower it rises to 12 px below the window's top and keeps that height, so a keyboard opening doesn't
 * move it. `header` takes the place of the title and its line, and holds a DialogTitle of its own; `cancel` renames
 * Cancel where nothing would be cancelled.
 */
function DrawerContent({
  className,
  title,
  description,
  header,
  action,
  cancel = t("Cancel"),
  children,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title?: React.ReactNode
  description?: React.ReactNode
  header?: React.ReactNode
  action?: React.ReactNode
  cancel?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-scrim fixed inset-0 z-(--semantic-layout-z-index-overlay) bg-(--semantic-color-surface-scrim)" />
      <DialogPrimitive.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "drawer-panel fixed z-(--semantic-layout-z-index-modal) flex flex-col border-(length:--semantic-layout-hairline) border-border bg-popover text-popover-foreground shadow-overlay outline-none",
          "sm:inset-y-0 sm:right-0 sm:w-[min(28rem,100vw)] sm:border-y-0 sm:border-r-0",
          "max-sm:inset-x-0 max-sm:top-3 max-sm:h-[calc(100dvh-0.75rem)] max-sm:rounded-t-lg max-sm:border-b-0",
          className
        )}
        {...props}
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e)
          // The field marked data-autofocus takes focus, without scrolling: the drawer is still sliding in, and
          // scrolling to where the field is mid-slide would leave the page or the drawer's fields out of place.
          const field = (e.target as HTMLElement).querySelector<HTMLElement>("[data-autofocus]")
          if (e.defaultPrevented || !field) return
          e.preventDefault()
          field.focus({ preventScroll: true })
        }}
      >
        <Counted />
        <div className="flex h-14 flex-none items-center justify-between gap-2 border-b-(length:--semantic-layout-hairline) border-border px-3">
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" className="text-foreground">
              {cancel}
            </Button>
          </DialogPrimitive.Close>
          {action}
        </div>
        <div className="scroll-pane flex min-h-0 flex-1 flex-col gap-4 overscroll-contain px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:px-5">
          {header ?? (
            <div className="flex flex-col gap-1">
              <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          )}
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-heading3 text-foreground", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-body text-muted-foreground", className)} {...props} />
}

/** Buttons at the end; on phones they stack full width with the main one on top. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full", className)} {...props} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger, DrawerContent }
