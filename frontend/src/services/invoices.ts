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

export type InvoiceType = "cost" | "advance"

export interface Invoice {
  id: number
  case_id: number
  case_name: string | null
  type: InvoiceType
  status: InvoiceStatus
  payee_id: number | null
  payee_name: string | null
  payee_address: string | null
  amount: string
  case_amount: string | null
  date: string | null
  due_date: string | null
  description: string | null
  category: InvoiceCategory | null
  check_number: string | null
  paid_by_person_id: number | null
  paid_by_name: string | null
  transfer_to_person_id: number | null
  transfer_to_name: string | null
  advanced_to_person_id: number | null
  advanced_to_name: string | null
  paid_date: string | null
  file_path: string | null
  file_name: string | null
  content_type: string | null
  notes: string | null
  is_transfer: boolean
  created_at: string
  updated_at: string
}

export interface EqualizationResult {
  grand_total: number
  our_total_paid: number
  counsel_total_paid: number
  our_share_pct: number
  our_target: number
  counsel_target: number
  transfer_amount: number
  already_transferred: number
  direction: "counsel_pays_us" | "we_pay_counsel" | "even"
  counsel_id: number | null
  counsel_name: string | null
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
  type?: InvoiceType
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
  if (params.type) sp.set("type", params.type)
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
  amount: number
  type?: InvoiceType
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
  transfer_to_person_id?: number
  advanced_to_person_id?: number
  payee_id?: number
  notes?: string
  is_transfer?: boolean
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
  amount?: number
  case_amount?: number | null
  date?: string
  due_date?: string
  description?: string
  category?: string
  paid_by_person_id?: number | null
  transfer_to_person_id?: number | null
  advanced_to_person_id?: number | null
  payee_id?: number | null
  notes?: string
  check_number?: string | null
  paid_date?: string | null
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
  caseId?: number,
  type?: InvoiceType
): Promise<InvoiceStats> {
  const sp = new URLSearchParams()
  if (caseId != null) sp.set("case_id", String(caseId))
  if (type) sp.set("type", type)
  const res = await apiFetch(`/api/v1/invoices/stats?${sp}`)
  if (!res.ok) throw new Error("Failed to fetch invoice stats")
  return res.json()
}

export interface AdvanceStats {
  total_advances: number
  unpaid_count: number
  paid_count: number
  by_recipient: { person_id: number | null; person_name: string; total: number }[]
}

export async function getAdvanceStats(caseId: number): Promise<AdvanceStats> {
  const res = await apiFetch(`/api/v1/invoices/advance-stats?case_id=${caseId}`)
  if (!res.ok) throw new Error("Failed to fetch advance stats")
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
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error?.message ?? "Failed to upload file")
  }
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
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error?.message ?? "Failed to extract invoice")
  }
  return res.json()
}

export async function openInvoiceFile(invoiceId: number): Promise<void> {
  const res = await apiFetch(`/api/v1/invoices/${invoiceId}/file-token`, {
    method: "POST",
  })
  const { token } = await res.json()
  window.open(`/api/v1/invoices/${invoiceId}/file?token=${token}`, "_blank")
}

export async function calculateEqualization(
  caseId: number,
  ourSharePct: number
): Promise<EqualizationResult> {
  const sp = new URLSearchParams()
  sp.set("case_id", String(caseId))
  sp.set("our_share_pct", String(ourSharePct))
  const res = await apiFetch(`/api/v1/invoices/equalization?${sp}`)
  if (!res.ok) throw new Error("Failed to calculate equalization")
  return res.json()
}

export interface CostSummaryParty {
  party_id: string
  label: string | null
  person_id: number | null
  paid: number
  net_paid: number
  target: number
}

export interface CostSummary {
  total_costs: number
  our_costs: number
  counsel_costs: number
  our_net: number
  counsel_net: number
  net_transferred: number
  counsel_id: number | null
  counsel_name: string | null
  parties?: CostSummaryParty[]
  targets_by_party?: Record<string, number>
}

