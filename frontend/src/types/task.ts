// Task-related types

import type { TaskStatus } from './common';

export type DocketCategory = 'today' | 'tomorrow' | 'backburner';

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
  docket_category?: DocketCategory | null;
  docket_order?: number | null;
  event_id?: number;
  event_description?: string;
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
  due_date?: string;
  completion_date?: string;
  status?: TaskStatus;
  urgency?: number;
  docket_category?: DocketCategory | null;
  docket_order?: number | null;
}

export interface DocketTasks {
  today: Task[];
  tomorrow: Task[];
  backburner: Task[];
  total: number;
}

export interface UpdateDocketInput {
  docket_category?: DocketCategory | null;
  docket_order?: number | null;
}
