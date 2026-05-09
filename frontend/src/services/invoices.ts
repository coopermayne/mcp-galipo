import { apiFetch } from "@/lib/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvoiceStatus = "unpaid" | "paid"

export type InvoiceCategory =
  | "Court Costs"
  | "Mediation"
  | "Experts"
  | "Messenger / Process"
  | "Court Reporters"
  | "Postage"
  | "Copy / Print / Scan"
  | "Parking"
  | "Travel"
  | "Miscellaneous"

export const INVOICE_CATEGORIES: InvoiceCategory[] = [
  "Court Costs",
  "Mediation",
  "Experts",
  "Messenger / Process",
  "Court Reporters",
  "Postage",
  "Copy / Print / Scan",
  "Parking",
  "Travel",
  "Miscellaneous",
]

export interface Invoice {
  id: number
  case_id: number
  case_name: string | null
  status: InvoiceStatus
  vendor: string
  amount: string
  case_amount: string | null
  date: string | null
  due_date: string | null
  description: string | null
  category: InvoiceCategory | null
  check_number: string | null
  paid_by_person_id: number | null
  paid_by_name: string | null
  paid_date: string | null
  payable_to: string | null
  payment_address: string | null
  file_path: string | null
  file_name: string | null
  content_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceStats {
  unpaid_count: number
  unpaid_total: string
  paid_count: number
  paid_total: string
}

export interface ExtractedInvoice {
  vendor?: string
  amount?: number
  date?: string
  due_date?: string
  description?: string
  check_number?: string
  payable_to?: string
  payment_address?: string
  notes?: string
  category?: InvoiceCategory
}

export interface InvoiceListResponse {
  invoices: Invoice[]
  total: number
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

interface ListInvoicesParams {
  case_id?: number
  status?: InvoiceStatus
  search?: string
  sort_by?: string
  sort_dir?: "asc" | "desc"
  limit?: number
  offset?: number
}

export async function listInvoices(
  params: ListInvoicesParams = {}
): Promise<InvoiceListResponse> {
  const sp = new URLSearchParams()
  if (params.case_id != null) sp.set("case_id", String(params.case_id))
  if (params.status) sp.set("status", params.status)
  if (params.search) sp.set("search", params.search)
  if (params.sort_by) sp.set("sort_by", params.sort_by)
  if (params.sort_dir) sp.set("sort_dir", params.sort_dir)
  if (params.limit != null) sp.set("limit", String(params.limit))
  if (params.offset != null) sp.set("offset", String(params.offset))
  const res = await apiFetch(`/api/v1/invoices?${sp}`)
  if (!res.ok) throw new Error("Failed to fetch invoices")
  return res.json()
}

export async function getInvoice(id: number): Promise<Invoice> {
  const res = await apiFetch(`/api/v1/invoices/${id}`)
  if (!res.ok) throw new Error("Failed to fetch invoice")
  return res.json()
}

export interface CreateInvoiceData {
  case_id: number
  vendor: string
  amount: number
  case_amount?: number
  status?: InvoiceStatus
  date?: string
  due_date?: string
  description?: string
  category?: string
  check_number?: string
  paid_date?: string
  file_path?: string
  file_name?: string
  content_type?: string
  paid_by_person_id?: number
  payable_to?: string
  payment_address?: string
  notes?: string
}

export async function createInvoice(
  data: CreateInvoiceData
): Promise<{ success: boolean; invoice: Invoice }> {
  const res = await apiFetch("/api/v1/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create invoice")
  return res.json()
}

export interface UpdateInvoiceData {
  vendor?: string
  amount?: number
  case_amount?: number | null
  date?: string
  due_date?: string
  description?: string
  category?: string
  paid_by_person_id?: number | null
  payable_to?: string
  payment_address?: string
  notes?: string
}

export async function updateInvoice(
  id: number,
  data: UpdateInvoiceData
): Promise<{ success: boolean; invoice: Invoice }> {
  const res = await apiFetch(`/api/v1/invoices/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update invoice")
  return res.json()
}

export async function markInvoicePaid(
  id: number,
  data: { check_number?: string; paid_date?: string }
): Promise<{ success: boolean; invoice: Invoice }> {
  const res = await apiFetch(`/api/v1/invoices/${id}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to mark invoice paid")
  return res.json()
}

export async function markInvoiceUnpaid(
  id: number
): Promise<{ success: boolean; invoice: Invoice }> {
  const res = await apiFetch(`/api/v1/invoices/${id}/unpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error("Failed to mark invoice unpaid")
  return res.json()
}

export async function deleteInvoice(
  id: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/invoices/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete invoice")
  return res.json()
}

export async function getInvoiceStats(
  caseId?: number
): Promise<InvoiceStats> {
  const sp = new URLSearchParams()
  if (caseId != null) sp.set("case_id", String(caseId))
  const res = await apiFetch(`/api/v1/invoices/stats?${sp}`)
  if (!res.ok) throw new Error("Failed to fetch invoice stats")
  return res.json()
}

export async function uploadInvoiceFile(
  caseId: number,
  file: File
): Promise<{ file_path: string; file_name: string; content_type: string }> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("case_id", String(caseId))
  const res = await apiFetch("/api/v1/invoices/upload", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to upload file")
  return res.json()
}

export async function extractInvoice(
  filePath: string,
  contentType: string
): Promise<{ success: boolean; extracted: ExtractedInvoice }> {
  const res = await apiFetch("/api/v1/invoices/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath, content_type: contentType }),
  })
  if (!res.ok) throw new Error("Failed to extract invoice")
  return res.json()
}

export function getInvoiceFileUrl(invoiceId: number): string {
  const token = localStorage.getItem("token")
  return `/api/v1/invoices/${invoiceId}/file${token ? `?token=${token}` : ""}`
}

export interface CounselOption {
  id: number
  name: string
  organization: string | null
}

export async function getCaseCounsel(
  caseId: number
): Promise<CounselOption[]> {
  const res = await apiFetch(
    `/api/v1/cases/${caseId}/persons?category=counsel`
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.persons ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as number,
    name: p.name as string,
    organization: (p.organization as string) ?? null,
  }))
}
