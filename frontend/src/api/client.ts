import type {
  Case,
  CaseSummary,
  Task,
  Deadline,
  Note,
  DashboardStats,
  Constants,
  CreateCaseInput,
  UpdateCaseInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateDeadlineInput,
  UpdateDeadlineInput,
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

// Deadlines
export async function getDeadlines(params?: {
  urgency?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ deadlines: Deadline[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.urgency) searchParams.set('urgency', String(params.urgency));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/deadlines${query ? `?${query}` : ''}`);
}

export async function createDeadline(
  data: CreateDeadlineInput
): Promise<{ success: boolean; deadline: Deadline }> {
  return request('/deadlines', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDeadline(
  deadlineId: number,
  data: UpdateDeadlineInput
): Promise<{ success: boolean; deadline: Deadline }> {
  return request(`/deadlines/${deadlineId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDeadline(deadlineId: number): Promise<{ success: boolean }> {
  return request(`/deadlines/${deadlineId}`, {
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

export async function deleteNote(noteId: number): Promise<{ success: boolean }> {
  return request(`/notes/${noteId}`, {
    method: 'DELETE',
  });
}

// Clients
export async function getClients(): Promise<{ clients: { id: number; name: string; phone?: string; email?: string }[] }> {
  return request('/clients');
}

export async function addClientToCase(
  caseId: number,
  data: { name: string; phone?: string; email?: string; is_primary?: boolean } | { client_id: number; is_primary?: boolean }
): Promise<{ success: boolean }> {
  return request(`/cases/${caseId}/clients`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeClientFromCase(
  caseId: number,
  clientId: number
): Promise<{ success: boolean }> {
  return request(`/cases/${caseId}/clients/${clientId}`, {
    method: 'DELETE',
  });
}

// Defendants
export async function getDefendants(): Promise<{ defendants: { id: number; name: string }[] }> {
  return request('/defendants');
}

export async function addDefendantToCase(
  caseId: number,
  name: string
): Promise<{ success: boolean; defendant: { id: number; name: string } }> {
  return request(`/cases/${caseId}/defendants`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function removeDefendantFromCase(
  caseId: number,
  defendantId: number
): Promise<{ success: boolean }> {
  return request(`/cases/${caseId}/defendants/${defendantId}`, {
    method: 'DELETE',
  });
}

// Contacts
export async function getContacts(): Promise<{ contacts: { id: number; name: string; firm?: string; phone?: string; email?: string }[] }> {
  return request('/contacts');
}

export async function addContactToCase(
  caseId: number,
  data: { name: string; firm?: string; phone?: string; email?: string; role: string } | { contact_id: number; role: string }
): Promise<{ success: boolean }> {
  return request(`/cases/${caseId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeContactFromCase(
  caseId: number,
  contactId: number,
  role?: string
): Promise<{ success: boolean }> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return request(`/cases/${caseId}/contacts/${contactId}${query}`, {
    method: 'DELETE',
  });
}

// Export error class for type checking
export { ApiError };
