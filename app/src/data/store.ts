import { useSyncExternalStore } from "react"
import type { Accepted, Account, Area, Billing, Block, Contact, ContactShare, Conversation, ConversationPrefs, Device, FileRef, Group, Message, MyAgent, Request, ShareLevel, Uploaded } from "./contract"
import { ApiError, noAnswer, type DataLayer, type Page, type Plan, type ReportReason } from "./layer"
import { online } from "./online"
import { t } from "@/i18n"
import { shrinkPicture } from "@/lib/picture"
import { navigate } from "@/lib/router"

// The only module components read data from. It loads what the pages show through the data layer, keeps it in one
// state object, and refreshes the chat and session lists and an open chat every 10 s, an open session with the session
// list every 3 s, while the tab is visible (docs/DESIGN.md「网页的界面状态」). A 401 anywhere signs the page out.

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
/**
 * `c:<conversation ID>` for a chat, `a:<agent ID>` for everything one of my sessions sent and received, `n:<account ID>`
 * for a chat with a contact that starts with the message being written (FLOW-WEB-CHAT S1).
 */
export type ThreadKey = `c:${number}` | `a:${string}` | `n:${number}`
/**
 * A message this page is sending or couldn't send. Retrying reuses `cid` (`client_msg_id`), so the server stores it
 * once. `id` is the server's message number once stored; the entry goes away when that message is in the thread.
 */
export type Outgoing = { cid: string; to: string; body: string; files: FileRef[]; status: "sending" | "failed"; error?: ApiError; id?: number; reply?: Quote }
/** What a reply shows of the message it answers (FLOW-REPLY); only `id` when I can't see that one. */
export type Quote = NonNullable<Message["quote"]>
/** A file for the next message in a thread: uploading, uploaded (`ref`), or not sendable (`error`, said for people). */
export type Attachment = { key: string; file: File; ref?: FileRef; error?: string }

export type State = {
  /** undefined until /v1/me answers, null when signed out. */
  account: Account | null | undefined
  /** The account was created by this sign-in: it goes to /welcome first. */
  isNew: boolean
  billing: Load<Billing>
  conversations: Load<Conversation[]>
  agents: Load<MyAgent[]>
  contacts: Load<Contact[]>
  /** The accounts I blocked, newest first (API-060). */
  blocks: Load<Block[]>
  /** The computers signed in with `imbo login` (API-006). */
  devices: Load<Device[]>
  /** The groups I'm in, with their members (API-019): the group header and the profile card read them. */
  groups: Load<Group[]>
  /** Per contact, which of my sessions they can see (API-081); fetched when their page opens. */
  shares: Partial<Record<number, Load<ContactShare>>>
  /** Contact requests and group invitations waiting for me (API-009). */
  requests: Request[]
  /** Contact requests I sent that are still waiting (API-009 `direction=out`). */
  outgoing: Request[]
  threads: Partial<Record<ThreadKey, Load<Thread>>>
  outbox: Partial<Record<ThreadKey, Outgoing[]>>
  /** Files attached to the message being written, per thread (FLOW-WEB-CHAT S3). */
  attachments: Partial<Record<ThreadKey, Attachment[]>>
  /** Per thread, the message the one being written replies to (FLOW-REPLY S1). */
  replying: Partial<Record<ThreadKey, Quote>>
  /** The threads whose text box is showing: only their messages offer Reply. */
  composing: Partial<Record<ThreadKey, boolean>>
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
  blocks: LOADING,
  devices: LOADING,
  groups: LOADING,
  shares: {},
  requests: [],
  outgoing: [],
  threads: {},
  outbox: {},
  attachments: {},
  replying: {},
  composing: {},
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
  return new ApiError(0, "unknown", noAnswer())
}
/** The web sign-in ended (expired, or signed out elsewhere): back to the sign-in page, which returns here after. */
function expired(e: unknown) {
  if (!(e instanceof ApiError) || e.status !== 401) return false
  stopPolling()
  set(fresh(null))
  return true
}

// ── Lists ────────────────────────────────────────────────────────────────────

type ListKey = "billing" | "conversations" | "agents" | "contacts" | "blocks" | "devices" | "groups"
const fetchers: { [K in ListKey]: () => Promise<State[K] extends Load<infer T> ? T : never> } = {
  billing: () => api.billing(),
  conversations: () => api.conversations(),
  agents: () => api.agents(),
  contacts: () => api.contacts(),
  blocks: () => api.blocks(),
  devices: () => api.devices(),
  groups: () => api.groups(),
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
  const n = turn("requests")
  try {
    const requests = await api.requests()
    if (seq.requests === n) set({ requests })
  } catch (e) {
    expired(e)
  }
}
/** Only contact requests: the group invitations I sent show in the groups' details, not here. */
async function loadSent() {
  const n = turn("outgoing")
  try {
    const sent = await api.sentRequests()
    if (seq.outgoing === n) set({ outgoing: sent.filter((r) => r.kind === "contact") })
  } catch (e) {
    expired(e)
  }
}

