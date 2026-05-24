import type {
  CaseListResponse,
  CaseCountsResponse,
  CaseDetail,
  CaseCommentsResponse,
  CaseComment,
} from "@/types/case"
import { apiFetch } from "@/lib/api"
import { downloadBlob } from "@/lib/download"

interface GetCasesParams {
  status?: string
  limit?: number
  offset?: number
  attorney_ids?: number[]
  paralegal_ids?: number[]
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
  if (params.paralegal_ids?.length)
    searchParams.set("paralegal_ids", params.paralegal_ids.join(","))
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
  if (!res.ok) {
    const err = new Error("Failed to fetch case") as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

export interface CreateCaseData {
  case_name: string
  status?: string
  short_name?: string
  print_code?: string
  date_of_injury?: string
  trial_date?: string
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

export type UpdateCaseData = Partial<CreateCaseData> & {
  notes?: string
  claim_deadline?: string | null
  complaint_deadline?: string | null
  proposed_trial_dates?: string[] | null
  trial_likelihood?: number | null
  trial_likelihood_note?: string | null
  trial_estimated_days?: number | null
  feature_toggles?: Record<string, boolean> | null
}

export async function updateCase(
  id: number,
  data: UpdateCaseData
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

// --- Case Comments (Activity Feed) ---

export async function getCaseComments(
  caseId: number
): Promise<CaseCommentsResponse> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/comments`)
  if (!res.ok) throw new Error("Failed to fetch case comments")
  return res.json()
}

export async function createCaseComment(
  caseId: number,
  content: string
): Promise<CaseComment> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error("Failed to create comment")
  return res.json()
}

export async function exportCaseReport(): Promise<void> {
  const res = await apiFetch("/api/v1/export?format=docx")
  if (!res.ok) throw new Error("Failed to export case report")
  const blob = await res.blob()
  const date = new Date().toISOString().slice(0, 10)
  downloadBlob(blob, `Case Report ${date}.docx`)
}

export type CaseListGroupBy = "attorney" | "status" | "alphabetical"

export async function exportCaseListPdf(groupBy: CaseListGroupBy): Promise<void> {
  const res = await apiFetch(`/api/v1/cases/export/list-pdf?group_by=${groupBy}`)
  if (!res.ok) throw new Error("Failed to export case list PDF")
  const blob = await res.blob()
  const date = new Date().toISOString().slice(0, 10)
  const labels: Record<CaseListGroupBy, string> = {
    attorney: "by Attorney",
    status: "by Status",
    alphabetical: "Alphabetical",
  }
  downloadBlob(blob, `Case List ${labels[groupBy]} ${date}.pdf`)
}

export async function markCaseRead(
  caseId: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/read`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to mark case as read")
  return res.json()
}
