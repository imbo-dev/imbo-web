import { z } from "zod"
import * as c from "./contract"
import { t } from "@/i18n"
import { ApiError, noAnswer, type DataLayer, type Page } from "./layer"

// The server's browser API. In dev the paths stay relative and Vite proxies /v1 to imbo-server (vite.config.ts); the
// built page on app.imbo.dev calls api.imbo.dev, which allows that one origin with cookies. Every body is parsed with
// its contract schema.
const API = import.meta.env.DEV ? "" : "https://api.imbo.dev"

/** A refusal's problem+json: its `type`, and the server's `detail` to show. */
function refused(r: Response, json: unknown) {
  const p = c.problem.safeParse(json)
  const retry = Number(r.headers.get("retry-after")) || undefined
  return new ApiError(r.status, p.success ? p.data.type : "unknown", (p.success && (p.data.detail ?? p.data.title)) || noAnswer(), retry)
}

/** `body` goes as JSON, except a Blob (a picture or a file), which goes as is with its own type, or `headers` when given. */
async function call<T extends z.ZodType>(schema: T, method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<z.infer<T>> {
  let r: Response
  const raw = body instanceof Blob
  try {
    r = await fetch(API + path, {
      method,
      credentials: "include",
      headers: headers ?? (body === undefined ? undefined : { "content-type": raw ? body.type : "application/json" }),
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "network", noAnswer())
  }
  let json: unknown
  if (r.status !== 204)
    try {
      json = await r.json()
    } catch {
      // A body cut off on the way (the page navigated, the connection dropped) is no answer, not a wrong one.
      if (r.ok) throw new ApiError(0, "network", noAnswer())
    }
  if (!r.ok) throw refused(r, json)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error(`${method} ${path} doesn't match src/data/contract.ts:\n${z.prettifyError(parsed.error)}`)
    throw new ApiError(r.status, "contract", t("Imbo answered in a form this page doesn't understand. Reload to get the latest version."))
  }
  return parsed.data
}

const get = <T extends z.ZodType>(schema: T, path: string) => call(schema, "GET", path)
const none = z.undefined()
const query = (p: Page = {}) => (p.before ? `?before=${p.before}` : p.after ? `?after=${p.after}` : "")

export const online = {
  requestCode: (email) => call(c.codeSent, "POST", "/v1/auth/code", { email }),
  signIn: (email, code, name) => call(c.webLogin, "POST", "/v1/web/session", { email, code, name }),
  signOut: () => call(none, "DELETE", "/v1/web/session"),
  me: () => get(c.me, "/v1/me"),
  renameMe: async (name) => (await call(c.accountChanged, "PATCH", "/v1/me", { name })).account,
  devices: async () => (await get(c.devices, "/v1/devices")).devices,
  revokeDevice: (id) => call(none, "DELETE", `/v1/devices/${encodeURIComponent(id)}`),
  deleteAccount: () => call(none, "DELETE", "/v1/account", { confirm: "DELETE" }),
  conversations: async () => (await get(c.conversations, "/v1/conversations")).conversations,
  messages: (id, page) => get(c.messagesPage, `/v1/conversations/${id}/messages${query(page)}`),
  agents: async () => (await get(c.myAgents, "/v1/agents")).agents,
  agentMessages: (id, page) => get(c.messagesPage, `/v1/agents/${encodeURIComponent(id)}/messages${query(page)}`),
  // With their sessions seen in the last 7 days, which a chat can also send to (FLOW-WEB-CHAT S2).
  contacts: async () => (await get(c.contacts, "/v1/contacts?offline=true")).contacts,
  send: (to, body, client_msg_id, files, in_reply_to) => call(c.sent, "POST", "/v1/messages", { to, body, client_msg_id, files, in_reply_to }),
  sendToAgent: async (id, body, client_msg_id, files, in_reply_to) =>
    (await call(c.sentToAgent, "POST", `/v1/agents/${encodeURIComponent(id)}/messages`, { body, client_msg_id, files, in_reply_to })).message,
  upload: (file, sha256) =>
    call(c.uploaded, "POST", "/v1/files", file, {
      "content-type": "application/octet-stream",
      "imbo-file-name": encodeURIComponent(file.name),
      "imbo-file-sha256": sha256,
    }),
  renameAgent: async (id, title) => (await call(c.agentRenamed, "PUT", `/v1/agents/${encodeURIComponent(id)}/title`, { title })).agent,
  markRead: async (id, up_to) => (await call(c.marked, "POST", `/v1/agents/${encodeURIComponent(id)}/read`, { up_to })).marked,
  markConversationRead: async (id, up_to) => (await call(c.marked, "POST", `/v1/conversations/${id}/read`, { up_to })).marked,
  setConversationPrefs: (id, prefs) => call(c.conversationPrefs, "POST", `/v1/conversations/${id}/prefs`, prefs),
  searchConversation: (id, q) => get(c.messagesPage, `/v1/conversations/${id}/search?q=${encodeURIComponent(q)}`),
  events: (changed) => {
    // Same host as every other call: through the dev server's proxy, or api.imbo.dev, which gets the session cookie too.
    const url = `${API ? API.replace(/^http/, "ws") : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`}/v1/events`
    const waits = [1, 2, 5, 10, 30]
    let ws: WebSocket | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    let over = false
    const open = () => {
      ws = new WebSocket(url)
      ws.onopen = () => {
        // What changed while it was down was never told.
        if (tries) changed("all")
        tries = 0
      }
      ws.onmessage = (e) => {
        let frame: unknown
        try {
          frame = JSON.parse(e.data)
        } catch {
          return
        }
        const p = c.changed.safeParse(frame)
        if (p.success) changed(p.data.area)
      }
      ws.onclose = (e) => {
        if (over) return
        // 4401: the sign-in ended. Fetching again finds that out and signs this page out, which closes this for good.
        if (e.code === 4401) return changed("all")
        timer = setTimeout(open, waits[Math.min(tries++, waits.length - 1)] * 1000)
      }
    }
    open()
    return () => {
      over = true
      clearTimeout(timer)
      ws?.close()
    }
  },
  requests: async () => (await get(c.requests, "/v1/requests")).requests,
  sentRequests: async () => (await get(c.requests, "/v1/requests?direction=out")).requests,
  askContact: (to, note) => call(c.contactAsked, "POST", "/v1/contacts/requests", { ...to, note: note || undefined }),
  removeContact: (id) => call(none, "DELETE", `/v1/contacts/${id}`),
  contactShare: (id) => get(c.contactShare, `/v1/contacts/${id}/share`),
  setContactShare: (id, share, devices, sessions) => call(c.contactShare, "PUT", `/v1/contacts/${id}/share`, share === "chosen" ? { share, devices, sessions } : { share }),
  accept: (id) => call(c.accepted, "POST", `/v1/requests/${id}/accept`, {}),
  decline: async (id) => void (await call(c.declined, "POST", `/v1/requests/${id}/decline`)),
  billing: () => get(c.billing, "/v1/billing"),
  checkout: async (plan) => (await call(c.checkout, "POST", "/v1/billing/checkout", { plan })).checkout_url,
  portal: async () => (await call(c.portal, "POST", "/v1/billing/portal")).portal_url,
  alipayPack: async (plan) => (await call(c.alipayPack, "POST", "/v1/billing/alipay", { plan })).purchase_url,
  alipayCheck: (out_trade_no) => call(c.alipayCheck, "POST", "/v1/billing/alipay/check", { out_trade_no }),
  // The response carries Content-Disposition: attachment, so a plain link downloads it.
  fileUrl: (f) => `${API}/v1/files/${encodeURIComponent(f.id)}`,
  // With the session cookie, like every other call. Read piece by piece when someone watches how far it got: the share
  // of Content-Length, or of the size the message gave when there's none.
  fileBytes: async (f, signal, progress) => {
    try {
      const r = await fetch(`${API}/v1/files/${encodeURIComponent(f.id)}`, { credentials: "include", signal })
      if (!r.ok) throw refused(r, await r.json().catch(() => undefined))
      if (!progress || !r.body) return await r.blob()
      const total = Number(r.headers.get("content-length")) || f.size
      const reader = r.body.getReader()
      const parts: Uint8Array<ArrayBuffer>[] = []
      for (let got = 0; ; ) {
        const { done, value } = await reader.read()
        if (done) return new Blob(parts)
        parts.push(value)
        got += value.length
        progress(Math.min(1, got / total))
      }
    } catch (e) {
      if (e instanceof ApiError || signal?.aborted) throw e
      throw new ApiError(0, "network", noAnswer())
    }
  },
  groups: async () => (await get(c.groups, "/v1/groups")).groups,
  createGroup: async (name, sessions) => (await call(c.groupOne, "POST", "/v1/groups", { name, sessions })).group,
  renameGroup: async (id, name) => (await call(c.groupOne, "PATCH", `/v1/groups/${id}`, { name })).group,
  setGroupAvatar: async (id, picture) => (await call(c.avatar, "PUT", `/v1/groups/${id}/avatar`, picture)).avatar_url,
  removeGroupAvatar: (id) => call(none, "DELETE", `/v1/groups/${id}/avatar`),
  leaveGroup: (id) => call(none, "DELETE", `/v1/groups/${id}/members/me`),
  removeMember: (id, account_id) => call(none, "DELETE", `/v1/groups/${id}/members/${account_id}`),
  transferGroup: async (id, account_id) => (await call(c.groupOne, "PUT", `/v1/groups/${id}/owner`, { account_id })).group,
  dissolveGroup: (id) => call(none, "DELETE", `/v1/groups/${id}`),
  invite: async (id, account_id) => void (await call(c.invited, "POST", `/v1/groups/${id}/invites`, { account_id })),
  setGroupSessions: async (id, sessions) => (await call(c.groupSessions, "PUT", `/v1/groups/${id}/sessions`, { sessions })).my_sessions,
  requestEmailChange: (email) => call(c.codeSent, "POST", "/v1/me/email/code", { email }),
  changeEmail: async (email, code) => (await call(c.accountChanged, "POST", "/v1/me/email", { email, code })).account,
  setAvatar: async (picture) => (await call(c.avatar, "PUT", "/v1/me/avatar", picture)).avatar_url,
  removeAvatar: () => call(none, "DELETE", "/v1/me/avatar"),
  avatarUrl: (url) => (url.startsWith("/") ? API + url : url),
  block: async (account_id) => (await call(c.blocked, "POST", "/v1/blocks", { account_id })).block,
  unblock: (id) => call(none, "DELETE", `/v1/blocks/${id}`),
  blocks: async () => (await get(c.blocks, "/v1/blocks")).blocks,
  report: async (account_id, reason, note, group_id) =>
    (await call(c.reported, "POST", "/v1/reports", { account_id, reason, note: note || undefined, group_id })).report.id,
  admin: {
    reports: (status, page) => get(c.reportsPage, `/v1/admin/reports?status=${status}&page=${page}`),
    report: async (id) => (await get(c.reportOne, `/v1/admin/reports/${id}`)).report,
    resolve: (id, action) => call(c.resolved, "POST", `/v1/admin/reports/${id}/resolve`, { action }),
    accounts: (q, page) => get(c.adminAccountsPage, `/v1/admin/accounts?${new URLSearchParams({ ...(q && { q }), page: String(page) })}`),
    ban: (id) => call(c.banned, "POST", `/v1/admin/accounts/${id}/ban`),
    unban: async (id) => (await call(c.adminAccountOne, "DELETE", `/v1/admin/accounts/${id}/ban`)).account,
    deleteAccount: (id) => call(none, "DELETE", `/v1/admin/accounts/${id}`, { confirm: "DELETE" }),
    stats: () => get(c.stats, "/v1/admin/stats"),
  },
} satisfies DataLayer
