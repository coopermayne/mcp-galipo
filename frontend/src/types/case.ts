export type CaseStatus =
  | "Signing Up"
  | "Prospective"
  | "Pre-Claim"
  | "Pre-Filing"
  | "Pleadings"
  | "Discovery"
  | "Expert Discovery"
  | "Pre-trial"
  | "Trial"
  | "Post-Trial"
  | "Appeal"
  | "Settl. Pend."
  | "Stayed"
  | "Closed"

export interface CaseListItem {
  id: number
  case_name: string
  short_name: string | null
  status: CaseStatus
  print_code: string | null
  attorney_ids: number[] | null
  paralegal_ids: number[] | null
  date_of_injury: string | null
  trial_date: string | null
  proposed_trial_dates: string[] | null
  trial_likelihood: number | null
  trial_likelihood_note: string | null
  trial_estimated_days: number | null
  claim_deadline: string | null
  complaint_deadline: string | null
  color: string | null
  judge: string | null
  case_number: string | null
  jurisdiction_name: string | null
  client_count: number | null
  defendant_count: number | null
  pending_task_count: number | null
  upcoming_event_count: number | null
}

export interface CaseDetail {
  id: number
  case_name: string
  short_name: string | null
  status: CaseStatus
  print_code: string | null
  case_summary: string | null
  result: string | null
  date_of_injury: string | null
  trial_date: string | null
  proposed_trial_dates: string[] | null
  trial_likelihood: number | null
  trial_likelihood_note: string | null
  trial_estimated_days: number | null
  claim_deadline: string | null
  complaint_deadline: string | null
  color: string | null
  attorney_ids: number[] | null
  paralegal_ids: number[] | null
  intake_id: number | null
  created_at: string | null
  updated_at: string | null
  attorneys: CaseStaffUser[]
  paralegals: CaseStaffUser[]
  persons: CasePerson[]
  events: CaseEvent[]
  tasks: CaseTask[]
  notes: string | null
  proceedings: CaseProceeding[]
  feature_toggles: CaseFeatureToggles | null
  feature_data_counts?: Record<CaseFeatureKey, number>
}

export type CaseFeatureKey = "tasks" | "events" | "financials" | "costs"

export type CaseFeatureToggles = Partial<Record<CaseFeatureKey, boolean>>

export const CASE_FEATURE_DEFINITIONS: {
  key: CaseFeatureKey
  label: string
  description: string
}[] = [
  { key: "tasks", label: "Tasks", description: "Track to-dos on this case" },
  { key: "events", label: "Events", description: "Calendar dates and deadlines" },
  { key: "financials", label: "Financials", description: "Settlement & disbursement summary" },
  { key: "costs", label: "Costs", description: "Costs/invoices link and totals" },
]

export function isCaseFeatureEnabled(
  toggles: CaseFeatureToggles | null | undefined,
  key: CaseFeatureKey
): boolean {
  return toggles?.[key] === true
}

export interface CaseStaffUser {
  id: number
  email: string
  first_name: string
  last_name: string
  initials: string
  position: string
  paralegal_id?: number | null
}

export interface CasePerson {
  id: number
  name: string
  phones: unknown[]
  emails: unknown[]
  address: string | null
  organization: string | null
  person_notes: string | null
  assignment_id: number
  role_id: number
  attributes: Record<string, unknown>
  role_notes: string | null
  is_primary: boolean | null
  grouped_under_id: number | null
  assigned_date: string | null
  assigned_at: string | null
  role: { id: number; name: string; category: string }
  grouped_under_name: string | null
}

export interface CaseEvent {
  id: number
  date: string
  time: string | null
  location: string | null
  description: string
  document_link: string | null
  calculation_note: string | null
  starred: boolean | null
}

export interface CaseTask {
  id: number
  due_date: string | null
  completion_date: string | null
  description: string
  status: string
  urgency: string | null
  event_id: number | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
  assignee_id: number | null
  event_description: string | null
}

export interface CaseProceeding {
  id: number
  case_id: number | null
  case_number: string
  jurisdiction_id: number | null
  sort_order: number | null
  is_primary: boolean | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  jurisdiction_name: string | null
  local_rules_link: string | null
  judges: { judge_id: number; name: string; role: string | null; sort_order: number | null }[]
  judge_name: string | null
  judge_id: number | null
}

export interface CaseListResponse {
  cases: CaseListItem[]
  total: number
}

export type CaseCountsResponse = Record<string, number>

export interface CaseComment {
  id: number
  case_id: number
  user_id: number
  content: string
  is_system: boolean
  detail?: Record<string, unknown> | null
  created_at: string
  user_first_name: string | null
  user_last_name: string | null
  user_initials: string | null
}

export interface CaseCommentsResponse {
  comments: CaseComment[]
  last_read_at: string | null
}

export type TaskStatus =
  | "Pending"
  | "Active"
  | "Done"
  | "Partially Done"
  | "Blocked"
  | "Awaiting Atty Review"

export type Urgency = "Low" | "Medium" | "High" | "Urgent"

export type RoleCategory =
  | "client"
  | "defendant"
  | "counsel"
  | "mediator"
  | "expert"
  | "other"
