import { t } from "@/i18n"
import type {
  Accepted,
  Account,
  AdminAccount,
  AdminAccountsPage,
  AgentRef,
  AlipayCheck,
  Area,
  Banned,
  Billing,
  Block,
  Contact,
  ContactAsked,
  ContactShare,
  Conversation,
  Device,
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
  ShareLevel,
  Stats,
  Uploaded,
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
  /** API-005: 1 to 32 characters. */
  renameMe(name: string): Promise<Account>
  /** API-006, API-007: the computers signed in with `imbo login`, and signing one out. */
  devices(): Promise<Device[]>
  revokeDevice(id: string): Promise<void>
  /** API-052: everything goes; the web sign-in ends with it. */
  deleteAccount(): Promise<void>
  conversations(): Promise<Conversation[]>
  messages(conversationId: number, page?: Page): Promise<MessagesPage>
  agents(): Promise<MyAgent[]>
  agentMessages(agentId: string, page?: Page): Promise<MessagesPage>
  contacts(): Promise<Contact[]>
  /**
   * API-015: `to` is `<account>` (their terminal inbox), `<account>/<short_id>` or `#<group>`. Same `clientMsgId` on
   * retry. `files`: IDs from `upload`.
   */
  send(to: string, body: string, clientMsgId: string, files?: string[]): Promise<Sent>
  /** API-043: to one of my own sessions. */
  sendToAgent(agentId: string, body: string, clientMsgId: string, files?: string[]): Promise<Message>
  /** API-026: `sha256` is the file's, 64 lowercase hex digits. */
  upload(file: File, sha256: string): Promise<Uploaded>
  /** API-073: an empty title goes back to the one from the tool. */
  renameAgent(agentId: string, title: string): Promise<MyAgent>
  /** API-044: what this session sent my terminal inbox, up to message `upTo`, counts as read. */
  markRead(agentId: string, upTo: number): Promise<number>
  /** API-078: what this chat sent my inbox, up to message `upTo`, counts as read; `imbo inbox` no longer lists it. */
  markConversationRead(conversationId: number, upTo: number): Promise<number>
  /**
   * API-079: calls `changed` with each area the server says changed, and with `all` once a dropped connection is back.
   * Returns what closes it for good.
   */
  events(changed: (area: Area) => void): () => void
  /** API-009: contact requests and group invitations waiting for me. */
  requests(): Promise<Request[]>
  /** API-009 `direction=out`: what I sent that is still waiting. */
  sentRequests(): Promise<Request[]>
  /** API-008: by account ID or by the email they sign in with. */
  askContact(to: { account_id: number } | { email: string }, note?: string): Promise<ContactAsked>
  /** API-013 */
  removeContact(accountId: number): Promise<void>
  /** API-081: which of my sessions this contact can see. */
  contactShare(accountId: number): Promise<ContactShare>
  /** API-082: replaces the whole setting; the lists count only for `chosen`. */
  setContactShare(accountId: number, share: ShareLevel, devices: string[], sessions: string[]): Promise<ContactShare>
  /** API-010, API-011 */
  accept(requestId: number): Promise<Accepted>
  decline(requestId: number): Promise<void>
  billing(): Promise<Billing>
  checkout(plan: Plan): Promise<string>
  portal(): Promise<string>
  /** API-080: Alipay's cashier page for this time pack. */
  alipayPack(plan: Plan): Promise<string>
  /** API-084: the order Alipay sent the buyer back with. */
  alipayCheck(outTradeNo: string): Promise<AlipayCheck>
  fileUrl(f: FileRef): string
  /**
   * API-027: the file's bytes, for a picture or video the page shows itself. `progress` gets the share that has
   * arrived, 0 to 1; `signal` stops the download, which then rejects with the signal's reason.
   */
  fileBytes(f: FileRef, signal?: AbortSignal, progress?: (share: number) => void): Promise<Blob>
  /** API-019: the groups I'm in, with their members. */
  groups(): Promise<Group[]>
  /** API-018: a group I own, its messages going to `sessions` (agent IDs). */
  createGroup(name: string, sessions: string[]): Promise<Group>
  /** API-020 */
  invite(groupId: number, accountId: number): Promise<void>
  /** API-021: which of my sessions get the group's messages; resolves to them. */
  setGroupSessions(groupId: number, sessions: string[]): Promise<AgentRef[]>
  /** The owner's (API-077, API-056, API-057, API-037, API-038, API-039), and leaving (API-022). */
  renameGroup(groupId: number, name: string): Promise<Group>
  setGroupAvatar(groupId: number, picture: Blob): Promise<string>
  removeGroupAvatar(groupId: number): Promise<void>
  removeMember(groupId: number, accountId: number): Promise<void>
  transferGroup(groupId: number, accountId: number): Promise<Group>
  dissolveGroup(groupId: number): Promise<void>
  leaveGroup(groupId: number): Promise<void>
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

export const noAnswer = () => t("Imbo didn't answer. Check your connection and try again.")
/** What to tell the person: the server's own wording (problem+json `detail`), or the no-answer line. */
export const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : noAnswer())
