import type { Judge, CreateJudgeInput, UpdateJudgeInput } from '../types';
import { request } from './common';

// Judges API

export async function getJudges(params?: {
  search?: string;
  jurisdiction_id?: number;
  status?: string;
  title?: string;
  limit?: number;
  offset?: number;
}): Promise<{ judges: Judge[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.jurisdiction_id) searchParams.set('jurisdiction_id', String(params.jurisdiction_id));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.title) searchParams.set('title', params.title);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return request(`/judges${query ? `?${query}` : ''}`);
}

export async function searchJudges(params?: {
  name?: string;
  jurisdiction_id?: number;
}): Promise<{ success: boolean; judges: Judge[] }> {
  const searchParams = new URLSearchParams();
  if (params?.name) searchParams.set('name', params.name);
  if (params?.jurisdiction_id) searchParams.set('jurisdiction_id', String(params.jurisdiction_id));
  const query = searchParams.toString();
  return request(`/judges/search${query ? `?${query}` : ''}`);
}

export async function getJudge(judgeId: number): Promise<{ success: boolean; judge: Judge }> {
  return request(`/judges/${judgeId}`);
}

export async function createJudge(data: CreateJudgeInput): Promise<{ success: boolean; judge: Judge }> {
  return request('/judges', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateJudge(
  judgeId: number,
  data: UpdateJudgeInput
): Promise<{ success: boolean; judge: Judge }> {
  return request(`/judges/${judgeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteJudge(judgeId: number): Promise<{ success: boolean; error?: string }> {
  return request(`/judges/${judgeId}`, {
    method: 'DELETE',
  });
}
