import { useState, useEffect, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateCase } from "@/services/cases"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/common/rich-text-editor"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface CaseNotesPanelProps {
  caseId: number
  notes: string | null
}

const NOTES_LIMIT = 2000

export function CaseNotesPanel({ caseId, notes: initialNotes }: CaseNotesPanelProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setNotes(initialNotes ?? "")
    setDirty(false)
  }, [initialNotes])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (notes.length > NOTES_LIMIT) {
        return Promise.reject(new Error(`Notes must be ${NOTES_LIMIT} characters or fewer`))
      }
      return updateCase(caseId, { notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      setDirty(false)
      toast.success("Notes saved")
    },
    onError: (e) => {
      toast.error(e.message)
    },
  })

  const handleUpdate = useCallback(
    (markdown: string) => {
      setNotes(markdown)
      setDirty(true)
    },
    []
  )

  const overLimit = notes.length > NOTES_LIMIT
  const showCounter = notes.length > NOTES_LIMIT * 0.8

  return (
    <Card size="sm">
      <CardHeader className="border-b bg-muted/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Notes</CardTitle>
            {showCounter && (
              <span className={`text-[10px] tabular-nums ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {notes.length}/{NOTES_LIMIT}
              </span>
            )}
          </div>
          {dirty && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || overLimit}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <RichTextEditor
          content={notes}
          onUpdate={handleUpdate}
          placeholder="Add notes about this case..."
          className="border-0"
        />
      </CardContent>
    </Card>
  )
}
