import type { SSEEvent } from "@/types/sse"

/**
 * Maps SSE entity types to the TanStack Query keys that should be invalidated.
 *
 * Each entry returns an array of query key prefixes. The `event` is passed in
 * so keys can include the specific ID (e.g. ["intake", 42]).
 *
 * To add real-time updates for a new entity:
 *   1. Backend: add `broadcast({"entity": "case", ...})` to route handlers
 *   2. Here: add a "case" entry returning the query keys to invalidate
 */
export const INVALIDATION_MAP: Record<
  string,
  (event: SSEEvent) => (string | (string | number)[])[]
> = {
  intake: (event) => {
    const keys: (string | (string | number)[])[] = [
      "intakes",
      "intake-counts",
      "unread-counts",
    ]
    if (event.id) {
      keys.push(["intake", event.id])
    }
    return keys
  },

  intake_comment: (event) => {
    const keys: (string | (string | number)[])[] = ["unread-counts"]
    if (event.intake_id) {
      keys.push(["intake-comments", event.intake_id])
    }
    return keys
  },

  sms_message: (event) => {
    const keys: (string | (string | number)[])[] = ["sms-conversations"]
    if (event.conversation_id) {
      keys.push(["sms-messages", event.conversation_id])
    }
    return keys
  },

  sms_conversation: () => {
    return ["sms-conversations"]
  },
}

/**
 * Actions triggered by the server (not by a user mutation) that should
 * always invalidate, even for the user who triggered them. This covers
 * async background work like AI analysis and external syncs where the
 * initiating user's mutation handler can't predict the result.
 */
const SERVER_SIDE_ACTIONS = new Set(["analyzed", "analyzing", "synced", "received"])

export function isServerSideAction(action: string): boolean {
  return SERVER_SIDE_ACTIONS.has(action)
}
