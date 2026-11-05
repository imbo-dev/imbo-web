import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { Download, Share2, X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { FileRef } from "@/data/contract"
import { messageOf } from "@/data/layer"
import { fetchedFile, fetchFile } from "@/data/store"
import { t } from "@/i18n"
import { useObjectUrl } from "@/lib/useObjectUrl"

// A picture or video from a message, full screen (RULE-020, RULE-021): the file's name, its buttons and Close in a bar
// at the top, the picture or video filling the rest of the window. Each sits in a Dialog the message opens
// (messages.tsx); what's inside mounts each time it opens, and Esc closes it.

/** The name on one line: what doesn't fit is cut before the extension, which stays whole. */
function FileName({ name }: { name: string }) {
  const dot = name.lastIndexOf(".")
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""]
  return (
    <span className="flex min-w-0 whitespace-nowrap">
      <span className="min-w-0 truncate">{stem}</span>
      <span className="flex-none">{ext}</span>
    </span>
  )
}

function Viewer({ f, actions, children }: { f: FileRef; actions?: ReactNode; children: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        data-testid="file-viewer"
        aria-describedby={undefined}
        className="viewer fixed inset-0 z-(--semantic-layout-z-index-modal) flex flex-col bg-background text-foreground outline-none"
      >
        <header className="flex h-14 flex-none items-center gap-1 border-b-(length:--semantic-layout-hairline) border-border pr-2 pl-4">
          <DialogPrimitive.Title className="mr-2 flex min-w-0 flex-1 text-body-strong">
            <FileName name={f.name} />
          </DialogPrimitive.Title>
          {actions}
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label={t("Close")} data-testid="file-viewer-close">
              <X size={20} aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
        </header>
        <div className="relative min-h-0 flex-1">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** A line in the middle of the window, with what to do next under it. */
function Notice({ text, alert, children }: { text: string; alert?: boolean; children: ReactNode }) {
  return (
    <div role={alert ? "alert" : undefined} className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="max-w-sm text-body text-pretty text-foreground">{text}</p>
      {children}
    </div>
  )
}

/** Toolbar buttons: icon and word, the icon alone on phones. */
const BAR_BUTTON = "max-sm:w-8 max-sm:px-0"

/**
 * The picture fits the window, a small one at its own size; the wheel, a pinch or a double-click zooms in, and dragging
 * moves it while zoomed. A click on the space around the picture closes it; one that ends a drag doesn't.
 */
export function PictureViewer({ f, blob, url, onClose }: { f: FileRef; blob: Blob; url: string; onClose: () => void }) {
  const file = useMemo(() => new File([blob], f.name, { type: blob.type }), [blob, f.name])
  // Share only where the browser can hand a picture to other apps.
  const canShare = !!navigator.canShare?.({ files: [file] })
  const share = () =>
    navigator.share({ files: [file], title: f.name }).catch((e: Error) => e.name !== "AbortError" && toast.error(t("Couldn't share the image. Download it instead.")))
  // With reduced motion a double-click jumps to the new size instead of growing to it.
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches
  const down = useRef({ x: 0, y: 0 })
  const picture = useRef<HTMLImageElement>(null)
  return (
    <Viewer
      f={f}
      actions={
        <>
          {canShare && (
            <Button variant="ghost" onClick={share} className={BAR_BUTTON}>
              <Share2 size={16} aria-hidden="true" />
              <span className="max-sm:sr-only">{t("Share")}</span>
            </Button>
          )}
          <Button asChild variant="ghost" className={BAR_BUTTON}>
            <a href={url} download={f.name}>
              <Download size={16} aria-hidden="true" />
              <span className="max-sm:sr-only">{t("Download")}</span>
            </a>
          </Button>
        </>
      }
    >
      {/* Esc and Close stay the keyboard's ways out; this only adds the pointer's. */}
      <div
        data-testid="file-viewer-stage"
        className="size-full"
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onClick={(e) => {
          // The zoom layer takes the clicks meant for the picture, so where the picture is decides; its box follows the zoom.
          const r = picture.current?.getBoundingClientRect()
          const onPicture = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
          if (onPicture || Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 4) return
          onClose()
        }}
      >
        <TransformWrapper minScale={1} maxScale={8} doubleClick={{ mode: "toggle", step: 1, animationTime: still ? 0 : 180 }}>
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
            <img ref={picture} src={url} alt={f.name} draggable={false} className="max-h-full max-w-full object-contain" />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </Viewer>
  )
}

/** Downloads the whole video first, saying how far it got, then plays it with the browser's own controls. */
function VideoBody({ f }: { f: FileRef }) {
  const [got, setGot] = useState<{ blob: Blob } | { error: unknown } | undefined>(() => {
    const blob = fetchedFile(f)
    return blob && { blob }
  })
  const [percent, setPercent] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [unplayable, setUnplayable] = useState(false)
  const url = useObjectUrl(got && "blob" in got ? got.blob : undefined)
  const label = useId()
  useEffect(() => {
    if (fetchedFile(f)) return
    // Closing the viewer, Cancel included, stops the download.
    const stop = new AbortController()
    fetchFile(f, stop.signal, (share) => setPercent(Math.floor(share * 100))).then(
      (blob) => setGot({ blob }),
      (error) => stop.signal.aborted || setGot({ error })
    )
    return () => stop.abort()
  }, [attempt, f.id])

  if (got && "error" in got)
    return (
      <Notice text={messageOf(got.error)} alert>
        <Button
          variant="outline"
          onClick={() => {
            setGot(undefined)
            setPercent(0)
            setAttempt((n) => n + 1)
          }}
        >
          {t("Try again")}
        </Button>
      </Notice>
    )
  if (got) {
    if (!url) return null
    return unplayable ? (
      <Notice text={t("This video can't play here. Download it to open it in another app.")} alert>
        <Button asChild>
          <a href={url} download={f.name}>
            <Download size={16} aria-hidden="true" />
            {t("Download")}
          </a>
        </Button>
      </Notice>
    ) : (
      <video data-testid="file-viewer-video" src={url} controls autoPlay playsInline onError={() => setUnplayable(true)} className="block size-full object-contain" />
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-6">
      <p id={label} className="text-body text-foreground tabular-nums">
        {t("Downloading… {percent}%", { percent })}
      </p>
      <Progress value={percent} aria-labelledby={label} data-testid="file-viewer-progress" className="w-64 max-w-full" />
      <DialogPrimitive.Close asChild>
        <Button variant="outline">{t("Cancel")}</Button>
      </DialogPrimitive.Close>
    </div>
  )
}

export function VideoViewer({ f }: { f: FileRef }) {
  return (
    <Viewer f={f}>
      <VideoBody f={f} />
    </Viewer>
  )
}
