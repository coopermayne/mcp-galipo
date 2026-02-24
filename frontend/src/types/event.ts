export interface EventListItem {
  id: number
  case_id: number | null
  date: string
  time: string | null
  location: string | null
  description: string
  document_link: string | null
  calculation_note: string | null
  starred: boolean | null
  created_at: string | null
  case_name: string | null
  short_name: string | null
  case_color: string | null
  task_count: number
  attendee_ids: number[]
}

export interface EventListResponse {
  events: EventListItem[]
  total: number
}

export interface EventAttendee {
  id: number
  email: string
  first_name: string
  last_name: string
  initials: string
  position: string
}

export interface EventDetail extends EventListItem {
  attendees: EventAttendee[]
}

export interface GetEventsParams {
  case_id?: number
  include_past?: boolean
  past_days?: number
  user_id?: number
  attendee_id?: number
  limit?: number
  offset?: number
}
