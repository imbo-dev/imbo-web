import type { ReactNode } from "react"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { retry } from "@/data/store"

/** Rows shaped like the list they stand in for: avatar, title line, preview line. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-1 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-2 py-2">
          <span className="skeleton size-8 rounded-full!" />
          <span className="flex flex-col gap-1.5">
            <span className="skeleton h-3.5" style={{ width: `${55 - (i % 3) * 12}%` }} />
            <span className="skeleton h-3" style={{ width: `${88 - (i % 2) * 20}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Message rows while a thread loads. */
export function ThreadSkeleton() {
  return (
    <div role="status" aria-label="Loading messages" className="flex flex-col gap-5 p-4">
      {[70, 45, 85, 60].map((w, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <span className="skeleton size-8 rounded-full!" />
          <span className="flex flex-col gap-2 pt-1">
            <span className="skeleton h-3 w-32" />
            <span className="skeleton h-3.5" style={{ width: `${w}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span aria-hidden="true" className="text-(--semantic-color-text-tertiary)">{icon}</span>
      <h2 className="text-body-strong text-foreground">{title}</h2>
      {children && <div className="flex w-full max-w-80 flex-col gap-3 text-body text-muted-foreground">{children}</div>}
    </div>
  )
}

export function ErrorState({ what }: { what: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <h2 className="text-body-strong text-foreground">Couldn't load {what}</h2>
      <p className="text-body text-muted-foreground">Imbo didn't answer. Check your connection and try again.</p>
      <Button variant="outline" onClick={retry}>
        <RotateCw size={16} aria-hidden="true" />
        Try again
      </Button>
    </div>
  )
}
