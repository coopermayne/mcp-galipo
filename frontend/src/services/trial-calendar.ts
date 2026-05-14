import { apiFetch } from "@/lib/api"

export interface TrialItem {
  case_id: number
  case_name: string
  short_name: string | null
  color: string | null
  status: string
  trial_date: string
  trial_estimated_days: number | null
  trial_likelihood: number | null
  trial_likelihood_note: string | null
  attorney_ids: number[]
  jurisdiction_name: string | null
  case_number: string | null
  judge_names: string | null
  proposed: boolean
}

export interface BlockingEvent {
  id: number
  event_type: string
  description: string
  date: string
  end_date: string | null
  case_id: number | null
}

export interface TrialCalendarData {
  trials: TrialItem[]
  blocking_events: BlockingEvent[]
  range: { start: string; end: string }
}

export async function getTrialCalendar(
  monthsAhead = 6,
  monthsBehind = 1
): Promise<TrialCalendarData> {
  const params = new URLSearchParams({
    months_ahead: String(monthsAhead),
    months_behind: String(monthsBehind),
  })
  const res = await apiFetch(`/api/v1/trial-calendar?${params}`)
  return res.json()
}

export interface TrialSlot {
  start_date: string
  end_date: string
  weekdays: number
}

export interface TrialSlotsResult {
  slots: TrialSlot[]
  search_range: { start: string; end: string }
  total_found: number
}

export async function findTrialSlots(params: {
  estimated_days: number
  months_ahead?: number
  earliest_date?: string
  latest_date?: string
  max_results?: number
}): Promise<TrialSlotsResult> {
  const sp = new URLSearchParams({
    estimated_days: String(params.estimated_days),
  })
  if (params.months_ahead) sp.set("months_ahead", String(params.months_ahead))
  if (params.earliest_date) sp.set("earliest_date", params.earliest_date)
  if (params.latest_date) sp.set("latest_date", params.latest_date)
  if (params.max_results) sp.set("max_results", String(params.max_results))
  const res = await apiFetch(`/api/v1/trial-calendar/slots?${sp}`)
  return res.json()
}

export async function downloadTrialCalendarPdf(
  monthsAhead = 12,
  monthsBehind = 0,
  style: "list" | "visual" = "list",
): Promise<Blob> {
  const params = new URLSearchParams({
    months_ahead: String(monthsAhead),
    months_behind: String(monthsBehind),
    style,
  })
  const res = await apiFetch(`/api/v1/trial-calendar/pdf?${params}`)
  if (!res.ok) throw new Error("Failed to generate PDF")
  return res.blob()
}
