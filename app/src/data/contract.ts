import { z } from "zod"

// What the web app reads from the server, in the server's own field names. Shapes follow
// crates/imbo-proto/src/api.rs (the `web` and `billing` sections and the types they use); meaning follows docs/DESIGN.md §8.
// One schema per response shape; the mock builds these shapes and every server response is parsed with them.

const time = z.string() // ISO 8601
const accountId = z.number() // 8 digits

/** API-004 `access`, also inside API-032. `until`: trial end, paid-through date (no grace days), or when access ended; absent for free. */
export const access = z.object({ state: z.enum(["free", "trial", "paid", "expired"]), until: time.optional() })

/** An account; `email` comes only with my own. */
export const account = z.object({ id: accountId, name: z.string(), email: z.string().optional() })
/** API-004 getMe, as called from a web login (no `device`). `access` is absent from servers older than 0.2.7. */
export const me = z.object({ account, access: access.optional() })

export const accountRef = z.object({ id: accountId, name: z.string() })
export const groupRef = z.object({ id: z.number(), name: z.string() })

/** A session as it appears on a message (`from.agent`, `to`). `to.tool` is `terminal` when it went to a terminal inbox. */
export const agentRef = z.object({ id: z.string(), short_id: z.string(), title: z.string(), tool: z.string() })

/** API-014 listMyAgents: my sessions, online or seen in the last 7 days. The terminal inbox is not one of them. */
export const myAgent = agentRef.extend({
  session_id: z.string(),
  online: z.boolean(),
  device_id: z.string().nullable(),
  device_name: z.string().optional(),
  last_online_at: time.optional(),
})

/** API-012 listContacts. A contact's sessions have no id and no computer name. `active` is false when their access ended. */
export const sessionInfo = z.object({ short_id: z.string(), title: z.string(), tool: z.string(), online: z.boolean(), last_online_at: time.optional() })
export const contact = z.object({ id: accountId, name: z.string(), sessions: z.array(sessionInfo), active: z.boolean().default(true) })

/** API-026 `file`; downloads (API-027) return 404 after `expires_at`. */
export const file = z.object({ id: z.string(), name: z.string(), size: z.number(), sha256: z.string(), expires_at: time })

/** No `agent` when sent with `imbo send` from a terminal. */
export const sender = z.object({ account_id: accountId, name: z.string(), agent: agentRef.optional() })

/** The conversation a message belongs to: `group` for group messages, `peer` (the other account) for direct ones. */
export const conversationRef = z.object({ kind: z.enum(["direct", "group"]), id: z.number(), group: groupRef.optional(), peer: accountRef.optional() })

/** API-031 / API-036 message. `reply_to` is the address to answer it: `#group`, `account/short_id`, or `account` for a terminal. */
export const message = z.object({
  id: z.number(),
  from: sender,
  conversation: conversationRef,
  body: z.string(),
  created_at: time,
  reply_to: z.string(),
  files: z.array(file).default([]),
  to: agentRef.optional(),
})

/** API-031 / API-036 response, paged with `?before=&after=&limit=50`. */
export const messagesPage = z.object({ messages: z.array(message), has_more: z.boolean() })

/** API-030 listConversations. `pending`: sent to me, not yet delivered to a session nor read in the terminal. */
export const conversation = z.object({
  id: z.number(),
  kind: z.enum(["direct", "group"]),
  peer: accountRef.optional(),
  group: groupRef.optional(),
  last_message: z.object({ id: z.number(), from: sender, preview: z.string(), created_at: time }).optional(),
  pending: z.number(),
})

/**
 * API-032 getBilling. `enabled: false`: the server has no Creem (self-hosted), and `mode` is absent.
 * `access.state` decides what the account can do; `subscription.status` is Creem's as received (`active`, `scheduled_cancel`,
 * `canceled`, `past_due`, or one this app doesn't know, shown as is) and only picks the wording.
 */
export const billing = z.object({
  enabled: z.boolean(),
  mode: z.enum(["test", "live"]).optional(),
  access,
  trial_ends_at: time.optional(),
  subscription: z.object({ plan: z.string(), status: z.string(), paid_until: time }).optional(),
})

/** Error bodies are problem+json. `type` is the stable part (`/errors/code-invalid`); `detail` is written for people. */
export const problem = z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string().optional() })

/** API-001 */
export const codeSent = z.object({ retry_after_s: z.number() })
/** API-028 */
export const webLogin = z.object({ account, new_account: z.boolean() })
/** API-009, as the web calls it: pending requests sent to me. */
export const requests = z.object({ requests: z.array(z.object({ id: z.number(), kind: z.string(), from: accountRef, status: z.string() })) })
/** API-033, API-034 */
export const checkout = z.object({ checkout_url: z.string() })
export const portal = z.object({ portal_url: z.string() })

// List responses wrap their items.
export const conversations = z.object({ conversations: z.array(conversation) })
export const myAgents = z.object({ agents: z.array(myAgent) })
export const contacts = z.object({ contacts: z.array(contact) })

export type Account = z.infer<typeof account>
export type AgentRef = z.infer<typeof agentRef>
export type MyAgent = z.infer<typeof myAgent>
export type Contact = z.infer<typeof contact>
export type FileRef = z.infer<typeof file>
export type Message = z.infer<typeof message>
export type Conversation = z.infer<typeof conversation>
export type Billing = z.infer<typeof billing>
export type MessagesPage = z.infer<typeof messagesPage>
export type Me = z.infer<typeof me>
export type WebLogin = z.infer<typeof webLogin>
