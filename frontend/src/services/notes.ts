import { apiFetch } from "@/lib/api"

export interface CreateNoteData {
  case_id: number
  content: string
}

export async function createNote(data: CreateNoteData) {
  const res = await apiFetch("/api/v1/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create note")
  return res.json()
}

export async function deleteNote(noteId: number) {
  const res = await apiFetch(`/api/v1/notes/${noteId}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete note")
  return res.json()
}
