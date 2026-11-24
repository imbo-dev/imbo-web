import type { Account, AdminAccount, AgentRef, Block, ContactShare, Device, FileRef, Group, Message, MessagesPage, MyAgent, Profile, Report, Request, Sent, SentRequest } from "@/data/contract"
import { account as accountSchema } from "@/data/contract"
import { ApiError, noAnswer, type DataLayer, type Page, type Plan } from "@/data/layer"
import * as f from "./data"

// The demo fixtures behind the same DataLayer as the server, answering the way the server does (errors, paging,
// 401 when signed out). Loaded only when VITE_USE_MOCK=1. The Demo panel (./DemoPanel.tsx) changes `controls`.

export type Status = "ready" | "loading" | "empty" | "error"
/**
 * `refused`: the server turns every send down, as when it's over the rate limit. `blocked`: the peer of a direct chat
 * blocked Dana (`/errors/blocked`).
 */
export type Sending = "ok" | "refused" | "blocked"
/** What the server makes of the next picture: taken, over 5 MB, unreadable, or the 20th change today. */
export type Picture = "ok" | "too-large" | "unreadable" | "limit"
/** Whether canceling a banned account's Waffo subscription works (API-066, API-070). */
export type Cancel = "ok" | "fails"
export type ShareSave = "ok" | "fails"
/** What the next file upload meets: taken, or today's 2 GB already used (API-026). */
export type Upload = "ok" | "quota"
export type Controls = {
  status: Status
  preset: f.BillingPreset
  /** The plan the "paid" state shows: the last one checked out. */
  plan: Plan
  mode: "live" | "test"
  billingOn: boolean
  sending: Sending
  picture: Picture
  cancel: Cancel
  upload: Upload
  /** Whether saving what a contact can see (API-082) goes through. */
  share: ShareSave
  live: Message[]
  pendingExtra: Record<number, number>
}

export let controls: Controls = {
  status: "ready",
  preset: "trial",
  plan: "monthly",
  mode: "live",
  billingOn: true,
  sending: "ok",
  picture: "ok",
  cancel: "ok",
  upload: "ok",
  share: "ok",
  live: [],
  pendingExtra: {},
}
const listeners = new Set<() => void>()
export const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export function setControls(patch: Partial<Controls>) {
  controls = { ...controls, ...patch }
  listeners.forEach((l) => l())
}

// The signed-in account stands in for the session cookie, so it survives a refresh.
const SAVED = "imbo-demo-account-v5"
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
  if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
  return controls.status === "empty" || a.id === f.newAccountId ? empty : value()
}

const allMessages = () => [...f.messages, ...controls.live]

// ── Blocks ──
// Who Dana blocked. Their group messages are left out of her view, and a direct chat with them can't send.

let myBlocks: Block[] = [...f.blocks]
const blockedByMe = (id: number) => myBlocks.some((b) => b.account.id === id)
/** Everyone Dana can see a profile of, with their picture. */
const profiles: Profile[] = [
  { id: 31570264, name: "Mia", avatar_url: f.pictures.mia },
  { id: 77120458, name: "Leo" },
  { id: 50928413, name: "Ivy" },
  f.bob,
  f.kai,
  { ...f.rex, avatar_url: f.pictures.rex },
]
/** What Dana is shown of a thread: messages in a group from someone she blocked are hidden (RULE-013). */
const visible = (m: Message) => !(m.conversation.kind === "group" && blockedByMe(m.from.account_id))

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
/** Files Dana uploaded, by ID, with their bytes, and how much she uploaded today. */
const uploads = new Map<string, FileRef>()
const uploadedBytes = new Map<string, Blob>()
let uploadedToday = 0
const LIMIT = 2_147_483_648
const filesOf = (ids: string[] = []) => ids.map((id) => uploads.get(id)!)
const agentSentByCid = new Map<string, number>()
/** What sending changed about a session that sending can open: opening, open, or failed (FLOW-WAKE). */
const woken: Record<string, Partial<MyAgent>> = {}
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

/** The checks every send passes first, in the server's order and wording. With files the text can be empty. */
async function sending(body: string, files: string[] = []) {
  const a = signedIn()
  await wait(450)
  if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
  if ((!files.length && !body.trim()) || [...body].length > 32_000) throw new ApiError(422, "/errors/body-invalid", "The message must be 1 to 32000 characters.")
  if (files.length > 20) throw new ApiError(400, "/errors/invalid-request", "A message can carry at most 20 files.")
  if (files.some((id) => !uploads.has(id))) throw new ApiError(400, "/errors/invalid-request", "Unknown file.")
  if (controls.preset === "expired") throw new ApiError(402, "/errors/subscription-required", "Your trial has ended. Subscribe to send messages again.")
  if (controls.sending === "refused") throw new ApiError(429, "/errors/rate-limited", "Too many messages in this conversation. Slow down.", 20)
  return a
}

// ── Requests and groups ──
// An answered request leaves the list; accepting adds the contact or the group, with its chat, as the server does.

let myRequests: Request[] = [...f.requests]
/** Invitations Dana sent, as `<group>/<account>`. */
const invitations = new Set<string>()
let nextGroupId = 7301402
const nextChatId = () => Math.max(f.selfChat.id, ...f.conversations.map((c) => c.id)) + 1

function waiting(id: number) {
  const r = myRequests.find((x) => x.id === id)
  if (!r) throw new ApiError(404, "/errors/not-found", "No such request.")
  if (r.status !== "pending") throw new ApiError(409, "/errors/request-closed", `This request was already ${r.status}.`)
  return r
}
const settle = (id: number, status: string) => (myRequests = myRequests.map((r) => (r.id === id ? { ...r, status } : r)))

