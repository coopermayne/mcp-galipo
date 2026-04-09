import type {
  IntakeListResponse,
  IntakeCountsResponse,
  IntakeCommentsResponse,
  IntakeComment,
  IntakeTransitions,
  Intake,
} from "@/types/intake"
import { apiFetch } from "@/lib/api"

interface GetIntakesParams {
  status?: string
  limit?: number
  offset?: number
  exclude_archived?: boolean
}

export async function getIntakes(
  params: GetIntakesParams = {}
): Promise<IntakeListResponse> {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set("status", params.status)
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))
  if (params.exclude_archived) searchParams.set("exclude_archived", "true")

  const res = await apiFetch(`/api/v1/intakes?${searchParams}`)
  if (!res.ok) throw new Error("Failed to fetch intakes")
  return res.json()
}

export async function getIntakeCounts(): Promise<IntakeCountsResponse> {
  const res = await apiFetch("/api/v1/intakes/counts")
  if (!res.ok) throw new Error("Failed to fetch intake counts")
  return res.json()
}

export async function getIntake(id: number): Promise<Intake> {
  const res = await apiFetch(`/api/v1/intakes/${id}`)
  if (!res.ok) throw new Error("Failed to fetch intake")
  return res.json()
}

export async function updateIntake(
  id: number,
  data: Partial<Intake>
): Promise<{ success: boolean; intake: Intake }> {
  const res = await apiFetch(`/api/v1/intakes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update intake")
  return res.json()
}

export async function bulkArchiveByStatus(
  status: string
): Promise<{ success: boolean; count: number }> {
  const res = await apiFetch("/api/v1/intakes/bulk-archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error("Failed to bulk archive intakes")
  return res.json()
}

export async function deleteIntake(
  id: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/intakes/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete intake")
  return res.json()
}

export interface SyncIntakesResponse {
  success: boolean
  imported: number
  skipped: number
  total: number
}

export async function syncIntakes(): Promise<SyncIntakesResponse> {
  const res = await apiFetch("/api/v1/intakes/sync", { method: "POST" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Failed to sync intakes")
  }
  return res.json()
}

export async function getIntakeComments(
  id: number
): Promise<IntakeCommentsResponse> {
  const res = await apiFetch(`/api/v1/intakes/${id}/comments`)
  if (!res.ok) throw new Error("Failed to fetch comments")
  return res.json()
}

export async function createIntakeComment(
  id: number,
  content: string
): Promise<IntakeComment> {
  const res = await apiFetch(`/api/v1/intakes/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error("Failed to create comment")
  return res.json()
}

export async function markIntakeRead(id: number): Promise<void> {
  await apiFetch(`/api/v1/intakes/${id}/read`, { method: "POST" })
}

export async function getUnreadCounts(
  ids: number[]
): Promise<Record<number, number>> {
  if (ids.length === 0) return {}
  const params = ids.map((id) => `ids=${id}`).join("&")
  const res = await apiFetch(`/api/v1/intakes/unread-counts?${params}`)
  if (!res.ok) throw new Error("Failed to fetch unread counts")
  const data: Record<string, number> = await res.json()
  // Convert string keys back to numbers
  const result: Record<number, number> = {}
  for (const [k, v] of Object.entries(data)) {
    result[Number(k)] = v
  }
  return result
}

export async function analyzeIntake(
  id: number
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/v1/intakes/${id}/analyze`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to start analysis")
  return res.json()
}

export async function getIntakeTransitions(): Promise<IntakeTransitions> {
  const res = await apiFetch("/api/v1/intakes/transitions")
  if (!res.ok) throw new Error("Failed to fetch transitions")
  return res.json()
}

export interface CreateIntakeData {
  name?: string
  email?: string
  phone?: string
  contact_relationship?: string
  referral_name?: string
  referral_org?: string
  referral_email?: string
  referral_phone?: string
  case_type?: string
  incident_date?: string
  incident_time?: string
  location?: string
  incident_description?: string
  injury_description?: string
  notes?: string
}

export async function createIntake(
  data: CreateIntakeData
): Promise<{ success: boolean; intake: Intake }> {
  const res = await apiFetch("/api/v1/intakes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create intake")
  return res.json()
}

export interface LogInteractionData {
  interaction_type: "email" | "phone"
  direction?: "inbound" | "outbound"
  content: string
}

export interface SaveInteractionData extends LogInteractionData {
  summary: string
}

export async function summarizeInteraction(
  id: number,
  data: LogInteractionData
): Promise<{ summary: string }> {
  const res = await apiFetch(`/api/v1/intakes/${id}/interactions/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to summarize interaction")
  return res.json()
}

export async function saveInteraction(
  id: number,
  data: SaveInteractionData
): Promise<IntakeComment> {
  const res = await apiFetch(`/api/v1/intakes/${id}/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to save interaction")
  return res.json()
}

export async function extractIntakeFields(
  text: string
): Promise<{ success: boolean; fields: CreateIntakeData }> {
  const res = await apiFetch("/api/v1/intakes/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error("Failed to extract intake fields")
  return res.json()
}
