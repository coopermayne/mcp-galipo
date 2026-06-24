import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { updateWorklogEntry, deleteWorklogEntry, formatHours } from "@/services/worklog"
import type { WorklogEntry } from "@/types/worklog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { InlineCasePicker } from "@/pages/worklog/components/worklog-pickers"

interface WorklogEntryRowProps {
  entry: WorklogEntry
  dayKey: string
}

/** One compact, editable ledger row: description · hours · case chip · delete.
 * Description commits on blur; hours is an underlined number that opens a small
 * editor (with a Done button) on click; case commits on change. */
export function WorklogEntryRow({ entry, dayKey }: WorklogEntryRowProps) {
  const queryClient = useQueryClient()
  const [desc, setDesc] = useState(entry.description)
  const [hours, setHours] = useState(entry.hours)
  const [editingHours, setEditingHours] = useState(false)
  const cancelRef = useRef(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["worklog-day", dayKey] })

  const update = useMutation({
    mutationFn: (payload: Parameters<typeof updateWorklogEntry>[1]) =>
      updateWorklogEntry(entry.id, payload),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteWorklogEntry(entry.id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  function commitDesc() {
    if (desc !== entry.description) update.mutate({ description: desc })
  }

  function startEditHours() {
    setHours(entry.hours)
    cancelRef.current = false
    setEditingHours(true)
  }
  // Functional update guarantees the commit fires once even if both Done's
  // click and the input's blur land (the second call sees prev=false).
  function commitHours() {
    setEditingHours((prev) => {
      if (prev && !cancelRef.current && hours !== entry.hours) update.mutate({ hours })
      cancelRef.current = false
      return false
    })
  }
  function cancelHours() {
    cancelRef.current = true
    setHours(entry.hours)
    setEditingHours(false)
  }

  return (
    <div className="group flex items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-accent/40">
      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={commitDesc}
        placeholder="What did you do?"
        className="h-7 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1 dark:bg-transparent"
      />

      {editingHours ? (
        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            min={0}
            step={0.1}
            autoFocus
            value={hours}
            onChange={(e) => setHours(Math.max(0, parseFloat(e.target.value) || 0))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitHours() }
              else if (e.key === "Escape") { e.preventDefault(); cancelHours() }
            }}
            onBlur={commitHours}
            className="h-7 w-14 px-1.5 text-right text-xs tabular-nums"
          />
          <span className="text-[10px] text-muted-foreground">h</span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs"
            // Keep input focus so its blur doesn't pre-empt this click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitHours}
          >
            Done
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditHours}
          className="shrink-0 text-xs tabular-nums text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
        >
          {formatHours(entry.hours)}
        </button>
      )}

      <InlineCasePicker
        value={entry.case_id}
        shortName={entry.short_name}
        caseName={entry.case_name}
        caseColor={entry.case_color}
        guess={!entry.case_id ? entry.raw_reference : null}
        onChange={(caseId) => update.mutate({ case_id: caseId })}
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="Delete entry"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this work-log entry. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
