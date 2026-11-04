import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { cn } from "@/lib/cn"

// shadcn Progress in the brand's dress: the bar in the primary color on a selected-surface track. `value` 0 to 100.
function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-accent", className)} {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full bg-primary transition-transform duration-(--semantic-motion-duration-fast) ease-(--semantic-motion-easing-standard)"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
