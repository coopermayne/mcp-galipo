import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon } from "@hugeicons/core-free-icons"
import type { CaseNote } from "@/types/case"
import { createNote, deleteNote } from "@/services/notes"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

function formatTimestamp(dateStr: string | null): string {
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

interface CaseNotesPanelProps {
  notes: CaseNote[]
  caseId: number
}

export function CaseNotesPanel({ notes, caseId }: CaseNotesPanelProps) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState("")
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
  }

  const addMutation = useMutation({
    mutationFn: () => createNote({ case_id: caseId, content }),
    onSuccess: () => {
      toast.success("Note added")
      setContent("")
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      toast.success("Note deleted")
      setDeleteId(null)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const sorted = [...notes].sort((a, b) => {
    const aDate = a.created_at ?? ""
    const bDate = b.created_at ?? ""
    return bDate.localeCompare(aDate)
  })

  return (
    <>
      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle>
            Notes
            {notes.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({notes.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No notes yet.</p>
          ) : (
            <div className="space-y-3 divide-y">
              {sorted.map((note) => (
                <div key={note.id} className="pt-2 first:pt-0 group/note">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs whitespace-pre-wrap flex-1">
                      {note.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDeleteId(note.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0"
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatTimestamp(note.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2 items-stretch">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="text-xs resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!content.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteId && removeMutation.mutate(deleteId)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
