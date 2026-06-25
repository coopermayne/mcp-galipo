import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getTasks, createTask, updateTask } from "@/services/tasks"
import type { TaskListItem as TaskListItemType } from "@/types/task"
import { TaskListItem } from "@/pages/tasks/components/task-list-item"
import { TaskDetailDialog } from "@/pages/tasks/components/task-detail-dialog"

interface EventTasksSectionProps {
  eventId: number
  /** Case the event belongs to — new tasks inherit it (null for case-less events) */
  caseId: number | null
}

export function EventTasksSection({ eventId, caseId }: EventTasksSectionProps) {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<TaskListItemType | null>(null)
  const [newDescription, setNewDescription] = useState("")

  const tasksKey = ["tasks", "event", eventId]

  const { data } = useQuery({
    queryKey: tasksKey,
    queryFn: () => getTasks({ event_id: eventId, limit: 200 }),
  })

  const tasks = data?.tasks ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tasksKey })
    queryClient.invalidateQueries({ queryKey: ["tasks"] })
    queryClient.invalidateQueries({ queryKey: ["event", eventId] })
  }

  const updateMutation = useMutation({
    mutationFn: ({ taskId, field, value }: { taskId: number; field: string; value: unknown }) =>
      updateTask(taskId, { [field]: value }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  const createMutation = useMutation({
    mutationFn: (description: string) =>
      createTask({
        description,
        event_id: eventId,
        case_id: caseId ?? undefined,
        status: "Pending",
      }),
    onSuccess: () => {
      setNewDescription("")
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  function handleAdd() {
    const desc = newDescription.trim()
    if (!desc || createMutation.isPending) return
    createMutation.mutate(desc)
  }

  return (
    <div className="border-t pt-3">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Tasks
      </span>

      <TooltipProvider delayDuration={300}>
        <div className="mt-1.5 border border-border">
          {tasks.length > 0 &&
            tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                onTaskClick={setSelectedTask}
                onUpdateTask={(taskId, field, value) =>
                  updateMutation.mutate({ taskId, field, value })
                }
                hideCaseBadge
                hideEventLinker
              />
            ))}

          {/* Quick-add row */}
          <div className="flex items-center gap-2 px-3 py-2">
            <HugeiconsIcon
              icon={Add01Icon}
              className="size-4 shrink-0 text-muted-foreground/50"
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              onBlur={handleAdd}
              placeholder="Add a task..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      </TooltipProvider>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
      />
    </div>
  )
}
