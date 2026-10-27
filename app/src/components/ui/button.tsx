import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"
import { Slot } from "radix-ui"

// Brand states (brand/DESIGN.md「状态」): hover/focus/pressed come from .state-layer, the focus ring from .focus-ring,
// disabled opacity from the state layer too; no hover:bg-*/90, ring-* or disabled:opacity-50 here.
const buttonVariants = cva(
  "state-layer focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-label whitespace-nowrap disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-transparent text-foreground",
        // Outlined, never filled: white on the dark theme's error pink is 2.67:1 (brand/DESIGN.md「危险操作按钮」).
        destructive: "border border-destructive bg-transparent text-destructive",
        ghost: "bg-transparent text-muted-foreground",
        link: "h-auto px-0 text-foreground underline underline-offset-4",
      },
      size: {
        default: "h-8 px-4",
        sm: "h-6 gap-1 px-2 text-caption",
        lg: "h-10 px-5 text-body-strong",
        icon: "size-8",
        "icon-sm": "size-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
