export type ResolutionType = "settlement" | "verdict" | "judgment" | "arbitration_award"

export interface FinancialListItem {
  id: number
  case_id: number
  case_name: string
  short_name: string | null
  attorney_ids: number[] | null
  resolution_type: string | null
  resolution_date: string | null
  gross_recovery: number | null
  costs_advanced: number | null
  liens_total: number | null
  is_finalized: boolean | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  our_fee: number | null
  counsel_count: number | null
}

export interface FinancialListResponse {
  financials: FinancialListItem[]
  total: number
}

export type FinancialCountsResponse = Record<string, number>

export interface CounselFee {
  id: number
  person_role_id: number | null
  counsel_name: string | null
  is_our_firm: boolean | null
  fee_type: string | null
  fee_percentage: number | null
  fee_flat_amount: number | null
  sort_order: number | null
  notes: string | null
}

export interface FinancialDetail {
  id: number
  case_id: number
  case_name: string
  short_name: string | null
  attorney_ids: number[] | null
  resolution_type: string | null
  resolution_date: string | null
  gross_recovery: number | null
  costs_advanced: number | null
  liens_total: number | null
  is_finalized: boolean | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  counsel_fees: CounselFee[]
}
