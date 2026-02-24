import { useState, useEffect, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Intake } from "@/types/intake"
import { updateIntake } from "@/services/intakes"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/common/rich-text-editor"

interface IntakeNotesProps {
  intake: Intake
}

export function IntakeNotes({ intake }: IntakeNotesProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(intake.notes ?? "")
  const [dirty, setDirty] = useState(false)

  // Sync when intake changes (e.g. after refetch)
  useEffect(() => {
    setNotes(intake.notes ?? "")
    setDirty(false)
  }, [intake.notes])

  const saveMutation = useMutation({
    mutationFn: () => updateIntake(intake.id, { notes }),
    onSuccess: (data) => {
      queryClient.setQueryData(["intake", intake.id], data.intake)
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
    <div className="border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notes</h3>
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
      <RichTextEditor
        content={notes}
        onUpdate={handleUpdate}
        placeholder="Add notes about this intake..."
      />
    </div>
  )
}
