import * as React from "react"
import { cn } from "@/lib/cn"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"

// The menu a right-click opens, dressed like dropdown-menu.tsx.

function ContextMenu(props: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger(props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "z-(--semantic-layout-z-index-dropdown) min-w-40 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-overlay",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

// Highlight (pointer or arrow keys) shows the hover state layer; see .state-layer[data-highlighted] in index.css.
function ContextMenuItem({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(
        "state-layer flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-body outline-none select-none data-disabled:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem }
