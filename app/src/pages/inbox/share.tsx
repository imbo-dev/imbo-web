import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Copy, Download, FileText, Share2, X } from "lucide-react"
import { toast } from "sonner"
import { Avatar, Sep, senderAvatar } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Wordmark } from "@/components/Wordmark"
import type { Conversation, Message } from "@/data/contract"
import { conversationTitle, type State } from "@/data/store"
import { t } from "@/i18n"
import { cn } from "@/lib/cn"
import { clock, fullDate, langOf, sameDay } from "@/lib/format"
import { mine, sourceOf } from "./messages"

// Picked messages drawn as one picture to share, the same picture as the App's: the chat's picture and name, the
// messages as bubbles — what the sharer sent in person on the right with their picture after it, everything else, their
// sessions' messages included, on the left after its sender's picture, as in the chat — then Imbo and imbo.dev. Names
// are account names, never "You": whoever sees the picture isn't the sharer. Files by name only. The
// picture is made in this browser (modern-screenshot draws the card through an SVG, so the browser lays it out the way
// it lays out the page) and never uploaded.

/** How many messages one picture holds. */
export const MAX_PICKED = 50
/** The picture's width in CSS pixels, as in the App. */
const CARD_WIDTH = 390
/** A message longer than this is cut in the picture, which says how much was left out. */
const MAX_CHARS = 2000

