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

export async function assignAttorney(caseId: number, userId: number) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/attorneys/${userId}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to assign attorney")
  return res.json()
}

export async function removeAttorney(caseId: number, userId: number) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/attorneys/${userId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to remove attorney")
  return res.json()
}

export async function assignParalegal(caseId: number, userId: number) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/paralegals/${userId}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to assign paralegal")
  return res.json()
}

export async function removeParalegal(caseId: number, userId: number) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/paralegals/${userId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to remove paralegal")
  return res.json()
}
