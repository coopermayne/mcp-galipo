import { apiFetch } from "@/lib/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LienStatus = "pending" | "negotiated" | "paid"

export interface Lien {
  id: number
  case_id: number
  case_name: string | null
  payee_id: number | null
  payee_name: string | null
  payee_address: string | null
  description: string | null
  claimed_amount: string
  negotiated_amount: string | null
  status: LienStatus
  date: string | null
  paid_date: string | null
  check_number: string | null
  file_path: string | null
  file_name: string | null
  content_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LienStats {
  count: number
  pending_count: number
  negotiated_count: number
  paid_count: number
  total_claimed: number
  total_negotiated: number
  total_paid: number
  savings: number
  savings_pct: number
}

export interface LienListResponse {
  liens: Lien[]
  total: number
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

interface ListLiensParams {
  case_id?: number
  status?: LienStatus
  search?: string
  sort_by?: string
  sort_dir?: "asc" | "desc"
  limit?: number
  offset?: number
}

export async function listLiens(
  params: ListLiensParams = {}
): Promise<LienListResponse> {
  const sp = new URLSearchParams()
  if (params.case_id != null) sp.set("case_id", String(params.case_id))
  if (params.status) sp.set("status", params.status)
  if (params.search) sp.set("search", params.search)
  if (params.sort_by) sp.set("sort_by", params.sort_by)
  if (params.sort_dir) sp.set("sort_dir", params.sort_dir)
  if (params.limit != null) sp.set("limit", String(params.limit))
  if (params.offset != null) sp.set("offset", String(params.offset))
  const res = await apiFetch(`/api/v1/liens?${sp}`)
  if (!res.ok) throw new Error("Failed to fetch liens")
  return res.json()
}

export async function getLien(id: number): Promise<Lien> {
  const res = await apiFetch(`/api/v1/liens/${id}`)
  if (!res.ok) throw new Error("Failed to fetch lien")
  return res.json()
}

export interface CreateLienData {
  case_id: number
  claimed_amount: number
  payee_id?: number
  negotiated_amount?: number
  status?: LienStatus
  date?: string
  paid_date?: string
  check_number?: string
  description?: string
  file_path?: string
  file_name?: string
  content_type?: string
  notes?: string
}

export async function createLien(
  data: CreateLienData
): Promise<{ success: boolean; lien: Lien }> {
  const res = await apiFetch("/api/v1/liens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create lien")
  return res.json()
}

export interface UpdateLienData {
  claimed_amount?: number
  negotiated_amount?: number | null
  payee_id?: number | null
  status?: LienStatus
  date?: string
  paid_date?: string | null
  check_number?: string | null
  description?: string
  notes?: string
}

export async function updateLien(
  id: number,
  data: UpdateLienData
): Promise<{ success: boolean; lien: Lien }> {
  const res = await apiFetch(`/api/v1/liens/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update lien")
  return res.json()
}

export async function deleteLien(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/liens/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete lien")
  return res.json()
}

export async function getLienStats(caseId: number): Promise<LienStats> {
  const res = await apiFetch(`/api/v1/liens/stats?case_id=${caseId}`)
  if (!res.ok) throw new Error("Failed to fetch lien stats")
  return res.json()
}

export async function uploadLienFile(
  caseId: number,
  file: File
): Promise<{ file_path: string; file_name: string; content_type: string }> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("case_id", String(caseId))
  const res = await apiFetch("/api/v1/liens/upload", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to upload file")
  return res.json()
}

export async function openLienFile(lienId: number): Promise<void> {
  const res = await apiFetch(`/api/v1/liens/${lienId}/file-token`, {
    method: "POST",
  })
  const { token } = await res.json()
  window.open(`/api/v1/liens/${lienId}/file?token=${token}`, "_blank")
}