export const retry = (key: ListKey) => load(key)

/** API-081 for one contact; `quiet` keeps what's shown while it fetches, and through a failure. */
async function loadShare(accountId: number, quiet = false) {
  const n = turn(`share:${accountId}`)
  const shown = state.shares[accountId]?.status === "ready"
  if (!quiet || !shown) set({ shares: { ...state.shares, [accountId]: LOADING } })
  try {
    const data = await api.contactShare(accountId)
    if (seq[`share:${accountId}`] === n) set({ shares: { ...state.shares, [accountId]: ready(data) } })
  } catch (e) {
    if (seq[`share:${accountId}`] !== n || expired(e)) return
    if (!quiet || !shown) set({ shares: { ...state.shares, [accountId]: { status: "error", error: asApiError(e) } } })
  }
}
/** A contact's page opening: what they can see, fetched again each time. */
export const openShare = (accountId: number) => loadShare(accountId, true)
export const retryShare = (accountId: number) => loadShare(accountId)
/** Opening the Sessions or Contacts tab brings presence up to date; opening a group's members or its chat, who's in it. */
export function refreshList(key: "agents" | "contacts" | "blocks" | "devices" | "groups") {
  load(key, true)
  if (key === "contacts") loadRequests(), loadSent()
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

const readUpTo = new Map<ThreadKey, number>()
/**
 * An open chat or session pane counts what it shows as read; not while the tab is in the background. In a session pane
 * that takes the session's replies out of `imbo inbox` (FLOW-WEB-SEND S9); in a chat, what it sent my inbox, which takes
 * the chat's red dot away (API-078, FLOW-WEB-CHAT S1). `arrived`: new messages just came in, so the count in the list is
 * not up to date yet.
 */
async function markShown(key: ThreadKey, arrived = false) {
  const t = state.threads[key]
  if (key.startsWith("n:") || key !== openKey || document.hidden || t?.status !== "ready") return
  const chat = key.startsWith("c:")
  const id = key.slice(2)
  const last = t.data.messages.at(-1)?.id
  const c = chat ? conversationOf(state, Number(id)) : undefined
  // Marked unread counts too: opening the chat takes the mark off (FLOW-CHAT-PREFS S5).
  const unread = (chat ? (c?.pending || Number(!!c?.marked_unread)) : dataOf(state.agents)?.find((a) => a.id === id)?.unread) ?? 0
  const before = readUpTo.get(key) ?? 0
  // A chat marked unread after it was read here still has its mark to take off.
  if (last === undefined || (last <= before && !c?.marked_unread) || (!unread && !arrived)) return
  readUpTo.set(key, last)
  try {
    if (chat) {
      await api.markConversationRead(Number(id), last)
      const chats = dataOf(state.conversations)
      if (chats) set({ conversations: ready(chats.map((c) => (c.id === Number(id) ? { ...c, pending: 0, marked_unread: false } : c))) })
    } else {
      await api.markRead(id, last)
      const agents = dataOf(state.agents)
      if (agents) set({ agents: ready(agents.map((a) => (a.id === id ? { ...a, unread: 0 } : a))) })
    }
    // An answer already on its way may still carry the old count; this one replaces it.
    changed(chat ? "conversations" : "agents")
  } catch (e) {
    if (!expired(e)) readUpTo.set(key, before)
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

/**
 * Sends, then fetches the thread right away so the stored message shows in its place (FLOW-WEB-CHAT S7); to a session, the
 * session list too, which says whether sending is opening it on its computer (FLOW-WAKE).
 */
async function deliver(key: ThreadKey, o: Outgoing) {
  const files = o.files.length ? o.files.map((f) => f.id) : undefined
  try {
    if (key.startsWith("n:")) return await started(key, o, await api.send(o.to, o.body, o.cid, files))
    const id = key.startsWith("a:")
      ? (await api.sendToAgent(key.slice(2), o.body, o.cid, files, o.reply?.id)).id
      : (await api.send(o.to, o.body, o.cid, files, o.reply?.id)).message_id
    if (key.startsWith("a:")) load("agents", true)
    const t = state.threads[key]
    // A retry after a lost answer: the poll may already have brought the stored message in.
    if (t?.status === "ready" && t.data.messages.some((m) => m.id === id)) discard(key, o.cid)
    else patchOut(key, o.cid, { id }), await newer(key)
  } catch (e) {
    if (!expired(e)) patchOut(key, o.cid, { status: "failed", error: asApiError(e) })
  }
}

/** The first message to a contact made the chat: open it, where the message now is. */
async function started(key: ThreadKey, o: Outgoing, sent: { conversation: { id: number } }) {
  const id = sent.conversation.id
  for (let i = 0; i < 3 && !conversationOf(state, id); i++) await load("conversations", true)
  discard(key, o.cid)
  drafts.delete(key)
  const peer = Number(key.slice(2))
  const short = state.sendTo[-peer]
  if (short) chooseRecipient(id, short)
  if (location.pathname === `/contacts/${peer}/chat`) navigate(`/chats/${id}`, { replace: true })
}

/**
 * `to` is the API-015 address in a chat; a session pane sends to its own session and ignores it. Without `given`, the
 * uploaded attachments and the message being replied to go with it and leave the box; a failed message sent again
 * brings its own and leaves the box as it is.
 */
export function send(key: ThreadKey, to: string, body: string, given?: FileRef[], reply?: Quote) {
  const o: Outgoing = { cid: crypto.randomUUID(), to, body, files: given ?? attachedFiles(key), status: "sending", reply: given ? reply : state.replying[key] }
  set({
    outbox: { ...state.outbox, [key]: [...(state.outbox[key] ?? []), o] },
    sent: { ...state.sent, [key]: (state.sent[key] ?? 0) + 1 },
    ...(!given && { attachments: { ...state.attachments, [key]: [] }, replying: { ...state.replying, [key]: undefined } }),
  })
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
  send(key, to, o.body, o.files, o.reply)
}
export const discard = (key: ThreadKey, cid: string) => setOutbox(key, (state.outbox[key] ?? []).filter((o) => o.cid !== cid))

export const chooseRecipient = (conversationId: number, shortId?: string) => set({ sendTo: { ...state.sendTo, [conversationId]: shortId } })

/** As a reply shows the message it answers: its first 80 characters, line breaks as spaces, or its first file's name. */
export const quoteOf = (m: Message): Quote => ({
  id: m.id,
  from_name: m.from.name,
  preview: m.body ? [...m.body.replace(/\r\n?|\n/g, " ")].slice(0, 80).join("") : (m.files[0]?.name ?? ""),
})
export const replyTo = (key: ThreadKey, m: Message) => set({ replying: { ...state.replying, [key]: quoteOf(m) } })
export const stopReplying = (key: ThreadKey) => set({ replying: { ...state.replying, [key]: undefined } })
export const showingComposer = (key: ThreadKey, on: boolean) => set({ composing: { ...state.composing, [key]: on } })

/** Up to 10 more pages back until message `id` is in the thread (FLOW-REPLY S6); false when it isn't. */
export async function bringIn(key: ThreadKey, id: number) {
  for (let pages = 0; ; pages++) {
    const t = state.threads[key]
    if (t?.status !== "ready") return false
    if (t.data.messages.some((m) => m.id === id)) return true
    if (!t.data.hasMore || pages === 10) return false
    await loadOlder(key)
    const after = state.threads[key]
    if (after?.status === "ready" && after.data.older === "error") return false
  }
}

// ── Attachments ──────────────────────────────────────────────────────────────

/** What one message can carry (API-015): 20 files, 100 MB together. */
const MAX_FILES = 20
const MAX_FILES_BYTES = 104_857_600
const quotaUsed = () => t("Today's 1 GB upload limit is used up. It resets at midnight Beijing time.")

/** The day's upload use from the last upload. A refused upload can come back without its answer, so this decides first. */
let quota: Uploaded["quota"] | undefined
const attachedFiles = (key: ThreadKey) => (state.attachments[key] ?? []).flatMap((a) => (a.ref ? [a.ref] : []))
const setAttachments = (key: ThreadKey, list: Attachment[]) => set({ attachments: { ...state.attachments, [key]: list } })
const patchAttachment = (key: ThreadKey, k: string, patch: Partial<Attachment>) =>
  setAttachments(key, (state.attachments[key] ?? []).map((a) => (a.key === k ? { ...a, ...patch } : a)))

/**
 * Attaches picked files to the next message in `key` and uploads them one after another. One past 20 files, over
 * 100 MB, or past 100 MB together stays in the box with why, and isn't uploaded.
 */
export function attach(key: ThreadKey, picked: File[]) {
  const list = [...(state.attachments[key] ?? [])]
  let n = list.filter((a) => !a.error).length
  let total = list.reduce((sum, a) => sum + (a.error ? 0 : a.file.size), 0)
  for (const file of picked) {
    const error =
      n >= MAX_FILES
        ? t("Over {n} files. A message can carry {n}.", { n: MAX_FILES })
        : file.size > MAX_FILES_BYTES
          ? t("Over 100 MB. Files in one message can add up to 100 MB.")
          : total + file.size > MAX_FILES_BYTES
            ? t("Over the 100 MB the files in one message can add up to.")
            : undefined
    list.push({ key: crypto.randomUUID(), file, error })
    if (!error) (n++, (total += file.size))
  }
  setAttachments(key, list)
  uploadAll(key)
}
export const detach = (key: ThreadKey, k: string) => setAttachments(key, (state.attachments[key] ?? []).filter((a) => a.key !== k))

const uploading = new Set<ThreadKey>()
async function uploadAll(key: ThreadKey) {
  if (uploading.has(key)) return
  uploading.add(key)
  try {
    for (let a; (a = state.attachments[key]?.find((x) => !x.ref && !x.error)); ) patchAttachment(key, a.key, await uploadOne(a))
  } finally {
    uploading.delete(key)
  }
}
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("")
async function uploadOne(a: Attachment): Promise<Partial<Attachment>> {
  if (quota && Date.parse(quota.resets_at) > Date.now() && quota.used + a.file.size > quota.limit) return { error: quotaUsed() }
  let sha256: string
  try {
    sha256 = hex(await crypto.subtle.digest("SHA-256", await a.file.arrayBuffer()))
  } catch {
    return { error: t("Imbo couldn't read {name}.", { name: a.file.name }) }
  }
  try {
    const r = await api.upload(a.file, sha256)
    quota = r.quota
    return { ref: r.file }
  } catch (e) {
    expired(e)
    const err = asApiError(e)
    return { error: err.type === "/errors/upload-quota-exceeded" ? quotaUsed() : err.message }
  }
}

/** Unsent text per thread, kept while the page is open; switching chats doesn't lose it, sending clears it. */
const drafts = new Map<ThreadKey, string>()
export const draftOf = (key: ThreadKey) => drafts.get(key) ?? ""
export const keepDraft = (key: ThreadKey, text: string) => void (text ? drafts.set(key, text) : drafts.delete(key))

// ── Pictures and videos in messages (RULE-020, RULE-021) ─────────────────────

/** Extensions the page shows itself, with the type their bytes get: API-027 sends every file as octet-stream. */
const MEDIA = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["mp4", "video/mp4"],
  ["mov", "video/quicktime"],
  ["m4v", "video/x-m4v"],
  ["webm", "video/webm"],
])
const typeOf = (f: FileRef) => MEDIA.get(/\.([^.]+)$/.exec(f.name)?.[1].toLowerCase() ?? "")
/** A file the message will show as a picture, by its name (the composer's thumbnails, RULE-020). */
export const pictureName = (name: string) => typeOf({ name } as FileRef)?.startsWith("image/") ?? false
/** A picture the page shows or a video it plays, by the file's extension; an expired file is neither. */
export const mediaOf = (f: FileRef) => (fileExpired(f) ? undefined : (typeOf(f)?.split("/")[0] as "image" | "video" | undefined))
/** Pictures up to 10 MB show in the message by themselves; bigger ones when asked. */
export const PICTURE_SHOWN_BYTES = 10 * 1024 * 1024

/** Bytes fetched while the page lives, by file ID, so the thread refreshing doesn't fetch them again. */
const fetched = new Map<string, Blob>()
/** Fetches without a signal share one request. */
const inFlight = new Map<string, Promise<Blob>>()
export const fetchedFile = (f: FileRef) => fetched.get(f.id)
/**
 * API-027: a picture's or video's bytes with their type, from memory once fetched. `signal` stops it, rejecting with
 * the signal's reason; `progress` gets the share that has arrived, 0 to 1.
 */
export function fetchFile(f: FileRef, signal?: AbortSignal, progress?: (share: number) => void): Promise<Blob> {
  const done = fetched.get(f.id)
  if (done) return Promise.resolve(done)
  const shared = !signal && inFlight.get(f.id)
  if (shared) return shared
  const p = api.fileBytes(f, signal, progress).then((b) => {
    const typed = b.slice(0, b.size, typeOf(f))
    fetched.set(f.id, typed)
    return typed
  })
  if (!signal) {
    inFlight.set(f.id, p)
    const forget = () => inFlight.delete(f.id)
    p.then(forget, forget)
  }
  return p
}

// ── Picture, blocks and reports ──────────────────────────────────────────────

/** Something the page waits on: a 401 signs out; anything else comes back as an ApiError for the page to show. */
async function act<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f()
  } catch (e) {
    expired(e)
    throw asApiError(e)
  }
}

