import { apiFetch } from "@/lib/api"
import type { PersonListItem, PersonDetail } from "@/types/person"

export interface PersonSearchResult {
  id: number
  name: string
  phones: unknown[]
  emails: unknown[]
  organization: string | null
  notes: string | null
}

export interface SearchPersonsParams {
  name?: string
  category?: string
  limit?: number
  offset?: number
  include_roles?: boolean
}

export async function searchPersons(params: SearchPersonsParams = {}) {
  const sp = new URLSearchParams()
  if (params.name) sp.set("name", params.name)
  if (params.category) sp.set("category", params.category)
  if (params.limit != null) sp.set("limit", String(params.limit))
  if (params.offset != null) sp.set("offset", String(params.offset))
  sp.set("include_roles", params.include_roles !== false ? "true" : "false")
  const res = await apiFetch(`/api/v1/persons?${sp}`)
  if (!res.ok) throw new Error("Failed to search persons")
  return res.json() as Promise<{ persons: PersonListItem[]; total: number }>
}

export async function getPerson(personId: number): Promise<PersonDetail> {
  const res = await apiFetch(`/api/v1/persons/${personId}`)
  if (!res.ok) throw new Error("Failed to fetch person")
  const data = await res.json()
  return data.person
}

export async function updatePerson(
  personId: number,
  fields: Record<string, unknown>
): Promise<PersonDetail> {
  const res = await apiFetch(`/api/v1/persons/${personId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error("Failed to update person")
  const data = await res.json()
  return data.person
}

export async function archivePerson(personId: number) {
  const res = await apiFetch(`/api/v1/persons/${personId}/archive`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to archive person")
  return res.json()
}

export async function deletePerson(personId: number) {
  const res = await apiFetch(`/api/v1/persons/${personId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete person")
  return res.json()
}

export interface CreatePersonData {
  name: string
  phones?: { number: string; type?: string }[]
  emails?: { address: string; type?: string }[]
  organization?: string
  notes?: string
}

export async function createPerson(data: CreatePersonData) {
  const res = await apiFetch("/api/v1/persons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create person")
  return res.json()
}

export interface AssignPersonData {
  person_id: number
  role_id: number
  attributes?: Record<string, unknown>
  notes?: string
  is_primary?: boolean
  grouped_under_id?: number
  assigned_date?: string
}

export async function assignPersonToCase(caseId: number, data: AssignPersonData) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/persons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to assign person to case")
  return res.json()
}

export async function removePersonFromCase(
  caseId: number,
  personId: number,
  roleId?: number
) {
  const sp = roleId ? `?role_id=${roleId}` : ""
  const res = await apiFetch(`/api/v1/cases/${caseId}/persons/${personId}${sp}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to remove person from case")
  return res.json()
}

export interface UpdateCaseAssignmentData {
  attributes?: Record<string, unknown>
  notes?: string
  is_primary?: boolean
  grouped_under_id?: number | null
  assigned_date?: string
}

export async function updateCaseAssignment(
  caseId: number,
  assignmentId: number,
  data: UpdateCaseAssignmentData
) {
  const res = await apiFetch(`/api/v1/cases/${caseId}/person-roles/${assignmentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? "Failed to update assignment")
  }
  return res.json()
}
