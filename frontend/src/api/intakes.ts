import type { Intake, IntakeComment, UpdateIntakeInput, SyncResult } from '../types';
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

export async function getIntakeCounts(): Promise<Record<string, number>> {
  return request('/intakes/counts');
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

export async function analyzeIntakes(limit?: number): Promise<{
  success: boolean;
  analyzed: number;
  errors: number;
  remaining: number;
}> {
  return request('/intakes/analyze', {
    method: 'POST',
    body: JSON.stringify({ limit: limit ?? 20 }),
  });
}

export async function syncIntakes(): Promise<SyncResult> {
  return request('/intakes/sync', {
    method: 'POST',
  });
}

export async function getIntakeComments(intakeId: number): Promise<IntakeComment[]> {
  return request(`/intakes/${intakeId}/comments`);
}

export async function addIntakeComment(intakeId: number, content: string): Promise<IntakeComment> {
  return request(`/intakes/${intakeId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteIntakeComment(intakeId: number, commentId: number): Promise<{ success: boolean }> {
  return request(`/intakes/${intakeId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

export async function markIntakeRead(intakeId: number): Promise<{ success: boolean }> {
  return request(`/intakes/${intakeId}/read`, {
    method: 'POST',
  });
}

export async function getIntakeUnreadCounts(ids: number[]): Promise<Record<string, number>> {
  const params = ids.map((id) => `ids=${id}`).join('&');
  return request(`/intakes/unread-counts?${params}`);
}
