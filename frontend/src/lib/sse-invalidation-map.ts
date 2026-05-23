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

  comment: (event) => {
    const keys: (string | (string | number)[])[] = ["comment-unread-counts"]
    if (event.entity_type && event.entity_id) {
      keys.push(["comments", event.entity_type, event.entity_id])
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
    const keys: (string | (string | number)[])[] = [
      "sms-conversations",
      "sms-unread-counts",
    ]
    if (event.conversation_id) {
      keys.push(["sms-messages", event.conversation_id])
    }
    return keys
  },

  sms_conversation: () => {
    return ["sms-conversations"]
  },

  case: (event) => {
    const keys: (string | (string | number)[])[] = ["cases", "case-counts"]
    if (event.id) keys.push(["case", event.id])
    return keys
  },

  task: (event) => {
    const keys: (string | (string | number)[])[] = ["tasks"]
    if (event.id) keys.push(["task", event.id])
    if (event.case_id) keys.push(["case", event.case_id])
    return keys
  },

  event: (event) => {
    const keys: (string | (string | number)[])[] = ["events", "trial-calendar"]
    if (event.id) keys.push(["event", event.id])
    if (event.case_id) keys.push(["case", event.case_id])
    return keys
  },

  invoice: (event) => {
    const keys: (string | (string | number)[])[] = ["invoices", "invoice-stats"]
    if (event.case_id) keys.push(["case-costs", event.case_id])
    return keys
  },

  financial: (event) => {
    const keys: (string | (string | number)[])[] = ["financials", "financial-counts"]
    if (event.case_id) keys.push(["case-financial", event.case_id])
    return keys
  },

  person: () => ["persons"],

  judge: () => ["judges"],

  user: () => ["users"],
}

/**
 * Actions triggered by the server (not by a user mutation) that should
 * always invalidate, even for the user who triggered them. This covers
 * async background work like AI analysis and external syncs where the
 * initiating user's mutation handler can't predict the result.
 */
const SERVER_SIDE_ACTIONS = new Set(["analyzed", "analyzing", "analysis_failed", "synced", "received"])

export function isServerSideAction(action: string): boolean {
  return SERVER_SIDE_ACTIONS.has(action)
}
