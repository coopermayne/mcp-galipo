// Task-related types

import type { TaskStatus } from './common';

export interface Task {
  id: number;
  case_id: number;
  case_name?: string;
  short_name?: string;
  description: string;
  due_date?: string;
  completion_date?: string;
  status: TaskStatus;
  urgency: number;
  sort_order: number;
  event_id?: number;
  event_description?: string;
  event_date?: string;
  has_events?: boolean;
  created_at: string;
}

export interface CreateTaskInput {
  case_id: number;
  description: string;
  due_date?: string;
  status?: TaskStatus;
  urgency?: number;
  event_id?: number;
}

export interface UpdateTaskInput {
  description?: string;
  due_date?: string | null;
  completion_date?: string | null;
  status?: TaskStatus;
  urgency?: number;
  event_id?: number | null;
}
