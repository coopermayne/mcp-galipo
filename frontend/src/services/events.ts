import { apiFetch } from "@/lib/api"

export interface CreateEventData {
  case_id: number
  date: string
  description: string
  time?: string
  location?: string
  document_link?: string
  calculation_note?: string
  starred?: boolean
}

export interface UpdateEventData {
  date?: string
  description?: string
  time?: string | null
  location?: string | null
  document_link?: string | null
  calculation_note?: string | null
  starred?: boolean
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
