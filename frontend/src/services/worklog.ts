import type {
  WorklogCandidates,
  Worklog,
  WorklogDay,
  WorklogEntry,
  WorklogByCase,
  WorklogByPerson,
  WorklogSelection,
} from "@/types/worklog"
import { apiFetch } from "@/lib/api"

async function json<T>(res: Response, errMsg: string): Promise<T> {
  if (!res.ok) {
    const err = new Error(errMsg) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function getWorklogCandidates(date?: string): Promise<WorklogCandidates> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ""
  return json(await apiFetch(`/api/v1/worklog/candidates${qs}`), "Failed to fetch candidates")
}

export interface ConsolidatePayload {
  transcript?: string
  log_date?: string | null
  selections?: WorklogSelection[]
}

export async function consolidateWorklog(
  payload: ConsolidatePayload
): Promise<{ voice_log_id: number; status: string }> {
  return json(
    await apiFetch("/api/v1/worklog/consolidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    "Failed to start consolidation"
  )
}

export async function getWorklog(id: number): Promise<Worklog> {
  return json(await apiFetch(`/api/v1/worklog/${id}`), "Failed to fetch worklog")
}

export async function getWorklogDay(date: string): Promise<WorklogDay> {
  return json(
    await apiFetch(`/api/v1/worklog/day?date=${encodeURIComponent(date)}`),
    "Failed to fetch day"
  )
}

export interface AddEntryPayload {
  log_date: string
  case_id?: number | null
  minutes?: number
  description?: string
  person_ids?: number[]
}

export async function addWorklogEntry(payload: AddEntryPayload): Promise<WorklogEntry> {
  return json(
    await apiFetch("/api/v1/worklog/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    "Failed to add entry"
  )
}

export interface UpdateEntryPayload {
  case_id?: number | null
  minutes?: number
  description?: string
  person_ids?: number[]
}

export async function updateWorklogEntry(id: number, payload: UpdateEntryPayload): Promise<WorklogEntry> {
  return json(
    await apiFetch(`/api/v1/worklog/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    "Failed to update entry"
  )
}

export async function deleteWorklogEntry(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/worklog/entries/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete entry")
}

export async function getWorklogByCase(caseId: number): Promise<WorklogByCase> {
  return json(await apiFetch(`/api/v1/worklog/by-case/${caseId}`), "Failed to fetch case worklog")
}

export async function getWorklogByPerson(personId: number): Promise<WorklogByPerson> {
  return json(await apiFetch(`/api/v1/worklog/by-person/${personId}`), "Failed to fetch person worklog")
}

/** Format integer minutes as "1h 30m" / "45m" / "2h". */
export function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0m"
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}