function groupOf(id: number) {
  const g = f.groups.find((x) => x.id === id)
  if (!g) throw new ApiError(404, "/errors/not-found", `No group ${id}.`)
  return g
}
const asMember = (a: Account, sessions: AgentRef[] = []) => ({ id: a.id, name: a.name, avatar_url: a.avatar_url, active: true, sessions })
/** Only the owner may change a group (`/errors/not-owner`). */
function ownGroup(a: Account, id: number) {
  const g = groupOf(id)
  if (g.owner?.id !== a.id) throw new ApiError(403, "/errors/not-owner", `Only the owner of ${g.name} can do that.`)
  return g
}
/** The group and its chat, which shows its name and picture. */
function changeGroup(g: Group, patch: Partial<Group>) {
  const next = { ...g, ...patch }
  f.groups[f.groups.indexOf(g)] = next
  for (const c of f.conversations) if (c.group?.id === g.id) c.group = { id: g.id, name: next.name, avatar_url: next.avatar_url }
  return next
}
/** Left or dissolved: gone from Dana's groups and chats. */
function dropGroup(g: Group) {
  f.groups.splice(f.groups.indexOf(g), 1)
  const i = f.conversations.findIndex((c) => c.group?.id === g.id)
  if (i >= 0) f.conversations.splice(i, 1)
}

