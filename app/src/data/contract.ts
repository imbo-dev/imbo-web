import { z } from "zod"

// What the web app reads from the server, in the server's own field names. Shapes follow
// crates/imbo-proto/src/api.rs (the `web` and `billing` sections and the types they use); meaning follows docs/DESIGN.md §8.
// One schema per response shape; the mock builds these shapes and every server response is parsed with them.

const time = z.string() // ISO 8601
const accountId = z.number() // 8 digits

/** API-004 `access`, also inside API-032. `until`: trial end, paid-through date (no grace days), or when access ended; absent for free. */
export const access = z.object({ state: z.enum(["free", "trial", "paid", "expired"]), until: time.optional() })

/**
 * An account; `email` comes only with my own, `admin` only on an admin's own (ROLE-Admin). `avatar_url` is absent
 * without a picture; a server without a domain sends it relative (`/v1/avatars/<id>.jpg`, API-045).
 */
export const account = z.object({
  id: accountId,
  name: z.string(),
  email: z.string().optional(),
  avatar_url: z.string().optional(),
  admin: z.boolean().default(false),
})
/** API-004 getMe, as called from a web login (no `device`). `access` is absent from servers older than 0.2.7. */
export const me = z.object({ account, access: access.optional() })

export const accountRef = z.object({ id: accountId, name: z.string() })
export const groupRef = z.object({ id: z.number(), name: z.string() })
/** An account or group with its picture; no `avatar_url` without one, or while the account is banned. */
export const profile = z.object({ id: z.number(), name: z.string(), avatar_url: z.string().optional() })

/** A session as it appears on a message (`from.agent`, `to`). `to.tool` is `terminal` when it went to a terminal inbox. */
export const agentRef = z.object({ id: z.string(), short_id: z.string(), title: z.string(), tool: z.string() })

/**
 * API-014 listMyAgents: my sessions, online or seen in the last 7 days. The terminal inbox is not one of them.
 * `unread`: what this session sent my terminal inbox that nobody has read yet; older servers leave it out.
 * `wakeable`: offline, and what I send it from here opens it in the background on its computer (FLOW-WAKE); `wake`: the
 * latest try at that, only while it's still offline, with `detail` (one English sentence) when it failed. Servers before
 * 0.2.14 leave both out.
 */
export const myAgent = agentRef.extend({
  session_id: z.string(),
  online: z.boolean(),
  device_id: z.string().nullable(),
  device_name: z.string().optional(),
  last_online_at: time.optional(),
  unread: z.number().default(0),
  wakeable: z.boolean().default(false),
  wake: z.object({ state: z.enum(["waking", "failed"]), detail: z.string().optional(), at: time }).nullish(),
})

/**
 * API-012 listContacts. A contact's sessions have no id and no computer name. `active` is false when their access
 * ended or the account is banned. `blocked`: I blocked them (RULE-013).
 */
export const sessionInfo = z.object({ short_id: z.string(), title: z.string(), tool: z.string(), online: z.boolean(), last_online_at: time.optional() })
export const contact = z.object({
  id: accountId,
  name: z.string(),
  sessions: z.array(sessionInfo),
  active: z.boolean().default(true),
  avatar_url: z.string().optional(),
  blocked: z.boolean().default(false),
})

/** API-026 `file`; downloads (API-027) return 404 after `expires_at`. */
export const file = z.object({ id: z.string(), name: z.string(), size: z.number(), sha256: z.string(), expires_at: time })

/**
 * No `agent` when sent in person. `via`: where it was sent in person (ADR-056); left out on what a session sent and on
 * messages older than it, which read as a terminal. One this page doesn't know reads as a terminal too.
 */
export const sender = z.object({
  account_id: accountId,
  name: z.string(),
  agent: agentRef.optional(),
  via: z.enum(["terminal", "app", "web"]).optional().catch(undefined),
})

/** The conversation a message belongs to: `group` for group messages, `peer` (the other account) for direct ones. */
export const conversationRef = z.object({ kind: z.enum(["direct", "group"]), id: z.number(), group: groupRef.optional(), peer: accountRef.optional() })

/**
 * API-031 / API-036 message. `reply_to` is the address to answer it: `#group`, `account/short_id`, or `account` for a terminal.
 * `from_me`: I sent it in person, from a terminal or this page. `state`: only on what went to one of my own sessions —
 * what I sent it (API-036, API-043) or, in a chat, what reached it and isn't in it yet (API-031): `pending`, `pushed`,
 * `delivered` or `canceled`.
 */
export const message = z.object({
  id: z.number(),
  from: sender,
  conversation: conversationRef,
  body: z.string(),
  created_at: time,
  reply_to: z.string(),
  files: z.array(file).default([]),
  to: agentRef.optional(),
  from_me: z.boolean().default(false),
  state: z.string().optional(),
})

/** API-031 / API-036 response, paged with `?before=&after=&limit=50`. */
export const messagesPage = z.object({ messages: z.array(message), has_more: z.boolean() })

/** API-030 listConversations. `pending`: sent to my inbox and not read yet, here, in the App or in a terminal (REQ-104). */
export const conversation = z.object({
  id: z.number(),
  kind: z.enum(["direct", "group"]),
  peer: profile.optional(),
  group: profile.optional(),
  last_message: z.object({ id: z.number(), from: sender, preview: z.string(), created_at: time }).optional(),
  pending: z.number(),
})

/**
 * API-032 getBilling. `enabled: false`: the server has no Waffo (self-hosted), and `mode` is absent.
 * `access.state` decides what the account can do; `subscription.status` is the server's (`active`, `scheduled_cancel`,
 * `canceled`, `past_due`, or one this app doesn't know, shown as is) and only picks the wording.
 * `subscription.provider` is `waffo`, `apple`, `alipay` (a time pack) or `gift`; servers before App Store
 * subscriptions leave it out (Waffo).
 * `app_store` is only there when the server sells App Store subscriptions; the web app doesn't use it.
 * `alipay`: this server sells Alipay time packs (API-080); servers before them leave it out.
 */
export const billing = z.object({
  enabled: z.boolean(),
  mode: z.enum(["test", "live"]).optional(),
  access,
  trial_ends_at: time.optional(),
  subscription: z
    .object({ plan: z.string(), status: z.string(), paid_until: time, provider: z.string().optional() })
    .optional(),
  alipay: z.boolean().optional(),
})

/** Error bodies are problem+json. `type` is the stable part (`/errors/code-invalid`); `detail` is written for people. */
export const problem = z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string().optional() })

/** API-015 sendMessage. `terminal`: it went to the peer's terminal inbox. `inactive_members`: group members skipped. */
export const sent = z.object({
  message_id: z.number(),
  conversation: conversationRef,
  recipients: z.number(),
  terminal: z.boolean().default(false),
  inactive_members: z.number().optional(),
})
/** API-043 sendToMyAgent: the stored message, with its `state`. */
export const sentToAgent = z.object({ message })
/** API-044 markAgentRead, API-078 markConversationRead */
export const marked = z.object({ marked: z.number() })
/** API-079: a frame on the live connection, naming what changed; `all` after the server's own listener came back. */
export const changed = z.object({ type: z.literal("changed"), area: z.enum(["conversations", "agents", "contacts", "requests", "groups", "all"]) })

/**
 * API-019 listGroups: a group's members, and which of my sessions get its messages. `active` as in API-012. A member's
 * `sessions`: the ones they picked for this group's messages, listed when typing @ (REQ-107); servers before 0.2.17 leave it out.
 */
