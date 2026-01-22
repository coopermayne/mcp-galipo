// Core entity types based on backend schema

export interface CaseNumber {
  number: string;
  label: string;
  primary?: boolean;
}

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

export interface Jurisdiction {
  id: number;
  name: string;
  local_rules_link?: string;
  notes?: string;
}

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
  deadline_id?: number;
  deadline_description?: string;
  created_at: string;
}

export interface Deadline {
  id: number;
  case_id: number;
  case_name?: string;
  short_name?: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  document_link?: string;
  calculation_note?: string;
  starred?: boolean;
  created_at: string;
}

export interface Note {
  id: number;
  case_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  case_id: number;
  description: string;
  type: string;
  date: string;
  minutes?: number;
  created_at: string;
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
  deadlines?: Deadline[];
  notes?: Note[];
  activities?: Activity[];
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
  task_statuses: string[];
  activity_types: string[];
  person_types?: string[];
  person_sides?: string[];
  jurisdictions?: Jurisdiction[];
}

// Calendar item type
export interface CalendarItem {
  id: number;
  date: string;
  time?: string;
  location?: string;
  description: string;
  status?: string;  // Only present for tasks
  urgency?: number;  // Only present for tasks
  case_id: number;
  case_name: string;
  short_name?: string;
  item_type: 'task' | 'deadline';
}

// Create/update types
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
  completion_date?: string;
  status?: TaskStatus;
  urgency?: number;
}

export interface CreateDeadlineInput {
  case_id: number;
  date: string;
  description: string;
  time?: string;
  location?: string;
  document_link?: string;
  calculation_note?: string;
  starred?: boolean;
}

export interface UpdateDeadlineInput {
  date?: string;
  description?: string;
  time?: string;
  location?: string;
  document_link?: string;
  calculation_note?: string;
  starred?: boolean;
}

// Person types (unified person management)
// PersonType is extensible - any string is allowed. Common types include:
// client, attorney, judge, expert, mediator, defendant, witness, lien_holder, interpreter, etc.
export type PersonType = string;
export type PersonSide = 'plaintiff' | 'defendant' | 'neutral';

// Expertise types for experts (used as lookup/dropdown values)
export interface ExpertiseType {
  id: number;
  name: string;
  description?: string;
}

// Person types (used as lookup/dropdown values)
export interface PersonTypeRecord {
  id: number;
  name: string;
  description?: string;
}

// Type-specific attributes (stored in JSONB)
export interface JudgeAttributes {
  status?: string;
  jurisdiction?: string;
  chambers?: string;
  courtroom_number?: string;
  appointed_by?: string;
  initials?: string;
  tenure?: string;
}

export interface ExpertAttributes {
  hourly_rate?: number;
  deposition_rate?: number;
  trial_rate?: number;
  expertises?: string[];  // Array of expertise names stored in JSONB
}

export interface AttorneyAttributes {
  bar_number?: string;
}

export interface MediatorAttributes {
  half_day_rate?: number;
  full_day_rate?: number;
  style?: string;
}

export interface ClientAttributes {
  date_of_birth?: string;
  preferred_language?: string;
  emergency_contact?: string;
}

export type PersonAttributes = JudgeAttributes | ExpertAttributes | AttorneyAttributes | MediatorAttributes | ClientAttributes | Record<string, unknown>;

export interface Person {
  id: number;
  person_type: PersonType;
  name: string;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  address?: string;
  organization?: string;
  attributes: PersonAttributes;
  notes?: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  case_assignments?: CasePersonAssignment[];
}

export interface CasePersonAssignment {
  assignment_id: number;
  case_id: number;
  case_name?: string;
  short_name?: string;
  role: string;
  side?: PersonSide;
  case_attributes: Record<string, unknown>;
  case_notes?: string;
  is_primary: boolean;
  contact_via_person_id?: number;
  contact_via_name?: string;
  assigned_date?: string;
  created_at: string;
}

export interface CasePerson extends Person {
  assignment_id: number;
  role: string;
  side?: PersonSide;
  case_attributes: Record<string, unknown>;
  case_notes?: string;
  is_primary: boolean;
  contact_via_person_id?: number;
  contact_via_name?: string;
  assigned_date?: string;
  assigned_at: string;
  person_notes?: string;
}

// Person API input types
export interface CreatePersonInput {
  person_type: PersonType;
  name: string;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  address?: string;
  organization?: string;
  attributes?: PersonAttributes;
  notes?: string;
}

export interface UpdatePersonInput {
  name?: string;
  person_type?: PersonType;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  address?: string;
  organization?: string;
  attributes?: PersonAttributes;
  notes?: string;
  archived?: boolean;
}

export interface AssignPersonInput {
  person_id: number;
  role: string;
  side?: PersonSide;
  case_attributes?: Record<string, unknown>;
  case_notes?: string;
  is_primary?: boolean;
  contact_via_person_id?: number;
  assigned_date?: string;
}

export interface UpdateAssignmentInput {
  role: string;
  side?: PersonSide;
  case_attributes?: Record<string, unknown>;
  case_notes?: string;
  is_primary?: boolean;
  contact_via_person_id?: number;
  assigned_date?: string;
}