/** Contact requests Dana sent that are still waiting. */
let outgoing: SentRequest[] = []
/** Session titles Dana gave (API-073). */
const titles: Record<string, string> = {}
let myDevices: Device[] = [...f.devices]
/** What each contact can see of Dana's sessions (API-081, API-082). */
const shares = structuredClone(f.shares)
const mySessions = () => [...f.myAgents, f.oldAgent]
function shareOf(id: number): ContactShare {
  const x = shares[id] ?? { share: "chosen", devices: [], sessions: [] }
  return {
    share: x.share,
    devices: myDevices.filter((d) => x.devices.includes(d.id)).map((d) => ({ id: d.id, name: d.name })),
    sessions: mySessions()
      .filter((a) => x.sessions.includes(a.id))
      .map((a) => ({ ...f.ref(a), title: titles[a.id] ?? a.title, device_id: a.device_id, online: a.online })),
  }
}
const contactOf = (id: number) => {
  if (!f.contacts.some((c) => c.id === id)) throw new ApiError(403, "/errors/not-contact", `${id} is not your contact.`)
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
    if (key === f.bannedEmail)
      throw new ApiError(403, "/errors/account-banned", "This account has been banned. If you think this is a mistake, write to support@imbo.dev.")
    codeSentAt[key] = Date.now()
    codeTries[key] = 0
    return { retry_after_s: 60 }
  },
  /**
   * dana@example.com and support@imbo.dev (the admin) have accounts; any other email is new. Code 000000 is wrong,
   * 111111 has expired.
   */
  async signIn(email, code, name) {
    await wait(500)
    const key = email.trim().toLowerCase()
    if (code === "111111") throw new ApiError(410, "/errors/code-expired", "That code has expired. Request a new one.")
    if (code === "000000" || (codeTries[key] ?? 0) >= 5) {
      const tries = (codeTries[key] = (codeTries[key] ?? 0) + 1)
      if (tries >= 5) throw new ApiError(429, "/errors/code-locked", "Too many wrong codes. Request a new code.")
      throw new ApiError(400, "/errors/code-invalid", `Wrong code. ${5 - tries} tries left.`)
    }
    for (const a of [f.account, f.adminAccount])
      if (key === a.email) {
        setMe(a)
        return { account: a, new_account: false }
      }
    if (!name) throw new ApiError(422, "/errors/name-required", "New account: choose a name first.")
    const account = { id: f.newAccountId, name, email: email.trim(), admin: false }
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
  /** Same rule as the server: 1 to 32 characters after trimming, no control characters. */
  async renameMe(name) {
    const a = signedIn()
    await wait(450)
    const n = name.trim()
    if (!n || [...n].length > 32 || /\p{Cc}/u.test(n)) throw new ApiError(400, "/errors/invalid-request", "A name must be 1 to 32 characters.")
    const next = { ...a, name: n }
    setMe(next)
    return next
  },
  devices: () => data(() => myDevices, []),
  async revokeDevice(id) {
    signedIn()
    await wait(450)
    if (!myDevices.some((d) => d.id === id)) throw new ApiError(404, "/errors/not-found", "No such computer.")
    myDevices = myDevices.filter((d) => d.id !== id)
  },
  async deleteAccount() {
    signedIn()
    await wait(800)
    setMe(null)
  },
  conversations: () =>
    data(
      () =>
        f.conversations
          .map((c) => {
            const last = allMessages()
              .filter((m) => m.conversation.id === c.id && visible(m))
              .at(-1)
            // Blocking took back what hadn't arrived yet (API-058).
            const takenBack = c.peer && blockedByMe(c.peer.id)
            return {
              ...c,
              pending: takenBack ? 0 : c.pending + (controls.pendingExtra[c.id] ?? 0),
              last_message: last && { id: last.id, from: last.from, preview: (last.body || last.files.map((x) => x.name).join(", ")).slice(0, 100), created_at: last.created_at },
            }
          })
          .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Date.parse(b.last_message?.created_at ?? "0") - Date.parse(a.last_message?.created_at ?? "0")),
      []
    ),
  async setConversationPrefs(id, prefs) {
    signedIn()
    await wait(200)
    const c = f.conversations.find((x) => x.id === id)
    if (!c) throw new ApiError(404, "/errors/not-found", `No conversation ${id}.`)
    Object.assign(c, prefs)
    return { pinned: !!c.pinned, marked_unread: !!c.marked_unread, muted: !!c.muted }
  },
  searchConversation: async (id, q) => {
    if (!f.conversations.some((c) => c.id === id)) throw new ApiError(404, "/errors/not-found", `No conversation ${id}.`)
    const found = allMessages().filter((m) => m.conversation.id === id && visible(m) && m.body.toLowerCase().includes(q.toLowerCase()))
    return data(() => ({ messages: found.slice(-50).reverse(), has_more: found.length > 50 }), { messages: [], has_more: false })
  },
  messages: async (id, p) => {
    if (!f.conversations.some((c) => c.id === id)) throw new ApiError(404, "/errors/not-found", `No conversation ${id}.`)
    return data(() => page(allMessages().filter((m) => m.conversation.id === id && visible(m)), p), { messages: [], has_more: false })
  },
  agents: () => data(() => f.myAgents.map((a) => ({ ...a, ...woken[a.id], ...(titles[a.id] && { title: titles[a.id] }), unread: unread[a.id].length })), []),
  agentMessages: async (id, p) => {
    if (!f.myAgents.some((a) => a.id === id)) throw new ApiError(404, "/errors/not-found", "No such session.")
    return data(() => page(allMessages().filter((m) => m.from.agent?.id === id || m.to?.id === id).map(withState), p), { messages: [], has_more: false })
  },
  contacts: () => data(() => f.contacts.map((c) => ({ ...c, blocked: blockedByMe(c.id) })), []),
  /** Direct: `<account>` is their terminal inbox, `<account>/<short ID>` one of their sessions, which answers 2.5 s later. */
  async send(to, body, cid, files) {
    const done = sentByCid.get(cid)
    if (done) return done
    const a = await sending(body, files)
    const group = to.startsWith("#") ? f.conversations.find((c) => c.group && `#${c.group.id}` === to) : undefined
    const [peerId, short] = to.split("/")
    const peer = group ? undefined : f.contacts.find((p) => String(p.id) === peerId)
    if (!group && !peer) throw new ApiError(403, "/errors/not-contact", `${to} isn't one of your contacts.`)
    if (peer && blockedByMe(peer.id)) throw new ApiError(403, "/errors/unblock-first", `You blocked ${peer.name}. Unblock them first.`)
    if (peer && controls.sending === "blocked") throw new ApiError(403, "/errors/blocked", `${peer.name} doesn't accept your messages.`)
    if (peer && !peer.active) throw new ApiError(403, "/errors/recipient-inactive", `${peer.name}'s account is inactive.`)
    // The first message to a contact starts the chat.
    let chat = group ?? f.conversations.find((c) => c.peer?.id === peer!.id)
    if (!chat) f.conversations.push((chat = { id: nextChatId(), kind: "direct", peer: { id: peer!.id, name: peer!.name, avatar_url: peer!.avatar_url }, pending: 0 }))
    const session = short ? f.contactSessions[to] : undefined
    if (short && !session) throw new ApiError(404, "/errors/session-not-found", `${peer!.name} has no session ${short}.`)
    const conversation = chat.group ? { kind: "group" as const, id: chat.id, group: chat.group } : { kind: "direct" as const, id: chat.id, peer: chat.peer }
    const m = f.msg({ id: nextId(), conversation, from: { ...f.from(a), via: "web" }, ...(!group && { to: session ?? f.terminalOf(peer!.id) }), created_at: new Date().toISOString(), body, files: filesOf(files) })
    append(m)
    if (group)
      later(3000, () => append(f.msg({ id: nextId(), conversation, from: f.from(f.groupAnswer.person, f.groupAnswer.agent), created_at: new Date().toISOString(), body: f.groupAnswer.body }), chat.id))
    else if (session)
      later(2500, () => append(f.msg({ id: nextId(), conversation, from: f.from(peer!, session), to: f.terminalOf(a.id), created_at: new Date().toISOString(), body: f.answerFor(m.id) }), chat.id))
    const r = { message_id: m.id, conversation, recipients: session ? 1 : 0, terminal: !group && !session }
    sentByCid.set(cid, r)
    return r
  },
  /**
   * An online session takes it within about a second and answers 3.5 s later; an offline one leaves it pending. One that
   * sending can open (FLOW-WAKE) shows as opening, comes online 6 s later and then takes it; search-index's open fails.
   */
  async sendToAgent(id, body, cid, files) {
    const done = agentSentByCid.get(cid)
    if (done !== undefined) return withState(allMessages().find((m) => m.id === done)!)
    const a = await sending(body, files)
    const agent = f.myAgents.find((x) => x.id === id)
    if (!agent) throw new ApiError(404, "/errors/not-found", "No such session.")
    const m = f.msg({ id: nextId(), conversation: f.selfChat, from: { ...f.from(a), via: "web" }, to: f.ref(agent), created_at: new Date().toISOString(), body, files: filesOf(files) })
    const online = agent.online || !!woken[id]?.online
    const opens = !online && agent.wakeable
    states[m.id] = online ? "pushed" : "pending"
    append(m)
    agentSentByCid.set(cid, m.id)
    const answer = () => {
      later(1200, () => (states[m.id] = "delivered"))
      later(3500, () => {
        const reply = f.msg({ id: nextId(), conversation: f.selfChat, from: f.from(a, f.ref(agent)), to: f.terminalOf(a.id), created_at: new Date().toISOString(), body: f.answerFor(m.id) })
        unread[id].push(reply.id)
        append(reply)
      })
    }
    if (online) answer()
    if (opens) {
      woken[id] = { wake: { state: "waking", at: new Date().toISOString() } }
      later(6000, () => {
        if (id === "a-search") {
          woken[id] = { wake: { state: "failed", detail: "Its folder ~/work/search-index is gone.", at: new Date().toISOString() } }
          return
        }
        woken[id] = { online: true, wakeable: false, wake: undefined }
        states[m.id] = "pushed"
        answer()
      })
    }
    return withState(m)
  },
  /** About 1 s a megabyte; the Demo panel can make today's 2 GB used up. */
  async upload(file, sha256) {
    signedIn()
    await wait(600 + Math.min(4000, file.size / 1000))
    if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
    if (file.size > 104_857_600) throw new ApiError(413, "/errors/file-too-large", "A file can be at most 100 MB (104857600 bytes).")
    if (controls.upload === "quota" || uploadedToday + file.size > LIMIT)
      throw new ApiError(429, "/errors/upload-quota-exceeded", "Today's 2 GB upload limit is used up; it resets at 00:00 Beijing time.")
    uploadedToday += file.size
    const ref: FileRef = { id: `f-${uploads.size + 1}`, name: file.name, size: file.size, sha256, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }
    uploads.set(ref.id, ref)
    uploadedBytes.set(ref.id, file)
    const midnight = new Date()
    midnight.setUTCHours(16, 0, 0, 0)
    if (midnight.getTime() < Date.now()) midnight.setUTCDate(midnight.getUTCDate() + 1)
    return { file: ref, quota: { used: uploadedToday, limit: LIMIT, resets_at: midnight.toISOString() } }
  },
  /** Up to 200 characters; empty goes back to the title from the tool. */
  async renameAgent(id, title) {
    signedIn()
    await wait(400)
    const agent = f.myAgents.find((x) => x.id === id)
    if (!agent) throw new ApiError(404, "/errors/not-found", "No such session.")
    const t = title.trim()
    if ([...t].length > 200 || /\p{Cc}/u.test(t)) throw new ApiError(400, "/errors/invalid-request", "A title can be at most 200 characters, without control characters.")
    if (t) titles[id] = t
    else delete titles[id]
    return { ...agent, ...woken[id], title: t || agent.title, unread: unread[id].length }
  },
  async markRead(id, upTo) {
    signedIn()
    await wait(200)
    const left = (unread[id] ?? []).filter((n) => n > upTo)
    const marked = (unread[id]?.length ?? 0) - left.length
    unread[id] = left
    return marked
  },
  /** No server to hear from: the demo panel refreshes after what it changes. */
  events: () => () => {},
  /** Everything the chat sent Dana's inbox counts as read, however far `upTo` goes. */
  async markConversationRead(id) {
    signedIn()
    await wait(200)
    const c = f.conversations.find((x) => x.id === id)
    if (!c) throw new ApiError(404, "/errors/not-found", `No conversation ${id}.`)
    const marked = c.pending + (controls.pendingExtra[id] ?? 0)
    c.pending = 0
    c.marked_unread = false
    setControls({ pendingExtra: { ...controls.pendingExtra, [id]: 0 } })
    return marked
  },
  requests: () => data(() => myRequests.filter((r) => r.status === "pending"), []),
  sentRequests: () => data(() => outgoing.filter((r) => r.status === "pending"), []),
  /**
   * By email or ID, in the server's order: no such account, myself, blocked either way, already contacts, they asked
   * first (accepted at once), already asked, 20 a day. Sam (sam@orbit.dev, 60391827) is someone new.
   */
  async askContact(to, note) {
    const a = signedIn()
    await wait(500)
    if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
    if (controls.preset === "expired") throw new ApiError(402, "/errors/subscription-required", "Your trial has ended. Subscribe to add contacts.")
    const email = "email" in to ? to.email.trim().toLowerCase() : undefined
    if (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "/errors/invalid-email", "That isn't an email address.")
    const who = email !== undefined ? f.byEmail[email] : f.byId.find((p) => "account_id" in to && p.id === to.account_id)
    if (!who) throw new ApiError(404, "/errors/account-not-found", email !== undefined ? `No account with email ${email}.` : `No account with ID ${"account_id" in to ? to.account_id : ""}.`)
    if (who.id === a.id) throw new ApiError(422, "/errors/cannot-add-self", email !== undefined ? "That is your own email." : "That is your own account ID.")
    if ([...(note ?? "").trim()].length > 200) throw new ApiError(400, "/errors/invalid-request", "The note can be at most 200 characters.")
    if (blockedByMe(who.id)) throw new ApiError(403, "/errors/unblock-first", `You blocked ${who.name}. Unblock them first.`)
    if (who.id === f.rex.id) throw new ApiError(403, "/errors/blocked", `${who.name} doesn't accept your messages.`)
    if (f.contacts.some((c) => c.id === who.id)) throw new ApiError(409, "/errors/already-contacts", `${who.name} is already your contact.`)
    const theirs = myRequests.find((r) => r.kind === "contact" && r.from.id === who.id && r.status === "pending")
    if (theirs) {
      settle(theirs.id, "accepted")
      f.contacts.push({ ...who, active: true, blocked: false, sessions: [] })
      return { contact: who }
    }
    if (outgoing.some((r) => r.to.id === who.id && r.status === "pending")) throw new ApiError(409, "/errors/request-pending", `You already have a pending request to ${who.name}.`)
    if (outgoing.length >= 20) throw new ApiError(429, "/errors/rate-limited", "At most 20 contact requests per day.", 3600)
    const request: SentRequest = { id: 800 + outgoing.length, kind: "contact", from: { id: a.id, name: a.name }, to: who, status: "pending", created_at: new Date().toISOString() }
    outgoing = [request, ...outgoing]
    return { request }
  },
  async contactShare(id) {
    signedIn()
    await wait(300)
    if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
    contactOf(id)
    return shareOf(id)
  },
  /** Same rules as the server: my own computers that are still signed in, my own sessions, 200 at most. */
  async setContactShare(id, share, devices, sessions) {
    signedIn()
    await wait(500)
    if (controls.share === "fails") throw new ApiError(0, "network", noAnswer())
    contactOf(id)
    const d = [...new Set(devices)]
    const a = [...new Set(sessions)]
    if (share === "chosen") {
      if (d.length + a.length > 200) throw new ApiError(400, "/errors/invalid-request", "Pick 200 computers and sessions at most.")
      if (d.some((x) => !myDevices.some((y) => y.id === x))) throw new ApiError(400, "/errors/invalid-request", "One of those computers isn't yours or is signed out.")
      if (a.some((x) => !mySessions().some((y) => y.id === x))) throw new ApiError(400, "/errors/invalid-request", "One of those sessions isn't yours.")
    }
    shares[id] = share === "chosen" ? { share, devices: d, sessions: a } : { share, devices: [], sessions: [] }
    return shareOf(id)
  },
  /** Both lose each other; the chat stays. */
  async removeContact(id) {
    signedIn()
    await wait(400)
    const i = f.contacts.findIndex((c) => c.id === id)
    if (i < 0) throw new ApiError(403, "/errors/not-contact", `${id} is not your contact.`)
    f.contacts.splice(i, 1)
  },
  async accept(id) {
    const a = signedIn()
    await wait(500)
    if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
    const r = waiting(id)
    settle(id, "accepted")
    if (r.group) {
      f.groups.push({ ...r.group, owner: r.from, members: [{ ...r.from, active: true, sessions: [] }, asMember(a)], my_sessions: [], discoverable: false })
      f.conversations.push({ id: nextChatId(), kind: "group", group: r.group, pending: 0 })
      return { group: r.group }
    }
    f.contacts.push({ ...r.from, active: true, blocked: false, sessions: [] })
    f.conversations.push({ id: nextChatId(), kind: "direct", peer: r.from, pending: 0 })
    return { contact: r.from }
  },
  async decline(id) {
    signedIn()
    await wait(400)
    if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
    waiting(id)
    settle(id, "declined")
  },
  async billing() {
    const a = signedIn()
    await wait(250)
    return f.billingFor(controls.preset, controls.mode, controls.billingOn, a.id === f.newAccountId ? 30 : 23, controls.plan)
  },
  /** No Waffo here: "checkout" lands straight back on the account page, and the payment notice arrives 4 s later. */
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
    return "https://pancake.waffo.ai/"
  },
  /** No Alipay in the demo, so this server sells no time packs and the account page offers none. */
  async alipayPack() {
    signedIn()
    throw new ApiError(404, "/errors/not-found", "This server does not sell time packs here.")
  },
  async alipayCheck() {
    signedIn()
    throw new ApiError(404, "/errors/not-found", "This server does not sell time packs here.")
  },
  fileUrl: (file) => `data:text/plain;charset=utf-8,${encodeURIComponent(`Demo file: ${file.name}\n`)}`,
  /**
   * What Dana uploaded, or the demo's pictures and videos; anything else isn't found. Arrives in steps, about 1 s for
   * every 10 MB the message says it has, at least 0.4 s and at most 4 s.
   */
  async fileBytes(file, signal, progress) {
    signedIn()
    const steps = Math.min(40, Math.max(4, Math.round(file.size / 1_000_000)))
    for (let i = 1; i <= steps; i++) {
      await wait(100)
      signal?.throwIfAborted()
      if (controls.status === "error") throw new ApiError(0, "network", noAnswer())
      progress?.(i / steps)
    }
    const bytes = uploadedBytes.get(file.id) ?? (f.media[file.id] && (await (await fetch(f.media[file.id])).blob()))
    if (!bytes) throw new ApiError(404, "/errors/not-found", "File not found.")
    return bytes
  },
  groups: () => data(() => f.groups, []),
  /** Same name rules as the server; the group is Dana's, with the sessions she picked. */
  async createGroup(name, sessions) {
    const a = signedIn()
    await wait(600)
    const n = name.trim()
    if (!n || [...n].length > 64) throw new ApiError(400, "/errors/invalid-request", "Group name must be 1 to 64 characters.")
    if (n.includes("/") || n.startsWith("#") || /\p{Cc}/u.test(n))
      throw new ApiError(400, "/errors/invalid-request", "Group name cannot contain a slash, start with # or contain control characters.")
    const ref = { id: nextGroupId++, name: n }
    const mine = f.myAgents.filter((x) => sessions.includes(x.id)).map(f.ref)
    const g: Group = { ...ref, owner: { id: a.id, name: a.name }, members: [asMember(a, mine)], my_sessions: mine, discoverable: false }
    f.groups.push(g)
    f.conversations.push({ id: nextChatId(), kind: "group", group: ref, pending: 0 })
    return g
  },
  /** Ivy's account is inactive; an invitation already sent is refused the second time. */
  async invite(groupId, accountId) {
    signedIn()
    await wait(350)
    const g = groupOf(groupId)
    const p = f.contacts.find((c) => c.id === accountId)
    if (!p) throw new ApiError(403, "/errors/not-contact", `${accountId} is not your contact. Only contacts can be invited.`)
    if (g.members.some((m) => m.id === accountId)) throw new ApiError(409, "/errors/already-member", `${accountId} is already in ${g.name}.`)
    if (blockedByMe(accountId)) throw new ApiError(403, "/errors/unblock-first", `You blocked ${p.name}. Unblock them first.`)
    if (!p.active) throw new ApiError(403, "/errors/recipient-inactive", `${p.name}'s account is inactive.`)
    const key = `${groupId}/${accountId}`
    if (invitations.has(key)) throw new ApiError(409, "/errors/request-pending", "They already have a pending invite to this group.")
    invitations.add(key)
  },
  async renameGroup(groupId, name) {
    const g = ownGroup(signedIn(), groupId)
    await wait(450)
    const n = name.trim()
    if (!n || [...n].length > 64 || n.includes("/") || n.startsWith("#") || /\p{Cc}/u.test(n))
      throw new ApiError(400, "/errors/invalid-request", "Group name must be 1 to 64 characters, without a slash or control characters, and not start with #.")
    return changeGroup(g, { name: n })
  },
  async setGroupAvatar(groupId, picture) {
    const g = ownGroup(signedIn(), groupId)
    await wait(700)
    if (controls.picture === "too-large") throw new ApiError(413, "/errors/file-too-large", "The picture can be at most 5 MB (5242880 bytes).")
    if (controls.picture === "unreadable") throw new ApiError(422, "/errors/image-invalid", "Only JPEG and PNG pictures can be avatars; convert it to JPEG or PNG first.")
    if (controls.picture === "limit") throw new ApiError(429, "/errors/rate-limited", "You can change pictures 20 times a day. Try again later.", 3600)
    const avatar_url = URL.createObjectURL(picture)
    changeGroup(g, { avatar_url })
    return avatar_url
  },
  async removeGroupAvatar(groupId) {
    const g = ownGroup(signedIn(), groupId)
    await wait(400)
    changeGroup(g, { avatar_url: undefined })
  },
  async removeMember(groupId, accountId) {
    const a = signedIn()
    const g = ownGroup(a, groupId)
    await wait(450)
    if (accountId === a.id) throw new ApiError(400, "/errors/invalid-request", "Use leave to leave a group you're in.")
    if (!g.members.some((m) => m.id === accountId)) throw new ApiError(403, "/errors/not-member", `${accountId} isn't in ${g.name}.`)
    changeGroup(g, { members: g.members.filter((m) => m.id !== accountId) })
  },
  async setDiscoverable(groupId, on) {
    const g = ownGroup(signedIn(), groupId)
    await wait(400)
    return changeGroup(g, { discoverable: on })
  },
  async setGroupAdmin(groupId, accountId, on) {
    const g = ownGroup(signedIn(), groupId)
    await wait(400)
    if (!g.members.some((m) => m.id === accountId)) throw new ApiError(404, "/errors/not-found", `${accountId} is not in ${g.name}.`)
    return changeGroup(g, { members: g.members.map((m) => (m.id === accountId ? { ...m, role: on ? "admin" : "member" } : m)) })
  },
  /** Only Dana's own groups can be found here, so every one found is Joined. */
  async searchGroups(q) {
    signedIn()
    await wait(400)
    const v = q.trim().replace(/^#/, "").toLowerCase()
    if (!v || v.length > 64) throw new ApiError(400, "/errors/invalid-request", "Search with a group ID or 1 to 64 characters of its name.")
    return f.groups
      .filter((g) => g.discoverable && (String(g.id) === v || g.name.toLowerCase().includes(v)))
      .map((g) => ({ id: g.id, name: g.name, avatar_url: g.avatar_url, member_count: g.members.length, owner: g.owner ?? g.members[0], joined: true, applied: false }))
  },
  async applyToGroup() {
    signedIn()
    await wait(400)
    throw new ApiError(409, "/errors/already-member", "You are already in this group.")
  },
  async transferGroup(groupId, accountId) {
    const g = ownGroup(signedIn(), groupId)
    await wait(450)
    const to = g.members.find((m) => m.id === accountId)
    if (!to) throw new ApiError(403, "/errors/not-member", `${accountId} isn't in ${g.name}.`)
    return changeGroup(g, { owner: { id: to.id, name: to.name } })
  },
  async dissolveGroup(groupId) {
    const g = ownGroup(signedIn(), groupId)
    await wait(500)
    dropGroup(g)
  },
  async leaveGroup(groupId) {
    const a = signedIn()
    await wait(450)
    const g = groupOf(groupId)
    if (g.owner?.id === a.id) throw new ApiError(409, "/errors/owner-cannot-leave", "The owner can't leave. Hand the group to someone else or dissolve it.")
    dropGroup(g)
  },
  async setGroupSessions(groupId, sessions) {
    signedIn()
    await wait(400)
    const g = groupOf(groupId)
    const mine = f.myAgents.filter((x) => sessions.includes(x.id)).map(f.ref)
    f.groups[f.groups.indexOf(g)] = { ...g, members: g.members.map((m) => (m.id === f.account.id ? { ...m, sessions: mine } : m)), my_sessions: mine }
    return mine
  },
  /** Same rules as the server: not my email now, not another account's (mia@example.com), one code a minute. */
  async requestEmailChange(email) {
    const a = signedIn()
    await wait(700)
    const key = email.trim().toLowerCase()
    if (key === a.email?.toLowerCase()) throw new ApiError(400, "/errors/invalid-email", "That's already your email.")
    if (key === f.takenEmail) throw new ApiError(409, "/errors/email-taken", "That email is already used by another Imbo account.")
    const age = (Date.now() - (codeSentAt[key] ?? 0)) / 1000
    if (age < 60) throw new ApiError(429, "/errors/rate-limited", "A code was just sent. Wait a minute before asking again.", Math.ceil(60 - age))
    codeSentAt[key] = Date.now()
    codeTries[key] = 0
    return { retry_after_s: 60 }
  },
  /** Code 000000 is wrong, 111111 has expired, as when signing in. */
  async changeEmail(email, code) {
    const a = signedIn()
    await wait(500)
    const key = email.trim().toLowerCase()
    if (code === "111111") throw new ApiError(410, "/errors/code-expired", "That code has expired. Request a new one.")
    if (code === "000000" || (codeTries[key] ?? 0) >= 5) {
      const tries = (codeTries[key] = (codeTries[key] ?? 0) + 1)
      if (tries >= 5) throw new ApiError(429, "/errors/code-locked", "Too many wrong codes. Request a new code.")
      throw new ApiError(400, "/errors/code-invalid", `Wrong code. ${5 - tries} tries left.`)
    }
    const next = { ...a, email: email.trim() }
    setMe(next)
    return next
  },
  /** Shows the very picture picked (the server would send back its 512 px square). */
  async setAvatar(picture) {
    const a = signedIn()
    await wait(700)
    if (controls.picture === "too-large") throw new ApiError(413, "/errors/file-too-large", "The picture can be at most 5 MB (5242880 bytes).")
    if (controls.picture === "unreadable") throw new ApiError(422, "/errors/image-invalid", "Only JPEG and PNG pictures can be avatars; convert it to JPEG or PNG first.")
    if (controls.picture === "limit") throw new ApiError(429, "/errors/rate-limited", "You can change pictures 20 times a day. Try again later.", 3600)
    const avatar_url = URL.createObjectURL(picture)
    setMe({ ...a, avatar_url })
    return avatar_url
  },
  async removeAvatar() {
    const a = signedIn()
    await wait(400)
    setMe({ ...a, avatar_url: undefined })
  },
  avatarUrl: (url) => url,
  async block(id) {
    const a = signedIn()
    await wait(400)
    if (id === a.id) throw new ApiError(400, "/errors/invalid-request", "You can't block yourself.")
    const who = profiles.find((p) => p.id === id)
    if (!who) throw new ApiError(404, "/errors/account-not-found", `No account with ID ${id}.`)
    const had = myBlocks.find((b) => b.account.id === id)
    if (had) return had
    const b = { account: who, created_at: new Date().toISOString() }
    myBlocks = [b, ...myBlocks]
    return b
  },
  async unblock(id) {
    signedIn()
    await wait(350)
    if (!blockedByMe(id)) throw new ApiError(404, "/errors/not-found", `You haven't blocked ${id}.`)
    myBlocks = myBlocks.filter((b) => b.account.id !== id)
  },
  blocks: () => data(() => myBlocks, []),
  async report(id, reason, note, groupId) {
    const a = signedIn()
    await wait(600)
    const target = profiles.find((p) => p.id === id)
    if (!target) throw new ApiError(404, "/errors/account-not-found", `No account with ID ${id}.`)
    const group = groupId === undefined ? undefined : f.groups.find((g) => g.id === groupId)
    if (groupId !== undefined && !group) throw new ApiError(404, "/errors/not-found", `No group #${groupId}.`)
    if (reports.some((r) => r.reporter.id === a.id && r.target.id === id && r.status === "open"))
      throw new ApiError(409, "/errors/already-reported", "You already reported this account. It will be handled within 24 hours.")
    const copied = allMessages()
      .filter((m) => (group ? m.conversation.group?.id === group.id && m.from.account_id === id : m.conversation.kind === "direct" && m.conversation.peer?.id === id))
      .slice(-20)
      .map((m) => ({ kind: "message", from: { id: m.from.account_id, name: m.from.name }, body: m.body, files: m.files.map((x) => ({ name: x.name, size: x.size })), created_at: m.created_at }))
    const r: Report = {
      id: Math.max(...reports.map((x) => x.id)) + 1,
      reporter: { id: a.id, name: a.name, avatar_url: a.avatar_url, banned: false },
      target: { ...target, banned: false, email: `${target.name.toLowerCase()}@example.com` },
      ...(group && { group: { id: group.id, name: group.name } }),
      reason,
      status: "open",
      created_at: new Date().toISOString(),
      ...(note && { note }),
      messages: copied,
    }
    reports = [r, ...reports]
    return r.id
  },
  admin: {
    async reports(status, n) {
      adminOnly()
      await wait(300)
      const list = reports.filter((r) => status === "all" || r.status === "open")
      return { reports: list.slice((n - 1) * 50, n * 50).map((r) => summary(current(r))), total: list.length }
    },
    async report(id) {
      adminOnly()
      await wait(250)
      return current(reportById(id))
    },
    async resolve(id, action) {
      adminOnly()
      await wait(500)
      const r = reportById(id)
      if (r.status !== "open") throw new ApiError(409, "/errors/report-closed", `Report ${id} was already handled.`)
      let canceled: boolean | undefined
      if (action === "ban") canceled = banAccount(r.target.id)
      if (action === "remove_avatar") takePicture(r.target.id)
      close(r, action === "dismiss" ? "dismissed" : "actioned", action === "dismiss" ? undefined : action)
      return { report: current(r), ...(canceled !== undefined && { subscription_canceled: canceled, app_store_subscription: false }) }
    },
    async accounts(q, n) {
      adminOnly()
      await wait(300)
      const key = q.trim().toLowerCase()
      if (key) {
        const hits = everyone().filter((x) => String(x.id) === key || x.email.toLowerCase().includes(key))
        return { accounts: hits.slice((n - 1) * 50, n * 50), total: hits.length }
      }
      const total = named.length + FILLERS
      const from = (n - 1) * 50
      const accounts = Array.from({ length: Math.max(0, Math.min(50, total - from)) }, (_, k) => from + k).map((i) => (i < named.length ? named[i] : filler(i - named.length)))
      return { accounts, total }
    },
    async ban(id) {
      adminOnly()
      await wait(500)
      const canceled = banAccount(id)
      return { account: accountById(id), subscription_canceled: canceled, app_store_subscription: false }
    },
    async unban(id) {
      adminOnly()
      await wait(400)
      const x = accountById(id)
      x.banned_at = undefined
      return x
    },
    async deleteAccount(id) {
      adminOnly()
      await wait(600)
      const x = accountById(id)
      if (!x.banned_at) throw new ApiError(400, "/errors/invalid-request", "Only a banned account can be deleted here. Ban it first.")
      if (x.subscription?.status === "active" && controls.cancel === "fails")
        throw new ApiError(502, "/errors/upstream", "Couldn't cancel the subscription on Waffo, so nothing was deleted.")
      named = named.filter((a) => a.id !== id)
      deleted.add(id)
    },
    async stats() {
      adminOnly()
      await wait(400)
      return f.stats()
    },
  },
} satisfies DataLayer

