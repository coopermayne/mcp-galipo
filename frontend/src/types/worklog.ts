export type WorklogStatus = "processing" | "ready" | "confirmed" | "failed"

export interface WorklogCandidate {
  source_type: "event" | "task" | "comment"
  source_id: number
  case_id: number | null
  case_name: string | null
  short_name: string | null
  description: string
  anchored_minutes: number | null
  when: string | null
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
  voice_log_id: number
  case_id: number | null
  case_name: string | null
  short_name: string | null
  minutes: number
  description: string
  raw_reference: string | null
  activity_date: string | null
  created_at: string | null
  people: WorklogPerson[]
}

export interface Worklog {
  id: number
  transcript: string | null
  log_date: string | null
  status: WorklogStatus
  error: string | null
  created_by: number | null
  created_by_name: string | null
  created_by_initials: string | null
  created_at: string | null
  confirmed_at: string | null
  entries: WorklogEntry[]
}

/** Draft shape posted to /consolidate. */
export interface WorklogSelection {
  source_type: "event" | "task" | "comment"
  source_id: number
}

/** Editable entry shape posted to /confirm. */
export interface WorklogEntryInput {
  case_id: number | null
  minutes: number
  description: string
  raw_reference: string | null
  person_ids: number[]
}

/** Confirmed worklog for a case, grouped by day. */
export interface WorklogByCaseDay {
  date: string
  minutes: number
  entries: {
    id: number
    minutes: number
    description: string
    author_id: number | null
    author_initials: string | null
    people: WorklogPerson[]
  }[]
}

export interface WorklogByCase {
  case_id: number
  total_minutes: number
  days: WorklogByCaseDay[]
}

export interface WorklogByPersonEntry {
  id: number
  minutes: number
  description: string
  activity_date: string | null
  case_id: number | null
  case_name: string | null
  short_name: string | null
}

export interface WorklogByPerson {
  person_id: number
  total_minutes: number
  entries: WorklogByPersonEntry[]
}