function Item({ s, m }: { s: State; m: Message }) {
  const right = mine(s, m)
  const chars = [...m.body]
  const cut = chars.length > MAX_CHARS
  return (
    <div className={cn("flex items-end gap-2 py-1.5", right ? "justify-end pl-8" : "pr-8")}>
      {!right && <Avatar kind={senderAvatar(m.from)} tool={m.from.agent?.tool} size="sm" />}
      <div className={cn("flex min-w-0 flex-col gap-1", right ? "items-end" : "items-start")}>
        <p className="flex max-w-full items-baseline gap-1.5 text-caption text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">
              <span className="text-label text-foreground">{m.from.name}</span>
              {m.from.agent && ` ${m.from.agent.title}`}
            </span>
            {!m.from.agent && (
              <>
                <Sep />
                <span className="flex-none">{sourceOf(m.from.via)}</span>
              </>
            )}
          </span>
          <time dateTime={m.created_at} className="flex-none tabular-nums">
            {clock(m.created_at)}
          </time>
        </p>
        {m.body && (
          <div className={cn("max-w-full rounded-lg px-3.5 py-2.5", right ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-accent text-foreground")}>
            <p lang={langOf(m.body)} className="text-body whitespace-pre-wrap wrap-anywhere">
              {cut ? chars.slice(0, MAX_CHARS).join("") + "…" : m.body}
            </p>
            {cut && <p className="mt-1 text-caption">{t("{n} more characters not shown", { n: chars.length - MAX_CHARS })}</p>}
          </div>
        )}
        {m.files.map((f) => (
          <p key={f.id} className="flex max-w-full items-center gap-2 rounded-md border-(length:--semantic-layout-hairline) border-border bg-card px-2.5 py-2 text-label text-foreground">
            <FileText size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
            <span className="min-w-0 wrap-anywhere">{f.name}</span>
          </p>
        ))}
      </div>
      {right && <Avatar kind="person" label={s.account?.name} src={s.account?.avatar_url} size="sm" />}
    </div>
  )
}

function DateDivider({ at }: { at: string }) {
  return (
    <div className="flex items-center gap-3 py-3 text-caption text-muted-foreground">
      <span className="h-(--semantic-layout-hairline) flex-1 bg-border" />
      {fullDate(at)}
      <span className="h-(--semantic-layout-hairline) flex-1 bg-border" />
    </div>
  )
}

/** `messages` oldest first. All on one day, the date goes after the count and there are no dividers. */
function ShareCard({ s, c, messages }: { s: State; c: Conversation; messages: Message[] }) {
  const title = conversationTitle(c)
  const oneDay = messages.every((m) => sameDay(m.created_at, messages[0].created_at))
  return (
    <div style={{ width: CARD_WIDTH }} className="bg-background px-5 pt-6 pb-5 text-foreground">
      <div className="flex items-center gap-3 pb-3">
        <Avatar kind={c.group ? "group" : "person"} label={title} src={(c.group ?? c.peer)?.avatar_url} size="lg" />
        <div className="min-w-0">
          <p className="text-heading3 wrap-anywhere">{title}</p>
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            {messages.length === 1 ? t("1 message") : t("{n} messages", { n: messages.length })}
            {oneDay && (
              <>
                <Sep />
                {fullDate(messages[0].created_at)}
              </>
            )}
          </p>
        </div>
      </div>
      {messages.map((m, i) => (
        <div key={m.id}>
          {!oneDay && (i === 0 || !sameDay(messages[i - 1].created_at, m.created_at)) && <DateDivider at={m.created_at} />}
          <Item s={s} m={m} />
        </div>
      ))}
      <div className="mt-4 flex items-center justify-between border-t-(length:--semantic-layout-hairline) border-border pt-4">
        <Wordmark className="block h-5 w-auto" />
        <span className="text-caption text-muted-foreground">imbo.dev</span>
      </div>
    </div>
  )
}

/**
 * Up to 3 pixels per CSS pixel, fewer for a tall card: iOS Safari draws nothing on a canvas over 16.7 million pixels.
 * A canvas the browser can't encode comes back as a file that isn't a picture; decoding it once tells.
 */
async function makeImage(card: HTMLElement) {
  const { domToBlob } = await import("modern-screenshot")
  const { width, height } = card.getBoundingClientRect()
  const scale = Math.min(3, Math.sqrt(16_777_216 / (width * height)))
  const blob = await domToBlob(card, { scale, type: "image/png", maximumCanvasSize: 16_384 })
  await createImageBitmap(blob).then((b) => b.close())
  return blob
}

const fileName = (title: string) => `imbo-${title.replace(/[\\/:*?"<>|\s]+/g, "-")}.png`

type Made = { status: "making" } | { status: "ready"; file: File; url: string } | { status: "failed" }

/** The dialog's inside: mounts each time the dialog opens, draws the card off screen, then shows the picture it made. */
function ShareBody({ s, c, messages }: { s: State; c: Conversation; messages: Message[] }) {
  const card = useRef<HTMLDivElement>(null)
  const [made, setMade] = useState<Made>({ status: "making" })
  const [attempt, setAttempt] = useState(0)
  const title = conversationTitle(c)
  useEffect(() => {
    let live = true
    let url: string | undefined
    makeImage(card.current!)
      .then((blob) => {
        if (!live) return
        url = URL.createObjectURL(blob)
        setMade({ status: "ready", file: new File([blob], fileName(title), { type: "image/png" }), url })
      })
      .catch(() => live && setMade({ status: "failed" }))
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [attempt, title])

  const file = made.status === "ready" ? made.file : undefined
  // Share… only where the browser can hand a picture to other apps; Copy image only where it can put one on the clipboard.
  const canShare = !!file && !!navigator.canShare?.({ files: [file] })
  const canCopy = typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write
  const share = (f: File) =>
    navigator.share({ files: [f], title }).catch((e: Error) => e.name !== "AbortError" && toast.error(t("Couldn't share the image. Download it instead.")))
  const copy = (f: File) =>
    navigator.clipboard.write([new ClipboardItem({ [f.type]: f })]).then(
      () => toast(t("Image copied")),
      () => toast.error(t("Couldn't copy the image. Download it instead."))
    )
  const download = (url: string, f: File) => Object.assign(document.createElement("a"), { href: url, download: f.name }).click()

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DialogTitle>{t("Share as image")}</DialogTitle>
          <DialogDescription>{t("Made in this browser, never uploaded.")}</DialogDescription>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" aria-label={t("Close")} className="-mt-1 -mr-2">
            <X size={16} aria-hidden="true" />
          </Button>
        </DialogClose>
      </div>
      <div className="scroll-pane min-h-0 flex-1 rounded-md bg-muted p-4">
        {made.status === "ready" ? (
          <img src={made.url} width={CARD_WIDTH} alt={t("The image to share")} className="mx-auto block h-auto max-w-full rounded-md border-(length:--semantic-layout-hairline) border-border" />
        ) : made.status === "making" ? (
          <p role="status" className="grid min-h-48 place-items-center text-caption text-muted-foreground">
            {t("Making the image…")}
          </p>
        ) : (
          <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-body text-foreground">{t("Couldn't make the image. Try again.")}</p>
            <Button
              variant="outline"
              onClick={() => {
                setMade({ status: "making" })
                setAttempt((n) => n + 1)
              }}
            >
              {t("Try again")}
            </Button>
          </div>
        )}
      </div>
      <DialogFooter>
        {canShare && (
          <Button variant="outline" onClick={() => share(file)}>
            <Share2 size={16} aria-hidden="true" />
            {t("Share…")}
          </Button>
        )}
        {canCopy && (
          <Button variant="outline" disabled={!file} onClick={() => file && copy(file)}>
            <Copy size={16} aria-hidden="true" />
            {t("Copy image")}
          </Button>
        )}
        <Button disabled={!file} onClick={() => made.status === "ready" && download(made.url, made.file)}>
          <Download size={16} aria-hidden="true" />
          {t("Download PNG")}
        </Button>
      </DialogFooter>
      {createPortal(
        <div aria-hidden="true" inert className="pointer-events-none fixed top-0 left-[-10000px]">
          <div ref={card}>
            <ShareCard s={s} c={c} messages={messages} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/** The Share as image dialog; `messages` oldest first, kept while the dialog closes. */
export function ShareDialogContent({ s, c, messages }: { s: State; c: Conversation; messages: Message[] }) {
  return (
    <DialogContent className="sm:w-[min(30rem,calc(100vw-2rem))]">
      <ShareBody s={s} c={c} messages={messages} />
    </DialogContent>
  )
}
