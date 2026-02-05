import type {
  Person,
  CasePerson,
  RoleCategory,
  ExpertiseType,
  CreatePersonInput,
  UpdatePersonInput,
  AssignPersonInput,
  UpdateAssignmentInput,
  ChangeRoleInput,
} from '../types';
import { request } from './common';

// Persons
export async function getPersons(params?: {
  name?: string;
  role_id?: number;
  category?: RoleCategory;
  organization?: string;
  email?: string;
  phone?: string;
  case_id?: number;
  unassigned?: boolean;
  include_roles?: boolean;
  user_id?: number;
  limit?: number;
  offset?: number;
}): Promise<{ persons: Person[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.name) searchParams.set('name', params.name);
  if (params?.role_id) searchParams.set('role_id', String(params.role_id));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.organization) searchParams.set('organization', params.organization);
  if (params?.email) searchParams.set('email', params.email);
  if (params?.phone) searchParams.set('phone', params.phone);
  if (params?.case_id) searchParams.set('case_id', String(params.case_id));
  if (params?.unassigned) searchParams.set('unassigned', 'true');
  if (params?.include_roles) searchParams.set('include_roles', 'true');
  if (params?.user_id) searchParams.set('user_id', String(params.user_id));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/persons${query ? `?${query}` : ''}`);
}

export async function getPerson(personId: number): Promise<{ success: boolean; person: Person }> {
  return request(`/persons/${personId}`);
}

export async function createPerson(data: CreatePersonInput): Promise<{ success: boolean; person: Person }> {
  return request('/persons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePerson(
  personId: number,
  data: UpdatePersonInput
): Promise<{ success: boolean; person: Person }> {
  return request(`/persons/${personId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePerson(
  personId: number
): Promise<{ success: boolean; action: string }> {
  return request(`/persons/${personId}`, {
    method: 'DELETE',
  });
}

export async function archivePerson(
  personId: number
): Promise<{ success: boolean; person: Person }> {
  return request(`/persons/${personId}/archive`, {
    method: 'POST',
  });
}

// Duplicate Detection & Merge
export interface DuplicateGroup {
  persons: Person[];
  match_reasons: string[];
  has_conflicts: boolean;
}

export async function getDuplicatePersons(): Promise<{ groups: DuplicateGroup[]; total: number }> {
  return request('/persons/duplicates');
}

export async function getMergePreview(
  primaryId: number,
  secondaryId: number
): Promise<{
  primary: Person;
  secondary: Person;
  conflicts: {
    field_conflicts: Array<{ field: string; primary_value: string; secondary_value: string }>;
    role_conflicts: Array<{ case_id: number; role_id: number; role_name: string; case_name: string }>;
  };
  auto_mergeable: boolean;
}> {
  return request(`/persons/merge-preview?primary_id=${primaryId}&secondary_id=${secondaryId}`);
}

export async function mergePersons(
  primaryId: number,
  secondaryId: number,
  fieldResolutions?: Record<string, string>
): Promise<{ success: boolean; person: Person }> {
  return request('/persons/merge', {
    method: 'POST',
    body: JSON.stringify({
      primary_id: primaryId,
      secondary_id: secondaryId,
      field_resolutions: fieldResolutions || {},
    }),
  });
}

// Case-Person Assignments (via person_roles)
export async function getCasePersons(
  caseId: number,
  params?: {
    role_id?: number;
    category?: RoleCategory;
  }
): Promise<{ success: boolean; persons: CasePerson[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.role_id) searchParams.set('role_id', String(params.role_id));
  if (params?.category) searchParams.set('category', params.category);
  const query = searchParams.toString();
  return request(`/cases/${caseId}/persons${query ? `?${query}` : ''}`);
}

export async function assignPersonToCase(
  caseId: number,
  data: AssignPersonInput
): Promise<{ success: boolean; assignment: CasePerson }> {
  return request(`/cases/${caseId}/persons`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCaseAssignment(
  caseId: number,
  assignmentId: number,
  data: UpdateAssignmentInput
): Promise<{ success: boolean; assignment: CasePerson }> {
  return request(`/cases/${caseId}/person-roles/${assignmentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePersonRole(
  caseId: number,
  personId: number,
  data: ChangeRoleInput
): Promise<{ success: boolean; assignment: CasePerson }> {
  return request(`/cases/${caseId}/persons/${personId}/change-role`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removePersonFromCase(
  caseId: number,
  personId: number,
  roleId?: number
): Promise<{ success: boolean }> {
  const query = roleId ? `?role_id=${roleId}` : '';
  return request(`/cases/${caseId}/persons/${personId}${query}`, {
    method: 'DELETE',
  });
}

// Expertise Types
export async function getExpertiseTypes(): Promise<{ success: boolean; expertise_types: ExpertiseType[]; total: number }> {
  return request('/expertise-types');
}

export async function createExpertiseType(
  name: string,
  description?: string
): Promise<{ success: boolean; expertise_type: ExpertiseType }> {
  return request('/expertise-types', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}
