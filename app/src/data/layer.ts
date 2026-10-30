import type {
  Accepted,
  Account,
  AdminAccount,
  AdminAccountsPage,
  AgentRef,
  Banned,
  Billing,
  Block,
  Contact,
  Conversation,
  FileRef,
  Group,
  Me,
  Message,
  MessagesPage,
  MyAgent,
  Report,
  ReportsPage,
  Request,
  Resolved,
  Sent,
  Stats,
  WebLogin,
} from "./contract"

/** Which messages to fetch: the newest page by default, or only those before or after a message number. */
export type Page = { before?: number; after?: number }
export type Plan = "monthly" | "yearly"
export type ReportReason = "spam" | "harassment" | "inappropriate_avatar" | "other"
export type ResolveAction = "ban" | "remove_avatar" | "dismiss"

/**
 * Everything the app asks the server for (docs/DESIGN.md §8, as the web may call it). The normal build talks to `/v1`
 * (online.ts); `VITE_USE_MOCK=1` swaps in the demo fixtures (src/mock/layer.ts), which answer the same way.
 */
export type DataLayer = {
  requestCode(email: string): Promise<{ retry_after_s: number }>
  signIn(email: string, code: string, name?: string): Promise<WebLogin>
  signOut(): Promise<void>
  me(): Promise<Me>
  conversations(): Promise<Conversation[]>
  messages(conversationId: number, page?: Page): Promise<MessagesPage>
  agents(): Promise<MyAgent[]>
  agentMessages(agentId: string, page?: Page): Promise<MessagesPage>
  contacts(): Promise<Contact[]>
  /** API-015: `to` is `<account>` (their terminal inbox), `<account>/<short_id>` or `#<group>`. Same `clientMsgId` on retry. */
  send(to: string, body: string, clientMsgId: string): Promise<Sent>
  /** API-043: to one of my own sessions. */
  sendToAgent(agentId: string, body: string, clientMsgId: string): Promise<Message>
  /** API-044: what this session sent my terminal inbox, up to message `upTo`, counts as read. */
  markRead(agentId: string, upTo: number): Promise<number>
  /** API-009: contact requests and group invitations waiting for me. */
  requests(): Promise<Request[]>
  /** API-010, API-011 */
  accept(requestId: number): Promise<Accepted>
  decline(requestId: number): Promise<void>
  billing(): Promise<Billing>
  checkout(plan: Plan): Promise<string>
  portal(): Promise<string>
  fileUrl(f: FileRef): string
  /** API-019: the groups I'm in, with their members. */
  groups(): Promise<Group[]>
  /** API-018: a group I own, its messages going to `sessions` (agent IDs). */
  createGroup(name: string, sessions: string[]): Promise<Group>
  /** API-020 */
  invite(groupId: number, accountId: number): Promise<void>
  /** API-021: which of my sessions get the group's messages; resolves to them. */
  setGroupSessions(groupId: number, sessions: string[]): Promise<AgentRef[]>
  /** API-075: a code to the new email. API-076 checks it and changes my email. */
  requestEmailChange(email: string): Promise<{ retry_after_s: number }>
  changeEmail(email: string, code: string): Promise<Account>
  /** API-045: a JPEG or PNG up to 5 MB; resolves to the new `avatar_url`. API-046 removes it. */
  setAvatar(picture: Blob): Promise<string>
  removeAvatar(): Promise<void>
  /** A picture address as the page can load it: a server without a domain sends it relative to itself. */
  avatarUrl(url: string): string
  /** API-058, API-059, API-060 */
  block(accountId: number): Promise<Block>
  unblock(accountId: number): Promise<void>
  blocks(): Promise<Block[]>
  /** API-061: `groupId` when reporting someone from a group. */
  report(accountId: number, reason: ReportReason, note?: string, groupId?: number): Promise<number>
  admin: {
    /** API-062, 50 a page, newest first. */
    reports(status: "open" | "all", page: number): Promise<ReportsPage>
    /** API-063 */
    report(id: number): Promise<Report>
    /** API-064 */
    resolve(id: number, action: ResolveAction): Promise<Resolved>
    /** API-065: `q` is an account ID or part of an email. */
    accounts(q: string, page: number): Promise<AdminAccountsPage>
    /** API-066: again on a banned account only retries canceling the subscription. */
    ban(id: number): Promise<Banned>
    /** API-067 */
    unban(id: number): Promise<AdminAccount>
    /** API-070: banned accounts only. */
    deleteAccount(id: number): Promise<void>
    /** API-068 */
    stats(): Promise<Stats>
  }
}

/** A refused request: problem+json `type` (`/errors/…`) and the server's `detail`. Status 0 means no answer at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    message: string,
    readonly retryAfter?: number
  ) {
    super(message)
  }
}

export const NO_ANSWER = "Imbo didn't answer. Check your connection and try again."
/** What to tell the person: the server's own wording (problem+json `detail`), or the no-answer line. */
export const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : NO_ANSWER)