// ── Admin ──
// Reports, accounts and their bans as the admin pages see them; only support@imbo.dev gets answers.

let reports: Report[] = structuredClone(f.reports)
let named: AdminAccount[] = structuredClone(f.namedAccounts)
const deleted = new Set<number>()
/** Made-up sign-ups behind the named ones, so Users has pages to turn; made when a page shows them. */
const FILLERS = f.ACCOUNT_TOTAL - f.namedAccounts.length
const fillers = new Map<number, AdminAccount>()
const filler = (i: number) => fillers.get(i) ?? fillers.set(i, f.fillerAccount(i)).get(i)!
const everyone = () => [...named, ...fillers.values()]

/** Anyone but an admin gets the same 404 as a path that doesn't exist. */
function adminOnly() {
  const a = signedIn()
  if (!a.admin) throw new ApiError(404, "/errors/not-found", "Not found.")
  return a
}
const accountById = (id: number) => {
  const x = everyone().find((a) => a.id === id)
  if (!x) throw new ApiError(404, "/errors/account-not-found", `No account with ID ${id}.`)
  return x
}
/** API-064 `remove_avatar`: gone from Users and from every profile Dana sees. */
function takePicture(id: number) {
  const x = everyone().find((a) => a.id === id)
  if (x) x.avatar_url = undefined
  const p = profiles.find((a) => a.id === id)
  if (p) p.avatar_url = undefined
}
function reportById(id: number) {
  const r = reports.find((x) => x.id === id)
  if (!r) throw new ApiError(404, "/errors/not-found", `No report ${id}.`)
  return r
}
/** A party as it is now: banned or not, picture or not; a deleted account has no name. */
function asNow(p: Report["target"]): Report["target"] {
  if (deleted.has(p.id)) return { ...p, name: "", avatar_url: undefined, banned: false }
  const x = everyone().find((a) => a.id === p.id)
  return x ? { ...p, banned: !!x.banned_at, avatar_url: x.avatar_url } : p
}
const current = (r: Report): Report => ({ ...r, reporter: asNow(r.reporter), target: asNow(r.target) })
/** API-062 leaves out what only API-063 has. */
const summary = ({ note: _n, messages: _m, action: _a, resolved_at: _r, ...r }: Report): Report => ({
  ...r,
  reporter: { ...r.reporter, email: undefined, avatar_changed: undefined },
  target: { ...r.target, email: undefined, avatar_changed: undefined },
})
function close(r: Report, status: string, action?: string) {
  Object.assign(r, { status, action, resolved_at: new Date().toISOString() })
}
/**
 * API-066: bans, closes the other open reports on them, and cancels a live subscription unless the Cancel control
 * says Waffo fails. Again on a banned account only retries the cancel. Resolves to whether nothing is left to cancel.
 */
