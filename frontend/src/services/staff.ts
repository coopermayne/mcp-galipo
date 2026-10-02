import { apiFetch } from "@/lib/api"

export interface StaffMember {
  id: number
  firstName: string
  lastName: string
  initials: string
  position: string
}

export async function getStaff(): Promise<{ success: boolean; data: StaffMember[] }> {
  const res = await apiFetch("/api/v1/staff")
  if (!res.ok) throw new Error("Failed to fetch staff")
  return res.json()
}
