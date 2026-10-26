import { useId } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { Popover, ToggleGroup } from "radix-ui"
import { Button } from "@/components/ui/button"
import { receive, setBillingOn, setMode, setPreset, setStatus, signIn, useStore, type BillingPreset, type Status } from "@/data/store"
import { navigate } from "@/lib/router"

// Demo-only controls, outside the app window: switch the plan and billing mode (API-032), the data state, and drop in
// a new message the way the ~10 s poll will. "off" is a server without Creem, e.g. self-hosted. Not part of the product.

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-caption text-muted-foreground">
        {label}
      </span>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={id}
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        className="flex flex-wrap rounded-md border-(length:--semantic-layout-hairline) border-input p-0.5"
      >
        {options.map((o) => (
          <ToggleGroup.Item
            key={o}
            value={o}
            className="state-layer focus-ring h-7 flex-1 rounded-sm px-2 text-caption whitespace-nowrap text-muted-foreground capitalize data-[state=on]:bg-accent data-[state=on]:text-foreground"
          >
            {o.replace("_", " ")}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  )
}

export function DemoPanel() {
  const s = useStore()
  const titleId = useId()
  return (
    <Popover.Root>
      {/* .state-layer sets position: relative, so the fixed placement lives on a wrapper. */}
      <div className="fixed bottom-4 left-4 z-20 max-sm:bottom-16">
        <Popover.Trigger asChild>
          <Button variant="secondary" size="sm" className="shadow-raised">
            <SlidersHorizontal size={14} aria-hidden="true" />
            Demo
          </Button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={titleId}
          className="z-30 flex w-72 flex-col gap-4 rounded-lg border-(length:--semantic-layout-hairline) border-border bg-popover p-4 text-popover-foreground shadow-overlay"
        >
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-body-strong">
              Demo controls
            </h2>
            <Popover.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close demo controls">
                <X size={16} aria-hidden="true" />
              </Button>
            </Popover.Close>
          </div>
          {s.account ? (
            <>
              <Choice<BillingPreset> label="Plan" value={s.preset} options={["free", "trial", "paid", "ending", "past_due", "expired"]} onChange={setPreset} />
              <Choice
                label="Billing"
                value={s.billingOn ? s.mode : "off"}
                options={["live", "test", "off"] as const}
                onChange={(v) => {
                  setBillingOn(v !== "off")
                  if (v !== "off") setMode(v)
                }}
              />
              <Choice<Status> label="Data" value={s.status} options={["ready", "loading", "empty", "error"]} onChange={setStatus} />
              <Button variant="outline" onClick={receive} disabled={s.status !== "ready"}>
                New message from Mia
              </Button>
            </>
          ) : (
            <Popover.Close asChild>
              <Button
                variant="outline"
                onClick={() => {
                  signIn("dana@example.com")
                  navigate("/chats", { replace: true })
                }}
              >
                Skip sign-in as Dana
              </Button>
            </Popover.Close>
          )}
          <p className="text-caption text-muted-foreground">
            Sign-in: dana@example.com has an account, any other email signs up. Codes: 000000 is wrong, 111111 has expired, other 6 digits work.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
