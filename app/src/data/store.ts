import { useSyncExternalStore } from "react"
import type { Account, Billing, Contact, Conversation, FileRef, Message, MyAgent } from "./contract"
import { ApiError, NO_ANSWER, type DataLayer, type Page, type Plan } from "./layer"
import { online } from "./online"
import { navigate } from "@/lib/router"

// The only module components read data from. It loads what the pages show through the data layer, keeps it in one
// state object, and refreshes the chat list and the open thread every 10 s while the tab is visible
// (docs/DESIGN.md「网页的界面状态」). A 401 anywhere signs the page out.

/**
 * The demo fixtures and their panel (src/mock), only in a `VITE_USE_MOCK=1` build. This is the one place the switch is
 * read, and it has to sit right at the import: a normal build then leaves the demo files out of dist entirely.
 */
export const demo = import.meta.env.VITE_USE_MOCK === "1" ? import("@/mock") : undefined
const layer: Promise<DataLayer> = demo ? demo.then((m) => m.mock) : Promise.resolve(online)
/** Set before anything signed-in renders: the first /v1/me waits for it. */
let api: DataLayer

export type Load<T> = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; data: T }
export type Thread = { messages: Message[]; hasMore: boolean; older: "idle" | "loading" | "error" }
/** `c:<conversation ID>` for a chat, `a:<agent ID>` for everything one of my sessions sent and received. */
export type ThreadKey = `c:${number}` | `a:${string}`

export type State = {
  /** undefined until /v1/me answers, null when signed out. */
  account: Account | null | undefined
  /** The account was created by this sign-in: it goes to /welcome first. */
  isNew: boolean
  billing: Load<Billing>
  conversations: Load<Conversation[]>
  agents: Load<MyAgent[]>
  contacts: Load<Contact[]>
  requests: number
  threads: Partial<Record<ThreadKey, Load<Thread>>>
  /** Back from checkout: waiting for the payment notice, or it took longer than 60 s. */
  checkout?: "waiting" | "late"
}

const LOADING = { status: "loading" } as const
const ready = <T>(data: T) => ({ status: "ready", data }) as const
const fresh = (account: Account | null | undefined, isNew = false): State => ({
  account,
  isNew,
  billing: LOADING,
  conversations: LOADING,
  agents: LOADING,
  contacts: LOADING,
  requests: 0,
  threads: {},
})

let state = fresh(undefined)
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const useStore = () => useSyncExternalStore(subscribe, () => state)

const asApiError = (e: unknown) => {
  if (e instanceof ApiError) return e
  console.error(e)
  return new ApiError(0, "unknown", NO_ANSWER)
}
/** The web sign-in ended (expired, or signed out elsewhere): back to the sign-in page, which returns here after. */
function expired(e: unknown) {
  if (!(e instanceof ApiError) || e.status !== 401) return false
  stopPolling()
  set(fresh(null))
  return true
}

// ── Lists ────────────────────────────────────────────────────────────────────

type ListKey = "billing" | "conversations" | "agents" | "contacts"
const fetchers: { [K in ListKey]: () => Promise<State[K] extends Load<infer T> ? T : never> } = {
  billing: () => api.billing(),
  conversations: () => api.conversations(),
  agents: () => api.agents(),
  contacts: () => api.contacts(),
}

// Each slot counts its requests, so a slow earlier answer never overwrites a later one.
const seq: Record<string, number> = {}
const turn = (key: string) => (seq[key] = (seq[key] ?? 0) + 1)

/** `quiet` refreshes behind what's shown: no skeleton, and a failure keeps the old data. */
async function load(key: ListKey, quiet = false) {
  const n = turn(key)
  const shown = state[key].status === "ready"
  if (!quiet || !shown) set({ [key]: LOADING })
  try {
    const data = await fetchers[key]()
    if (seq[key] === n) set({ [key]: ready(data) })
  } catch (e) {
    if (seq[key] !== n || expired(e)) return
    if (!quiet || state[key].status !== "ready") set({ [key]: { status: "error", error: asApiError(e) } })
  }
}

async function loadRequests() {
  try {
    set({ requests: await api.pendingRequests() })
  } catch (e) {
    expired(e)
  }
}

export const retry = (key: ListKey) => load(key)
/** Opening the Sessions or Contacts tab brings presence up to date. */
export function refreshList(key: "agents" | "contacts") {
  load(key, true)
  if (key === "contacts") loadRequests()
}

// ── Threads ──────────────────────────────────────────────────────────────────

let openKey: ThreadKey | undefined
const setThread = (key: ThreadKey, t: Load<Thread>) => set({ threads: { ...state.threads, [key]: t } })
const fetchPage = (key: ThreadKey, page?: Page) =>
  key.startsWith("c:") ? api.messages(Number(key.slice(2)), page) : api.agentMessages(key.slice(2), page)

export async function loadThread(key: ThreadKey) {
  const n = turn(key)
  setThread(key, LOADING)
  try {
    const p = await fetchPage(key)
    if (seq[key] === n) setThread(key, ready({ messages: p.messages, hasMore: p.has_more, older: "idle" }))
  } catch (e) {
    if (seq[key] === n && !expired(e)) setThread(key, { status: "error", error: asApiError(e) })
  }
}

/** Appends what arrived after the newest message shown; a failed poll keeps the thread as it is. */
async function newer(key: ThreadKey) {
  const t = state.threads[key]
  if (t?.status !== "ready") return
  const n = turn(key)
  const last = t.data.messages.at(-1)
  try {
    const p = await fetchPage(key, last && { after: last.id })
    const cur = state.threads[key]
    if (seq[key] !== n || cur?.status !== "ready") return
    const seen = new Set(cur.data.messages.map((m) => m.id))
    const added = p.messages.filter((m) => !seen.has(m.id))
    if (added.length) setThread(key, ready({ ...cur.data, messages: [...cur.data.messages, ...added] }))
    if (last && p.has_more) newer(key)
  } catch (e) {
    expired(e)
  }
}

/** A pane shows this thread: load it once, then keep it fresh while it stays open. Returns the cleanup. */
export function openThread(key: ThreadKey) {
  openKey = key
  const t = state.threads[key]
  if (!t || t.status === "error") loadThread(key)
  else if (t.status === "ready") newer(key)
  return () => {
    if (openKey === key) openKey = undefined
  }
}

export async function loadOlder(key: ThreadKey) {
  const t = state.threads[key]
  if (t?.status !== "ready" || t.data.older === "loading" || !t.data.messages.length) return
  setThread(key, ready({ ...t.data, older: "loading" }))
  try {
    const p = await fetchPage(key, { before: t.data.messages[0].id })
    const cur = state.threads[key]
    if (cur?.status === "ready") setThread(key, ready({ messages: [...p.messages, ...cur.data.messages], hasMore: p.has_more, older: "idle" }))
  } catch (e) {
    const cur = state.threads[key]
    if (!expired(e) && cur?.status === "ready") setThread(key, ready({ ...cur.data, older: "error" }))
  }
}

// ── Polling ──────────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | undefined
function tick() {
  if (document.hidden || !state.account) return
  load("conversations", true)
  if (openKey) newer(openKey)
}
function startPolling() {
  stopPolling()
  timer = setInterval(tick, 10_000)
}
function stopPolling() {
  clearInterval(timer)
  timer = undefined
}
// Paused in a background tab; catches up as soon as it's visible again.
document.addEventListener("visibilitychange", tick)

// ── Session ──────────────────────────────────────────────────────────────────

/** Signed in: load everything the tabs and the top bar show. */
export function begin(account: Account, isNew = false) {
  set(fresh(account, isNew))
  for (const key of Object.keys(fetchers) as ListKey[]) load(key)
  loadRequests()
  if (openKey) loadThread(openKey)
  startPolling()
}

/** Loads everything again, as after signing in. */
export const reload = () => state.account && begin(state.account, state.isNew)
/** One poll, now. */
export const refresh = tick

async function boot() {
  api = await layer
  try {
    begin((await api.me()).account)
  } catch {
    // 401, or no answer: either way the sign-in page is where to start
    set(fresh(null))
  }
}
boot()

export const requestCode = (email: string) => api.requestCode(email)

/** API-028. Throws ApiError, `/errors/name-required` for a new email without a name. */
export async function verify(email: string, code: string, name?: string) {
  const r = await api.signIn(email, code, name)
  begin(r.account, r.new_account)
}

/** Throws ApiError when the server didn't end the sign-in; already signed out (401) counts as done. */
export async function signOut() {
  try {
    await api.signOut()
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e
  }
  stopPolling()
  // Same tick as clearing the account, so the router never sees the sign-in page while still signed in.
  navigate("/login", { replace: true })
  set(fresh(null))
}

// ── Billing ──────────────────────────────────────────────────────────────────

export const PRICES = { monthly: "$1", yearly: "$10" } as const

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Back from Creem: the payment notice can lag behind, so ask every 3 s for up to 60 s (FLOW-SUBSCRIBE S6). */
export async function watchCheckout() {
  set({ checkout: "waiting" })
  const until = Date.now() + 60_000
  while (Date.now() < until && state.account) {
    try {
      const b = await api.billing()
      set({ billing: ready(b) })
      if (b.access.state === "paid") return set({ checkout: undefined })
    } catch (e) {
      if (expired(e)) return
    }
    await pause(3000)
  }
  if (state.account) set({ checkout: "late" })
}

/**
 * Throws ApiError when the server refuses. Resolves true when the page is leaving for Creem; a path instead of a
 * payment page means there is none to go to (the demo), so it waits for the payment notice right here.
 */
export async function checkout(plan: Plan) {
  const url = await api.checkout(plan)
  if (!url.startsWith("/")) return location.assign(url), true
  watchCheckout()
  return false
}
export const portalUrl = () => api.portal()

// ── Reading the state ────────────────────────────────────────────────────────

export const dataOf = <T>(l: Load<T>) => (l.status === "ready" ? l.data : undefined)
export const isMe = (s: State, accountId: number) => accountId === s.account?.id
export const fileExpired = (f: FileRef) => Date.now() > Date.parse(f.expires_at)
export const fileUrl = (f: FileRef) => api.fileUrl(f)
export const conversationTitle = (c: Conversation) => c.group?.name ?? c.peer?.name ?? String(c.id)

export const pendingTotal = (s: State) => (dataOf(s.conversations) ?? []).reduce((n, c) => n + c.pending, 0)
export const conversationOf = (s: State, id: number) => dataOf(s.conversations)?.find((c) => c.id === id)
export const conversationWith = (s: State, accountId: number) =>
  dataOf(s.conversations)?.find((c) => c.kind === "direct" && c.peer?.id === accountId)?.id

/** Who a one-to-one message went to. `to` names the session but not its owner: the peer when I sent it, otherwise me. */
export function recipientOf(s: State, m: Message) {
  if (!m.to) return undefined
  const owner = isMe(s, m.from.account_id) ? m.conversation.peer?.name : s.account?.name
  return { owner: owner ?? "", title: m.to.tool === "terminal" ? "Terminal" : m.to.title }
}
