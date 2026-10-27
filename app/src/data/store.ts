import { useSyncExternalStore } from "react"
import type { Account, Billing, Contact, Conversation, FileRef, Message, MyAgent } from "./contract"
import { ApiError, NO_ANSWER, type DataLayer, type Page, type Plan } from "./layer"
import { online } from "./online"
import { navigate } from "@/lib/router"

// The only module components read data from. It loads what the pages show through the data layer, keeps it in one
// state object, and refreshes the chat and session lists and an open chat every 10 s, an open session every 3 s, while
// the tab is visible (docs/DESIGN.md「网页的界面状态」). A 401 anywhere signs the page out.

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
/**
 * A message this page is sending or couldn't send. Retrying reuses `cid` (`client_msg_id`), so the server stores it
 * once. `id` is the server's message number once stored; the entry goes away when that message is in the thread.
 */
export type Outgoing = { cid: string; to: string; body: string; status: "sending" | "failed"; error?: ApiError; id?: number }

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
  outbox: Partial<Record<ThreadKey, Outgoing[]>>
  /** How many messages this page has sent per thread; the message list goes back to the bottom when it grows. */
  sent: Partial<Record<ThreadKey, number>>
  /** Per direct chat, the short ID of the peer's session it sends to; none is the peer's terminal inbox (FLOW-WEB-CHAT S2). */
  sendTo: Partial<Record<number, string>>
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
  outbox: {},
  sent: {},
  sendTo: {},
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
    if (seq[key] !== n) return
    set({ [key]: ready(data) })
    if (key === "agents" && openKey) markShown(openKey)
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
/** Sent messages that are now in the thread leave the outbox in the same update, so neither shows twice. */
function setThread(key: ThreadKey, t: Load<Thread>) {
  const out = state.outbox[key]
  if (t.status !== "ready" || !out?.some((o) => o.id)) return set({ threads: { ...state.threads, [key]: t } })
  const ids = new Set(t.data.messages.map((m) => m.id))
  set({ threads: { ...state.threads, [key]: t }, outbox: { ...state.outbox, [key]: out.filter((o) => !o.id || !ids.has(o.id)) } })
}
const fetchPage = (key: ThreadKey, page?: Page) =>
  key.startsWith("c:") ? api.messages(Number(key.slice(2)), page) : api.agentMessages(key.slice(2), page)

export async function loadThread(key: ThreadKey) {
  const n = turn(key)
  setThread(key, LOADING)
  try {
    const p = await fetchPage(key)
    if (seq[key] !== n) return
    setThread(key, ready({ messages: p.messages, hasMore: p.has_more, older: "idle" }))
    markShown(key)
  } catch (e) {
    if (seq[key] === n && !expired(e)) setThread(key, { status: "error", error: asApiError(e) })
  }
}

/** My message to a session that hasn't settled: the session may still take it, so its state is asked for again. */
const unsettled = (m: Message) => m.state === "pending" || m.state === "pushed"

/**
 * Appends what arrived after the newest message shown, and refreshes the state of my recent messages to a session that
 * are still on their way (FLOW-WEB-SEND S8). A failed poll keeps the thread as it is. One fetch per thread at a time:
 * a call while one is out asks for another round after it, so a slow answer is never thrown away for a newer poll.
 */
