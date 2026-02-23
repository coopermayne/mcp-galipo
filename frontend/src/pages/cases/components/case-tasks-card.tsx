import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import type { CaseTask } from "@/types/case"
import { updateTask } from "@/services/tasks"
import { statuses, urgencies } from "@/pages/tasks/task-data"
import { cn } from "@/lib/utils"
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

interface CaseTasksCardProps {
  tasks: CaseTask[]
  caseId: number
  onAdd: () => void
}

function TaskRow({
  task,
  onToggle,
}: {
  task: CaseTask
  onToggle: (isDone: boolean) => void
}) {
  const isDone = task.status === "Done"
  const status = statuses.find((s) => s.value === task.status)
  const urgency = urgencies.find((u) => u.value === task.urgency)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue =
    task.due_date && parseLocalDate(task.due_date) < today && !isDone

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 text-xs group/task",
        isDone && "text-muted-foreground"
      )}
    >
      {/* Status icon — clickable to toggle done */}
      <button
        type="button"
        onClick={() => onToggle(!isDone)}
        className="shrink-0"
        title={isDone ? "Mark pending" : "Mark done"}
      >
        {status ? (
          <status.icon className={cn("size-4", status.iconColor)} />
        ) : (
          <div className="size-4" />
        )}
      </button>

      {/* Description */}
      <span
        className={cn(
          "flex-1 truncate",
          isDone && "line-through"
        )}
      >
        {task.description}
      </span>

      {/* Urgency icon */}
      {urgency && !isDone && (
        <urgency.icon
          className={cn("size-3.5 shrink-0", urgency.iconColor)}
        />
      )}

      {/* Due date */}
      {task.due_date && !isDone && (
        <span
          className={cn(
            "tabular-nums shrink-0",
            isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
          )}
        >
          {formatDate(task.due_date)}
        </span>
      )}
    </div>
  )
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
          <div className="space-y-0.5">
            {pending.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={(isDone) =>
                  toggleMutation.mutate({ taskId: t.id, isDone })
                }
              />
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
                  <div className="space-y-0.5 mt-1">
                    {done.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={(isDone) =>
                          toggleMutation.mutate({ taskId: t.id, isDone })
                        }
                      />
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
