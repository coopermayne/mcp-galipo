// Person-related types

import type { PersonType, PersonSide, PhoneEntry, EmailEntry } from './common';

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