function banAccount(id: number) {
  const x = accountById(id)
  if (x.admin) throw new ApiError(403, "/errors/forbidden", "Admins can't ban an admin.")
  x.banned_at ??= new Date().toISOString()
  for (const r of reports) if (r.target.id === id && r.status === "open") close(r, "actioned", "ban")
  if (x.subscription?.status === "active" && controls.cancel === "ok") x.subscription = { ...x.subscription, status: "canceled" }
  return x.subscription?.status !== "active"
}

/** What a poll would bring in: a message to an offline session, so it waits for it to come online (API-031 `state`). */
export function receive() {
  setControls({ live: [...controls.live, f.incomingMessage(controls.live.length)] })
}

/** The Demo panel's shortcut past sign-in, as Dana or as the admin. */
export function skipSignIn(admin = false) {
  const a = admin ? f.adminAccount : f.account
  setMe(a)
  return a
}

/** Who owns release-team, Leo or Dana: the Demo panel switches it to show the owner's group details or a member's. */
export const releaseOwner = () => (f.groups.find((g) => g.id === RELEASE)?.owner?.id === f.account.id ? "dana" : "leo")
export function setReleaseOwner(who: "leo" | "dana") {
  const g = f.groups.find((x) => x.id === RELEASE)
  if (!g) return
  const m = g.members.find((x) => (who === "dana" ? x.id === f.account.id : x.name === "Leo"))
  if (m) changeGroup(g, { owner: { id: m.id, name: m.name } })
}
const RELEASE = 5520183
