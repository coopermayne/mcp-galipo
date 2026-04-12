import type {
  FinancialListResponse,
  FinancialCountsResponse,
  FinancialDetail,
} from "@/types/financial"
import { apiFetch } from "@/lib/api"

interface GetFinancialsParams {
  resolution_type?: string
  is_finalized?: boolean
  attorney_ids?: number[]
  search?: string
  limit?: number
  offset?: number
}

export async function getFinancials(
  params: GetFinancialsParams = {}
): Promise<FinancialListResponse> {
  const searchParams = new URLSearchParams()
  if (params.resolution_type) searchParams.set("resolution_type", params.resolution_type)
  if (params.is_finalized != null) searchParams.set("is_finalized", String(params.is_finalized))
  if (params.attorney_ids?.length)
    searchParams.set("attorney_ids", params.attorney_ids.join(","))
  if (params.search) searchParams.set("search", params.search)
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))

  const res = await apiFetch(`/api/v1/financials?${searchParams}`)
  if (!res.ok) throw new Error("Failed to fetch financials")
  return res.json()
}

export async function getFinancialCounts(
  attorney_ids?: number[]
): Promise<FinancialCountsResponse> {
  const searchParams = new URLSearchParams()
  if (attorney_ids?.length)
    searchParams.set("attorney_ids", attorney_ids.join(","))
  const qs = searchParams.toString()
  const res = await apiFetch(`/api/v1/financials/counts${qs ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error("Failed to fetch financial counts")
  return res.json()
}

export interface CreateFinancialData {
  case_id: number
  resolution_type?: string
  resolution_date?: string
  gross_recovery?: number
  costs_advanced?: number
  liens_total?: number
  is_finalized?: boolean
  notes?: string
}

export async function createFinancial(
  data: CreateFinancialData
): Promise<{ success: boolean; financial: unknown }> {
  const res = await apiFetch("/api/v1/financials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create financial record")
  return res.json()
}

export async function getFinancialByCase(
  caseId: number
): Promise<FinancialDetail | null> {
  const res = await apiFetch(`/api/v1/financials/by-case/${caseId}`)
  if (!res.ok) throw new Error("Failed to fetch financial")
  return res.json()
}

export type UpdateFinancialData = Partial<Omit<CreateFinancialData, "case_id">>

export async function updateFinancial(
  id: number,
  data: UpdateFinancialData
): Promise<{ success: boolean; financial: FinancialDetail }> {
  const res = await apiFetch(`/api/v1/financials/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update financial record")
  return res.json()
}

export async function deleteFinancial(
  id: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/financials/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete financial record")
  return res.json()
}

// --- Counsel Fees ---

export interface CreateCounselFeeData {
  counsel_name?: string
  is_our_firm?: boolean
  fee_type?: string
  fee_percentage?: number
  fee_flat_amount?: number
  sort_order?: number
  notes?: string
}

export async function createCounselFee(
  financialId: number,
  data: CreateCounselFeeData
): Promise<{ success: boolean; financial: FinancialDetail }> {
  const res = await apiFetch(`/api/v1/financials/${financialId}/fees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create counsel fee")
  return res.json()
}

export async function updateCounselFee(
  feeId: number,
  data: Partial<CreateCounselFeeData>
): Promise<{ success: boolean; financial: FinancialDetail }> {
  const res = await apiFetch(`/api/v1/counsel-fees/${feeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update counsel fee")
  return res.json()
}

export async function deleteCounselFee(
  feeId: number
): Promise<{ success: boolean; financial: FinancialDetail }> {
  const res = await apiFetch(`/api/v1/counsel-fees/${feeId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete counsel fee")
  return res.json()
}
