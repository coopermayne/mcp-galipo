import type { Intake, UpdateIntakeInput, SyncResult } from '../types';
import { request } from './common';

export async function getIntakes(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ intakes: Intake[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return request(`/intakes${qs ? `?${qs}` : ''}`);
}

export async function getIntake(id: number): Promise<Intake> {
  return request(`/intakes/${id}`);
}

export async function updateIntake(
  id: number,
  data: UpdateIntakeInput
): Promise<{ success: boolean; intake: Intake }> {
  return request(`/intakes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteIntake(id: number): Promise<{ success: boolean }> {
  return request(`/intakes/${id}`, {
    method: 'DELETE',
  });
}

export async function syncIntakes(): Promise<SyncResult> {
  return request('/intakes/sync', {
    method: 'POST',
  });
}
