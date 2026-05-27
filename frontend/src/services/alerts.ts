import { apiFetch } from "@/lib/api"
import type { AlertListResponse } from "@/types/alert"

export async function getAlerts(
  params: { case_id?: number; include_dismissed?: boolean } = {}
): Promise<AlertListResponse> {
  const qs = new URLSearchParams()
  if (params.case_id !== undefined) qs.set("case_id", String(params.case_id))
  if (params.include_dismissed) qs.set("include_dismissed", "true")
  const url = `/api/v1/alerts${qs.toString() ? `?${qs}` : ""}`
  const res = await apiFetch(url)
  if (!res.ok) throw new Error("Failed to fetch alerts")
  return res.json()
}

export async function dismissAlert(input: {
  case_id: number
  rule_id: string
  fingerprint?: string | null
  reason?: string
}) {
  const res = await apiFetch("/api/v1/alerts/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to dismiss alert")
  return res.json()
}

export async function undismissAlert(caseId: number, ruleId: string) {
  const qs = new URLSearchParams({ case_id: String(caseId), rule_id: ruleId })
  const res = await apiFetch(`/api/v1/alerts/dismiss?${qs}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to restore alert")
  return res.json()
}
