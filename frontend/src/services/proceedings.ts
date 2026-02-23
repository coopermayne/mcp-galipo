import { apiFetch } from "@/lib/api"

export interface CreateProceedingData {
  case_number: string
  jurisdiction_id?: number
  is_primary?: boolean
  notes?: string
}

export interface UpdateProceedingData {
  case_number?: string
  jurisdiction_id?: number | null
  is_primary?: boolean
  notes?: string | null
}

export async function createProceeding(caseId: number, data: CreateProceedingData) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/proceedings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create proceeding")
  return res.json()
}

export async function updateProceeding(proceedingId: number, data: UpdateProceedingData) {
  const res = await apiFetch(`/api/v1/proceedings/${proceedingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update proceeding")
  return res.json()
}

export async function deleteProceeding(proceedingId: number) {
  const res = await apiFetch(`/api/v1/proceedings/${proceedingId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete proceeding")
  return res.json()
}

export interface AssignJudgeData {
  judge_id: number
  role?: string
  sort_order?: number
}

export async function assignJudgeToProceeding(
  proceedingId: number,
  data: AssignJudgeData
) {
  const res = await apiFetch(`/api/v1/proceedings/${proceedingId}/judges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to assign judge")
  return res.json()
}

export async function removeJudgeFromProceeding(
  proceedingId: number,
  judgeId: number
) {
  const res = await apiFetch(
    `/api/v1/proceedings/${proceedingId}/judges/${judgeId}`,
    { method: "DELETE" }
  )
  if (!res.ok) throw new Error("Failed to remove judge")
  return res.json()
}
