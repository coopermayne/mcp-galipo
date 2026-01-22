import type {
  Person,
  CasePerson,
  PersonType,
  PersonTypeRecord,
  ExpertiseType,
  CreatePersonInput,
  UpdatePersonInput,
  AssignPersonInput,
  UpdateAssignmentInput,
} from '../types';
import { request } from './common';

// Persons
export async function getPersons(params?: {
  name?: string;
  type?: PersonType;
  organization?: string;
  email?: string;
  phone?: string;
  case_id?: number;
  archived?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ persons: Person[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.name) searchParams.set('name', params.name);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.organization) searchParams.set('organization', params.organization);
  if (params?.email) searchParams.set('email', params.email);
  if (params?.phone) searchParams.set('phone', params.phone);
  if (params?.case_id) searchParams.set('case_id', String(params.case_id));
  if (params?.archived) searchParams.set('archived', 'true');
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
  personId: number,
  permanent: boolean = false
): Promise<{ success: boolean; action: string }> {
  const query = permanent ? '?permanent=true' : '';
  return request(`/persons/${personId}${query}`, {
    method: 'DELETE',
  });
}

// Case-Person Assignments
export async function getCasePersons(
  caseId: number,
  params?: {
    type?: PersonType;
    role?: string;
    side?: string;
  }
): Promise<{ success: boolean; persons: CasePerson[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.role) searchParams.set('role', params.role);
  if (params?.side) searchParams.set('side', params.side);
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
  personId: number,
  data: UpdateAssignmentInput
): Promise<{ success: boolean; assignment: CasePerson }> {
  return request(`/cases/${caseId}/persons/${personId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function removePersonFromCase(
  caseId: number,
  personId: number,
  role?: string
): Promise<{ success: boolean }> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
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

// Person Types
export async function getPersonTypes(): Promise<{ success: boolean; person_types: PersonTypeRecord[]; total: number }> {
  return request('/person-types');
}

export async function createPersonType(
  name: string,
  description?: string
): Promise<{ success: boolean; person_type: PersonTypeRecord }> {
  return request('/person-types', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}
