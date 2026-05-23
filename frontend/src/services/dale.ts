import { apiFetch } from "@/lib/api"
import type { CaseDetail } from "@/types/case"
import type { TrialCalendarData } from "@/services/trial-calendar"
import type { Comment } from "@/services/comments"

export interface DaleCaseListItem {
  id: number
  case_name: string
  short_name: string | null
  status: string
  color: string | null
  trial_date: string | null
  date_of_injury: string | null
}

export type DaleEntityType = "case" | "event" | "task"

export async function bootstrapDaleSession(token: string): Promise<{
  success: boolean
  token?: string
  user?: { id: number; firstName: string; lastName: string; initials: string }
  error?: { message: string; code: string }
}> {
  const res = await fetch("/api/v1/auth/dale-bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  return res.json()
}

export async function getDaleCases(): Promise<{ cases: DaleCaseListItem[] }> {
  const res = await apiFetch("/api/v1/dale/cases")
  if (!res.ok) throw new Error("Failed to load cases")
  return res.json()
}

export async function getDaleCase(id: number): Promise<CaseDetail> {
  const res = await apiFetch(`/api/v1/dale/cases/${id}`)
  if (!res.ok) throw new Error("Failed to load case")
  return res.json()
}

export async function getDaleCalendar(
  monthsAhead = 6,
): Promise<TrialCalendarData> {
  const res = await apiFetch(
    `/api/v1/dale/calendar?months_ahead=${monthsAhead}&months_behind=0`,
  )
  if (!res.ok) throw new Error("Failed to load calendar")
  return res.json()
}

export async function getDaleComments(
  entityType: DaleEntityType,
  entityId: number,
): Promise<{ comments: Comment[] }> {
  const res = await apiFetch(`/api/v1/dale/comments/${entityType}/${entityId}`)
  if (!res.ok) throw new Error("Failed to load comments")
  return res.json()
}

export async function postDaleComment(
  entityType: DaleEntityType,
  entityId: number,
  content: string,
): Promise<Comment> {
  const res = await apiFetch(`/api/v1/dale/comments/${entityType}/${entityId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error("Failed to save comment")
  const data = await res.json()
  return data.comment
}
