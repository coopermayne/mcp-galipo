import type { Case, CaseSummary, CreateCaseInput, UpdateCaseInput } from '../types';
import { request } from './common';

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
