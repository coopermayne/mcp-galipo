import { apiFetch } from "@/lib/api"
import type { EventListResponse, EventDetail, GetEventsParams } from "@/types/event"

export interface CreateEventData {
  case_id?: number
  date: string
  description: string
  time?: string
  location?: string
  document_link?: string
  calculation_note?: string
  notes?: string
  starred?: boolean
  event_type?: string
  end_date?: string
  blocks_calendar?: boolean
}

export interface UpdateEventData {
  date?: string
  description?: string
  time?: string | null
  location?: string | null
  document_link?: string | null
  calculation_note?: string | null
  notes?: string | null
  starred?: boolean
  event_type?: string | null
  end_date?: string | null
  blocks_calendar?: boolean
}

export async function createEvent(data: CreateEventData) {
  const res = await apiFetch("/api/v1/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create event")
  return res.json()
}

export async function updateEvent(eventId: number, data: UpdateEventData) {
  const res = await apiFetch(`/api/v1/events/${eventId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update event")
  return res.json()
}

export async function deleteEvent(eventId: number) {
  const res = await apiFetch(`/api/v1/events/${eventId}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete event")
  return res.json()
}

export interface CaseEvent {
  id: number
  description: string
  date: string
  time: string | null
  location: string | null
}

export async function getEvents(params: GetEventsParams = {}): Promise<EventListResponse> {
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) qs.set(key, String(val))
  }
  const url = `/api/v1/events${qs.toString() ? `?${qs}` : ""}`
  const res = await apiFetch(url)
  if (!res.ok) throw new Error("Failed to fetch events")
  return res.json()
}

export async function getEvent(eventId: number): Promise<{ event: EventDetail }> {
  const res = await apiFetch(`/api/v1/events/${eventId}`)
  if (!res.ok) throw new Error("Failed to fetch event")
  return res.json()
}

export async function addAttendee(eventId: number, userId: number) {
  const res = await apiFetch(`/api/v1/events/${eventId}/attendees/${userId}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to add attendee")
  return res.json()
}

export async function removeAttendee(eventId: number, userId: number) {
  const res = await apiFetch(`/api/v1/events/${eventId}/attendees/${userId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to remove attendee")
  return res.json()
}

export async function getEventsByCase(caseId: number): Promise<CaseEvent[]> {
  const [upcoming, past] = await Promise.all([
    apiFetch(`/api/v1/events?case_id=${caseId}&limit=200`),
    apiFetch(`/api/v1/events?case_id=${caseId}&include_past=true&past_days=3650&limit=200`),
  ])
  if (!upcoming.ok || !past.ok) throw new Error("Failed to fetch events")
  const [u, p] = await Promise.all([upcoming.json(), past.json()])
  // Merge and deduplicate by id
  const map = new Map<number, CaseEvent>()
  for (const e of [...p.events, ...u.events]) {
    map.set(e.id, e)
  }
  // Sort by date descending (most recent first)
  return Array.from(map.values()).sort(
    (a, b) => b.date.localeCompare(a.date)
  )
}
