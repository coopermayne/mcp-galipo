import { apiFetch } from "@/lib/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Payee {
  id: number
  name: string
  check_name: string | null
  address: string | null
  w9_file_path: string | null
  w9_file_name: string | null
  w9_year: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PayeeListResponse {
  payees: Payee[]
  total: number
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function listPayees(
  params?: { search?: string; limit?: number; offset?: number }
): Promise<PayeeListResponse> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set("search", params.search)
  if (params?.limit != null) sp.set("limit", String(params.limit))
  if (params?.offset != null) sp.set("offset", String(params.offset))
  const res = await apiFetch(`/api/v1/payees?${sp}`)
  if (!res.ok) throw new Error("Failed to fetch payees")
  return res.json()
}

export async function searchPayees(
  query: string,
  limit?: number
): Promise<Payee[]> {
  const sp = new URLSearchParams({ q: query })
  if (limit != null) sp.set("limit", String(limit))
  const res = await apiFetch(`/api/v1/payees/search?${sp}`)
  if (!res.ok) throw new Error("Failed to search payees")
  return res.json()
}

export async function getPayee(id: number): Promise<Payee> {
  const res = await apiFetch(`/api/v1/payees/${id}`)
  if (!res.ok) throw new Error("Failed to fetch payee")
  return res.json()
}

export async function createPayee(
  data: { name: string; check_name?: string; address?: string; notes?: string }
): Promise<{ success: boolean; payee: Payee }> {
  const res = await apiFetch("/api/v1/payees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create payee")
  return res.json()
}

export async function updatePayee(
  id: number,
  data: { name?: string; check_name?: string; address?: string; notes?: string }
): Promise<{ success: boolean; payee: Payee }> {
  const res = await apiFetch(`/api/v1/payees/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update payee")
  return res.json()
}

export async function deletePayee(
  id: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/payees/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete payee")
  return res.json()
}

export async function uploadW9(
  payeeId: number,
  file: File,
  year: number
): Promise<{ success: boolean; payee: Payee }> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("w9_year", String(year))
  const res = await apiFetch(`/api/v1/payees/${payeeId}/w9`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to upload W9")
  return res.json()
}

export async function openW9File(payeeId: number): Promise<void> {
  const res = await apiFetch(`/api/v1/payees/${payeeId}/w9-token`, {
    method: "POST",
  })
  const { token } = await res.json()
  window.open(`/api/v1/payees/${payeeId}/w9?token=${token}`, "_blank")
}
