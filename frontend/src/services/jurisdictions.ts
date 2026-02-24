import { apiFetch } from "@/lib/api"

export interface Jurisdiction {
  id: number
  name: string
  aliases: string[]
  local_rules_link: string | null
  notes: string | null
}

export async function getJurisdictions(): Promise<{
  success: boolean
  jurisdictions: Jurisdiction[]
  total: number
}> {
  const res = await apiFetch("/api/v1/jurisdictions")
  if (!res.ok) throw new Error("Failed to fetch jurisdictions")
  return res.json()
}
