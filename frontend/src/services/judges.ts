import { apiFetch } from "@/lib/api"

export interface ContactInfo {
  value: string
  type?: string
}

export interface JudgeListItem {
  id: number
  name: string
  title: string | null
  phones: ContactInfo[]
  emails: ContactInfo[]
  jurisdiction_id: number | null
  jurisdiction_name: string | null
  chambers: string | null
  courtroom_number: string | null
  appointed_by: string | null
  appointed_date: string | null
  initials: string | null
  status: string | null
  notes: string | null
}

export interface JudgeProceeding {
  proceeding_id: number
  role: string
  sort_order: number | null
  case_number: string | null
  case_id: number
  case_name: string
  short_name: string | null
}

export interface JudgeDetail extends JudgeListItem {
  local_rules_link: string | null
  proceedings: JudgeProceeding[]
}

export async function getJudges(
  search?: string,
  status?: string
): Promise<{ judges: JudgeListItem[]; total: number }> {
  const sp = new URLSearchParams()
  if (search) sp.set("search", search)
  if (status) sp.set("status", status)
  sp.set("limit", "500")
  const res = await apiFetch(`/api/v1/judges?${sp}`)
  if (!res.ok) throw new Error("Failed to fetch judges")
  return res.json()
}

export async function getJudge(id: number): Promise<JudgeDetail> {
  const res = await apiFetch(`/api/v1/judges/${id}`)
  if (!res.ok) throw new Error("Failed to fetch judge")
  const data = await res.json()
  return data.judge
}

export async function updateJudge(
  id: number,
  fields: Record<string, unknown>
): Promise<JudgeDetail> {
  const res = await apiFetch(`/api/v1/judges/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error("Failed to update judge")
  const data = await res.json()
  return data.judge
}

export async function deleteJudge(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/judges/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail ?? "Failed to delete judge")
  }
}

export async function searchJudges(
  name: string,
  jurisdictionId?: number
): Promise<{ success: boolean; judges: JudgeListItem[] }> {
  const sp = new URLSearchParams({ name })
  if (jurisdictionId != null) sp.set("jurisdiction_id", String(jurisdictionId))
  const res = await apiFetch(`/api/v1/judges/search?${sp}`)
  if (!res.ok) throw new Error("Failed to search judges")
  return res.json()
}
