import * as React from "react"
import { cn } from "@/lib/cn"
import { OTPInput, OTPInputContext } from "input-otp"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn("flex items-center gap-2 has-disabled:opacity-(--state-disabled)", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={cn("flex items-center gap-2", className)} {...props} />
}

// Separate slots; the active one shows the brand focus ring (outline), an invalid code turns every border to the error color.
function InputOTPSlot({
  index,
  invalid,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
  invalid?: boolean
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex h-12 w-10 items-center justify-center rounded-md border bg-muted text-heading2 tabular-nums text-foreground",
        invalid ? "border-destructive" : "border-input",
        "data-[active=true]:outline-(length:--focus-ring-width) data-[active=true]:outline-offset-(--focus-ring-offset) data-[active=true]:outline-(--focus-ring-color) data-[active=true]:outline-solid",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="otp-caret h-5 w-px bg-foreground" />
        </div>
      )}
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot }
