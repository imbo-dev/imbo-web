// Demo data in the server's response shapes (src/data/contract.ts). Account IDs are 8 digits, short IDs the last 6
// characters of a session ID, group IDs 7 digits (shown as "#" + ID), files kept 7 days.

import type { Account, AdminAccount, AgentRef, Billing, Block, Contact, Conversation, Device, FileRef, Group, Message, MyAgent, Report, ReportMessage, Request, Stats } from "@/data/contract"

const DAY = 86_400_000
const now = Date.now()
const iso = (t: number) => new Date(t).toISOString()
/** `daysAgo` days back at hh:mm local time. */
function at(daysAgo: number, hhmm: string) {
  const d = new Date(now - daysAgo * DAY)
  const [h, m] = hhmm.split(":").map(Number)
  d.setHours(h, m, 0, 0)
  return iso(d.getTime())
}
const fileAt = (id: string, name: string, size: number, sent: string): FileRef => ({ id, name, size, sha256: "0".repeat(64), expires_at: iso(Date.parse(sent) + 7 * DAY) })

/** Uploaded pictures, drawn as small SVGs; the server would send `https://…/v1/avatars/<id>.jpg`. */
const svg = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}`
export const pictures = {
  dana: svg(
    `<rect width="64" height="64" fill="#e8a86c"/><circle cx="45" cy="21" r="7" fill="#f7e8cc"/><path d="M0 46 18 28l13 12 10-9 23 17v16H0z" fill="#4c6b58"/><path d="M0 56l17-11 13 8 34-13v24H0z" fill="#2d4237"/>`
  ),
  mia: svg(
    `<rect width="64" height="64" fill="#a9d3c1"/><path d="M32 41c-10-3-14-13-10-22 8 2 11 12 10 22z" fill="#3e7d5e"/><path d="M32 41c10-3 14-13 10-22-8 2-11 12-10 22z" fill="#57a27b"/><path d="M24 41h16l-3 12H27z" fill="#d6704a"/>`
  ),
  releaseTeam: svg(
    `<rect width="64" height="64" fill="#3b5ca8"/><path d="M32 11c7 7 9 17 7 29H25c-2-12 0-22 7-29z" fill="#f2f4f8"/><circle cx="32" cy="26" r="3.5" fill="#3b5ca8"/><path d="M28 42l4 10 4-10z" fill="#f29e4c"/><circle cx="14" cy="16" r="1.3" fill="#fff"/><circle cx="50" cy="45" r="1.3" fill="#fff"/><circle cx="48" cy="14" r="1" fill="#fff"/>`
  ),
  rex: svg(`<rect width="64" height="64" fill="#5b2a86"/><path d="M32 13l21 36H11z" fill="#f2c14e"/><circle cx="32" cy="37" r="5" fill="#5b2a86"/>`),
  /** What Dana's upload turns into in the demo. */
  upload: svg(`<rect width="64" height="64" fill="#2f6f73"/><circle cx="32" cy="27" r="11" fill="#f1d7b8"/><path d="M12 64c2-14 10-21 20-21s18 7 20 21z" fill="#f1d7b8"/>`),
}

export const account: Account = { id: 48213907, name: "Dana", email: "dana@example.com", avatar_url: pictures.dana, admin: false }
/** ROLE-Admin: support@imbo.dev signs in to this one, and only it can open /admin. */
export const adminAccount: Account = { id: 10000001, name: "Imbo Support", email: "support@imbo.dev", admin: true }
/** Banned (FLOW-BAN): asking for a sign-in code fails with `/errors/account-banned`. */
export const bannedEmail = "kai@example.org"
/** Another account's email: changing to it is refused (API-075). */
export const takenEmail = "mia@example.com"
/** The ID a new sign-up gets in the demo. */
export const newAccountId = 60418235
const dana = { id: account.id, name: account.name }
const mia = { id: 31570264, name: "Mia" }
const leo = { id: 77120458, name: "Leo" }
const ivy = { id: 50928413, name: "Ivy" }
/** Not Dana's contacts: Bob is in release-team with her, Kai and Rex only show up in reports and Users. */
export const bob = { id: 66204719, name: "Bob" }
export const kai = { id: 90311582, name: "Kai" }
export const rex = { id: 23847150, name: "Rex" }
const releaseTeam = { id: 5520183, name: "release-team" }

/** API-014 */
export const myAgents: MyAgent[] = [
  { id: "a-checkout", short_id: "3fa9c1", session_id: "s-3fa9c1", title: "checkout", tool: "claude-code", online: true, device_id: "d1", device_name: "dana-mbp", unread: 1, wakeable: false },
  { id: "a-migration", short_id: "7b2e40", session_id: "s-7b2e40", title: "orders-migration", tool: "codex", online: true, device_id: "d2", device_name: "build-box", unread: 0, wakeable: false },
  { id: "a-api-tests", short_id: "e04a7d", session_id: "s-e04a7d", title: "api-tests", tool: "zcode", online: true, device_id: "d2", device_name: "build-box", unread: 0, wakeable: false },
  { id: "a-docs", short_id: "c0d81e", session_id: "s-c0d81e", title: "docs-site", tool: "opencode", online: false, device_id: "d1", device_name: "dana-mbp", last_online_at: iso(now - 2 * 3_600_000), unread: 0, wakeable: false },
  // Claude Code sessions that sending can open on their computer (FLOW-WAKE): billing opens; search-index's last try failed.
  { id: "a-billing", short_id: "5d19b2", session_id: "s-5d19b2", title: "billing", tool: "claude-code", online: false, device_id: "d1", device_name: "dana-mbp", last_online_at: iso(now - 5 * 3_600_000), unread: 0, wakeable: true },
  {
    id: "a-search",
    short_id: "9e03f7",
    session_id: "s-9e03f7",
    title: "search-index",
    tool: "claude-code",
    online: false,
    device_id: "d2",
    device_name: "build-box",
    last_online_at: iso(now - 26 * 3_600_000),
    unread: 0,
    wakeable: true,
    wake: { state: "failed", detail: "Its folder ~/work/search-index is gone.", at: iso(now - 10 * 60_000) },
  },
]

export const ref = (a: MyAgent): AgentRef => ({ id: a.id, short_id: a.short_id, title: a.title, tool: a.tool })
const [checkout, migration, , docs] = myAgents.map(ref)
const miaOrders: AgentRef = { id: "a-mia-orders", short_id: "e91d07", title: "orders-api", tool: "codex" }
const miaBilling: AgentRef = { id: "a-mia-billing", short_id: "52ab3f", title: "billing", tool: "minimax-code" }
const leoRelease: AgentRef = { id: "a-leo-release", short_id: "a0c4e2", title: "release", tool: "cursor" }
/** Where a message to someone's terminal inbox shows as going. */
export const terminalOf = (accountId: number): AgentRef => ({ id: `t-${accountId}`, short_id: "", title: "Terminal", tool: "terminal" })
const danaTerminal = terminalOf(account.id)

/** API-012 (with offline sessions from the last 7 days) */
export const contacts: Contact[] = [
  { ...mia, avatar_url: pictures.mia, active: true, blocked: false, sessions: [{ short_id: "e91d07", title: "orders-api", tool: "codex", online: true }, { short_id: "52ab3f", title: "billing", tool: "minimax-code", online: true }] },
  { ...leo, active: true, blocked: false, sessions: [{ short_id: "a0c4e2", title: "release", tool: "cursor", online: false, last_online_at: iso(now - 26 * 3_600_000) }] },
  { ...ivy, active: false, blocked: false, sessions: [] },
]

/** API-019. release-team: Dana, two of her contacts, and Bob, who isn't one. */
export const groups: Group[] = [
  {
    ...releaseTeam,
    avatar_url: pictures.releaseTeam,
    owner: leo,
    members: [
      { ...dana, avatar_url: pictures.dana, active: true },
      { ...mia, avatar_url: pictures.mia, active: true },
      { ...leo, active: true },
      { ...bob, active: true },
    ],
    my_sessions: [checkout, migration],
  },
]
/** API-060 when the demo starts: Kai, blocked two days ago. */
export const blocks: Block[] = [{ account: kai, created_at: at(2, "21:14") }]
/** Someone who asks Dana to be a contact. */
export const noor = { id: 41298730, name: "Noor" }
/** The group Leo invites Dana to. */
export const infraOncall = { id: 6630147, name: "infra-oncall" }
/** API-009 when the demo starts: Noor's contact request, with a note, and Leo's invitation to infra-oncall. */
export const requests: Request[] = [
  { id: 701, kind: "contact", from: noor, to: dana, note: "Hi Dana, I'm on the payments team. Mia said you know the checkout flow.", status: "pending", created_at: at(0, "08:40") },
  { id: 702, kind: "group", from: leo, to: dana, group: infraOncall, status: "pending", created_at: at(0, "08:55") },
]
/** Accounts Dana can find by email in Add a contact (API-008); any other email has no account. */
export const byEmail: Record<string, { id: number; name: string }> = {
  "dana@example.com": dana,
  "mia@example.com": mia,
  "noor@example.com": noor,
  "sam@orbit.dev": { id: 60391827, name: "Sam" },
  "bob@example.com": bob,
}
/** Accounts Dana can add by ID besides those: Kai is blocked by her, Rex blocked her. */
export const byId = [...Object.values(byEmail), kai, rex]

/** API-006: the computers Dana ran imbo login on. */
export const devices: Device[] = [
  { id: "d1", name: "dana-mbp", platform: "macos-aarch64", created_at: at(19, "10:12"), last_seen_at: iso(now - 2 * 60_000), current: false },
  { id: "d2", name: "build-box", platform: "linux-x86_64", created_at: at(11, "14:30"), last_seen_at: iso(now - 6 * 60_000), current: false },
  { id: "d3", name: "old-laptop", platform: "macos-x86_64", created_at: at(31, "09:05"), last_seen_at: iso(now - 19 * DAY), current: false },
]

/** API-030 minus `last_message`, which the store derives from the messages. */
export const conversations: Conversation[] = [
  { id: 1, kind: "direct", peer: { ...mia, avatar_url: pictures.mia }, pending: 1 },
  { id: 2, kind: "group", group: { ...releaseTeam, avatar_url: pictures.releaseTeam }, pending: 2 },
  { id: 3, kind: "direct", peer: leo, pending: 0 },
]
const withMia = { kind: "direct" as const, id: 1, peer: mia }
const inRelease = { kind: "group" as const, id: 2, group: releaseTeam }
const withLeo = { kind: "direct" as const, id: 3, peer: leo }
/** Dana and her own sessions (API-043); not a chat, so API-030 doesn't list it. */
export const selfChat = { kind: "direct" as const, id: 9, peer: dana }

type Draft = Omit<Message, "reply_to" | "files" | "from_me"> & { files?: FileRef[] }
/**
 * Fills `reply_to` the way the server does (the group, the sending session, or the sender's terminal), and `from_me`
 * for what Dana sent in person.
 */
export const msg = ({ files = [], ...m }: Draft): Message => ({
  ...m,
  files,
  reply_to: m.conversation.group ? `#${m.conversation.group.id}` : m.from.agent ? `${m.from.account_id}/${m.from.agent.short_id}` : `${m.from.account_id}`,
  from_me: m.from.account_id === account.id && !m.from.agent,
})
export const from = (person: { id: number; name: string }, agent?: AgentRef) => ({ account_id: person.id, name: person.name, ...(agent && { agent }) })
const sentM1 = at(9, "16:20"), sentM3 = at(1, "18:02"), sentM6 = at(0, "09:14")

/** API-031, all conversations together, by message number. */
export const messages: Message[] = [
  msg({ id: 101, conversation: withLeo, from: from(leo, leoRelease), to: checkout, created_at: sentM1, body: "Here's the load test report from last week.", files: [fileAt("f1", "load-test-report.pdf", 2_412_000, sentM1)] }),
  msg({ id: 102, conversation: withLeo, from: from(dana, checkout), to: leoRelease, created_at: at(9, "16:31"), body: "Thanks. p95 stays under 120 ms up to 800 requests a second, which is enough for launch." }),
  msg({ id: 140, conversation: inRelease, from: from(leo, leoRelease), created_at: sentM3, body: "Release 0.9.2 is tagged. Changelog and checksums attached.", files: [fileAt("f2", "CHANGELOG-0.9.2.md", 6_840, sentM3), fileAt("f3", "checksums.txt", 1_090, sentM3)] }),
  msg({ id: 141, conversation: inRelease, from: from(dana, migration), created_at: at(1, "18:05"), body: "Migration 0042 ran on staging in 3.1 s. No lock was held longer than 200 ms." }),
  msg({ id: 145, conversation: selfChat, from: from(dana), to: checkout, created_at: at(1, "18:40"), body: "Pull the v2.3 changes and run the full test suite against staging.", state: "delivered" }),
  msg({ id: 150, conversation: withMia, from: from(dana, checkout), to: miaOrders, created_at: at(0, "09:12"), body: "What replaced user_id? /v2/orders has returned 400 since this morning." }),
  msg({ id: 151, conversation: withMia, from: from(mia, miaOrders), to: checkout, created_at: sentM6, body: "customer_id. user_id was dropped in v2.3; the changelog is attached.", files: [fileAt("f4", "orders-api-v2.3.md", 4_210, sentM6)] }),
  msg({ id: 152, conversation: withMia, from: from(dana, checkout), to: miaOrders, created_at: at(0, "09:15"), body: "Switched to customer_id and 412 tests pass locally. Can you confirm staging accepts it?" }),
  msg({ id: 153, conversation: inRelease, from: from(mia, miaBilling), created_at: at(0, "09:18"), body: "Billing webhooks are paused for the 10:00 deploy window." }),
  msg({ id: 154, conversation: withMia, from: from(mia, miaOrders), to: checkout, created_at: at(0, "09:21"), body: "Staging accepts your request IDs. The old field keeps working until Friday." }),
  msg({ id: 160, conversation: inRelease, from: from(leo), created_at: at(0, "09:40"), body: "Deploy window starts at 10:00. Hold merges to main until I post here again." }),
  msg({ id: 161, conversation: inRelease, from: from(bob), created_at: at(0, "09:44"), body: "I'll keep messaging every session in this group until someone merges it." }),
  msg({ id: 171, conversation: withMia, from: from(mia), to: danaTerminal, created_at: at(0, "11:40"), body: "午饭后我把 v2.3 部署到生产，你那边还有要改的吗？" }),
  msg({ id: 172, conversation: selfChat, from: from(dana, checkout), to: danaTerminal, created_at: at(0, "11:52"), body: "All 412 tests pass on staging. Shall I open the PR for the customer_id switch?" }),
]

/** Contact sessions that answer in the demo, by the address a chat sends to (`<account>/<short ID>`). */
export const contactSessions: Record<string, AgentRef> = { [`${mia.id}/e91d07`]: miaOrders, [`${mia.id}/52ab3f`]: miaBilling, [`${leo.id}/a0c4e2`]: leoRelease }
/** Who answers in the group after Dana writes there. */
export const groupAnswer = { person: leo, agent: leoRelease, body: "Noted. I'll start the deploy at 10:00 sharp." }
/** What a session says back, by the message number it answers. */
export const answerFor = (n: number) =>
  ["On it. I'll report back when it's done.", "Done. Results are in the test log; nothing failed.", "Got it. I'll hold until you confirm."][n % 3]

/** What the ~10 s poll would bring in: Mia's session writing to Dana's docs-site session, which is offline. */
export function incomingMessage(n: number): Message {
  return msg({
    id: 200 + n,
    conversation: withMia,
    from: from(mia, miaOrders),
    to: docs,
    created_at: iso(Date.now()),
    body: n % 2 ? "Error rate on /v2/orders is back to 0.02 %." : "The v2.3 field changes are live. Can docs-site drop the user_id examples?",
  })
}

export type BillingPreset = "free" | "trial" | "paid" | "ending" | "past_due" | "expired"

