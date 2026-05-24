import { apiFetch } from "@/lib/api"

export interface Role {
  id: number
  name: string
  category: string
  sort_order: number | null
  description: string | null
  is_system: boolean
  usage_count?: number
}

export async function getRoles(category?: string): Promise<{ success: boolean; roles: Role[] }> {
  const sp = category ? `?category=${category}` : ""
  const res = await apiFetch(`/api/v1/roles${sp}`)
  if (!res.ok) throw new Error("Failed to fetch roles")
  return res.json()
}

export async function getRolesWithCounts(): Promise<{ success: boolean; roles: Role[] }> {
  const res = await apiFetch("/api/v1/roles?with_counts=true")
  if (!res.ok) throw new Error("Failed to fetch roles")
  return res.json()
}

export async function createRole(data: {
  name: string
  category: string
  sort_order?: number
  description?: string
}): Promise<{ success: boolean; role: Role }> {
  const res = await apiFetch("/api/v1/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Failed to create role")
  }
  return res.json()
}

export async function updateRole(
  id: number,
  data: {
    name?: string
    category?: string
    sort_order?: number
    description?: string
  }
): Promise<{ success: boolean; role: Role }> {
  const res = await apiFetch(`/api/v1/roles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Failed to update role")
  }
  return res.json()
}

export async function deleteRole(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/roles/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Failed to delete role")
  }
  return res.json()
}
