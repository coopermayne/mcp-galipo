import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Task01Icon, Message01Icon } from "@hugeicons/core-free-icons"
import { getWorklogCandidates } from "@/services/worklog"
import type { WorklogCandidate, WorklogSelection } from "@/types/worklog"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface WorklogInputProps {
  onConsolidate: (payload: {
    transcript: string
    log_date: string
    selections: WorklogSelection[]
  }) => void
  isSubmitting: boolean
}

function selKey(c: WorklogCandidate) {
  return `${c.source_type}:${c.source_id}`
}

const GROUPS: { key: "events" | "tasks" | "comments"; label: string; icon: typeof Calendar03Icon }[] = [
  { key: "events", label: "Events", icon: Calendar03Icon },
  { key: "tasks", label: "Tasks done", icon: Task01Icon },
  { key: "comments", label: "Comments", icon: Message01Icon },
]

export function WorklogInput({ onConsolidate, isSubmitting }: WorklogInputProps) {
  const [logDate, setLogDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [transcript, setTranscript] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["worklog-candidates", logDate],
    queryFn: () => getWorklogCandidates(logDate),
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

  function handleSubmit() {
    const all = [
      ...(candidates?.events ?? []),
      ...(candidates?.tasks ?? []),
      ...(candidates?.comments ?? []),
    ]
    const selections: WorklogSelection[] = all
      .filter((c) => selected.has(selKey(c)))
      .map((c) => ({ source_type: c.source_type, source_id: c.source_id }))
    onConsolidate({ transcript, log_date: logDate, selections })
  }

  const hasContent = transcript.trim().length > 0 || selected.size > 0
  const totalCandidates =
    (candidates?.events.length ?? 0) +
    (candidates?.tasks.length ?? 0) +
    (candidates?.comments.length ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Date</span>
        <div className="w-48">
          <DatePicker value={logDate} onChange={(d) => setLogDate(d ?? logDate)} />
        </div>
      </div>

      {/* Surfaced items */}
      <div className="border">
        <div className="px-3 h-10 flex items-center border-b bg-muted/30">
          <span className="text-sm font-semibold">Already on record</span>
          {totalCandidates > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({totalCandidates})</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{selected.size} selected</span>
        </div>
        <div className="p-3 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : totalCandidates === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Nothing on record for this date — just write below.
            </p>
          ) : (
            GROUPS.map(({ key, label, icon }) => {
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
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggle(c)}
                        className={cn(
                          "flex w-full items-start gap-2.5 border px-2.5 py-1.5 text-left transition-colors",
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
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Free text */}
      <div className="space-y-1.5">
        <span className="text-sm font-semibold">What else did you work on?</span>
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={6}
          placeholder="e.g. Spent the morning on the opposition to the MTD in Armstrong, then a call with Tanner about Reyes, then drafted discovery for Armstrong again..."
          className="resize-none"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!hasContent || isSubmitting}>
          {isSubmitting ? "Starting…" : "Consolidate my day"}
        </Button>
      </div>
    </div>
  )
}
