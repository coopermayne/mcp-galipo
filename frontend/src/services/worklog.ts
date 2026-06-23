import type {
  WorklogCandidates,
  Worklog,
  WorklogByCase,
  WorklogByPerson,
  WorklogSelection,
  WorklogEntryInput,
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

export async function listPendingWorklogs(): Promise<Worklog[]> {
  const data = await json<{ worklogs: Worklog[] }>(
    await apiFetch("/api/v1/worklog/pending"),
    "Failed to fetch pending worklogs"
  )
  return data.worklogs
}

export interface ConfirmPayload {
  transcript?: string
  log_date?: string | null
  entries: WorklogEntryInput[]
}

export async function confirmWorklog(id: number, payload: ConfirmPayload): Promise<Worklog> {
  return json(
    await apiFetch(`/api/v1/worklog/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    "Failed to confirm worklog"
  )
}

export async function discardWorklog(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/worklog/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to discard worklog")
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
