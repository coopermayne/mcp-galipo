import type { Task, Event } from '../types';
import { request } from './common';

interface QuickCreateTaskResponse {
  success: boolean;
  task?: Task;
  error?: { message: string; code: string };
}

interface QuickCreateEventResponse {
  success: boolean;
  event?: Event;
  error?: { message: string; code: string };
}

export async function quickCreateTask(
  caseId: number,
  text: string
): Promise<QuickCreateTaskResponse> {
  return request('/quick/task', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, text }),
  });
}

export async function quickCreateEvent(
  caseId: number,
  text: string
): Promise<QuickCreateEventResponse> {
  return request('/quick/event', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, text }),
  });
}
