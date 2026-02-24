import type { UsersResponse, UserResponse } from "@/types/user"
import { apiFetch } from "@/lib/api"

export async function getUsers(
  includeInactive = false
): Promise<UsersResponse> {
  const params = new URLSearchParams()
  if (includeInactive) params.set("include_inactive", "true")
  const res = await apiFetch(`/api/v1/users?${params}`)
  if (!res.ok) throw new Error("Failed to fetch users")
  return res.json()
}

export async function createUser(
  data: Record<string, unknown>
): Promise<UserResponse> {
  const res = await apiFetch("/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || "Failed to create user")
  }
  return res.json()
}

export async function updateUser(
  id: number,
  data: Record<string, unknown>
): Promise<UserResponse> {
  const res = await apiFetch(`/api/v1/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || "Failed to update user")
  }
  return res.json()
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/users/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || "Failed to deactivate user")
  }
  return res.json()
}

export async function resetUserPassword(
  id: number
): Promise<{ success: boolean; defaultPassword: string }> {
  const res = await apiFetch(`/api/v1/users/${id}/reset-password`, {
    method: "POST",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || "Failed to reset password")
  }
  return res.json()
}
