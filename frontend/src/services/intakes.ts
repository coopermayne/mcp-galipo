import type {
  IntakeListResponse,
  IntakeCountsResponse,
  Intake,
} from "@/types/intake"

interface GetIntakesParams {
  status?: string
  limit?: number
  offset?: number
}

export async function getIntakes(
  params: GetIntakesParams = {}
): Promise<IntakeListResponse> {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set("status", params.status)
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))

  const res = await fetch(`/api/v1/intakes?${searchParams}`)
  if (!res.ok) throw new Error("Failed to fetch intakes")
  return res.json()
}

export async function getIntakeCounts(): Promise<IntakeCountsResponse> {
  const res = await fetch("/api/v1/intakes/counts")
  if (!res.ok) throw new Error("Failed to fetch intake counts")
  return res.json()
}

export async function getIntake(id: number): Promise<Intake> {
  const res = await fetch(`/api/v1/intakes/${id}`)
  if (!res.ok) throw new Error("Failed to fetch intake")
  return res.json()
}

export async function updateIntake(
  id: number,
  data: Partial<Intake>
): Promise<{ success: boolean; intake: Intake }> {
  const res = await fetch(`/api/v1/intakes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update intake")
  return res.json()
}

export async function deleteIntake(
  id: number
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/v1/intakes/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete intake")
  return res.json()
}

export interface SyncIntakesResponse {
  success: boolean
  imported: number
  skipped: number
  total: number
}

export async function syncIntakes(): Promise<SyncIntakesResponse> {
  const res = await fetch("/api/v1/intakes/sync", { method: "POST" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Failed to sync intakes")
  }
  return res.json()
}
