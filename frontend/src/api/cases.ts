import type { Case, CaseSummary, CreateCaseInput, UpdateCaseInput, CaseStaffUser } from '../types';
import { request } from './common';

interface CaseUsersResponse {
  attorneys: CaseStaffUser[];
  paralegals: CaseStaffUser[];
}

interface AssignResponse {
  case_users: CaseUsersResponse;
  auto_assigned_paralegal_ids?: number[];
}

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

// Case Staff Assignments

export async function getCaseUsers(caseId: number): Promise<CaseUsersResponse> {
  const response = await request<{ success: boolean; data: CaseUsersResponse }>(`/cases/${caseId}/users`);
  return response.data;
}

export async function assignAttorneyToCase(caseId: number, userId: number): Promise<AssignResponse> {
  const response = await request<{ success: boolean; data: AssignResponse }>(`/cases/${caseId}/attorneys/${userId}`, {
    method: 'POST',
  });
  return response.data;
}

export async function removeAttorneyFromCase(caseId: number, userId: number): Promise<CaseUsersResponse> {
  const response = await request<{ success: boolean; data: { case_users: CaseUsersResponse } }>(`/cases/${caseId}/attorneys/${userId}`, {
    method: 'DELETE',
  });
  return response.data.case_users;
}

export async function assignParalegalToCase(caseId: number, userId: number): Promise<CaseUsersResponse> {
  const response = await request<{ success: boolean; data: { case_users: CaseUsersResponse } }>(`/cases/${caseId}/paralegals/${userId}`, {
    method: 'POST',
  });
  return response.data.case_users;
}

export async function removeParalegalFromCase(caseId: number, userId: number): Promise<CaseUsersResponse> {
  const response = await request<{ success: boolean; data: { case_users: CaseUsersResponse } }>(`/cases/${caseId}/paralegals/${userId}`, {
    method: 'DELETE',
  });
  return response.data.case_users;
}
