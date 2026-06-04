import { apiFetch } from "@/lib/api"
import type { Checklist, ChecklistItem, ChecklistStatus } from "@/types/checklist"
import type { Comment } from "@/services/comments"

export async function getChecklist(caseId: number): Promise<Checklist> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/checklist`)
  if (!res.ok) throw new Error("Failed to load document checklist")
  return res.json()
}

export async function setChecklistItem(
  caseId: number,
  itemKey: string,
  patch: { status?: ChecklistStatus; notes?: string | null }
): Promise<ChecklistItem> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/checklist/item`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_key: itemKey, ...patch }),
  })
  if (!res.ok) throw new Error("Failed to update item")
  const data = await res.json()
  return data.item
}

export async function addCustomChecklistItem(
  caseId: number,
  label: string
): Promise<ChecklistItem> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/checklist/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  })
  if (!res.ok) throw new Error("Failed to add item")
  const data = await res.json()
  return data.item
}

export async function deleteChecklistItem(
  caseId: number,
  itemKey: string
): Promise<void> {
  const res = await apiFetch(
    `/api/v1/cases/${caseId}/checklist/item?key=${encodeURIComponent(itemKey)}`,
    { method: "DELETE" }
  )
  if (!res.ok) throw new Error("Failed to remove item")
}

export async function getChecklistComments(
  caseId: number,
  itemKey: string
): Promise<Comment[]> {
  const res = await apiFetch(
    `/api/v1/cases/${caseId}/checklist/comments?key=${encodeURIComponent(itemKey)}`
  )
  if (!res.ok) throw new Error("Failed to load activity")
  const data = await res.json()
  return data.comments
}

export async function addChecklistComment(
  caseId: number,
  itemKey: string,
  content: string
): Promise<Comment> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/checklist/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_key: itemKey, content }),
  })
  if (!res.ok) throw new Error("Failed to post update")
  const data = await res.json()
  return data.comment
}
