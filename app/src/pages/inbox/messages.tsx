import { Fragment, type ReactNode } from "react"
import { ArrowDown, Download, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, SessionName, Sep, Tag, agentAvatar } from "@/components/bits"
import type { FileRef, Message } from "@/data/contract"
import { fileExpired, recipientOf, type State } from "@/data/store"
import { clock, dayLabel, fileSize, langOf, sameDay } from "@/lib/format"
import { useFollow } from "@/lib/useFollow"

// Messages as rows, not bubbles (brand/examples product sample): every message is a session talking, so the row
// leads with who sent it — "Mia orders-api" — and, where it matters, which session it went to.

function Attachments({ files }: { files: FileRef[] }) {
  return (
    <ul className="mt-2 flex max-w-sm flex-col gap-2">
      {files.map((f) => {
        const expired = fileExpired(f)
        return (
          <li key={f.id} className="flex items-center gap-3 rounded-md border-(length:--semantic-layout-hairline) border-border bg-card py-2 pr-2 pl-3">
            <FileText size={20} aria-hidden="true" className="flex-none text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body wrap-anywhere text-foreground">{f.name}</span>
              <span className="flex items-center gap-2 text-caption text-muted-foreground">
                {fileSize(f.size)}
                {expired && (
                  <>
                    <Sep />
                    Files are kept 7 days
                  </>
                )}
              </span>
            </span>
            {expired ? (
              <Tag>Expired</Tag>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Download ${f.name}`}
                onClick={() => toast(`Demo: ${f.name} would download from Imbo.`)}
              >
                <Download size={16} aria-hidden="true" />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** A message sent with `imbo send` has no `from.agent`: it came from the sender's terminal. Group messages have no `to`. */
export function MessageRow({ s, m }: { s: State; m: Message }) {
  const to = recipientOf(s, m)
  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <Avatar kind={agentAvatar(m.from.agent?.tool)} />
      <div className="min-w-0">
        <header className="flex min-w-0 items-baseline gap-2">
          <SessionName owner={m.from.name} title={m.from.agent?.title ?? "Terminal"} strong />
          {to && <span className="min-w-0 truncate text-caption text-(--semantic-color-text-tertiary)">to {to.owner} {to.title}</span>}
          <time dateTime={m.created_at} className="flex-none text-caption tabular-nums text-(--semantic-color-text-tertiary)">
            {clock(m.created_at)}
          </time>
        </header>
        <p lang={langOf(m.body)} className="text-body whitespace-pre-wrap wrap-anywhere text-foreground">
          {m.body}
        </p>
        {m.files.length > 0 && <Attachments files={m.files} />}
      </div>
    </article>
  )
}

function DayDivider({ at }: { at: string }) {
  return (
    <div role="separator" className="flex items-center gap-3 text-caption text-(--semantic-color-text-tertiary)">
      <span className="h-(--semantic-layout-hairline) flex-1 bg-border" />
      {dayLabel(at)}
      <span className="h-(--semantic-layout-hairline) flex-1 bg-border" />
    </div>
  )
}

/** Scrolling message list that stays on the newest message while you're at the bottom, with a day divider per day. */
export function MessageList({ s, messages, resetKey, label }: { s: State; messages: Message[]; resetKey: string; label: string }) {
  const { ref, showJump, jump } = useFollow<HTMLDivElement>(messages.length, resetKey)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} tabIndex={0} aria-label={label} className="scroll-pane focus-ring min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {messages.map((m, i) => (
            <Fragment key={m.id}>
              {(i === 0 || !sameDay(messages[i - 1].created_at, m.created_at)) && <DayDivider at={m.created_at} />}
              <MessageRow s={s} m={m} />
            </Fragment>
          ))}
        </div>
      </div>
      {showJump && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Button variant="secondary" size="sm" onClick={jump} className="shadow-raised">
            <ArrowDown size={14} aria-hidden="true" />
            Jump to latest
          </Button>
        </div>
      )}
    </div>
  )
}

/** Header bar shared by every detail pane; `back` is the list this pane came from (shown on phones only). */
export function PaneHeader({ back, children, end }: { back: ReactNode; children: ReactNode; end?: ReactNode }) {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b-(length:--semantic-layout-hairline) border-border px-4 max-sm:pl-2">
      <span className="sm:hidden">{back}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {end}
    </header>
  )
}
