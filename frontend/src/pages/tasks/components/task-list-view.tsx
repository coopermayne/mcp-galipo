import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { updateTask, rescheduleOverdueTasks } from "@/services/tasks"
import { getUnreadCounts } from "@/services/comments"
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
  /** Show completed tasks (changes grouping/sorting to use completion_date) */
  showDone?: boolean
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
  showDone,
  noBorder,
  invalidateKeys = [["tasks"]],
}: TaskListViewProps) {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<TaskListItemType | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])

  const { data: unreadCounts } = useQuery({
    queryKey: ["comment-unread-counts", "task", taskIds],
    queryFn: () => getUnreadCounts("task", taskIds),
    enabled: taskIds.length > 0,
  })

  const updateFieldMutation = useMutation({
    mutationFn: ({ taskId, field, value }: { taskId: number; field: string; value: unknown }) =>
      updateTask(taskId, { [field]: value }),
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      queryClient.invalidateQueries({ queryKey: ["comment-unread-counts"] })
    },
    onError: (e) => toast.error(e.message),
  })

  const groups = useMemo(
    () => groupTasks(tasks, groupBy, showDone),
    [tasks, groupBy, showDone]
  )

  const rescheduleMutation = useMutation({
    mutationFn: ({ date, taskIds }: { date: string; taskIds: number[] }) =>
      rescheduleOverdueTasks(date, taskIds),
    onSuccess: (_data, variables) => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      toast.success(`Rescheduled ${variables.taskIds.length} task(s)`)
    },
    onError: (e) => toast.error(e.message),
  })

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
              <div className="flex w-full items-center bg-muted/50 border-b border-border/50">
                <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2 hover:bg-muted transition-colors cursor-pointer">
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
                {group.key === "overdue" && (
                  <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground mr-3 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Reschedule all
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Calendar
                        mode="single"
                        defaultMonth={new Date()}
                        disabled={{ before: new Date() }}
                        onSelect={(date) => {
                          if (!date) return
                          const y = date.getFullYear()
                          const m = String(date.getMonth() + 1).padStart(2, "0")
                          const d = String(date.getDate()).padStart(2, "0")
                          const iso = `${y}-${m}-${d}`
                          const taskIds = group.tasks.map((t) => t.id)
                          rescheduleMutation.mutate({ date: iso, taskIds })
                          setRescheduleOpen(false)
                        }}
                        className="p-2.5"
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
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
                    showDone={showDone}
                    unreadCount={unreadCounts?.[task.id]}
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
