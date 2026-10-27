import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/cn"

// Radix Dialog in the brand's dress: a plain scrim (brand/DESIGN.md has no blur, see 遮罩), a popover-surface panel
// centered on wide screens and a bottom sheet on phones. Every dialog needs a DialogTitle. Motion lives in index.css.

const Dialog = DialogPrimitive.Root
const DialogClose = DialogPrimitive.Close

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

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle }
