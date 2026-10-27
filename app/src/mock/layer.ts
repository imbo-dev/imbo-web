import type { Account, Message, MessagesPage, Sent } from "@/data/contract"
import { account as accountSchema } from "@/data/contract"
import { ApiError, NO_ANSWER, type DataLayer, type Page, type Plan } from "@/data/layer"
import * as f from "./data"

// The demo fixtures behind the same DataLayer as the server, answering the way the server does (errors, paging,
// 401 when signed out). Loaded only when VITE_USE_MOCK=1. The Demo panel (./DemoPanel.tsx) changes `controls`.

export type Status = "ready" | "loading" | "empty" | "error"
/** `refused`: the server turns every send down, as when it's over the rate limit. */
export type Sending = "ok" | "refused"
export type Controls = {
  status: Status
  preset: f.BillingPreset
  /** The plan the "paid" state shows: the last one checked out. */
  plan: Plan
  mode: "live" | "test"
  billingOn: boolean
  sending: Sending
  live: Message[]
  pendingExtra: Record<number, number>
}

export let controls: Controls = { status: "ready", preset: "trial", plan: "monthly", mode: "live", billingOn: true, sending: "ok", live: [], pendingExtra: {} }
const listeners = new Set<() => void>()
export const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export function setControls(patch: Partial<Controls>) {
  controls = { ...controls, ...patch }
  listeners.forEach((l) => l())
}

// The signed-in account stands in for the session cookie, so it survives a refresh.
const SAVED = "imbo-demo-account-v4"
function saved(): Account | null {
  try {
    return accountSchema.nullable().parse(JSON.parse(sessionStorage.getItem(SAVED) ?? "null"))
  } catch {
    return null
  }
}
let me: Account | null = saved()
function setMe(a: Account | null) {
  me = a
  try {
    sessionStorage.setItem(SAVED, JSON.stringify(a))
  } catch {
    // storage unavailable: the demo session just won't survive a refresh
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** "loading" holds every answer until the panel picks another state. */
const settled = () =>
  new Promise<void>((resolve) => {
    if (controls.status !== "loading") return resolve()
    const off = subscribe(() => {
      if (controls.status !== "loading") (off(), resolve())
    })
  })

function signedIn(): Account {
  if (!me) throw new ApiError(401, "/errors/unauthorized", "Sign in again.")
  return me
}

/** A list or thread: waits like a round trip, then follows the Data control. A new account has nothing yet. */
async function data<T>(value: () => T, empty: T): Promise<T> {
  const a = signedIn()
  await wait(350)
  await settled()
  if (controls.status === "error") throw new ApiError(0, "network", NO_ANSWER)
  return controls.status === "empty" || a.id === f.newAccountId ? empty : value()
}

const allMessages = () => [...f.messages, ...controls.live]

/** Same paging as the server: up to 50, oldest first, `has_more` when more lie beyond the page. */
function page(list: Message[], p: Page = {}, limit = 50): MessagesPage {
  if (p.after !== undefined) {
    const newer = list.filter((m) => m.id > p.after!)
    return { messages: newer.slice(0, limit), has_more: newer.length > limit }
  }
  const older = p.before !== undefined ? list.filter((m) => m.id < p.before!) : list
  return { messages: older.slice(-limit), has_more: older.length > limit }
}

// ── Sending ──
// Stored the way the server stores it: once per client_msg_id, answered by the sessions it went to a moment later.

const sentByCid = new Map<string, Sent>()
const agentSentByCid = new Map<string, number>()
/** Delivery state of what Dana sent her own sessions, as it moves on. */
const states: Record<number, string> = {}
/** What each of Dana's sessions sent her terminal inbox that she hasn't read yet, by message number. */
const repliesOf = (id: string) => allMessages().filter((m) => m.from.agent?.id === id && m.to?.tool === "terminal").map((m) => m.id)
const unread: Record<string, number[]> = Object.fromEntries(f.myAgents.map((a) => [a.id, a.unread ? repliesOf(a.id).slice(-a.unread) : []]))
const withState = (m: Message) => (states[m.id] ? { ...m, state: states[m.id] } : m)
const nextId = () => Math.max(...allMessages().map((m) => m.id)) + 1
const later = (ms: number, fn: () => void) => setTimeout(fn, ms)
const append = (m: Message, pendingFor?: number) =>
  setControls({
    live: [...controls.live, m],
    pendingExtra: pendingFor === undefined ? controls.pendingExtra : { ...controls.pendingExtra, [pendingFor]: (controls.pendingExtra[pendingFor] ?? 0) + 1 },
  })

/** The checks every send passes first, in the server's order and wording. */
async function sending(body: string) {
  const a = signedIn()
  await wait(450)
  if (controls.status === "error") throw new ApiError(0, "network", NO_ANSWER)
  if (!body.trim() || [...body].length > 32_000) throw new ApiError(422, "/errors/body-invalid", "The message must be 1 to 32000 characters.")
  if (controls.preset === "expired") throw new ApiError(402, "/errors/subscription-required", "Your trial has ended. Subscribe to send messages again.")
  if (controls.sending === "refused") throw new ApiError(429, "/errors/rate-limited", "Too many messages in this conversation. Slow down.", 20)
  return a
}

const codeTries: Record<string, number> = {}
const codeSentAt: Record<string, number> = {}

export const mock = {
  /** Same rule as the server: one code per email a minute. */
  async requestCode(email) {
    await wait(700)
    const key = email.trim().toLowerCase()
    const age = (Date.now() - (codeSentAt[key] ?? 0)) / 1000
    if (age < 60) throw new ApiError(429, "/errors/rate-limited", "A code was just sent. Wait a minute before asking again.", Math.ceil(60 - age))
    codeSentAt[key] = Date.now()
    codeTries[key] = 0
    return { retry_after_s: 60 }
  },
  /** dana@example.com has an account; any other email is new. Code 000000 is wrong, 111111 has expired. */
  async signIn(email, code, name) {
    await wait(500)
    const key = email.trim().toLowerCase()
    if (code === "111111") throw new ApiError(410, "/errors/code-expired", "That code has expired. Request a new one.")
    if (code === "000000" || (codeTries[key] ?? 0) >= 5) {
      const tries = (codeTries[key] = (codeTries[key] ?? 0) + 1)
      if (tries >= 5) throw new ApiError(429, "/errors/code-locked", "Too many wrong codes. Request a new code.")
      throw new ApiError(400, "/errors/code-invalid", `Wrong code. ${5 - tries} tries left.`)
    }
    if (key === f.account.email) {
      setMe(f.account)
      return { account: f.account, new_account: false }
    }
    if (!name) throw new ApiError(422, "/errors/name-required", "New account: choose a name first.")
    const account = { id: f.newAccountId, name, email: email.trim() }
    setMe(account)
    return { account, new_account: true }
  },
  async signOut() {
    await wait(300)
    setMe(null)
  },
  async me() {
    await wait(200)
    return { account: signedIn() }
  },
  conversations: () =>
    data(
      () =>
        f.conversations
          .map((c) => {
            const last = allMessages()
              .filter((m) => m.conversation.id === c.id)
              .at(-1)
            return {
              ...c,
              pending: c.pending + (controls.pendingExtra[c.id] ?? 0),
              last_message: last && { id: last.id, from: last.from, preview: (last.body || last.files.map((x) => x.name).join(", ")).slice(0, 100), created_at: last.created_at },
            }
          })
          .sort((a, b) => Date.parse(b.last_message?.created_at ?? "0") - Date.parse(a.last_message?.created_at ?? "0")),
      []
    ),
  messages: async (id, p) => {
    if (!f.conversations.some((c) => c.id === id)) throw new ApiError(404, "/errors/not-found", `No conversation ${id}.`)
    return data(() => page(allMessages().filter((m) => m.conversation.id === id), p), { messages: [], has_more: false })
  },
  agents: () => data(() => f.myAgents.map((a) => ({ ...a, unread: unread[a.id].length })), []),
  agentMessages: async (id, p) => {
    if (!f.myAgents.some((a) => a.id === id)) throw new ApiError(404, "/errors/not-found", "No such session.")
    return data(() => page(allMessages().filter((m) => m.from.agent?.id === id || m.to?.id === id).map(withState), p), { messages: [], has_more: false })
  },
  contacts: () => data(() => f.contacts, []),
  /** Direct: `<account>` is their terminal inbox, `<account>/<short ID>` one of their sessions, which answers 2.5 s later. */
  async send(to, body, cid) {
    const done = sentByCid.get(cid)
    if (done) return done
    const a = await sending(body)
    const group = to.startsWith("#") ? f.conversations.find((c) => c.group && `#${c.group.id}` === to) : undefined
    const [peerId, short] = to.split("/")
    const peer = group ? undefined : f.contacts.find((p) => String(p.id) === peerId)
    if (!group && !peer) throw new ApiError(403, "/errors/not-contact", `${to} isn't one of your contacts.`)
    if (peer && !peer.active) throw new ApiError(403, "/errors/recipient-inactive", `${peer.name}'s account is inactive.`)
    const chat = group ?? f.conversations.find((c) => c.peer?.id === peer!.id)
    if (!chat) throw new ApiError(404, "/errors/recipient-not-found", `No conversation with ${to}.`)
    const session = short ? f.contactSessions[to] : undefined
    if (short && !session) throw new ApiError(404, "/errors/session-not-found", `${peer!.name} has no session ${short}.`)
    const conversation = chat.group ? { kind: "group" as const, id: chat.id, group: chat.group } : { kind: "direct" as const, id: chat.id, peer: chat.peer }
    const m = f.msg({ id: nextId(), conversation, from: f.from(a), ...(!group && { to: session ?? f.terminalOf(peer!.id) }), created_at: new Date().toISOString(), body })
    append(m)
    if (group)
      later(3000, () => append(f.msg({ id: nextId(), conversation, from: f.from(f.groupAnswer.person, f.groupAnswer.agent), created_at: new Date().toISOString(), body: f.groupAnswer.body }), chat.id))
    else if (session)
      later(2500, () => append(f.msg({ id: nextId(), conversation, from: f.from(peer!, session), to: f.terminalOf(a.id), created_at: new Date().toISOString(), body: f.answerFor(m.id) }), chat.id))
    const r = { message_id: m.id, conversation, recipients: session ? 1 : 0, terminal: !group && !session }
    sentByCid.set(cid, r)
    return r
  },
  /** An online session takes it within about a second and answers 3.5 s later; an offline one leaves it pending. */
  async sendToAgent(id, body, cid) {
    const done = agentSentByCid.get(cid)
    if (done !== undefined) return withState(allMessages().find((m) => m.id === done)!)
    const a = await sending(body)
    const agent = f.myAgents.find((x) => x.id === id)
    if (!agent) throw new ApiError(404, "/errors/not-found", "No such session.")
    const m = f.msg({ id: nextId(), conversation: f.selfChat, from: f.from(a), to: f.ref(agent), created_at: new Date().toISOString(), body })
    states[m.id] = agent.online ? "pushed" : "pending"
    append(m)
    agentSentByCid.set(cid, m.id)
    if (agent.online) {
      later(1200, () => (states[m.id] = "delivered"))
      later(3500, () => {
        const reply = f.msg({ id: nextId(), conversation: f.selfChat, from: f.from(a, f.ref(agent)), to: f.terminalOf(a.id), created_at: new Date().toISOString(), body: f.answerFor(m.id) })
        unread[id].push(reply.id)
        append(reply)
      })
    }
    return withState(m)
  },
  async markRead(id, upTo) {
    signedIn()
    await wait(200)
    const left = (unread[id] ?? []).filter((n) => n > upTo)
    const marked = (unread[id]?.length ?? 0) - left.length
    unread[id] = left
    return marked
  },
  pendingRequests: () => data(() => f.pendingRequests, 0),
  async billing() {
    const a = signedIn()
    await wait(250)
    return f.billingFor(controls.preset, controls.mode, controls.billingOn, a.id === f.newAccountId ? 30 : 23, controls.plan)
  },
  /** No Creem here: "checkout" lands straight back on the account page, and the payment notice arrives 4 s later. */
  async checkout(plan) {
    signedIn()
    await wait(800)
    if (controls.preset === "paid" || controls.preset === "ending" || controls.preset === "past_due")
      throw new ApiError(409, "/errors/already-subscribed", "You already have a subscription. Change it under Manage subscription.")
    setTimeout(() => setControls({ preset: "paid", plan }), 4000)
    return "/account?checkout=done"
  },
  async portal() {
    signedIn()
    await wait(600)
    if (controls.preset !== "paid" && controls.preset !== "ending" && controls.preset !== "past_due")
      throw new ApiError(404, "/errors/not-found", "You have no subscription to manage yet.")
    return "https://www.creem.io/"
  },
  fileUrl: (file) => `data:text/plain;charset=utf-8,${encodeURIComponent(`Demo file: ${file.name}\n`)}`,
} satisfies DataLayer

/** What a poll would bring in: a message to an offline session, so it also waits for delivery. */
export function receive() {
  const m = f.incomingMessage(controls.live.length)
  const c = m.conversation.id
  setControls({ live: [...controls.live, m], pendingExtra: { ...controls.pendingExtra, [c]: (controls.pendingExtra[c] ?? 0) + 1 } })
}

/** The Demo panel's shortcut past sign-in. */
export const skipSignIn = () => (setMe(f.account), f.account)
