// Demo data in the server's response shapes (src/data/contract.ts). Account IDs are 8 digits, short IDs the last 6
// characters of a session ID, group IDs 7 digits (shown as "#" + ID), files kept 7 days.

import type { Account, AgentRef, Billing, Contact, Conversation, FileRef, Message, MyAgent } from "@/data/contract"

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

export const account: Account = { id: 48213907, name: "Dana", email: "dana@example.com" }
/** The ID a new sign-up gets in the demo. */
export const newAccountId = 60418235
const dana = { id: account.id, name: account.name }
const mia = { id: 31570264, name: "Mia" }
const leo = { id: 77120458, name: "Leo" }
const releaseTeam = { id: 5520183, name: "release-team" }

/** API-014 */
export const myAgents: MyAgent[] = [
  { id: "a-checkout", short_id: "3fa9c1", session_id: "s-3fa9c1", title: "checkout", tool: "claude-code", online: true, device_id: "d1", device_name: "dana-mbp" },
  { id: "a-migration", short_id: "7b2e40", session_id: "s-7b2e40", title: "orders-migration", tool: "codex", online: true, device_id: "d2", device_name: "build-box" },
  { id: "a-api-tests", short_id: "e04a7d", session_id: "s-e04a7d", title: "api-tests", tool: "zcode", online: true, device_id: "d2", device_name: "build-box" },
  { id: "a-docs", short_id: "c0d81e", session_id: "s-c0d81e", title: "docs-site", tool: "opencode", online: false, device_id: "d1", device_name: "dana-mbp", last_online_at: iso(now - 2 * 3_600_000) },
]

const ref = (a: MyAgent): AgentRef => ({ id: a.id, short_id: a.short_id, title: a.title, tool: a.tool })
const [checkout, migration, , docs] = myAgents.map(ref)
const miaOrders: AgentRef = { id: "a-mia-orders", short_id: "e91d07", title: "orders-api", tool: "codex" }
const miaBilling: AgentRef = { id: "a-mia-billing", short_id: "52ab3f", title: "billing", tool: "minimax-code" }
const leoRelease: AgentRef = { id: "a-leo-release", short_id: "a0c4e2", title: "release", tool: "cursor" }
const danaTerminal: AgentRef = { id: "t-48213907", short_id: "", title: "Terminal", tool: "terminal" }

/** API-012 (with offline sessions from the last 7 days) */
export const contacts: Contact[] = [
  { ...mia, active: true, sessions: [{ short_id: "e91d07", title: "orders-api", tool: "codex", online: true }, { short_id: "52ab3f", title: "billing", tool: "minimax-code", online: true }] },
  { ...leo, active: true, sessions: [{ short_id: "a0c4e2", title: "release", tool: "cursor", online: false, last_online_at: iso(now - 26 * 3_600_000) }] },
  { id: 50928413, name: "Ivy", active: false, sessions: [] },
]
export const pendingRequests = 1

/** API-030 minus `last_message`, which the store derives from the messages. */
export const conversations: Conversation[] = [
  { id: 1, kind: "direct", peer: mia, pending: 1 },
  { id: 2, kind: "group", group: releaseTeam, pending: 2 },
  { id: 3, kind: "direct", peer: leo, pending: 0 },
]
const withMia = { kind: "direct" as const, id: 1, peer: mia }
const inRelease = { kind: "group" as const, id: 2, group: releaseTeam }
const withLeo = { kind: "direct" as const, id: 3, peer: leo }

type Draft = Omit<Message, "reply_to" | "files"> & { files?: FileRef[] }
/** Fills `reply_to` the way the server does: the group, the sending session, or the sender's terminal. */
const msg = ({ files = [], ...m }: Draft): Message => ({
  ...m,
  files,
  reply_to: m.conversation.group ? `#${m.conversation.group.id}` : m.from.agent ? `${m.from.account_id}/${m.from.agent.short_id}` : `${m.from.account_id}`,
})
const from = (person: { id: number; name: string }, agent?: AgentRef) => ({ account_id: person.id, name: person.name, ...(agent && { agent }) })
const sentM1 = at(9, "16:20"), sentM3 = at(1, "18:02"), sentM6 = at(0, "09:14")

