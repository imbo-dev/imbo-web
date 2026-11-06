import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import { cn } from "@/lib/cn"

// Radix Switch dressed like Checkbox: an outlined track that fills with the foreground color when on.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "focus-ring inline-flex h-5 w-9 flex-none items-center rounded-full border-(length:--primitive-dimension-ring-width) border-muted-foreground transition-colors duration-(--semantic-motion-duration-fast) ease-(--semantic-motion-easing-standard) motion-reduce:transition-none data-[state=checked]:border-foreground data-[state=checked]:bg-foreground disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-3 translate-x-0.5 rounded-full bg-muted-foreground transition-transform duration-(--semantic-motion-duration-fast) ease-(--semantic-motion-easing-standard) motion-reduce:transition-none data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-background" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
