import type { Billing, Contact, Conversation, FileRef, Me, MessagesPage, MyAgent, WebLogin } from "./contract"

/** Which messages to fetch: the newest page by default, or only those before or after a message number. */
export type Page = { before?: number; after?: number }
export type Plan = "monthly" | "yearly"

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
  pendingRequests(): Promise<number>
  billing(): Promise<Billing>
  checkout(plan: Plan): Promise<string>
  portal(): Promise<string>
  fileUrl(f: FileRef): string
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
