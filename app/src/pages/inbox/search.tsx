import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { Message, MessagesPage } from "@/data/contract"
import type { ApiError } from "@/data/layer"
import { searchChat, type Load, type State } from "@/data/store"
import { t } from "@/i18n"
import { langOf, shortWhen } from "@/lib/format"
import { afterName, mine } from "./messages"
import { ErrorState } from "./states"

/** How long typing has to stop before the search goes out (FLOW-CHAT-SEARCH S1). */
const SETTLE = 300
/** API-086 takes up to 100 characters, counted as the server counts them. */
const MOST = 100

export type ChatSearching = ReturnType<typeof useChatSearch>

/**
 * Finding messages in one chat (FLOW-CHAT-SEARCH): what's in the box, and what the server found for it. Only the
 * answer to what's in the box now shows; an earlier, slower one is dropped.
 */
export function useChatSearch(conversationId: number) {
  const [q, setQ] = useState("")
  const [found, setFound] = useState<Load<MessagesPage>>()
  const [tries, setTries] = useState(0)
  const words = q.trim()
  const long = [...words].length > MOST
  useEffect(() => {
    if (!words || long) return void setFound(undefined)
    let live = true
    const timer = setTimeout(() => {
      setFound({ status: "loading" })
      searchChat(conversationId, words).then(
        (data) => live && setFound({ status: "ready", data }),
        (error: ApiError) => live && setFound({ status: "error", error })
      )
    }, SETTLE)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [words, long, conversationId, tries])
  return { q, setQ, words, long, found, retry: () => setTries((n) => n + 1) }
}

/** The box that takes the header's place while searching; Esc or × closes it and leaves the chat where it was. */
export function SearchBar({ search, onClose }: { search: ChatSearching; onClose: () => void }) {
  return (
    <div className="flex h-14 flex-none items-center gap-2 border-b-(length:--semantic-layout-hairline) border-border px-4 max-sm:pl-3">
      <Search size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
      <input
        autoFocus
        type="search"
        value={search.q}
        onChange={(e) => search.setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), onClose())}
        aria-label={t("Search in this chat")}
        aria-invalid={search.long || undefined}
        placeholder={t("Search in this chat")}
        className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-(--semantic-color-text-tertiary) [&::-webkit-search-cancel-button]:hidden"
      />
      <Button variant="ghost" size="icon" aria-label={t("Close search")} onClick={onClose}>
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}

/** Over the messages, what the search found, newest first; picking one hands it to `onPick`. Nothing while the box is empty. */
export function SearchResults({ s, search, onPick }: { s: State; search: ChatSearching; onPick: (id: number) => void }) {
  const { found, long, words } = search
  if (!found && !long) return null
  return (
    <div className="scroll-pane absolute inset-0 z-10 bg-background">
      {long ? (
        <p role="status" className="px-4 py-6 text-body text-muted-foreground">
          {t("Search for up to {n} characters.", { n: MOST })}
        </p>
      ) : found!.status === "loading" ? (
        <p role="status" className="px-4 py-6 text-body text-muted-foreground">
          {t("Searching…")}
        </p>
      ) : found!.status === "error" ? (
        <ErrorState title={t("Couldn't search")} error={found!.error} onRetry={search.retry} />
      ) : !found!.data.messages.length ? (
        <p role="status" className="px-4 py-6 text-body text-muted-foreground">
          {t("No messages found")}
        </p>
      ) : (
        <>
          <ul aria-label={t("Messages found")} className="flex flex-col p-2">
            {found!.data.messages.map((m) => (
              <li key={m.id}>
                <Hit s={s} m={m} words={words} onPick={() => onPick(m.id)} />
              </li>
            ))}
          </ul>
          {found!.data.has_more && <p className="px-4 pb-4 text-caption text-muted-foreground">{t("Showing the latest 50")}</p>}
        </>
      )}
    </div>
  )
}

/** One message found: who sent it and when, then its text from a little before the first match, the match marked. */
function Hit({ s, m, words, onPick }: { s: State; m: Message; words: string; onPick: () => void }) {
  const at = m.body.toLowerCase().indexOf(words.toLowerCase())
  const from = at > 24 ? at - 16 : 0
  const text = (from ? "…" : "") + m.body.slice(from)
  const hit = at - from + (from ? 1 : 0)
  return (
    <button type="button" onClick={onPick} className="state-layer focus-ring flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left">
      <span className="flex w-full min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate text-label text-foreground">{mine(s, m) ? t("You") : `${m.from.name} ${afterName(m.from)}`}</span>
        <time dateTime={m.created_at} className="ml-auto flex-none text-caption tabular-nums text-(--semantic-color-text-tertiary)">
          {shortWhen(m.created_at)}
        </time>
      </span>
      <span lang={langOf(m.body)} className="line-clamp-2 text-body wrap-anywhere text-muted-foreground">
        {at < 0 ? (
          text
        ) : (
          <>
            {text.slice(0, hit)}
            <mark className="rounded-sm bg-(--semantic-color-surface-selected) text-foreground">{text.slice(hit, hit + words.length)}</mark>
            {text.slice(hit + words.length)}
          </>
        )}
      </span>
    </button>
  )
}
