import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { AsciiRain } from "./AsciiRain"

// The landing page's character rain behind everything. The app sits in one fixed window in the middle of the screen;
// on phones the window takes the whole screen.
export function AppStage({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <AsciiRain />
      <div className="relative z-10 grid size-full place-items-center sm:p-6">
        <div className="flex size-full flex-col overflow-hidden bg-background sm:h-[min(100%,46rem)] sm:w-[min(100%,50rem)] sm:rounded-lg sm:border sm:border-border sm:shadow-overlay">
          {children}
        </div>
      </div>
    </div>
  )
}

// Sign-in and sign-up: one card, no app chrome (ui-constraints IA-008). The stage itself scrolls so a short screen
// with every error showing still reaches both ends of the card.
/** `wide` fits the install command on one line (the welcome card). */
export function AuthStage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <AsciiRain />
      <div className="scroll-pane relative z-10 size-full">
        <div className="grid min-h-full place-items-center px-4 py-10">
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-lg border border-border bg-background p-6 shadow-overlay transition-[max-width] duration-(--semantic-motion-duration-base) motion-reduce:transition-none sm:p-8",
              wide ? "max-w-[27rem]" : "max-w-[25rem]"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