export const PICTURE_TYPES = ["image/jpeg", "image/png"]
const unreadable = () => t("Imbo can't read that image. Pick a JPEG or PNG.")

/** A file the browser can't read as a JPEG or PNG fails here like the server would. */
async function readPicture(file: Blob) {
  try {
    if (!PICTURE_TYPES.includes(file.type)) throw new Error(file.type)
    return await shrinkPicture(file)
  } catch {
    throw new ApiError(422, "/errors/image-invalid", unreadable())
  }
}
/** API-045. Throws ApiError. */
export async function uploadPicture(file: Blob) {
  const picture = await readPicture(file)
  const avatar_url = await act(() => api.setAvatar(picture))
  if (state.account) set({ account: { ...state.account, avatar_url } })
}
/** API-046 */
export async function removePicture() {
  await act(() => api.removeAvatar())
  if (state.account) set({ account: { ...state.account, avatar_url: undefined } })
}
/** An `avatar_url` as an `<img>` can load it. */
export const pictureSrc = (url?: string) => (url ? api.avatarUrl(url) : undefined)

/**
 * Blocking takes back what hadn't arrived and hides their group messages (FLOW-BLOCK S3, S5), unblocking shows those
 * again: the lists that mark the block load again, and so do the chats already loaded.
 */
function afterBlock() {
  load("blocks", true)
  load("contacts", true)
  load("conversations", true)
  const threads = { ...state.threads }
  for (const key of Object.keys(threads) as ThreadKey[]) if (key.startsWith("c:") && key !== openKey) delete threads[key]
  set({ threads })
  if (openKey?.startsWith("c:")) reloadQuietly(openKey)
}
/** The newest page again, in place of what's shown, without a skeleton in between. */
async function reloadQuietly(key: ThreadKey) {
  const n = turn(key)
  try {
    const p = await fetchPage(key)
    if (seq[key] === n) setThread(key, ready({ messages: p.messages, hasMore: p.has_more, older: "idle" }))
  } catch (e) {
    expired(e)
  }
}
/** API-058. Throws ApiError. */
export async function block(accountId: number) {
  await act(() => api.block(accountId))
  afterBlock()
}
/** API-059. Throws ApiError; someone no longer on the list (unblocked elsewhere) counts as done. */
export async function unblock(accountId: number) {
  try {
    await act(() => api.unblock(accountId))
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e
  }
  afterBlock()
}
export const isBlocked = (s: State, accountId: number) => !!dataOf(s.blocks)?.some((b) => b.account.id === accountId)