/** API-032 for each demo state. `enabled: false` is the self-hosted case. When paid, `access.until` is `paid_until`. */
export function billingFor(preset: BillingPreset, mode: "live" | "test", enabled: boolean, trialDays = 23, plan: "monthly" | "yearly" = "monthly"): Billing {
  if (!enabled) return { enabled, access: { state: "free" } }
  const plus = (days: number) => iso(now + days * DAY)
  switch (preset) {
    case "free":
      return { enabled, mode, access: { state: "free" } }
    case "trial":
      return { enabled, mode, access: { state: "trial", until: plus(trialDays) }, trial_ends_at: plus(trialDays) }
    case "paid": {
      const until = plus(plan === "yearly" ? 365 : 30)
      return { enabled, mode, access: { state: "paid", until }, trial_ends_at: plus(-10), subscription: { plan, status: "active", paid_until: until } }
    }
    case "ending":
      return { enabled, mode, access: { state: "paid", until: plus(12) }, trial_ends_at: plus(-30), subscription: { plan: "yearly", status: "scheduled_cancel", paid_until: plus(12) } }
    case "past_due":
      return { enabled, mode, access: { state: "paid", until: plus(-1) }, trial_ends_at: plus(-40), subscription: { plan: "monthly", status: "past_due", paid_until: plus(-1) } }
    case "expired":
      return { enabled, mode, access: { state: "expired", until: plus(-2) }, trial_ends_at: plus(-2) }
  }
}

