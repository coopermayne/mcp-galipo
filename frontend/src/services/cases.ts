import type {
  CaseListResponse,
  CaseCountsResponse,
  CaseDetail,
} from "@/types/case"
import { apiFetch } from "@/lib/api"

interface GetCasesParams {
  status?: string
  limit?: number
  offset?: number
  attorney_ids?: number[]
  unassigned?: boolean
}

export async function getCases(
  params: GetCasesParams = {}
): Promise<CaseListResponse> {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set("status", params.status)
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))
  if (params.attorney_ids?.length)
    searchParams.set("attorney_ids", params.attorney_ids.join(","))
  if (params.unassigned) searchParams.set("unassigned", "true")

  const res = await apiFetch(`/api/v1/cases?${searchParams}`)
  if (!res.ok) throw new Error("Failed to fetch cases")
  return res.json()
}

export async function getCaseCounts(
  attorney_ids?: number[]
): Promise<CaseCountsResponse> {
  const searchParams = new URLSearchParams()
  if (attorney_ids?.length)
    searchParams.set("attorney_ids", attorney_ids.join(","))
  const qs = searchParams.toString()
  const res = await apiFetch(`/api/v1/cases/counts${qs ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error("Failed to fetch case counts")
  return res.json()
}

export async function getCase(id: number): Promise<CaseDetail> {
  const res = await apiFetch(`/api/v1/cases/${id}`)
  if (!res.ok) throw new Error("Failed to fetch case")
  return res.json()
}

export interface CreateCaseData {
  case_name: string
  status?: string
  short_name?: string
  print_code?: string
  date_of_injury?: string
  case_summary?: string
}

export async function createCase(
  data: CreateCaseData
): Promise<{ success: boolean; case: CaseDetail }> {
  const res = await apiFetch("/api/v1/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create case")
  return res.json()
}

export async function updateCase(
  id: number,
  data: Partial<CreateCaseData>
): Promise<{ success: boolean; case: CaseDetail }> {
  const res = await apiFetch(`/api/v1/cases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update case")
  return res.json()
}

export async function deleteCase(
  id: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/cases/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete case")
  return res.json()
}