/** API-031, all conversations together, by message number. */
export const messages: Message[] = [
  msg({ id: 101, conversation: withLeo, from: from(leo, leoRelease), to: checkout, created_at: sentM1, body: "Here's the load test report from last week.", files: [fileAt("f1", "load-test-report.pdf", 2_412_000, sentM1)] }),
  msg({ id: 102, conversation: withLeo, from: from(dana, checkout), to: leoRelease, created_at: at(9, "16:31"), body: "Thanks. p95 stays under 120 ms up to 800 requests a second, which is enough for launch." }),
  msg({ id: 140, conversation: inRelease, from: from(leo, leoRelease), created_at: sentM3, body: "Release 0.9.2 is tagged. Changelog and checksums attached.", files: [fileAt("f2", "CHANGELOG-0.9.2.md", 6_840, sentM3), fileAt("f3", "checksums.txt", 1_090, sentM3)] }),
  msg({ id: 141, conversation: inRelease, from: from(dana, migration), created_at: at(1, "18:05"), body: "Migration 0042 ran on staging in 3.1 s. No lock was held longer than 200 ms." }),
  msg({ id: 150, conversation: withMia, from: from(dana, checkout), to: miaOrders, created_at: at(0, "09:12"), body: "What replaced user_id? /v2/orders has returned 400 since this morning." }),
  msg({ id: 151, conversation: withMia, from: from(mia, miaOrders), to: checkout, created_at: sentM6, body: "customer_id. user_id was dropped in v2.3; the changelog is attached.", files: [fileAt("f4", "orders-api-v2.3.md", 4_210, sentM6)] }),
  msg({ id: 152, conversation: withMia, from: from(dana, checkout), to: miaOrders, created_at: at(0, "09:15"), body: "Switched to customer_id and 412 tests pass locally. Can you confirm staging accepts it?" }),
  msg({ id: 153, conversation: inRelease, from: from(mia, miaBilling), created_at: at(0, "09:18"), body: "Billing webhooks are paused for the 10:00 deploy window." }),
  msg({ id: 154, conversation: withMia, from: from(mia, miaOrders), to: checkout, created_at: at(0, "09:21"), body: "Staging accepts your request IDs. The old field keeps working until Friday." }),
  msg({ id: 160, conversation: inRelease, from: from(leo), created_at: at(0, "09:40"), body: "Deploy window starts at 10:00. Hold merges to main until I post here again." }),
  msg({ id: 171, conversation: withMia, from: from(mia), to: danaTerminal, created_at: at(0, "11:40"), body: "午饭后我把 v2.3 部署到生产，你那边还有要改的吗？" }),
]

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
export function billingFor(preset: BillingPreset, mode: "live" | "test", enabled: boolean, trialDays = 23): Billing {
  if (!enabled) return { enabled, access: { state: "free" } }
  const plus = (days: number) => iso(now + days * DAY)
  switch (preset) {
    case "free":
      return { enabled, mode, access: { state: "free" } }
    case "trial":
      return { enabled, mode, access: { state: "trial", until: plus(trialDays) }, trial_ends_at: plus(trialDays) }
    case "paid":
      return { enabled, mode, access: { state: "paid", until: plus(30) }, trial_ends_at: plus(-10), subscription: { plan: "monthly", status: "active", paid_until: plus(30) } }
    case "ending":
      return { enabled, mode, access: { state: "paid", until: plus(12) }, trial_ends_at: plus(-30), subscription: { plan: "yearly", status: "scheduled_cancel", paid_until: plus(12) } }
    case "past_due":
      return { enabled, mode, access: { state: "paid", until: plus(-1) }, trial_ends_at: plus(-40), subscription: { plan: "monthly", status: "past_due", paid_until: plus(-1) } }
    case "expired":
      return { enabled, mode, access: { state: "expired", until: plus(-2) }, trial_ends_at: plus(-2) }
  }
}