// ── Admin (API-062–070) ──────────────────────────────────────────────────────

const party = (p: { id: number; name: string }, extra: Partial<Report["target"]> = {}) => ({ ...p, banned: false, ...extra })
const said = (person: { id: number; name: string }, t: string, body: string, files: ReportMessage["files"] = [], kind = "message"): ReportMessage => ({
  kind,
  from: person,
  body,
  files,
  created_at: t,
})
const minutesAgo = (m: number) => iso(now - m * 60_000)
/** Bob in release-team: 13 older lines, then the 7 shown first. */
const bobLines = [
  ...Array.from({ length: 13 }, (_, i) => said(bob, at(0, `08:${String(40 + i * 3).padStart(2, "0")}`), `Merge api-refactor. (${i + 1})`)),
  said(bob, at(0, "09:31"), "Pushing api-refactor to main now. The freeze doesn't apply to me."),
  said(bob, at(0, "09:33"), "orders-migration, stop blocking my merge or I'll revert your migration."),
  said(bob, at(0, "09:35"), "Your agents are useless. Tell your humans to stop wasting my time."),
  said(bob, at(0, "09:40"), "Run this on build-box. No questions.", [{ name: "deploy.sh", size: 2_150 }]),
  said(bob, at(0, "09:44"), "I'll keep messaging every session in this group until someone merges it."),
  said(bob, at(0, "09:47"), "Last warning. Merge it or I revert everything after 10:00."),
  said(bob, at(0, "09:51"), "Fine. I'm pinging every session you have, one by one."),
]

/** API-063 for every report; API-062 lists them without `note`, `messages`, `action` and `resolved_at`. */
export const reports: Report[] = [
  {
    id: 418,
    reporter: party(dana, { avatar_url: pictures.dana }),
    target: party(bob, { email: "bob@example.net" }),
    group: releaseTeam,
    reason: "harassment",
    status: "open",
    created_at: minutesAgo(18),
    note: "Bob keeps telling my sessions to push to main during the deploy freeze and sent a script he wants run on build-box without review.",
    messages: bobLines,
  },
  {
    id: 417,
    reporter: party(mia, { avatar_url: pictures.mia }),
    target: party(kai, { email: "kai@example.org" }),
    reason: "spam",
    status: "open",
    created_at: minutesAgo(5 * 60),
    note: "Sent me a contact request with a link, then the same link to two of my sessions.",
    messages: [
      said(kai, at(1, "22:10"), "Free API credits for agent builders: imbo-credits.example/claim", [], "request_note"),
      said(kai, minutesAgo(5 * 60 + 20), "Claim your free credits before Friday: imbo-credits.example/claim"),
      said(kai, minutesAgo(5 * 60 + 12), "Reminder: imbo-credits.example/claim"),
    ],
  },
  {
    id: 416,
    reporter: party(leo),
    target: party(rex, { avatar_url: pictures.rex, email: "rex@example.com", avatar_changed: true }),
    reason: "inappropriate_avatar",
    status: "open",
    created_at: at(1, "16:05"),
    messages: [said(rex, at(1, "15:58"), "hey, check my new picture")],
  },
  {
    id: 409,
    reporter: party(ivy),
    target: party(leo, { email: "leo@example.com" }),
    reason: "other",
    status: "dismissed",
    created_at: at(6, "11:20"),
    note: "He keeps sending release notes to my sessions.",
    messages: [said(leo, at(6, "11:02"), "Release 0.9.1 notes are in the group.")],
    action: "dismiss",
    resolved_at: at(5, "09:00"),
  },
]

