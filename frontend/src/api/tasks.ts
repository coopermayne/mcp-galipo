import type { Task, CreateTaskInput, UpdateTaskInput, DocketTasks, UpdateDocketInput, DocketCategory } from '../types';
import { request } from './common';

export async function getTasks(params?: {
  case_id?: number;
  status?: string;
  exclude_status?: string;
  urgency?: number;
  due_date_from?: string;
  due_date_to?: string;
  limit?: number;
  offset?: number;
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
  const query = searchParams.toString();
  return request(`/tasks${query ? `?${query}` : ''}`);
}

// ============================================================================
// Docket API Functions
// ============================================================================

/**
 * Get all tasks in the daily docket, grouped by category (today, tomorrow, backburner)
 */
export async function getDocketTasks(excludeDone: boolean = true): Promise<DocketTasks> {
  return request(`/docket?exclude_done=${excludeDone}`);
}

/**
 * Update a task's docket category and/or order
 */
export async function updateDocket(
  taskId: number,
  data: UpdateDocketInput
): Promise<{ success: boolean; task: Task }> {
  return request(`/docket/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Add a task to the docket with a specific category
 */
export async function addToDocket(
  taskId: number,
  category: DocketCategory,
  order?: number
): Promise<{ success: boolean; task: Task }> {
  return updateDocket(taskId, { docket_category: category, docket_order: order });
}

/**
 * Remove a task from the docket (set docket_category to null)
 */
export async function removeFromDocket(taskId: number): Promise<{ success: boolean; task: Task }> {
  return updateDocket(taskId, { docket_category: null, docket_order: null });
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
  urgency?: number
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
