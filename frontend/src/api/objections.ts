import type { Objection } from '../types/rfp';
import { request } from './common';

interface ObjectionsResponse {
  success: boolean;
  objections: Objection[];
}

interface ObjectionResponse {
  success: boolean;
  objection: Objection;
}

export async function getObjections(): Promise<Objection[]> {
  const data = await request<ObjectionsResponse>('/objections');
  return data.objections;
}

export async function createObjection(objection: {
  name: string;
  short_name: string;
  formal_language: string;
  argument_template?: string;
  position?: number;
}): Promise<Objection> {
  const data = await request<ObjectionResponse>('/objections', {
    method: 'POST',
    body: JSON.stringify(objection),
  });
  return data.objection;
}

export async function updateObjection(
  id: number,
  updates: Partial<Omit<Objection, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Objection> {
  const data = await request<ObjectionResponse>(`/objections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.objection;
}

export async function deleteObjection(id: number): Promise<void> {
  await request(`/objections/${id}`, { method: 'DELETE' });
}

export async function reorderObjections(orderedIds: number[]): Promise<Objection[]> {
  const data = await request<ObjectionsResponse>('/objections/reorder', {
    method: 'POST',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  return data.objections;
}
