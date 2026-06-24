import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { updateWorklogEntry, deleteWorklogEntry } from "@/services/worklog"
import type { WorklogEntry } from "@/types/worklog"
import { Input } from "@/components/ui/input"
import { CasePicker, PeopleEditor } from "@/pages/worklog/components/worklog-pickers"

interface WorklogEntryRowProps {
  entry: WorklogEntry
  dayKey: string
}

/** One editable ledger row. Each field commits on its own (text on blur, case
 * and people on change) via PATCH; works on past days too. */
export function WorklogEntryRow({ entry, dayKey }: WorklogEntryRowProps) {
  const queryClient = useQueryClient()
  const [desc, setDesc] = useState(entry.description)
  const [minutes, setMinutes] = useState(entry.minutes)

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
  function commitMinutes() {
    if (minutes !== entry.minutes) update.mutate({ minutes })
  }

  return (
    <div className="border p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={commitDesc}
          className="flex-1"
          placeholder="What did you do?"
        />
        <button
          type="button"
          onClick={() => remove.mutate()}
          className="text-muted-foreground hover:text-destructive shrink-0 mt-2"
          title="Delete entry"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            step={15}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
            onBlur={commitMinutes}
            className="w-20 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
        <div className="min-w-[220px] flex-1">
          <CasePicker
            value={entry.case_id}
            label={entry.short_name || entry.case_name}
            guess={!entry.case_id ? entry.raw_reference : null}
            onChange={(c) => update.mutate({ case_id: c?.id ?? null })}
          />
        </div>
      </div>

      <PeopleEditor
        people={entry.people}
        onAdd={(p) => {
          if (!entry.people.some((x) => x.id === p.id)) {
            update.mutate({ person_ids: [...entry.people.map((x) => x.id), p.id] })
          }
        }}
        onRemove={(id) =>
          update.mutate({ person_ids: entry.people.map((x) => x.id).filter((x) => x !== id) })
        }
      />
    </div>
  )
}
