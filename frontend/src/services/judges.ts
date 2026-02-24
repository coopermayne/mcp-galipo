import { apiFetch } from "@/lib/api"

export interface Judge {
  id: number
  name: string
  jurisdiction_id: number | null
  chambers: string | null
  title: string | null
}

export async function searchJudges(
  name: string,
  jurisdictionId?: number
): Promise<{ success: boolean; judges: Judge[] }> {
  const sp = new URLSearchParams({ name })
  if (jurisdictionId != null) sp.set("jurisdiction_id", String(jurisdictionId))
  const res = await apiFetch(`/api/v1/judges/search?${sp}`)
  if (!res.ok) throw new Error("Failed to search judges")
  return res.json()
}
