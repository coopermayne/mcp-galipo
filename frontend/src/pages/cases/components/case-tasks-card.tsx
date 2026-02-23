import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import type { CaseTask } from "@/types/case"
import { updateTask } from "@/services/tasks"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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

interface CaseTasksCardProps {
  tasks: CaseTask[]
  caseId: number
  onAdd: () => void
}

export function CaseTasksCard({ tasks, caseId, onAdd }: CaseTasksCardProps) {
  const queryClient = useQueryClient()
  const [showDone, setShowDone] = useState(false)

  const pending = useMemo(
    () => tasks.filter((t) => t.status !== "Done"),
    [tasks]
  )
  const done = useMemo(
    () => tasks.filter((t) => t.status === "Done"),
    [tasks]
  )

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, isDone }: { taskId: number; isDone: boolean }) =>
      updateTask(taskId, {
        status: isDone ? "Done" : "Pending",
        completion_date: isDone
          ? new Date().toISOString().split("T")[0]
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Tasks
          {pending.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({pending.length} pending)
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onAdd}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No tasks.</p>
        ) : (
          <div className="space-y-1">
            {pending.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-1 text-xs">
                <Checkbox
                  checked={false}
                  onCheckedChange={() =>
                    toggleMutation.mutate({ taskId: t.id, isDone: true })
                  }
                  className="size-3.5"
                />
                <span className="flex-1 truncate">{t.description}</span>
                {t.urgency && (
                  <Badge
                    className={`border-0 text-[10px] px-1.5 py-0 shrink-0 ${urgencyColors[t.urgency] ?? ""}`}
                  >
                    {t.urgency}
                  </Badge>
                )}
                {t.due_date && (
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {formatDate(t.due_date)}
                  </span>
                )}
              </div>
            ))}
            {done.length > 0 && (
              <div className="pt-1 border-t mt-1">
                <button
                  type="button"
                  onClick={() => setShowDone((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDone ? "Hide" : "Show"} {done.length} completed
                </button>
                {showDone && (
                  <div className="space-y-1 mt-1">
                    {done.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
                      >
                        <Checkbox
                          checked
                          onCheckedChange={() =>
                            toggleMutation.mutate({ taskId: t.id, isDone: false })
                          }
                          className="size-3.5"
                        />
                        <span className="flex-1 truncate line-through">
                          {t.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
