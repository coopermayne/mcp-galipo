import { apiFetch } from "@/lib/api"
import type { TaskListResponse, TaskDetail, GetTasksParams } from "@/types/task"

export async function getTasks(params: GetTasksParams = {}): Promise<TaskListResponse> {
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) qs.set(key, String(val))
  }
  const url = `/api/v1/tasks${qs.toString() ? `?${qs}` : ""}`
  const res = await apiFetch(url)
  if (!res.ok) throw new Error("Failed to fetch tasks")
  return res.json()
}

export async function getTask(taskId: number): Promise<TaskDetail> {
  const res = await apiFetch(`/api/v1/tasks/${taskId}`)
  if (!res.ok) throw new Error("Failed to fetch task")
  return res.json()
}

export interface CreateTaskData {
  case_id?: number
  intake_id?: number
  description: string
  due_date?: string
  status?: string
  urgency?: string
  event_id?: number
  assignee_id?: number
}

export interface UpdateTaskData {
  description?: string
  due_date?: string | null
  completion_date?: string | null
  status?: string
  urgency?: string | null
  event_id?: number | null
  assignee_id?: number | null
}

export interface SearchTasksParams {
  q: string
  my_tasks?: boolean
  limit?: number
}

export async function searchTasks(params: SearchTasksParams): Promise<TaskListResponse> {
  const sp = new URLSearchParams({ q: params.q })
  if (params.my_tasks) sp.set("my_tasks", "true")
  if (params.limit) sp.set("limit", String(params.limit))
  const res = await apiFetch(`/api/v1/tasks/search?${sp.toString()}`)
  if (!res.ok) throw new Error("Failed to search tasks")
  return res.json()
}

export async function createTask(data: CreateTaskData) {
  const res = await apiFetch("/api/v1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create task")
  return res.json()
}

export async function updateTask(taskId: number, data: UpdateTaskData) {
  const res = await apiFetch(`/api/v1/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update task")
  return res.json()
}

export async function deleteTask(taskId: number) {
  const res = await apiFetch(`/api/v1/tasks/${taskId}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete task")
  return res.json()
}

export async function rescheduleOverdueTasks(newDate: string, taskIds: number[]) {
  const res = await apiFetch("/api/v1/tasks/reschedule-overdue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_date: newDate, task_ids: taskIds }),
  })
  if (!res.ok) throw new Error("Failed to reschedule tasks")
  return res.json()
}