// ── Requests, groups and email ───────────────────────────────────────────────

/** The request leaves the list at once, and the lists it changes load again. A poll already out would bring it back. */
function answered(id: number) {
  turn("requests")
  set({ requests: state.requests.filter((r) => r.id !== id) })
  return Promise.all([load("contacts", true), load("groups", true), load("conversations", true)])
}
/** API-010 or API-011. Throws ApiError; a request already answered elsewhere leaves the list too. */
async function answer(r: Request, call: () => Promise<Accepted | void>) {
  let done: Accepted | void
  try {
    done = await act(call)
  } catch (e) {
    if (e instanceof ApiError && (e.type === "/errors/request-closed" || e.type === "/errors/not-found")) await answered(r.id)
    throw e
  }
  await answered(r.id)
  return done ?? {}
}
/** A joined group comes with its chat, to open. */
export async function acceptRequest(r: Request) {
  const done = await answer(r, () => api.accept(r.id))
  return { ...done, chat: done.group && (await chatOf(done.group.id)) }
}
export const declineRequest = (r: Request) => answer(r, () => api.decline(r.id))

/** Why an invitation was refused, in the App's words. */
function inviteRefusal(e: ApiError, name: string) {
  switch (e.type) {
    case "/errors/already-member":
      return t("{name} is already in this group.", { name })
    case "/errors/request-pending":
      return t("{name} already has an invitation to this group.", { name })
    case "/errors/removed-from-group":
      return t("{name} was removed from this group; only the owner can invite them back.", { name })
    case "/errors/blocked":
      return t("{name} doesn't accept your invitations.", { name })
    case "/errors/unblock-first":
      return t("You blocked {name}. Unblock them to invite them.", { name })
    case "/errors/recipient-inactive":
      return t("{name}'s account is inactive.", { name })
  }
  return `${name}: ${e.message}`
}
/** API-020 for each person, one after another. Resolves to why some were refused. */
export async function invite(groupId: number, people: { id: number; name: string }[]) {
  const refused: string[] = []
  for (const p of people)
    try {
      await act(() => api.invite(groupId, p.id))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) break
      refused.push(inviteRefusal(asApiError(e), p.name))
    }
  return refused
}
/**
 * API-018, then invitations to `people`. Resolves to the new group's chat, to open, and why invitations were refused;
 * throws ApiError when the group wasn't made.
 */
export async function createGroup(name: string, sessions: string[], people: { id: number; name: string }[]) {
  const g = await act(() => api.createGroup(name, sessions))
  const refused = await invite(g.id, people)
  const [chat] = await Promise.all([chatOf(g.id), load("groups", true)])
  return { chat, refused }
}
/** The group's chat once the chats list has it: a poll can overtake a reload and leave the list as it was. */
async function chatOf(groupId: number) {
  const find = () => dataOf(state.conversations)?.find((c) => c.group?.id === groupId)?.id
  for (let i = 0; i < 3 && !find(); i++) await load("conversations", true)
  return find()
}
/** API-021: which of my sessions get this group's messages from now on. Throws ApiError. */
export async function setGroupSessions(groupId: number, sessions: string[]) {
  const mine = await act(() => api.setGroupSessions(groupId, sessions))
  const groups = dataOf(state.groups)
  if (groups) set({ groups: ready(groups.map((g) => (g.id === groupId ? { ...g, my_sessions: mine } : g))) })
  return mine
}

/** The group as the server sent it back, in place of the one shown. */
function putGroup(g: Group) {
  const groups = dataOf(state.groups)
  if (groups) set({ groups: ready(groups.map((x) => (x.id === g.id ? g : x))) })
}
/** API-077: the chats list shows the new name too. Throws ApiError. */
export async function renameGroup(groupId: number, name: string) {
  putGroup(await act(() => api.renameGroup(groupId, name)))
  await load("conversations", true)
}
/** API-056, API-057: the group's picture in its details and in the chats list. Throw ApiError. */
export async function uploadGroupPicture(groupId: number, file: Blob) {
  const picture = await readPicture(file)
  await act(() => api.setGroupAvatar(groupId, picture))
  await Promise.all([load("groups", true), load("conversations", true)])
}
export async function removeGroupPicture(groupId: number) {
  await act(() => api.removeGroupAvatar(groupId))
  await Promise.all([load("groups", true), load("conversations", true)])
}
/** API-037. Throws ApiError. */
export async function removeMember(groupId: number, accountId: number) {
  await act(() => api.removeMember(groupId, accountId))
  const g = groupOf(state, groupId)
  if (g) putGroup({ ...g, members: g.members.filter((m) => m.id !== accountId) })
  load("groups", true)
}
/** API-038: I stay in the group as a member. Throws ApiError. */
export const transferGroup = async (groupId: number, accountId: number) => putGroup(await act(() => api.transferGroup(groupId, accountId)))
/** API-039 or API-022: the group and its chat leave the lists. Throws ApiError. */
async function gone(groupId: number, call: () => Promise<void>) {
  await act(call)
  const chat = dataOf(state.conversations)?.find((c) => c.group?.id === groupId)?.id
  const groups = dataOf(state.groups)
  const conversations = dataOf(state.conversations)
  set({
    ...(groups && { groups: ready(groups.filter((g) => g.id !== groupId)) }),
    ...(conversations && { conversations: ready(conversations.filter((c) => c.id !== chat)) }),
  })
  load("groups", true)
  load("conversations", true)
}
export const dissolveGroup = (groupId: number) => gone(groupId, () => api.dissolveGroup(groupId))
export const leaveGroup = (groupId: number) => gone(groupId, () => api.leaveGroup(groupId))

