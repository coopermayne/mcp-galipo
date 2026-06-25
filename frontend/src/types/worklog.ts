export type WorklogStatus = "processing" | "done" | "failed"

export interface WorklogCandidate {
  source_type: "event" | "task" | "comment"
  source_id: number
  case_id: number | null
  case_name: string | null
  short_name: string | null
  description: string
  anchored_hours: number | null
  when: string | null
  already_logged: boolean
}

export interface WorklogCandidates {
  events: WorklogCandidate[]
  tasks: WorklogCandidate[]
  comments: WorklogCandidate[]
}

export interface WorklogPerson {
  id: number
  name: string
}

export interface WorklogEntry {
  id: number
  voice_log_id: number | null
  case_id: number | null
  case_name: string | null
  short_name: string | null
  case_color: string | null
  hours: number
  description: string
  raw_reference: string | null
  activity_date: string | null
  created_at: string | null
  author_id: number | null
  author_initials: string | null
  people: WorklogPerson[]
}

/** A consolidation session, used only for polling the processing state. */
export interface Worklog {
  id: number
  transcript: string | null
  log_date: string | null
  status: WorklogStatus
  error: string | null
  entries: WorklogEntry[]
}

/** The current user's editable ledger for one day. */
export interface WorklogDay {
  date: string
  total_hours: number
  entries: WorklogEntry[]
  processing_ids: number[]
}

/** Draft shape posted to /consolidate. */
export interface WorklogSelection {
  source_type: "event" | "task" | "comment"
  source_id: number
}

/** Confirmed worklog for a case, grouped by day. */
export interface WorklogByCaseDay {
  date: string
  hours: number
  entries: {
    id: number
    hours: number
    description: string
    author_id: number | null
    author_initials: string | null
    people: WorklogPerson[]
  }[]
}

export interface WorklogByCase {
  case_id: number
  total_hours: number
  days: WorklogByCaseDay[]
}

export interface WorklogByPersonEntry {
  id: number
  hours: number
  description: string
  activity_date: string | null
  case_id: number | null
  case_name: string | null
  short_name: string | null
}

export interface WorklogByPerson {
  person_id: number
  total_hours: number
  entries: WorklogByPersonEntry[]
}
