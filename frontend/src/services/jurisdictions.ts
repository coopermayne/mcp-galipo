import { apiFetch } from "@/lib/api"

export interface Jurisdiction {
  id: number
  name: string
  aliases: string[]
  local_rules_link: string | null
  notes: string | null
  judge_count: number
  proceeding_count: number
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

export async function createJurisdiction(data: {
  name: string
  local_rules_link?: string
  notes?: string
  aliases?: string[]
}): Promise<{ success: boolean; jurisdiction: Jurisdiction }> {
  const res = await apiFetch("/api/v1/jurisdictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create jurisdiction")
  return res.json()
}

export async function updateJurisdiction(
  id: number,
  data: {
    name?: string
    local_rules_link?: string | null
    notes?: string | null
    aliases?: string[]
  }
): Promise<{ success: boolean; jurisdiction: Jurisdiction }> {
  const res = await apiFetch(`/api/v1/jurisdictions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update jurisdiction")
  return res.json()
}

export async function deleteJurisdiction(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/jurisdictions/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    if (res.status === 409) throw new Error("Cannot delete jurisdiction with linked judges or proceedings")
    throw new Error("Failed to delete jurisdiction")
  }
  return res.json()
}
