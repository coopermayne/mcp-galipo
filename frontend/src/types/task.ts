import type { TaskStatus, Urgency } from "@/types/case"

export interface TaskAssignee {
  id: number
  first_name: string
  last_name: string
  initials: string
}

export interface TaskListItem {
  id: number
  case_id: number | null
  description: string
  due_date: string | null
  completion_date: string | null
  status: TaskStatus
  urgency: Urgency | null
  event_id: number | null
  sort_order: number | null
  assignee_id: number | null
  created_at: string | null
  updated_at: string | null
  case_name: string | null
  short_name: string | null
  case_color: string | null
  event_description: string | null
  event_date: string | null
  has_events: boolean
  assignee: TaskAssignee | null
}

export interface TaskListResponse {
  tasks: TaskListItem[]
  total: number
}

export interface TaskDetail {
  id: number
  case_id: number | null
  case_name: string | null
  short_name: string | null
  description: string
  due_date: string | null
  completion_date: string | null
  status: TaskStatus
  urgency: Urgency | null
  event_id: number | null
  sort_order: number | null
  assignee_id: number | null
  assignee_first_name: string | null
  assignee_last_name: string | null
  assignee_initials: string | null
}

export interface GetTasksParams {
  case_id?: number
  status?: TaskStatus
  exclude_status?: TaskStatus
  urgency?: Urgency
  due_date_from?: string
  due_date_to?: string
  user_id?: number
  assignee_id?: number
  limit?: number
  offset?: number
}