export async function getCostSummary(caseId: number): Promise<CostSummary> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/cost-summary`)
  if (!res.ok) throw new Error("Failed to fetch cost summary")
  return res.json()
}

export interface CostSharingPartner {
  person_id: number
  name: string
  organization: string | null
  cost_share_pct: number | null
}

// Advanced config types — mirror the backend Pydantic shape.
export interface AdvancedShare {
  party: string
  pct: number
}

export interface AdvancedCap {
  party: string
  max_cumulative: number
  absorber?: string | null
}

export interface AdvancedPhase {
  id: string
  label?: string | null
  boundary_kind: "open_start" | "date"
  boundary_date?: string | null
  shares: AdvancedShare[]
  caps: AdvancedCap[]
}

export interface AdvancedParty {
  id: string
  label: string
  person_id?: number | null
  organization?: string | null
}

export interface AdvancedConfig {
  version: number
  parties: AdvancedParty[]
  phases: AdvancedPhase[]
  absorber_party: string
}

export interface AdvancedPartyWithPct {
  party_id: string
  label: string
  person_id: number | null
  organization: string | null
  pct: number
}

export interface CostSharingConfig {
  config: AdvancedConfig | null
  co_counsel: CostSharingPartner[]
  parties_with_pct: AdvancedPartyWithPct[]
  absorber_party: string
}

export async function getCostSharing(caseId: number): Promise<CostSharingConfig> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/cost-sharing`)
  if (!res.ok) throw new Error("Failed to fetch cost sharing config")
  return res.json()
}

export async function setCostSharing(
  caseId: number,
  personId: number,
  costSharePct: number
): Promise<CostSharingConfig> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/cost-sharing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_id: personId, cost_share_pct: costSharePct }),
  })
  if (!res.ok) throw new Error("Failed to update cost sharing")
  return res.json()
}

export async function removeCostSharing(
  caseId: number
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/cost-sharing`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error?.message ?? "Failed to remove cost sharing")
  }
  return res.json()
}

export async function setCostSharingConfig(
  caseId: number,
  config: AdvancedConfig
): Promise<CostSharingConfig> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/cost-sharing-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error?.message ?? "Failed to update cost sharing config")
  }
  return res.json()
}

export async function removeCostSharingConfig(
  caseId: number
): Promise<CostSharingConfig> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/cost-sharing-config`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error?.message ?? "Failed to reset cost sharing")
  }
  return res.json()
}

export interface SettlementTransfer {
  from_party: string
  to_party: string
  amount: number
  from_label: string | null
  to_label: string | null
  from_person_id: number | null
  to_person_id: number | null
}

export interface SettlementPartyMeta {
  party_id: string
  label: string | null
  person_id: number | null
  organization: string | null
}

export interface Settlement {
  config: AdvancedConfig
  parties: string[]
  parties_meta: SettlementPartyMeta[]
  targets: Record<string, number>
  paid: Record<string, number>
  net_paid: Record<string, number>
  deltas: Record<string, number>
  transfers: SettlementTransfer[]
}

export async function getSettlement(caseId: number): Promise<Settlement> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/settlement`)
  if (!res.ok) throw new Error("Failed to fetch settlement")
  return res.json()
}

export interface CounselOption {
  id: number
  name: string
  organization: string | null
}

export async function exportCostReport(caseId: number): Promise<void> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/costs/export`)
  if (!res.ok) throw new Error("Failed to export cost report")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const disposition = res.headers.get("Content-Disposition")
  const match = disposition?.match(/filename="(.+)"/)
  a.download = match?.[1] ?? "cost_report.pdf"
  a.click()
  URL.revokeObjectURL(url)
}

export async function getCaseCoCounsel(
  caseId: number
): Promise<CounselOption[]> {
  // role_id=5 is co_counsel (seeded role)
  const res = await apiFetch(
    `/api/v1/cases/${caseId}/persons?role_id=5`
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.persons ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as number,
    name: p.name as string,
    organization: (p.organization as string) ?? null,
  }))
}
