import { useSyncExternalStore } from "react"
import * as mock from "@/mock/data"
import type { BillingPreset } from "@/mock/data"
import { account as accountSchema, type Account, type Billing, type Conversation, type FileRef, type Message } from "./contract"

// The only module components read data from. Each selector returns what one server endpoint returns (named in its
// comment); today they read the demo fixtures, later the same names fetch, `schema.parse` and poll every ~10 s.

export type Status = "ready" | "loading" | "empty" | "error"
export type { BillingPreset }

type Mode = NonNullable<Billing["mode"]>
export type State = {
  account: Account | null
  status: Status
  preset: BillingPreset
  mode: Mode
  billingOn: boolean
  live: Message[]
  pendingExtra: Record<number, number>
}

// The signed-in account survives a refresh, the way the real cookie session will.
const SAVED = "imbo-demo-account-v3"
function saved(): Account | null {
  try {
    return accountSchema.nullable().parse(JSON.parse(sessionStorage.getItem(SAVED) ?? "null"))
  } catch {
    return null
  }
}
function save(account: Account | null) {
  try {
    sessionStorage.setItem(SAVED, JSON.stringify(account))
  } catch {
    // storage unavailable: the session just won't survive a refresh
  }
}

const restored = saved()
let state: State = {
  account: restored,
  status: restored?.id === mock.newAccountId ? "empty" : "ready",
  preset: "trial",
  mode: "live",
  billingOn: true,
  live: [],
  pendingExtra: {},
}
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  if ("account" in patch) save(state.account)
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const useStore = () => useSyncExternalStore(subscribe, () => state)

// ── Account ──────────────────────────────────────────────────────────────────

/** Demo: dana@example.com has an account; any other email is new and is asked for a name. */
export const hasAccount = (email: string) => email.trim().toLowerCase() === mock.account.email

export function signIn(email: string, name?: string) {
  const existing = hasAccount(email)
  set({ account: existing ? mock.account : { id: mock.newAccountId, name: name ?? "", email }, status: existing ? "ready" : "empty", preset: "trial" })
}
export const signOut = () => set({ account: null })

/** Demo: "000000" is the wrong code, "111111" an expired one; any other 6 digits sign in. */
export function checkCode(code: string): "ok" | "invalid" | "expired" {
  return code === "000000" ? "invalid" : code === "111111" ? "expired" : "ok"
}

/** API-032. A new account starts with the full 30-day trial. */
export const billingOf = (s: State): Billing => mock.billingFor(s.preset, s.mode, s.billingOn, s.account?.id === mock.newAccountId ? 30 : 23)
export const PRICES = { monthly: "$1", yearly: "$10" } as const

// ── Conversations, sessions, contacts ────────────────────────────────────────

const allMessages = (s: State) => [...mock.messages, ...s.live]
export const isMe = (s: State, accountId: number) => accountId === s.account?.id
export const fileExpired = (f: FileRef) => Date.now() > Date.parse(f.expires_at)
export const conversationTitle = (c: Conversation) => c.group?.name ?? c.peer?.name ?? String(c.id)

/** API-030 */
export function conversations(s: State): Conversation[] {
  const msgs = allMessages(s)
  return mock.conversations
    .map((c) => {
      const last = msgs.filter((m) => m.conversation.id === c.id).at(-1)
      return {
        ...c,
        pending: c.pending + (s.pendingExtra[c.id] ?? 0),
        last_message: last && { id: last.id, from: last.from, preview: last.body.slice(0, 100), created_at: last.created_at },
      }
    })
    .sort((a, b) => Date.parse(b.last_message?.created_at ?? "0") - Date.parse(a.last_message?.created_at ?? "0"))
}

export const pendingTotal = (s: State) => conversations(s).reduce((n, c) => n + c.pending, 0)
export const conversationOf = (s: State, id: number) => conversations(s).find((c) => c.id === id)
/** API-031 */
export const messagesOf = (s: State, conversationId: number) => allMessages(s).filter((m) => m.conversation.id === conversationId)

/** Who a one-to-one message went to. `to` names the session but not its owner: the peer when I sent it, otherwise me. */
export function recipientOf(s: State, m: Message) {
  if (!m.to) return undefined
  const owner = isMe(s, m.from.account_id) ? m.conversation.peer?.name : s.account?.name
  return { owner: owner ?? "", title: m.to.tool === "terminal" ? "Terminal" : m.to.title }
}

/** API-014 */
export const myAgents = () => mock.myAgents
/** API-036 */
export const agentMessages = (s: State, agentId: string) => allMessages(s).filter((m) => m.from.agent?.id === agentId || m.to?.id === agentId)

/** API-012 */
export const contacts = () => mock.contacts
export const conversationWith = (accountId: number) => mock.conversations.find((c) => c.kind === "direct" && c.peer?.id === accountId)?.id
/** API-009, count only: requests are answered in a terminal. */
export const pendingRequests = () => mock.pendingRequests

// ── Demo controls ────────────────────────────────────────────────────────────

export const setStatus = (status: Status) => set({ status })
export const setPreset = (preset: BillingPreset) => set({ preset })
export const setMode = (mode: Mode) => set({ mode })
export const setBillingOn = (billingOn: boolean) => set({ billingOn })

/** Error state → Retry: a real loading → ready transition. */
export function retry() {
  set({ status: "loading" })
  setTimeout(() => set({ status: "ready" }), 900)
}

/** What a poll would bring in. It goes to an offline session, so it also counts as waiting for delivery. */
export function receive() {
  const m = mock.incomingMessage(state.live.length)
  const c = m.conversation.id
  set({ live: [...state.live, m], pendingExtra: { ...state.pendingExtra, [c]: (state.pendingExtra[c] ?? 0) + 1 } })
}
