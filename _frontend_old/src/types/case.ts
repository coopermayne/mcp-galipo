// Case-related types

import type { CaseStatus } from './common';
import type { Task } from './task';
import type { Event } from './event';
import type { Note } from './note';
import type { CasePerson } from './person';
import type { Proceeding } from './proceeding';
import type { CaseStaffUser } from './user';

export interface Case {
  id: number;
  case_name: string;
  short_name?: string;
  color?: string;
  status: CaseStatus;
  case_summary?: string;
  result?: string;
  date_of_injury?: string;
  created_at: string;
  updated_at?: string;
  persons: CasePerson[];
  tasks?: Task[];
  events?: Event[];
  notes?: Note[];
  proceedings?: Proceeding[];
  // Staff assignments
  attorney_ids: number[];
  paralegal_ids: number[];
  attorneys?: CaseStaffUser[];
  paralegals?: CaseStaffUser[];
}

export interface CaseSummary {
  id: number;
  case_name: string;
  short_name?: string;
  color?: string;
  status: CaseStatus;
  judge?: string;
  client_count?: number;
  defendant_count?: number;
  pending_task_count?: number;
  upcoming_event_count?: number;
  attorney_ids?: number[];
  paralegal_ids?: number[];
}

export interface CreateCaseInput {
  case_name: string;
  short_name?: string;
  status?: CaseStatus;
  case_summary?: string;
  result?: string;
  date_of_injury?: string;
}

export interface UpdateCaseInput {
  case_name?: string;
  short_name?: string;
  status?: CaseStatus;
  case_summary?: string;
  result?: string;
  date_of_injury?: string;
}
