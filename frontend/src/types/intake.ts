export type IntakeStatus =
  | "New"
  | "Dave Review"
  | "Needs Follow-Up"
  | "Atty Review"
  | "Needs Rejection Letter"
  | "Rejection Letter Sent"
  | "Needs Retainer"
  | "Retainer Sent"
  | "Retainer Signed"
  | "Archived"

export interface Intake {
  id: number
  submitted_on: string | null
  name: string | null
  email: string | null
  phone: string | null
  case_type: string | null
  incident_date: string | null
  incident_time: string | null
  location: string | null
  incident_description: string | null
  injury_description: string | null
  disclaimer_accepted: boolean | null
  status: IntakeStatus
  contact_relationship: string | null
  referral_name: string | null
  referral_org: string | null
  referral_email: string | null
  referral_phone: string | null
  notes: string | null
  ai_summary: string | null
  ai_rating: number | null
  ai_rating_reasoning: string | null
  location_short: string | null
  ai_analyzing: boolean
  google_row_number: number | null
  created_at: string | null
  updated_at: string | null
  has_comment_since_status_change: boolean
}

export interface IntakeComment {
  id: number
  intake_id: number
  user_id: number
  content: string
  is_system: boolean
  created_at: string
  user_first_name: string | null
  user_last_name: string | null
  user_initials: string | null
}

export interface IntakeCommentsResponse {
  comments: IntakeComment[]
  last_read_at: string | null
}

export type IntakeTransitions = Record<string, string[]>

export interface IntakeListResponse {
  intakes: Intake[]
  total: number
}

export type IntakeCountsResponse = Record<string, number>
