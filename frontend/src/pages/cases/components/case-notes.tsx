import type { CaseNote } from "@/types/case"

interface CaseNotesProps {
  notes: CaseNote[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function CaseNotes({ notes }: CaseNotesProps) {
  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Notes
        {notes.length > 0 && (
          <span className="ml-1 text-xs font-normal opacity-60">
            ({notes.length})
          </span>
        )}
      </h2>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-3 divide-y">
          {notes.map((note) => (
            <div key={note.id} className="pt-2 first:pt-0">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(note.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
