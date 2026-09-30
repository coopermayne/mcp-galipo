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
  /** Existing event the AI judged this note to be about, if any. */
  existing_id?: number | null
}

/** The task fields the AI extracted; resent verbatim to resolve a duplicate. */
export interface TaskDraft {
  description: string
  due_date: string | null
  urgency: string
  assignee_id: number | null
  /** Existing task the AI judged this note to be about, if any. */
  existing_id?: number | null
}

/** An existing item the AI judged the note to be about. */
export interface DuplicateMatch {
  id: number
  description: string
  /** "duplicate" = same details; "differs" = same item with changed details. */
  match: "duplicate" | "differs"
  differences: Record<string, { existing: string | number | null; new: string | number }>
  date?: string
  time?: string | null
  location?: string | null
  due_date?: string | null
  urgency?: string
  assignee_id?: number | null
}

export type FieldChanges = Record<string, { existing: string | number | null; new: string | number }>

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
  | { status: "updated"; kind: "task"; task: CreatedTask; changes: FieldChanges }
  | { status: "updated"; kind: "event"; event: CreatedEvent; changes: FieldChanges }
  | { status: "needs_date"; draft: EventDraft }
  | {
      status: "possible_duplicate"
      kind: QuickKind
      draft: EventDraft | TaskDraft
      matches: DuplicateMatch[]
    }

export interface QuickCreatePayload {
  kind: QuickKind
  case_id: number
  /** Natural-language note (omit when finalizing an event draft). */
  text?: string
  /** A prior parse result (event with date filled in, or a duplicate being resolved). */
  draft?: EventDraft | TaskDraft
  /** Apply the draft's changed fields to this existing item instead of creating. */
  update_id?: number
  /** Create even though the draft matched an existing item. */
  create_anyway?: boolean
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