export const member = z.object({ id: accountId, name: z.string(), avatar_url: z.string().optional(), active: z.boolean().default(true), sessions: z.array(agentRef).default([]) })
export const group = z.object({
  id: z.number(),
  name: z.string(),
  owner: accountRef.nullish(),
  members: z.array(member),
  my_sessions: z.array(agentRef).default([]),
  avatar_url: z.string().optional(),
})
/** API-018, API-038, API-077: the group as it is now. */
export const groupOne = z.object({ group })
/** API-020: the invitation; its other fields aren't read. */
export const invited = z.object({ request: z.object({ id: z.number() }) })
/** API-021 */
export const groupSessions = z.object({ my_sessions: z.array(agentRef) })

/** API-045 */
export const avatar = z.object({ avatar_url: z.string() })
/** API-058, API-060: who I blocked and when. */
export const block = z.object({ account: profile, created_at: time })
export const blocked = z.object({ block })
/** API-061 */
export const reported = z.object({ report: z.object({ id: z.number(), created_at: time }) })

// Admin (API-062–070). Only ROLE-Admin gets answers; anyone else gets 404.

/** A reporter or the reported account. `email` and `avatar_changed` (picture changed since the report) come with API-063 only. */
export const reportParty = z.object({
  id: accountId,
  name: z.string(),
  avatar_url: z.string().optional(),
  banned: z.boolean(),
  email: z.string().optional(),
  avatar_changed: z.boolean().optional(),
})
/** Copied into the report when it was made. `request_note`: the note on a contact request. Files: name and size only. */
export const reportMessage = z.object({
  kind: z.string(),
  from: accountRef,
  body: z.string(),
  files: z.array(z.object({ name: z.string(), size: z.number() })).default([]),
  created_at: time,
})
/**
 * API-062 item; API-063 adds `note`, `messages`, `action` and `resolved_at`. `reason`: `spam`, `harassment`,
 * `inappropriate_avatar` or `other`. `status`: `open`, `actioned` or `dismissed`. `action`: `ban`, `remove_avatar`, `dismiss`.
 */
export const report = z.object({
  id: z.number(),
  reporter: reportParty,
  target: reportParty,
  group: groupRef.optional(),
  reason: z.string(),
  status: z.string(),
  created_at: time,
  note: z.string().optional(),
  messages: z.array(reportMessage).optional(),
  action: z.string().optional(),
  resolved_at: time.optional(),
})
export const reportsPage = z.object({ reports: z.array(report), total: z.number() })
export const reportOne = z.object({ report })
/** API-064; `subscription_canceled` and `app_store_subscription` only for `ban`. */
export const resolved = z.object({ report, subscription_canceled: z.boolean().optional(), app_store_subscription: z.boolean().optional() })
/** API-065 item. `subscription`: the latest one, absent when there's none. */
export const adminAccount = z.object({
  id: accountId,
  name: z.string(),
  email: z.string(),
  avatar_url: z.string().optional(),
  created_at: time,
  access,
  subscription: z.object({ status: z.string(), paid_until: time, provider: z.string().optional() }).optional(),
  last_active_at: time.optional(),
  banned_at: time.optional(),
  admin: z.boolean(),
})
export const adminAccountsPage = z.object({ accounts: z.array(adminAccount), total: z.number() })
export const adminAccountOne = z.object({ account: adminAccount })
/** API-066. `app_store_subscription`: it still has an App Store subscription that renews, which only it can cancel. */
export const banned = z.object({ account: adminAccount, subscription_canceled: z.boolean(), app_store_subscription: z.boolean() })
/** API-068. `days`: the last 30 Beijing-time days, oldest first; `paid` has no daily history. */
export const stats = z.object({
  accounts: z.number(),
  active_7d: z.number(),
  paid: z.number(),
  messages_today: z.number(),
  days: z.array(z.object({ date: z.string(), accounts: z.number(), active_7d: z.number(), messages: z.number() })),
})

