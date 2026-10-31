import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { BarChart3, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Stats } from "@/data/contract"
import type { ApiError } from "@/data/layer"
import { admin, type Load } from "@/data/store"
import { dateTime, shortDate } from "@/lib/format"
import { onFilterClick, useQuery } from "@/lib/router"
import { ErrorState } from "@/pages/inbox/states"

// The Dashboard tab of PAGE-WEB-ADMIN (API-068): four numbers counted when the page opens, and the last 30 Beijing-time
// days as three small charts, each on its own scale (two measures never share an axis). `?view=table` shows the days
// as a table instead. Single series, so no legend: each chart's title names it. Series color is the brand's --chart-1.

type Day = Stats["days"][number]
type Series = { key: "accounts" | "active_7d" | "messages"; title: string; unit: string; kind: "line" | "bar" }
const SERIES: Series[] = [
  { key: "accounts", title: "Accounts", unit: "accounts", kind: "line" },
  { key: "active_7d", title: "Active in the last 7 days", unit: "active accounts", kind: "line" },
  { key: "messages", title: "Messages per day", unit: "messages", kind: "bar" },
]
const n = (v: number) => v.toLocaleString("en-US")
/** Hover follows a mouse or trackpad only; a tap picks the day instead (ui-constraints INT-006). */
const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches
/** `2026-10-27` is a Beijing date; noon keeps it on the same day in any time zone. */
const dayName = (d: string) => shortDate(`${d}T12:00:00`)

export function Dashboard() {
  const query = useQuery()
  const table = query.get("view") === "table"
  const [stats, setStats] = useState<Load<Stats>>({ status: "loading" })
  const [at, setAt] = useState(() => new Date().toISOString())
  const load = useCallback(async () => {
    setStats({ status: "loading" })
    try {
      const data = await admin.stats()
      setAt(new Date().toISOString())
      setStats({ status: "ready", data })
    } catch (e) {
      setStats({ status: "error", error: e as ApiError })
    }
  }, [])
  useEffect(() => void load(), [load])

  if (stats.status === "error")
    return (
      <div className="grid flex-1 place-items-center">
        <ErrorState title="Couldn't load the numbers" error={stats.error} onRetry={load} />
      </div>
    )
  const d = stats.status === "ready" ? stats.data : undefined
  return (
    <div className="scroll-pane flex min-h-0 flex-1 flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-muted-foreground">{d ? `Counted when you open this page, ${dateTime(at)}.` : "Counting…"}</p>
        <Button asChild variant="ghost" size="sm" className="text-foreground">
          <a href={table ? "/admin/dashboard" : "/admin/dashboard?view=table"} onClick={onFilterClick}>
            {table ? <BarChart3 size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />}
            {table ? "Show as charts" : "Show as table"}
          </a>
        </Button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Accounts" value={d?.accounts} note="Not counting deleted ones" />
        <Tile label="Active in the last 7 days" value={d?.active_7d} note="Sent at least one message" />
        <Tile label="Paying now" value={d?.paid} note="Subscriptions that give access. No daily history." />
        <Tile label="Messages today" value={d?.messages_today} note="Since 00:00 Beijing time" />
      </dl>
      {d && (table ? <DaysTable days={d.days} /> : (
        <div className="grid gap-3 lg:grid-cols-3">
          {SERIES.map((x) => (
            <Chart key={x.key} series={x} days={d.days} />
          ))}
        </div>
      ))}
      {!d && <div className="skeleton h-64" />}
      <p className="text-caption text-muted-foreground">
        Each chart has its own scale. Active counts accounts that sent a message in the 7 days up to that day. Today's bar counts messages so far.
      </p>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value?: number; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border-(length:--semantic-layout-hairline) border-border p-4">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-heading2 tabular-nums text-foreground">{value === undefined ? <span className="skeleton inline-block h-7 w-20 align-middle" /> : n(value)}</dd>
      <dd className="text-caption text-muted-foreground">{note}</dd>
    </div>
  )
}

/** Three or four round tick values covering [lo, hi]; bars start at zero, lines fit their range. */
function ticks(lo: number, hi: number) {
  const span = Math.max(1, hi - lo)
  const raw = span / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 4)!
  const start = Math.floor(lo / step) * step
  const out: number[] = []
  for (let v = start; v < hi + step; v += step) out.push(v)
  return out
}

const H = 248
const PAD = { top: 8, right: 8, bottom: 22, left: 44 }

