import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon, Task01Icon, Message01Icon, Loading03Icon, Tick02Icon,
} from "@hugeicons/core-free-icons"
import { getWorklogCandidates, consolidateWorklog } from "@/services/worklog"
import type { WorklogCandidate, WorklogSelection } from "@/types/worklog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface WorklogComposerProps {
  dayKey: string
  /** True while a consolidation is in flight for this day (from the day query). */
  processing: boolean
}

function selKey(c: WorklogCandidate) {
  return `${c.source_type}:${c.source_id}`
}

const GROUPS: { key: "events" | "tasks" | "comments"; label: string; icon: typeof Calendar03Icon }[] = [
  { key: "events", label: "Events", icon: Calendar03Icon },
  { key: "tasks", label: "Tasks done", icon: Task01Icon },
  { key: "comments", label: "Comments", icon: Message01Icon },
]

/** "Add to this day" — pick surfaced items + write a memo, consolidate via AI.
 * The resulting entries append to the day ledger (the day query polls for them). */
export function WorklogComposer({ dayKey, processing }: WorklogComposerProps) {
  const queryClient = useQueryClient()
  const [transcript, setTranscript] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: candidates } = useQuery({
    queryKey: ["worklog-candidates", dayKey],
    queryFn: () => getWorklogCandidates(dayKey),
  })

  const consolidate = useMutation({
    mutationFn: () => {
      const all = [
        ...(candidates?.events ?? []),
        ...(candidates?.tasks ?? []),
        ...(candidates?.comments ?? []),
      ]
      const selections: WorklogSelection[] = all
        .filter((c) => selected.has(selKey(c)))
        .map((c) => ({ source_type: c.source_type, source_id: c.source_id }))
      return consolidateWorklog({ transcript, log_date: dayKey, selections })
    },
    onSuccess: () => {
      // The day query will pick up the in-flight log and poll until entries land.
      queryClient.invalidateQueries({ queryKey: ["worklog-day", dayKey] })
      setTranscript("")
      setSelected(new Set())
      toast.success("Consolidating — entries will appear shortly")
    },
    onError: (e) => toast.error(e.message),
  })

  function toggle(c: WorklogCandidate) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = selKey(c)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const isProcessing = processing || consolidate.isPending
  const hasContent = transcript.trim().length > 0 || selected.size > 0
  const totalCandidates =
    (candidates?.events.length ?? 0) +
    (candidates?.tasks.length ?? 0) +
    (candidates?.comments.length ?? 0)

  return (
    <div className="border">
      <div className="px-3 h-10 flex items-center border-b bg-muted/30">
        <span className="text-sm font-semibold">Add to this day</span>
        {isProcessing && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" />
            consolidating…
          </span>
        )}
      </div>

      <div className="p-3 space-y-4">
        {totalCandidates > 0 && (
          <div className="space-y-4">
            {GROUPS.map(({ key, label, icon }) => {
              const items = candidates?.[key] ?? []
              if (items.length === 0) return null
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <HugeiconsIcon icon={icon} className="size-3.5" />
                    {label}
                  </div>
                  {items.map((c) => {
                    const k = selKey(c)
                    const on = selected.has(k)
                    return (
                      <div
                        key={k}
                        role="button"
                        onClick={() => toggle(c)}
                        className={cn(
                          "flex w-full items-start gap-2.5 border px-2.5 py-1.5 text-left cursor-pointer transition-colors",
                          on ? "border-info/60 bg-info/5" : "border-input hover:bg-muted/40"
                        )}
                      >
                        <Checkbox checked={on} className="mt-0.5 pointer-events-none" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {(c.short_name || c.case_name) && (
                              <span className="text-xs font-medium truncate">
                                {c.short_name || c.case_name}
                              </span>
                            )}
                            {c.when && (
                              <span className="text-[10px] text-muted-foreground shrink-0">{c.when}</span>
                            )}
                            {c.already_logged && (
                              <span className="ml-auto flex items-center gap-0.5 text-[10px] text-success-foreground shrink-0">
                                <HugeiconsIcon icon={Tick02Icon} className="size-3" />
                                logged
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={4}
          placeholder="What else did you work on? e.g. Drafted the opposition in Armstrong, call with Tanner about Reyes…"
          className="resize-none"
        />

        <div className="flex justify-end">
          <Button onClick={() => consolidate.mutate()} disabled={!hasContent || isProcessing}>
            {isProcessing ? "Consolidating…" : "Consolidate"}
          </Button>
        </div>
      </div>
    </div>
  )
}
