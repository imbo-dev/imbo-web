import * as React from "react"
import { Check } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { cn } from "@/lib/cn"

// Radix Checkbox in the brand's dress: an outlined box that fills with the foreground color when checked.
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "focus-ring grid size-4 flex-none place-items-center rounded-sm border-(length:--primitive-dimension-ring-width) border-muted-foreground data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
