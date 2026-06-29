import { apiFetch } from "@/lib/api"

export type QuickKind = "task" | "event"

/** The event fields the AI extracted; reused verbatim when finalizing a date. */
export interface EventDraft {
  description: string
  date: string | null
  time: string | null
  location: string | null
  notes: string | null
  event_type: string | null
  attendee_ids: number[]
}

export interface CreatedTask {
  id: number
  description: string
  due_date: string | null
  urgency: string
  assignee_id: number | null
}

export interface CreatedEvent {
  id: number
  description: string
  date: string
  time: string | null
  location: string | null
}

export type QuickCreateResponse =
  | { status: "created"; kind: "task"; task: CreatedTask }
  | { status: "created"; kind: "event"; event: CreatedEvent }
  | { status: "needs_date"; draft: EventDraft }

export interface QuickCreatePayload {
  kind: QuickKind
  case_id: number
  /** Natural-language note (omit when finalizing an event draft). */
  text?: string
  /** A prior event draft with the date filled in (event finalize path). */
  draft?: EventDraft
}

export async function quickCreate(
  payload: QuickCreatePayload
): Promise<QuickCreateResponse> {
  const res = await apiFetch("/api/v1/quick-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let msg = "Failed to create"
    try {
      const body = await res.json()
      msg = body?.error?.message || body?.message || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}