/** API-001 */
export const codeSent = z.object({ retry_after_s: z.number() })
/** API-028 */
export const webLogin = z.object({ account, new_account: z.boolean() })
/**
 * API-009, as the web calls it: contact requests (`kind` contact, maybe with a note) and group invitations waiting for
 * me, or the ones I sent (`direction=out`, without their notes).
 */
export const request = z.object({
  id: z.number(),
  kind: z.string(),
  from: accountRef,
  to: accountRef,
  group: groupRef.optional(),
  note: z.string().optional(),
  status: z.string(),
  created_at: time,
})
export const requests = z.object({ requests: z.array(request) })
/** API-008: 201 with the new request, or 200 with the contact when they had already asked me (theirs is accepted). */
export const contactAsked = z.union([z.object({ request }), z.object({ contact: accountRef })])
/** API-010: the new contact, or the group I joined (a web login picks none of my sessions for it). */
export const accepted = z.object({ contact: accountRef.optional(), group: groupRef.optional() })
/** API-011: the request, now declined; its fields aren't read. */
export const declined = z.object({ request: z.object({ id: z.number() }) })
/** API-005, API-076: my account under its new name or email. */
export const accountChanged = z.object({ account })
/** API-006: a computer signed in with `imbo login`. `current` is always false from the web. */
export const device = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  created_at: time,
  last_seen_at: time.nullish(),
  current: z.boolean().default(false),
})
export const devices = z.object({ devices: z.array(device) })
/** API-026: the uploaded file, and what the account uploaded today against the 1 GB limit. */
export const uploaded = z.object({ file, quota: z.object({ used: z.number(), limit: z.number(), resets_at: time }) })
/** API-073 */
export const agentRenamed = z.object({ agent: myAgent })
/** API-033, API-034 */
export const checkout = z.object({ checkout_url: z.string() })
export const portal = z.object({ portal_url: z.string() })
/** API-080. `purchase_url` is where to pay; it's absent when the pack was already paid for and is now recorded. */
export const alipayPack = z.object({ status: z.string(), paid_until: time.optional(), purchase_url: z.string().optional() })

// List responses wrap their items.
export const conversations = z.object({ conversations: z.array(conversation) })
export const myAgents = z.object({ agents: z.array(myAgent) })
export const contacts = z.object({ contacts: z.array(contact) })
export const groups = z.object({ groups: z.array(group) })
export const blocks = z.object({ blocks: z.array(block) })

export type Account = z.infer<typeof account>
export type AgentRef = z.infer<typeof agentRef>
export type Area = z.infer<typeof changed>["area"]
export type MyAgent = z.infer<typeof myAgent>
export type Contact = z.infer<typeof contact>
export type FileRef = z.infer<typeof file>
export type Message = z.infer<typeof message>
export type Via = NonNullable<z.infer<typeof sender>["via"]>
export type Conversation = z.infer<typeof conversation>
export type Billing = z.infer<typeof billing>
export type MessagesPage = z.infer<typeof messagesPage>
export type Me = z.infer<typeof me>
export type WebLogin = z.infer<typeof webLogin>
export type Sent = z.infer<typeof sent>
export type Profile = z.infer<typeof profile>
export type Group = z.infer<typeof group>
export type Request = z.infer<typeof request>
export type Accepted = z.infer<typeof accepted>
export type Member = z.infer<typeof member>
export type Block = z.infer<typeof block>
export type Device = z.infer<typeof device>
export type Uploaded = z.infer<typeof uploaded>
export type ContactAsked = z.infer<typeof contactAsked>
export type ReportParty = z.infer<typeof reportParty>
export type Report = z.infer<typeof report>
export type ReportMessage = z.infer<typeof reportMessage>
export type ReportsPage = z.infer<typeof reportsPage>
export type Resolved = z.infer<typeof resolved>
export type AdminAccount = z.infer<typeof adminAccount>
export type AdminAccountsPage = z.infer<typeof adminAccountsPage>
export type Banned = z.infer<typeof banned>
export type Stats = z.infer<typeof stats>
