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

export function CaseNotesPanel({ caseId, notes: initialNotes }: CaseNotesPanelProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [dirty, setDirty] = useState(false)

  // Sync when case data changes (e.g. after refetch)
  useEffect(() => {
    setNotes(initialNotes ?? "")
    setDirty(false)
  }, [initialNotes])

  const saveMutation = useMutation({
    mutationFn: () => updateCase(caseId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      setDirty(false)
      toast.success("Notes saved")
    },
    onError: () => {
      toast.error("Failed to save notes")
    },
  })

  const handleUpdate = useCallback(
    (markdown: string) => {
      setNotes(markdown)
      setDirty(true)
    },
    []
  )

  return (
    <Card size="sm">
      <CardHeader className="border-b bg-muted/40">
        <div className="flex items-center justify-between">
          <CardTitle>Notes</CardTitle>
          {dirty && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
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