// ── Contacts and my account ──────────────────────────────────────────────────

/**
 * API-008. Resolves to the request, or to the contact when they had asked me already (their request is accepted, so
 * they're a contact at once). Throws ApiError.
 */
export async function askContact(to: { account_id: number } | { email: string }, note?: string) {
  const r = await act(() => api.askContact(to, note))
  if ("contact" in r) await Promise.all([load("contacts", true), loadRequests()])
  else await loadSent()
  return r
}
/** Pinned first, then the newest last message, as API-030 orders them. */
const byPin = (a: Conversation, b: Conversation) => Number(!!b.pinned) - Number(!!a.pinned) || (b.last_message?.id ?? 0) - (a.last_message?.id ?? 0)
function putChat(id: number, change: Partial<Conversation>) {
  const chats = dataOf(state.conversations)
  if (chats) set({ conversations: ready(chats.map((c) => (c.id === id ? { ...c, ...change } : c)).sort(byPin)) })
}
/**
 * API-085: pin, mark unread or mute a chat, mine only. The list changes at once and goes back when the server says no.
 * Throws ApiError.
 */
export async function setChatPrefs(id: number, change: Partial<ConversationPrefs>) {
  const before = conversationOf(state, id)
  if (!before) return
  turn("conversations")
  putChat(id, change)
  try {
    putChat(id, await act(() => api.setConversationPrefs(id, change)))
  } catch (e) {
    // Only what this change set goes back; another change that went through meanwhile stays.
    putChat(id, Object.fromEntries(Object.keys(change).map((k) => [k, before[k as keyof ConversationPrefs]])))
    throw e
  }
}
/** API-078 from the list: everything up to its last message, and the unread mark goes. Throws ApiError. */
export async function markChatRead(id: number) {
  const c = conversationOf(state, id)
  if (!c?.last_message) return
  turn("conversations")
  await act(() => api.markConversationRead(id, c.last_message!.id))
  putChat(id, { pending: 0, marked_unread: false })
}
/** API-086: up to 50 of the chat's messages whose text has `q`, oldest first. Throws ApiError. */
export const searchChat = (id: number, q: string) => act(() => api.searchConversation(id, q))
/** API-013: the chat stays, and says they're no longer a contact. Throws ApiError. */
export async function removeContact(accountId: number) {
  await act(() => api.removeContact(accountId))
  const contacts = dataOf(state.contacts)
  if (contacts) set({ contacts: ready(contacts.filter((p) => p.id !== accountId)) })
  load("contacts", true)
  load("conversations", true)
}
/** API-082: replaces what this contact can see; the page shows the server's answer. Throws ApiError. */
export async function setShare(accountId: number, share: ShareLevel, devices: string[] = [], sessions: string[] = []) {
  turn(`share:${accountId}`)
  const data = await act(() => api.setContactShare(accountId, share, devices, sessions))
  set({ shares: { ...state.shares, [accountId]: ready(data) } })
  return data
}
/** API-005: the page shows the new name at once. Throws ApiError. */
export async function renameMe(name: string) {
  const a = await act(() => api.renameMe(name))
  if (state.account) set({ account: { ...state.account, name: a.name } })
}
/** API-073: an empty title goes back to the tool's. Throws ApiError. */
export async function renameAgent(agentId: string, title: string) {
  const x = await act(() => api.renameAgent(agentId, title))
  const agents = dataOf(state.agents)
  if (agents) set({ agents: ready(agents.map((a) => (a.id === agentId ? { ...a, title: x.title } : a))) })
  // An answer already on its way may still carry the old title; this one replaces it.
  load("agents", true)
}
/** API-007: its sessions go offline with it. Throws ApiError. */
export async function revokeDevice(id: string) {
  await act(() => api.revokeDevice(id))
  const devices = dataOf(state.devices)
  if (devices) set({ devices: ready(devices.filter((d) => d.id !== id)) })
  load("agents", true)
}
/** API-052: then this page is signed out too. Throws ApiError. */
export async function deleteAccount() {
  await act(() => api.deleteAccount())
  stopPolling()
  navigate("/login", { replace: true })
  set(fresh(null))
}

