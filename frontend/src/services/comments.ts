import { apiFetch } from "@/lib/api"

export interface Comment {
  id: number
  entity_type: string
  entity_id: number
  content: string
  is_system: boolean
  detail?: Record<string, unknown> | null
  created_at: string
  user_id: number | null
  user_first_name: string | null
  user_last_name: string | null
  user_initials: string | null
}

export interface CommentsResponse {
  comments: Comment[]
  last_read_at: string | null
}

export async function getComments(
  entityType: string,
  entityId: number
): Promise<CommentsResponse> {
  const res = await apiFetch(`/api/v1/comments/${entityType}/${entityId}`)
  if (!res.ok) throw new Error("Failed to fetch comments")
  return res.json()
}

export async function createComment(
  entityType: string,
  entityId: number,
  content: string
): Promise<Comment> {
  const res = await apiFetch(`/api/v1/comments/${entityType}/${entityId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error("Failed to create comment")
  const data = await res.json()
  return data.comment
}

export async function markRead(
  entityType: string,
  entityId: number
): Promise<void> {
  await apiFetch(`/api/v1/comments/${entityType}/${entityId}/read`, {
    method: "POST",
  })
}

export async function getUnreadCounts(
  entityType: string,
  ids: number[]
): Promise<Record<number, number>> {
  if (ids.length === 0) return {}
  const params = ids.map((id) => `ids=${id}`).join("&")
  const res = await apiFetch(
    `/api/v1/comments/unread-counts/${entityType}?${params}`
  )
  if (!res.ok) throw new Error("Failed to fetch unread counts")
  const data: Record<string, number> = await res.json()
  const result: Record<number, number> = {}
  for (const [k, v] of Object.entries(data)) {
    result[Number(k)] = v
  }
  return result
}
