// Core entity types based on backend schema

export interface CaseNumber {
  number: string;
  label: string;
  primary?: boolean;
}

export interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contact_directly: boolean;
  contact_via?: string;
  contact_via_relationship?: string;
  is_primary: boolean;
  notes?: string;
}

export interface Defendant {
  id: number;
  name: string;
}

export interface Contact {
  id: number;
  name: string;
  firm?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  role?: string;
}

export interface Task {
  id: number;
  case_id: number;
  case_name?: string;
  description: string;
  due_date?: string;
  status: TaskStatus;
  urgency: number;
  deadline_id?: number;
  created_at: string;
}

export interface Deadline {
  id: number;
  case_id: number;
  case_name?: string;
  date: string;
  description: string;
  status: string;
  urgency: number;
  document_link?: string;
  calculation_note?: string;
  created_at: string;
}

export interface Note {
  id: number;
  case_id: number;
  content: string;
  created_at: string;
}

export interface Activity {
  id: number;
  case_id: number;
  description: string;
  activity_type: string;
  date: string;
  minutes?: number;
  created_at: string;
}

export interface Case {
  id: number;
  case_name: string;
  status: CaseStatus;
  court?: string;
  print_code?: string;
  case_summary?: string;
  date_of_injury?: string;
  claim_due?: string;
  claim_filed_date?: string;
  complaint_due?: string;
  complaint_filed_date?: string;
  trial_date?: string;
  created_at: string;
  case_numbers: CaseNumber[];
  clients: Client[];
  defendants: Defendant[];
  contacts: Contact[];
  tasks?: Task[];
  deadlines?: Deadline[];
  notes?: Note[];
  activities?: Activity[];
}

export interface CaseSummary {
  id: number;
  case_name: string;
  status: CaseStatus;
  court?: string;
  print_code?: string;
  client_count?: number;
  defendant_count?: number;
  pending_task_count?: number;
  upcoming_deadline_count?: number;
}

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

export type ContactRole =
  | 'Opposing Counsel'
  | 'Co-Counsel'
  | 'Referring Attorney'
  | 'Mediator'
  | 'Judge'
  | 'Magistrate Judge'
  | 'Plaintiff Expert'
  | 'Defendant Expert'
  | 'Witness'
  | 'Client Contact'
  | 'Guardian Ad Litem'
  | 'Family Contact';

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
  upcoming_deadlines: number;
  cases_by_status: Record<string, number>;
}

export interface Constants {
  case_statuses: string[];
  contact_roles: string[];
  task_statuses: string[];
  courts: string[];
}

// Calendar item type
export interface CalendarItem {
  id: number;
  date: string;
  description: string;
  status: string;
  urgency: number;
  case_id: number;
  case_name: string;
  item_type: 'task' | 'deadline';
}

// Create/update types
export interface CreateCaseInput {
  case_name: string;
  status?: CaseStatus;
  court?: string;
  print_code?: string;
  case_summary?: string;
  date_of_injury?: string;
  case_numbers?: CaseNumber[];
  clients?: Partial<Client>[];
  defendants?: string[];
  contacts?: Partial<Contact & { role: ContactRole }>[];
}

export interface UpdateCaseInput {
  case_name?: string;
  status?: CaseStatus;
  court?: string;
  print_code?: string;
  case_summary?: string;
  date_of_injury?: string;
  claim_due?: string;
  claim_filed_date?: string;
  complaint_due?: string;
  complaint_filed_date?: string;
  trial_date?: string;
  case_numbers?: CaseNumber[];
}

export interface CreateTaskInput {
  case_id: number;
  description: string;
  due_date?: string;
  status?: TaskStatus;
  urgency?: number;
  deadline_id?: number;
}

export interface UpdateTaskInput {
  description?: string;
  due_date?: string;
  status?: TaskStatus;
  urgency?: number;
}

export interface CreateDeadlineInput {
  case_id: number;
  date: string;
  description: string;
  status?: string;
  urgency?: number;
  document_link?: string;
  calculation_note?: string;
}

export interface UpdateDeadlineInput {
  date?: string;
  description?: string;
  status?: string;
  urgency?: number;
  document_link?: string;
  calculation_note?: string;
}
