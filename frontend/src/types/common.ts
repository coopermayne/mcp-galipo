// Shared types, constants, and enums used across multiple domains

// Status types
export type CaseStatus =
  | 'Signing Up'
  | 'Prospective'
  | 'Pre-Filing'
  | 'Pleadings'
  | 'Discovery'
  | 'Expert Discovery'
  | 'Pre-trial'
  | 'Trial'
  | 'Post-Trial'
  | 'Appeal'
  | 'Settl. Pend.'
  | 'Stayed'
  | 'Closed';

export type TaskStatus =
  | 'Pending'
  | 'Active'
  | 'Done'
  | 'Partially Done'
  | 'Blocked'
  | 'Awaiting Atty Review';

// Role categories for the unified roles system
export type RoleCategory = 'expert' | 'counsel' | 'mediator' | 'client' | 'defendant' | 'other';

// Role interface for constants response
export interface RoleRef {
  id: number;
  name: string;
  category: RoleCategory;
  sort_order: number;
}

// Contact info types (shared across person and other entities)
export interface PhoneEntry {
  value: string;
  label?: string;
  primary?: boolean;
}

export interface EmailEntry {
  value: string;
  label?: string;
  primary?: boolean;
}

// Jurisdiction type
export interface Jurisdiction {
  id: number;
  name: string;
  local_rules_link?: string;
  notes?: string;
}

// API response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardStats {
  total_cases: number;
  active_cases: number;
  pending_tasks: number;
  upcoming_events: number;
  cases_by_status: Record<string, number>;
}

export interface Constants {
  case_statuses: string[];
  task_statuses: string[];
  activity_types: string[];
  role_categories: string[];
  roles: RoleRef[];
  jurisdictions?: Jurisdiction[];
}

// Calendar item type (combines tasks and events for calendar views)
export interface CalendarItem {
  id: number;
  date: string;
  time?: string;
  location?: string;
  description: string;
  status?: string;  // Only present for tasks
  urgency?: string;  // Only present for tasks
  case_id: number;
  case_name: string;
  short_name?: string;
  item_type: 'task' | 'event';
}
