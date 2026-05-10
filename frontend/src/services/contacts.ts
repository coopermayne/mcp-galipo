import { apiFetch } from "@/lib/api"

export interface ContactInfo {
  value: string
  type?: string
}

export interface PersonSearchResult {
  type: "person"
  id: number
  name: string
  phones: ContactInfo[]
  emails: ContactInfo[]
  organization: string | null
  role_summary: string | null
  score: number
}

export interface JudgeSearchResult {
  type: "judge"
  id: number
  name: string
  phones: ContactInfo[]
  emails: ContactInfo[]
  jurisdiction: string | null
  title: string | null
  courtroom: string | null
  score: number
}

export type UnifiedSearchResult = PersonSearchResult | JudgeSearchResult

export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[]
  total: number
}

export async function searchContacts(q: string, limit = 25): Promise<UnifiedSearchResponse> {
  const sp = new URLSearchParams({ q, limit: String(limit) })
  const res = await apiFetch(`/api/v1/contacts/search?${sp}`)
  if (!res.ok) throw new Error("Failed to search contacts")
  return res.json()
}
