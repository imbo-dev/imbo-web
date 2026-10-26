import * as React from "react"
import { cn } from "@/lib/cn"

// Text inputs carry the state layer and focus ring on the wrapper (brand/DESIGN.md「状态」: input has no ::after).
function Input({ className, invalid, ...props }: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <div
      className={cn(
        "state-layer focus-ring is-field flex h-10 w-full items-center rounded-md border bg-muted px-3",
        invalid ? "border-destructive" : "border-input",
        className
      )}
    >
      <input
        data-slot="input"
        aria-invalid={invalid || undefined}
        className="w-full min-w-0 bg-transparent text-body text-foreground outline-none placeholder:text-(--semantic-color-text-tertiary) disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  )
}

export { Input }