const fetching = new Map<ThreadKey, boolean>()
async function newer(key: ThreadKey) {
  if (fetching.has(key)) return void fetching.set(key, true)
  fetching.set(key, false)
  try {
    await fetchNewer(key)
  } finally {
    const again = fetching.get(key)
    fetching.delete(key)
    if (again) newer(key)
  }
}
async function fetchNewer(key: ThreadKey) {
  const t = state.threads[key]
  if (t?.status !== "ready") return
  const n = seq[key]
  const shown = t.data.messages
  const from = shown.slice(-50).find(unsettled) ?? shown.at(-1)
  let after = from && (unsettled(from) ? from.id - 1 : from.id)
  const got: Message[] = []
  try {
    for (;;) {
      const p = await fetchPage(key, after === undefined ? undefined : { after })
      got.push(...p.messages)
      if (after === undefined || !p.has_more || !p.messages.length) break
      after = p.messages[p.messages.length - 1].id
    }
  } catch (e) {
    expired(e)
    return
  }
  const cur = state.threads[key]
  if (seq[key] !== n || cur?.status !== "ready") return
  const byId = new Map(got.map((m) => [m.id, m]))
  const seen = new Set(cur.data.messages.map((m) => m.id))
  const added = got.filter((m) => !seen.has(m.id))
  const moved = cur.data.messages.some((m) => byId.has(m.id) && byId.get(m.id)!.state !== m.state)
  if (added.length || moved)
    setThread(key, ready({ ...cur.data, messages: [...cur.data.messages.map((m) => byId.get(m.id) ?? m), ...added] }))
  if (added.some((m) => !m.from_me)) markShown(key, true)
}

const readUpTo: Record<string, number> = {}
/**
 * An open session pane counts what it shows as read, which takes the session's replies out of `imbo inbox`; not while
 * the tab is in the background (FLOW-WEB-SEND S9). `arrived`: new messages just came in, so the unread count in the
 * session list is not up to date yet.
 */
async function markShown(key: ThreadKey, arrived = false) {
  const t = state.threads[key]
  if (!key.startsWith("a:") || key !== openKey || document.hidden || t?.status !== "ready") return
  const id = key.slice(2)
  const last = t.data.messages.at(-1)?.id
  const unread = dataOf(state.agents)?.find((a) => a.id === id)?.unread ?? 0
  const before = readUpTo[id] ?? 0
  if (last === undefined || last <= before || (!unread && !arrived)) return
  readUpTo[id] = last
  try {
    await api.markRead(id, last)
    const agents = dataOf(state.agents)
    if (agents) set({ agents: ready(agents.map((a) => (a.id === id ? { ...a, unread: 0 } : a))) })
    // An answer already on its way may still carry the old count; this one replaces it.
    load("agents", true)
  } catch (e) {
    if (!expired(e)) readUpTo[id] = before
  }
}

