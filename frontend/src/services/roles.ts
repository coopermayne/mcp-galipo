import { apiFetch } from "@/lib/api"

export interface Role {
  id: number
  name: string
  category: string
  sort_order: number | null
  description: string | null
}

export async function getRoles(category?: string): Promise<{ success: boolean; roles: Role[] }> {
  const sp = category ? `?category=${category}` : ""
  const res = await apiFetch(`/api/v1/roles${sp}`)
  if (!res.ok) throw new Error("Failed to fetch roles")
  return res.json()
}
