import type { Task, CreateTaskInput, UpdateTaskInput } from '../types';
import { request } from './common';

export async function getTasks(params?: {
  case_id?: number;
  status?: string;
  exclude_status?: string;
  urgency?: string;
  due_date_from?: string;
  due_date_to?: string;
  limit?: number;
  offset?: number;
  user_id?: number;
}): Promise<{ tasks: Task[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.case_id) searchParams.set('case_id', String(params.case_id));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.exclude_status) searchParams.set('exclude_status', params.exclude_status);
  if (params?.urgency) searchParams.set('urgency', String(params.urgency));
  if (params?.due_date_from) searchParams.set('due_date_from', params.due_date_from);
  if (params?.due_date_to) searchParams.set('due_date_to', params.due_date_to);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.user_id) searchParams.set('user_id', String(params.user_id));
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
  urgency?: string
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

export async function rescheduleOverdueTasks(
  newDate: string
): Promise<{ success: boolean; updated: number }> {
  return request('/tasks/reschedule-overdue', {
    method: 'POST',
    body: JSON.stringify({ new_date: newDate }),
  });
}
