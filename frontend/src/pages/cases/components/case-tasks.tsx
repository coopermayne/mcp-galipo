import { useMemo } from "react"
import type { CaseTask } from "@/types/case"
import { Badge } from "@/components/ui/badge"

interface CaseTasksProps {
  tasks: CaseTask[]
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const urgencyColors: Record<string, string> = {
  Urgent: "bg-destructive text-white",
  High: "bg-warning text-warning-foreground",
  Medium: "bg-info text-info-foreground",
  Low: "bg-muted text-muted-foreground",
}

export function CaseTasks({ tasks }: CaseTasksProps) {
  const pending = useMemo(
    () => tasks.filter((t) => t.status !== "Done"),
    [tasks]
  )
  const done = useMemo(
    () => tasks.filter((t) => t.status === "Done"),
    [tasks]
  )

  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Tasks
        {tasks.length > 0 && (
          <span className="ml-1 text-xs font-normal opacity-60">
            ({pending.length} pending)
          </span>
        )}
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks.</p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <span className="size-1.5 shrink-0 border border-muted-foreground/50 bg-transparent" />
              <span className="flex-1 truncate">{t.description}</span>
              {t.urgency && (
                <Badge className={`border-0 text-[10px] px-1.5 py-0 ${urgencyColors[t.urgency] ?? ""}`}>
                  {t.urgency}
                </Badge>
              )}
              {t.due_date && (
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatDate(t.due_date)}
                </span>
              )}
            </div>
          ))}
          {done.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1 border-t">
              {done.length} completed
            </p>
          )}
        </div>
      )}
    </div>
  )
}