/** API-075: a code to the new email. Throws ApiError. */
export const requestEmailChange = (email: string) => act(() => api.requestEmailChange(email))
/** API-076: the account shows the new email at once. Throws ApiError. */
export async function changeEmail(email: string, code: string) {
  const a = await act(() => api.changeEmail(email, code))
  if (state.account) set({ account: { ...state.account, email: a.email } })
  return a
}

/** API-061. Resolves to the report's number; throws ApiError (409 `/errors/already-reported` among them). */
export const report = (accountId: number, reason: ReportReason, note?: string, groupId?: number) =>
  act(() => api.report(accountId, reason, note, groupId))

/** API-062 to API-070, for the admin pages: what they show stays in the pages. A 401 signs out here too. */
export const admin: DataLayer["admin"] = {
  reports: (status, page) => act(() => api.admin.reports(status, page)),
  report: (id) => act(() => api.admin.report(id)),
  resolve: (id, action) => act(() => api.admin.resolve(id, action)),
  accounts: (q, page) => act(() => api.admin.accounts(q, page)),
  ban: (id) => act(() => api.admin.ban(id)),
  unban: (id) => act(() => api.admin.unban(id)),
  deleteAccount: (id) => act(() => api.admin.deleteAccount(id)),
  stats: () => act(() => api.admin.stats()),
}

// ── Keeping up ───────────────────────────────────────────────────────────────

/** Fetches an area again: conversations take the open chat or session pane's messages along; groups, any open details. */
function refetch(area: Area) {
  if (area === "all") return void (["conversations", "agents", "contacts", "requests", "groups"] as const).forEach(refetch)
  if (area === "requests") return void (loadRequests(), loadSent())
  const loaded = load(area, true)
  // What a contact can see changed here or in another tab, or one of my sessions messaged them (RULE-019). Not for someone
  // no longer a contact: the server refuses.
  if (area === "contacts")
    void loaded.then(() => {
      const contacts = dataOf(state.contacts)
      for (const id of Object.keys(state.shares).map(Number)) if (!contacts || contacts.some((p) => p.id === id)) loadShare(id, true)
    })
  if (area === "conversations" && openKey && !openKey.startsWith("n:")) newer(openKey)
}
// Areas fetched in the last second, and whether they changed again since.
const settling = new Map<Area, boolean>()
// Areas that changed while the tab was in the background, fetched once it's back.
const missed = new Set<Area>()
/**
 * Something in an area changed (API-079, or a poll asks): fetch it again at once, then at most once a second; changes
 * within that second make one more fetch after it. A tab in the background only notes the area.
 */
function changed(area: Area) {
  if (!state.account) return
  if (document.hidden) return void missed.add(area)
  if (settling.has(area)) return void settling.set(area, true)
  settling.set(area, false)
  refetch(area)
  setTimeout(() => {
    const again = settling.get(area)
    settling.delete(area)
    if (again) changed(area)
  }, 1000)
}

// The server says what changed as it happens (FLOW-LIVE); the polls below stay as a fallback while it's not connected.
let live: (() => void) | undefined
let timer: ReturnType<typeof setInterval> | undefined
let fastTimer: ReturnType<typeof setInterval> | undefined
function tick() {
  if (document.hidden || !state.account) return
  changed("conversations")
  load("agents", true)
  loadRequests()
}
/**
 * An open session pane shows replies and delivery states within 3 s (FLOW-WEB-SEND S8), and whether sending is opening it
 * on its computer (FLOW-WAKE).
 */