/** One series over 30 days with its own y-axis, a crosshair and a tooltip on hover or arrow keys. */
function Chart({ series, days }: { series: Series; days: Day[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [hover, setHover] = useState<number>()
  const titleId = useId()
  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const values = days.map((d) => d[series.key])
  const last = days.at(-1)
  const bar = series.kind === "bar"
  const lo = bar ? 0 : Math.min(...values)
  const ys = ticks(lo, Math.max(...values))
  const [y0, y1] = [ys[0], ys.at(-1)!]
  const plotW = Math.max(0, w - PAD.left - PAD.right)
  const plotH = H - PAD.top - PAD.bottom
  const slot = plotW / Math.max(1, days.length)
  const x = (i: number) => PAD.left + (bar ? slot * (i + 0.5) : (plotW * i) / Math.max(1, days.length - 1))
  const y = (v: number) => PAD.top + plotH - ((v - y0) / Math.max(1, y1 - y0)) * plotH
  const barW = Math.min(24, Math.max(2, slot - 2))
  const labelAt = [0, Math.floor((days.length - 1) / 2), days.length - 1]

  const pick = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect()
    const px = clientX - rect.left - PAD.left
    const i = bar ? Math.floor(px / slot) : Math.round((px / Math.max(1, plotW)) * (days.length - 1))
    setHover(Math.min(days.length - 1, Math.max(0, i)))
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    setHover((h) => Math.min(days.length - 1, Math.max(0, (h ?? days.length - 1) + (e.key === "ArrowRight" ? 1 : -1))))
  }
  const h = hover !== undefined ? days[hover] : undefined
  const tipLeft = hover !== undefined ? Math.min(Math.max(x(hover), 64), Math.max(64, w - 64)) : 0

  return (
    <figure className="flex flex-col gap-3 rounded-lg border-(length:--semantic-layout-hairline) border-border p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span id={titleId} className="text-body-strong text-foreground">
          {series.title}
        </span>
        {last && (
          <span className="text-caption whitespace-nowrap tabular-nums text-muted-foreground">
            {n(last[series.key])} on {dayName(last.date)}
          </span>
        )}
      </figcaption>
      <div
        ref={box}
        tabIndex={0}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-desc`}
        onPointerMove={(e) => finePointer() && pick(e.clientX)}
        onPointerLeave={() => finePointer() && setHover(undefined)}
        onClick={(e) => pick(e.clientX)}
        onKeyDown={onKey}
        onBlur={() => setHover(undefined)}
        className="focus-ring relative rounded-sm"
        style={{ height: H }}
      >
        <span id={`${titleId}-desc`} className="sr-only">
          Last 30 days, from {n(values[0])} on {dayName(days[0].date)} to {n(values.at(-1)!)} on {dayName(last!.date)}. Use the left and right arrow keys
          to read each day.
        </span>
        {w > 0 && (
          <svg width={w} height={H} aria-hidden="true" className="block overflow-visible">
            {ys.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-caption tabular-nums">
                  {n(v)}
                </text>
              </g>
            ))}
            {labelAt.map((i) => (
              <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 && !bar ? "start" : i === days.length - 1 && !bar ? "end" : "middle"} className="fill-muted-foreground text-caption">
                {dayName(days[i].date)}
              </text>
            ))}
            {hover !== undefined && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-muted-foreground" strokeWidth={1} />}
            {bar ? (
              values.map((v, i) => {
                const top = y(v)
                const bottom = y(0)
                const r = Math.min(4, barW / 2, Math.max(0, bottom - top))
                const left = x(i) - barW / 2
                return (
                  <path
                    key={i}
                    d={`M${left},${bottom}V${top + r}Q${left},${top} ${left + r},${top}H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${bottom}Z`}
                    className="fill-chart-1"
                    opacity={hover === undefined || hover === i ? 1 : 0.55}
                  />
                )
              })
            ) : (
              <>
                <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" className="stroke-chart-1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(hover ?? values.length - 1)} cy={y(values[hover ?? values.length - 1])} r={4} className="fill-chart-1 stroke-background" strokeWidth={2} />
              </>
            )}
          </svg>
        )}
        {h && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border-(length:--semantic-layout-hairline) border-border bg-popover px-2.5 py-1.5 shadow-overlay"
            style={{ left: tipLeft }}
          >
            <p className="text-caption text-muted-foreground">{dayName(h.date)}</p>
            <p className="text-body-strong whitespace-nowrap tabular-nums text-foreground">
              {n(h[series.key])} {series.unit}
            </p>
          </div>
        )}
      </div>
    </figure>
  )
}

function DaysTable({ days }: { days: Day[] }) {
  return (
    <div className="rounded-lg border-(length:--semantic-layout-hairline) border-border px-4">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">The last 30 days, newest first</caption>
        <thead>
          <tr className="text-caption text-muted-foreground">
            <th scope="col" className="py-2.5 pr-4 font-normal">Day</th>
            {SERIES.map((x) => (
              <th key={x.key} scope="col" className="py-2.5 pr-4 text-right font-normal last:pr-0">
                {x.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.date} className="border-t-(length:--semantic-layout-hairline) border-border text-body tabular-nums text-foreground">
              <th scope="row" className="py-2 pr-4 text-left font-normal">
                {dayName(d.date)}
              </th>
              {SERIES.map((x) => (
                <td key={x.key} className="py-2 pr-4 text-right last:pr-0">
                  {n(d[x.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
