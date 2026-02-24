import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { updateTask } from "@/services/tasks"
import type { TaskListItem as TaskListItemType } from "@/types/task"
import { TaskListItem } from "@/pages/tasks/components/task-list-item"
import { TaskDetailDialog } from "@/pages/tasks/components/task-detail-dialog"
import { groupTasks, type TaskGroupBy } from "@/pages/tasks/group-tasks"
import { getBadgeStyle } from "@/lib/badge-colors"
import { cn } from "@/lib/utils"

interface TaskListViewProps {
  tasks: TaskListItemType[]
  isLoading?: boolean
  groupBy?: TaskGroupBy
  hideCaseBadge?: boolean
  /** Remove outer border (when embedded inside a Card) */
  noBorder?: boolean
  /** Query keys to invalidate after a task update */
  invalidateKeys?: unknown[][]
}

export function TaskListView({
  tasks,
  isLoading,
  groupBy = "date",
  hideCaseBadge,
  noBorder,
  invalidateKeys = [["tasks"]],
}: TaskListViewProps) {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<TaskListItemType | null>(null)

  const updateFieldMutation = useMutation({
    mutationFn: ({ taskId, field, value }: { taskId: number; field: string; value: unknown }) =>
      updateTask(taskId, { [field]: value }),
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const groups = useMemo(
    () => groupTasks(tasks, groupBy),
    [tasks, groupBy]
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className={noBorder ? undefined : "border border-border"}>
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                <Skeleton className="size-5 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <Collapsible key={group.key} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors border-b border-border/50 cursor-pointer">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-3.5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90"
                />
                {group.caseColor ? (
                  <Badge
                    className="text-[10px] px-1.5 py-0 h-4 leading-none"
                    style={getBadgeStyle(group.caseColor)}
                  >
                    {group.label}
                  </Badge>
                ) : (
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      group.key === "overdue" && "text-destructive"
                    )}
                  >
                    {group.label}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {group.tasks.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {group.tasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onTaskClick={setSelectedTask}
                    onUpdateTask={(taskId, field, value) =>
                      updateFieldMutation.mutate({ taskId, field, value })
                    }
                    hideCaseBadge={hideCaseBadge || groupBy === "case"}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No tasks found.
          </div>
        )}
      </div>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
      />
    </TooltipProvider>
  )
}