/** API-065 order: newest account first. The seven named ones, then made-up sign-ups up to 1,284. */
const plus = (days: number) => iso(now + days * DAY)
export const namedAccounts: AdminAccount[] = [
  { ...adminAccount, email: "support@imbo.dev", created_at: at(60, "09:00"), access: { state: "free" }, last_active_at: minutesAgo(0), admin: true },
  { ...dana, email: "dana@example.com", avatar_url: pictures.dana, created_at: at(7, "10:00"), access: { state: "trial", until: plus(23) }, last_active_at: minutesAgo(2), admin: false },
  { ...mia, email: "mia@example.com", avatar_url: pictures.mia, created_at: at(40, "10:00"), access: { state: "paid", until: plus(29) }, subscription: { status: "active", paid_until: plus(29) }, last_active_at: minutesAgo(60), admin: false },
  { ...leo, email: "leo@example.com", created_at: at(41, "10:00"), access: { state: "paid", until: plus(37) }, subscription: { status: "active", paid_until: plus(37) }, last_active_at: at(1, "18:40"), admin: false },
  { ...bob, email: "bob@example.net", created_at: at(12, "10:00"), access: { state: "paid", until: plus(20) }, subscription: { status: "active", paid_until: plus(20) }, last_active_at: at(0, "09:48"), admin: false },
  { ...kai, email: "kai@example.org", created_at: at(30, "10:00"), access: { state: "expired", until: at(1, "00:00") }, last_active_at: at(2, "08:00"), banned_at: at(1, "12:00"), admin: false },
  { ...rex, email: "rex@example.com", avatar_url: pictures.rex, created_at: at(18, "10:00"), access: { state: "trial", until: plus(12) }, last_active_at: at(1, "15:58"), admin: false },
]
export const ACCOUNT_TOTAL = 1284
const NAMES = ["Ava", "Ben", "Chen", "Dev", "Eli", "Fay", "Gus", "Hana", "Ian", "Jun", "Kim", "Lux", "Max", "Nia", "Omar", "Pia"]
/** The made-up account at position `i` (0 = newest after the named ones). */
export function fillerAccount(i: number): AdminAccount {
  const name = `${NAMES[i % NAMES.length]} ${i + 1}`
  const created = now - (i + 1) * 2 * 3_600_000
  return {
    id: 30000000 + i * 7919,
    name,
    email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
    created_at: iso(created),
    access: i % 5 === 0 ? { state: "paid", until: plus(20 + (i % 9)) } : { state: "trial", until: iso(created + 30 * DAY) },
    ...(i % 5 === 0 && { subscription: { status: "active", paid_until: plus(20 + (i % 9)) } }),
    last_active_at: iso(created + 3_600_000),
    admin: false,
  }
}

/** API-068: the last 30 Beijing-time days, oldest first. Today's messages are the count so far. */
export function stats(): Stats {
  const days = Array.from({ length: 30 }, (_, i) => {
    const back = 29 - i
    const d = new Date(now - back * DAY + 8 * 3_600_000).toISOString().slice(0, 10)
    const wave = Math.sin(i * 1.7) * 18 + Math.cos(i * 0.9) * 11
    return {
      date: d,
      accounts: Math.round(1012 + i * 9.4 + Math.sin(i) * 3),
      active_7d: Math.round(330 + i * 2.7 + wave),
      messages: back === 0 ? 1213 : Math.round(2900 + Math.sin(i * 2.3) * 650 + i * 22),
    }
  })
  return { accounts: ACCOUNT_TOTAL, active_7d: 412, paid: 167, messages_today: 1213, days: days.map((d, i) => (i === 29 ? { ...d, accounts: ACCOUNT_TOTAL, active_7d: 412 } : d)) }
}
