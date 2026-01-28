import type { Activity, CreateActivityInput } from '../types';
import { request } from './common';

export async function createActivity(
  input: CreateActivityInput
): Promise<{ success: boolean; activity: Activity }> {
  return request('/activities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteActivity(activityId: number): Promise<{ success: boolean }> {
  return request(`/activities/${activityId}`, {
    method: 'DELETE',
  });
}
