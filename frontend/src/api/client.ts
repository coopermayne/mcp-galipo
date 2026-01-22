import type {
  Case,
  CaseSummary,
  Task,
  Event,
  Note,
  DashboardStats,
  Constants,
  CreateCaseInput,
  UpdateCaseInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateEventInput,
  UpdateEventInput,
  Person,
  CasePerson,
  PersonType,
  PersonTypeRecord,
  ExpertiseType,
  CreatePersonInput,
  UpdatePersonInput,
  AssignPersonInput,
  UpdateAssignmentInput,
  Jurisdiction,
} from '../types';
import { getAuthToken, clearAuthToken } from '../context/AuthContext';

const API_BASE = '/api/v1';

class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    // Handle 401 by clearing token and redirecting to login
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const error = data.error || { message: 'Unknown error', code: 'UNKNOWN' };
    throw new ApiError(error.message, error.code, response.status);
  }

  return data;
}

// Stats & Constants
export async function getStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/stats');
}

export async function getConstants(): Promise<Constants> {
  return request<Constants>('/constants');
}

// Jurisdictions
export async function getJurisdictions(): Promise<{ jurisdictions: Jurisdiction[] }> {
  return request('/jurisdictions');
}

export async function createJurisdiction(
  data: { name: string; local_rules_link?: string; notes?: string }
): Promise<{ success: boolean; jurisdiction: Jurisdiction }> {
  return request('/jurisdictions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateJurisdiction(
  jurisdictionId: number,
  data: { name?: string; local_rules_link?: string; notes?: string }
): Promise<{ success: boolean; jurisdiction: Jurisdiction }> {
  return request(`/jurisdictions/${jurisdictionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Cases
export async function getCases(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ cases: CaseSummary[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/cases${query ? `?${query}` : ''}`);
}

export async function getCase(caseId: number): Promise<Case> {
  return request(`/cases/${caseId}`);
}

export async function createCase(data: CreateCaseInput): Promise<{ success: boolean; case: Case }> {
  return request('/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCase(
  caseId: number,
  data: UpdateCaseInput
): Promise<{ success: boolean; case: Case }> {
  return request(`/cases/${caseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCase(caseId: number): Promise<{ success: boolean }> {
  return request(`/cases/${caseId}`, {
    method: 'DELETE',
  });
}

// Tasks
export async function getTasks(params?: {
  case_id?: number;
  status?: string;
  urgency?: number;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: Task[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.case_id) searchParams.set('case_id', String(params.case_id));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.urgency) searchParams.set('urgency', String(params.urgency));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/tasks${query ? `?${query}` : ''}`);
}

export async function createTask(data: CreateTaskInput): Promise<{ success: boolean; task: Task }> {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(
  taskId: number,
  data: UpdateTaskInput
): Promise<{ success: boolean; task: Task }> {
  return request(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(taskId: number): Promise<{ success: boolean }> {
  return request(`/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export async function reorderTask(
  taskId: number,
  sortOrder: number,
  urgency?: number
): Promise<{ success: boolean; task: Task }> {
  return request('/tasks/reorder', {
    method: 'POST',
    body: JSON.stringify({
      task_id: taskId,
      sort_order: sortOrder,
      urgency: urgency,
    }),
  });
}

// Events (Calendar items: hearings, depositions, filing deadlines, etc.)
export async function getEvents(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ events: Event[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/events${query ? `?${query}` : ''}`);
}

export async function createEvent(
  data: CreateEventInput
): Promise<{ success: boolean; event: Event }> {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(
  eventId: number,
  data: UpdateEventInput
): Promise<{ success: boolean; event: Event }> {
  return request(`/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(eventId: number): Promise<{ success: boolean }> {
  return request(`/events/${eventId}`, {
    method: 'DELETE',
  });
}

// Notes
export async function createNote(
  caseId: number,
  content: string
): Promise<{ success: boolean; note: Note }> {
  return request('/notes', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, content }),
  });
}

export async function updateNote(
  noteId: number,
  content: string
): Promise<{ success: boolean; note: Note }> {
  return request(`/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function deleteNote(noteId: number): Promise<{ success: boolean }> {
  return request(`/notes/${noteId}`, {
    method: 'DELETE',
  });
}

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

// Export error class for type checking
export { ApiError };
