// Case-related types

import type { CaseStatus } from './common';
import type { Task } from './task';
import type { Event } from './event';
import type { Note } from './note';
import type { Activity } from './activity';
import type { CasePerson } from './person';
import type { Proceeding } from './proceeding';

export interface CaseNumber {
  number: string;
  label: string;
  primary?: boolean;
}

export interface Case {
  id: number;
  case_name: string;
  short_name?: string;
  status: CaseStatus;
  court?: string;
  court_id?: number;
  local_rules_link?: string;
  print_code?: string;
  case_summary?: string;
  result?: string;
  date_of_injury?: string;
  created_at: string;
  updated_at?: string;
  case_numbers: CaseNumber[];
  persons: CasePerson[];
  tasks?: Task[];
  events?: Event[];
  notes?: Note[];
  activities?: Activity[];
  proceedings?: Proceeding[];
}

export interface CaseSummary {
  id: number;
  case_name: string;
  short_name?: string;
  status: CaseStatus;
  court?: string;
  print_code?: string;
  judge?: string;
  client_count?: number;
  defendant_count?: number;
  pending_task_count?: number;
  upcoming_event_count?: number;
}

export interface CreateCaseInput {
  case_name: string;
  short_name?: string;
  status?: CaseStatus;
  court_id?: number;
  print_code?: string;
  case_summary?: string;
  result?: string;
  date_of_injury?: string;
  case_numbers?: CaseNumber[];
}

export interface UpdateCaseInput {
  case_name?: string;
  short_name?: string;
  status?: CaseStatus;
  court_id?: number;
  print_code?: string;
  case_summary?: string;
  result?: string;
  date_of_injury?: string;
  case_numbers?: CaseNumber[];
}
