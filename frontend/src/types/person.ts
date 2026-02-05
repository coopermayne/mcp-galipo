// Person-related types (unified roles system)

import type { PhoneEntry, EmailEntry, RoleCategory } from './common';

// Expertise types for experts (used as lookup/dropdown values)
export interface ExpertiseType {
  id: number;
  name: string;
  description?: string;
}

// Role reference (embedded in person data)
export interface PersonRoleRef {
  id: number;
  name: string;
  category: RoleCategory;
}

// Role-specific attributes (stored in JSONB on person_roles)
export interface ExpertAttributes {
  hourly_rate?: number;
  deposition_rate?: number;
  trial_rate?: number;
  expertises?: string[];  // Array of expertise names
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

export type PersonAttributes = ExpertAttributes | AttorneyAttributes | MediatorAttributes | ClientAttributes | Record<string, unknown>;

// Person role assignment (the link between person, role, and optionally case)
export interface PersonRole {
  id: number;
  role_id: number;
  role: PersonRoleRef;
  case_id?: number;
  case_name?: string;
  short_name?: string;
  color?: string;
  attributes: PersonAttributes;
  notes?: string;
  is_primary: boolean;
  grouped_under_id?: number;
  grouped_under_name?: string;
  assigned_date?: string;
  created_at: string;
}

// Person (simplified - no person_type)
export interface Person {
  id: number;
  name: string;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  address?: string;
  organization?: string;
  notes?: string;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
  // Roles this person has (standalone and case-specific)
  roles?: PersonRole[];
}

// Case assignment (when viewing persons assigned to a case)
export interface CasePersonAssignment {
  assignment_id: number;
  case_id: number;
  case_name?: string;
  short_name?: string;
  color?: string;
  role_id: number;
  role: PersonRoleRef;
  attributes: PersonAttributes;
  notes?: string;
  is_primary: boolean;
  grouped_under_id?: number;
  grouped_under_name?: string;
  assigned_date?: string;
  created_at: string;
}

// CasePerson - person data + their assignment to a specific case
export interface CasePerson extends Person {
  assignment_id: number;
  role_id: number;
  role: PersonRoleRef;
  attributes: PersonAttributes;
  case_notes?: string;
  is_primary: boolean;
  grouped_under_id?: number;
  grouped_under_name?: string;
  assigned_date?: string;
  assigned_at: string;
}

// Person API input types
export interface CreatePersonInput {
  name: string;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  address?: string;
  organization?: string;
  notes?: string;
}

export interface UpdatePersonInput {
  name?: string;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  address?: string;
  organization?: string;
  notes?: string;
}

export interface AssignPersonInput {
  person_id: number;
  role_id: number;
  attributes?: PersonAttributes;
  notes?: string;
  is_primary?: boolean;
  grouped_under_id?: number;
  assigned_date?: string;
}

export interface UpdateAssignmentInput {
  attributes?: PersonAttributes;
  notes?: string;
  is_primary?: boolean;
  grouped_under_id?: number | null;
  assigned_date?: string;
}

export interface ChangeRoleInput {
  old_role_id: number;
  new_role_id: number;
}

// Legacy exports for backwards compatibility (these types no longer exist in the new schema)
// Components should migrate to using role-based types instead
export type PersonTypeRecord = never;
export type JudgeAttributes = never;