function fast() {
  if (document.hidden || !state.account) return
  if (!openKey?.startsWith("a:")) return
  newer(openKey)
  load("agents", true)
}
function startPolling() {
  stopPolling()
  live = api.events(changed)
  timer = setInterval(tick, 10_000)
  fastTimer = setInterval(fast, 3_000)
}
function stopPolling() {
  live?.()
  clearInterval(timer)
  clearInterval(fastTimer)
  live = timer = fastTimer = undefined
}
// Paused in a background tab; catches up as soon as it's visible again, and counts what the open pane shows as read.
document.addEventListener("visibilitychange", () => {
  tick(), fast(), openKey && markShown(openKey)
  // A fetch that's just started covers what changed before it.
  if (!document.hidden) missed.forEach((area) => settling.has(area) || changed(area)), missed.clear()
})

// ── Session ──────────────────────────────────────────────────────────────────

/** Signed in: load everything the tabs and the top bar show. */
export function begin(account: Account, isNew = false) {
  drafts.clear()
  readUpTo.clear()
  quota = undefined
  set(fresh(account, isNew))
  for (const key of Object.keys(fetchers) as ListKey[]) load(key)
  loadRequests()
  loadSent()
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

export const PRICES = { monthly: "$2", yearly: "$20" } as const
/** API-080: what an Alipay time pack costs. */
export const ALIPAY_PRICES = { monthly: "¥15", yearly: "¥150" } as const

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Back from Waffo: the payment notice can lag behind, so ask every 3 s for up to 60 s (FLOW-SUBSCRIBE S6). */
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
 * Throws ApiError when the server refuses. Resolves true when the page is leaving for Waffo; a path instead of a
 * payment page means there is none to go to (the demo), so it waits for the payment notice right here.
 */
export async function checkout(plan: Plan) {
  const url = await api.checkout(plan)
  if (!url.startsWith("/")) return location.assign(url), true
  watchCheckout()
  return false
}
export const portalUrl = () => api.portal()

/** API-080: leaves for Alipay's cashier. Throws ApiError when the server refuses. */
export async function alipayPack(plan: Plan) {
  location.assign(await api.alipayPack(plan))
}

/**
 * Back from Alipay's cashier with the order number: the server looks the order up (API-084). Not recorded yet, or
 * Alipay not answering, it waits for the payment notice as after Waffo (FLOW-ALIPAY-PACK S6).
 */
export async function watchAlipay(outTradeNo: string) {
  set({ checkout: "waiting" })
  try {
    if ((await api.alipayCheck(outTradeNo)).status === "granted") {
      set({ billing: ready(await api.billing()), checkout: undefined })
      return
    }
  } catch (e) {
    if (expired(e)) return
  }
  watchCheckout()
}

// ── Reading the state ────────────────────────────────────────────────────────

export const dataOf = <T>(l: Load<T>) => (l.status === "ready" ? l.data : undefined)
export const isMe = (s: State, accountId: number) => accountId === s.account?.id
export const fileExpired = (f: FileRef) => Date.now() > Date.parse(f.expires_at)
export const fileUrl = (f: FileRef) => api.fileUrl(f)
export const conversationTitle = (c: Conversation) => c.group?.name ?? c.peer?.name ?? String(c.id)

/** What the Chats tab counts: muted chats left out (FLOW-CHAT-PREFS S3). */
export const pendingTotal = (s: State) => (dataOf(s.conversations) ?? []).reduce((n, c) => n + (c.muted ? 0 : c.pending), 0)
/** Replies from my sessions to my terminal inbox that nobody has read yet (API-014 `unread`). */
export const unreadTotal = (s: State) => (dataOf(s.agents) ?? []).reduce((n, a) => n + a.unread, 0)
export const conversationOf = (s: State, id: number) => dataOf(s.conversations)?.find((c) => c.id === id)
export const conversationWith = (s: State, accountId: number) =>
  dataOf(s.conversations)?.find((c) => c.kind === "direct" && c.peer?.id === accountId)?.id

export const contactOf = (s: State, accountId: number) => dataOf(s.contacts)?.find((p) => p.id === accountId)
export const groupOf = (s: State, groupId: number) => dataOf(s.groups)?.find((g) => g.id === groupId)
/** An account's picture, from wherever this page last saw it: me, a contact, a direct chat's peer or a group member. */
export const photoOf = (s: State, accountId: number) =>
  isMe(s, accountId)
    ? s.account?.avatar_url
    : (contactOf(s, accountId)?.avatar_url ??
      dataOf(s.conversations)?.find((c) => c.peer?.id === accountId)?.peer?.avatar_url ??
      dataOf(s.groups)?.flatMap((g) => g.members).find((m) => m.id === accountId)?.avatar_url)
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

/**
 * Who a one-to-one message went to. `to` names the session but not its owner: the peer when I sent it, otherwise me.
 * `inbox`: it went to the owner's inbox, not to a session.
 */
export function recipientOf(s: State, m: Message) {
  if (!m.to) return undefined
  const owner = isMe(s, m.from.account_id) ? m.conversation.peer?.name : s.account?.name
  return { owner: owner ?? "", title: m.to.title, inbox: m.to.tool === "terminal" }
}
