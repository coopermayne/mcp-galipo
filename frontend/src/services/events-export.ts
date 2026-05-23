import { apiFetch } from "@/lib/api"
import { downloadBlob } from "@/lib/download"

/**
 * Download an .ics calendar file containing the specified events.
 * The backend renders the file; the browser triggers a download.
 */
export async function exportEventsIcs(eventIds: number[]): Promise<void> {
  const res = await apiFetch("/api/v1/events/export.ics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_ids: eventIds }),
  })
  if (!res.ok) throw new Error("Failed to export events")
  const blob = await res.blob()
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(blob, `galipo-events-${stamp}.ics`)
}
