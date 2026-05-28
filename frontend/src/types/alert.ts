export type AlertSeverity = "error" | "warning" | "info"

export interface CaseAlert {
  case_id: number
  case_name: string
  short_name: string | null
  case_color: string | null
  case_status: string
  attorney_ids: number[] | null
  paralegal_ids: number[] | null
  rule_id: string
  label: string
  severity: AlertSeverity
  dismissible: boolean
  message: string
  fingerprint: string | null
  dismissed: boolean
  dismissed_at: string | null
}

export interface AlertListResponse {
  alerts: CaseAlert[]
  total: number
  error_count: number
  warning_count: number
  affected_cases: number
}