/** A pane shows this thread: load it once, then keep it fresh while it stays open. Returns the cleanup. */
export function openThread(key: ThreadKey) {
  openKey = key
  const t = state.threads[key]
  if (!t || t.status === "error") loadThread(key)
  else if (t.status === "ready") newer(key), markShown(key)
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

// ── Sending ──────────────────────────────────────────────────────────────────

const setOutbox = (key: ThreadKey, out: Outgoing[]) => set({ outbox: { ...state.outbox, [key]: out } })
const patchOut = (key: ThreadKey, cid: string, patch: Partial<Outgoing>) =>
  setOutbox(key, (state.outbox[key] ?? []).map((o) => (o.cid === cid ? { ...o, ...patch } : o)))

/** Sends, then fetches the thread right away so the stored message shows in its place (FLOW-WEB-CHAT S7). */
async function deliver(key: ThreadKey, o: Outgoing) {
  try {
    const id = key.startsWith("a:") ? (await api.sendToAgent(key.slice(2), o.body, o.cid)).id : (await api.send(o.to, o.body, o.cid)).message_id
    const t = state.threads[key]
    // A retry after a lost answer: the poll may already have brought the stored message in.
    if (t?.status === "ready" && t.data.messages.some((m) => m.id === id)) discard(key, o.cid)
    else patchOut(key, o.cid, { id }), await newer(key)
  } catch (e) {
    if (!expired(e)) patchOut(key, o.cid, { status: "failed", error: asApiError(e) })
  }
}

/** `to` is the API-015 address in a chat; a session pane sends to its own session and ignores it. */
export function send(key: ThreadKey, to: string, body: string) {
  const o: Outgoing = { cid: crypto.randomUUID(), to, body, status: "sending" }
  set({ outbox: { ...state.outbox, [key]: [...(state.outbox[key] ?? []), o] }, sent: { ...state.sent, [key]: (state.sent[key] ?? 0) + 1 } })
  deliver(key, o)
}
export function resend(key: ThreadKey, cid: string) {
  const o = state.outbox[key]?.find((x) => x.cid === cid)
  if (!o || o.status === "sending") return
  patchOut(key, cid, { status: "sending", error: undefined })
  deliver(key, { ...o, status: "sending" })
}
/** Sends a failed message again to another address, as a new message. */
export function resendTo(key: ThreadKey, cid: string, to: string) {
  const o = state.outbox[key]?.find((x) => x.cid === cid)
  if (!o || o.status === "sending") return
  discard(key, cid)
  send(key, to, o.body)
}
export const discard = (key: ThreadKey, cid: string) => setOutbox(key, (state.outbox[key] ?? []).filter((o) => o.cid !== cid))

export const chooseRecipient = (conversationId: number, shortId?: string) => set({ sendTo: { ...state.sendTo, [conversationId]: shortId } })

/** Unsent text per thread, kept while the page is open; switching chats doesn't lose it, sending clears it. */
const drafts = new Map<ThreadKey, string>()
export const draftOf = (key: ThreadKey) => drafts.get(key) ?? ""
export const keepDraft = (key: ThreadKey, text: string) => void (text ? drafts.set(key, text) : drafts.delete(key))

// ── Polling ──────────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | undefined
let fastTimer: ReturnType<typeof setInterval> | undefined
function tick() {
  if (document.hidden || !state.account) return
  load("conversations", true)
  load("agents", true)
  if (openKey?.startsWith("c:")) newer(openKey)
}
/** An open session pane shows replies and delivery states within 3 s (FLOW-WEB-SEND S8). */
function fast() {
  if (document.hidden || !state.account) return
  if (openKey?.startsWith("a:")) newer(openKey)
}
function startPolling() {
  stopPolling()
  timer = setInterval(tick, 10_000)
  fastTimer = setInterval(fast, 3_000)
}
function stopPolling() {
  clearInterval(timer)
  clearInterval(fastTimer)
  timer = fastTimer = undefined
}
// Paused in a background tab; catches up as soon as it's visible again.
document.addEventListener("visibilitychange", () => (tick(), fast()))

// ── Session ──────────────────────────────────────────────────────────────────

/** Signed in: load everything the tabs and the top bar show. */
export function begin(account: Account, isNew = false) {
  drafts.clear()
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
/** Replies from my sessions to my terminal inbox that nobody has read yet (API-014 `unread`). */
export const unreadTotal = (s: State) => (dataOf(s.agents) ?? []).reduce((n, a) => n + a.unread, 0)
export const conversationOf = (s: State, id: number) => dataOf(s.conversations)?.find((c) => c.id === id)
export const conversationWith = (s: State, accountId: number) =>
  dataOf(s.conversations)?.find((c) => c.kind === "direct" && c.peer?.id === accountId)?.id

export const contactOf = (s: State, accountId: number) => dataOf(s.contacts)?.find((p) => p.id === accountId)
/** The peer's session a direct chat sends to, while it's still one of theirs; otherwise their terminal inbox. */
export const chosenSession = (s: State, c: Conversation) => {
  const short = s.sendTo[c.id]
  return short && c.peer ? contactOf(s, c.peer.id)?.sessions.find((x) => x.short_id === short) : undefined
}
/** API-015 `to` for a chat: the group, the chosen session (`<account>/<short ID>`), or the peer's terminal inbox. */
export const addressOf = (s: State, c: Conversation) => {
  if (c.group) return `#${c.group.id}`
  const x = chosenSession(s, c)
  return x ? `${c.peer!.id}/${x.short_id}` : String(c.peer?.id)
}

/** Who a one-to-one message went to. `to` names the session but not its owner: the peer when I sent it, otherwise me. */
export function recipientOf(s: State, m: Message) {
  if (!m.to) return undefined
  const owner = isMe(s, m.from.account_id) ? m.conversation.peer?.name : s.account?.name
  return { owner: owner ?? "", title: m.to.tool === "terminal" ? "Terminal" : m.to.title }
}
