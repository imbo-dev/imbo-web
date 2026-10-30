import { z } from "zod"
import * as c from "./contract"
import { ApiError, NO_ANSWER, type DataLayer, type Page } from "./layer"

// The server's browser API. In dev the paths stay relative and Vite proxies /v1 to imbo-server (vite.config.ts); the
// built page on app.imbo.dev calls api.imbo.dev, which allows that one origin with cookies. Every body is parsed with
// its contract schema.
const API = import.meta.env.DEV ? "" : "https://api.imbo.dev"

/** `body` goes as JSON, except a Blob (a picture), which goes as is with its own type. */
async function call<T extends z.ZodType>(schema: T, method: string, path: string, body?: unknown): Promise<z.infer<T>> {
  let r: Response
  const raw = body instanceof Blob
  try {
    r = await fetch(API + path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": raw ? body.type : "application/json" },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "network", NO_ANSWER)
  }
  let json: unknown
  if (r.status !== 204)
    try {
      json = await r.json()
    } catch {
      // A body cut off on the way (the page navigated, the connection dropped) is no answer, not a wrong one.
      if (r.ok) throw new ApiError(0, "network", NO_ANSWER)
    }
  if (!r.ok) {
    const p = c.problem.safeParse(json)
    const retry = Number(r.headers.get("retry-after")) || undefined
    throw new ApiError(r.status, p.success ? p.data.type : "unknown", (p.success && (p.data.detail ?? p.data.title)) || NO_ANSWER, retry)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error(`${method} ${path} doesn't match src/data/contract.ts:\n${z.prettifyError(parsed.error)}`)
    throw new ApiError(r.status, "contract", "Imbo answered in a form this page doesn't understand. Reload to get the latest version.")
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
  conversations: async () => (await get(c.conversations, "/v1/conversations")).conversations,
  messages: (id, page) => get(c.messagesPage, `/v1/conversations/${id}/messages${query(page)}`),
  agents: async () => (await get(c.myAgents, "/v1/agents")).agents,
  agentMessages: (id, page) => get(c.messagesPage, `/v1/agents/${encodeURIComponent(id)}/messages${query(page)}`),
  // With their sessions seen in the last 7 days, which a chat can also send to (FLOW-WEB-CHAT S2).
  contacts: async () => (await get(c.contacts, "/v1/contacts?offline=true")).contacts,
  send: (to, body, client_msg_id) => call(c.sent, "POST", "/v1/messages", { to, body, client_msg_id }),
  sendToAgent: async (id, body, client_msg_id) =>
    (await call(c.sentToAgent, "POST", `/v1/agents/${encodeURIComponent(id)}/messages`, { body, client_msg_id })).message,
  markRead: async (id, up_to) => (await call(c.marked, "POST", `/v1/agents/${encodeURIComponent(id)}/read`, { up_to })).marked,
  requests: async () => (await get(c.requests, "/v1/requests")).requests,
  accept: (id) => call(c.accepted, "POST", `/v1/requests/${id}/accept`, {}),
  decline: async (id) => void (await call(c.declined, "POST", `/v1/requests/${id}/decline`)),
  billing: () => get(c.billing, "/v1/billing"),
  checkout: async (plan) => (await call(c.checkout, "POST", "/v1/billing/checkout", { plan })).checkout_url,
  portal: async () => (await call(c.portal, "POST", "/v1/billing/portal")).portal_url,
  // The response carries Content-Disposition: attachment, so a plain link downloads it.
  fileUrl: (f) => `${API}/v1/files/${encodeURIComponent(f.id)}`,
  groups: async () => (await get(c.groups, "/v1/groups")).groups,
  createGroup: async (name, sessions) => (await call(c.groupCreated, "POST", "/v1/groups", { name, sessions })).group,
  invite: async (id, account_id) => void (await call(c.invited, "POST", `/v1/groups/${id}/invites`, { account_id })),
  setGroupSessions: async (id, sessions) => (await call(c.groupSessions, "PUT", `/v1/groups/${id}/sessions`, { sessions })).my_sessions,
  requestEmailChange: (email) => call(c.codeSent, "POST", "/v1/me/email/code", { email }),
  changeEmail: async (email, code) => (await call(c.emailChanged, "POST", "/v1/me/email", { email, code })).account,
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
