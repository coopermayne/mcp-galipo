import { useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import type { TaskListItem } from "@/types/task"
import type { TaskStatus, Urgency } from "@/types/case"
import { getTask, updateTask, deleteTask } from "@/services/tasks"
import { getStaff } from "@/services/staff"
import { getEventsByCase, type CaseEvent } from "@/services/events"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { DetailDialogActions } from "@/components/common/detail-dialog-actions"
import { getBadgeStyle } from "@/lib/badge-colors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"

const TASK_STATUSES: TaskStatus[] = [
  "Pending",
  "Active",
  "Partially Done",
  "Blocked",
  "Awaiting Atty Review",
  "Done",
]

const URGENCIES: Urgency[] = ["Low", "Medium", "High", "Urgent"]

interface TaskDetailDialogProps {
  task: TaskListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
}: TaskDetailDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDivElement>(null)

  const { data: detail } = useQuery({
    queryKey: ["task", task?.id],
    queryFn: () => getTask(task!.id),
    enabled: !!task && open,
  })

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })

  const { data: caseEvents } = useQuery({
    queryKey: ["events", "case", task?.case_id, "list"],
    queryFn: () => getEventsByCase(task!.case_id!),
    enabled: !!task && !!task.case_id && open,
    staleTime: 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: ({ field, value }: { field: string; value: unknown }) =>
      updateTask(task!.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["task", task?.id] })
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task deleted")
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  if (!task) return null

  const d = detail ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogRef} className="sm:max-w-md">
        <DetailDialogActions
          entityName="task"
          onDelete={() => deleteMutation.mutate()}
          isPending={deleteMutation.isPending}
        />
        <DialogHeader>
          {/* Case badge */}
          {task.short_name && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                onOpenChange(false)
                navigate(`/cases/${task.case_id}`)
              }}
              className="w-fit h-auto p-0 border-0"
            >
              <Badge
                className="hover:opacity-80 transition-opacity"
                style={getBadgeStyle(task.case_color)}
              >
                {task.short_name}
              </Badge>
            </Button>
          )}
          <DialogTitle>
            <InlineEditField
              value={d?.description ?? task.description}
              onSave={(v) => mutation.mutate({ field: "description", value: v })}
            />
          </DialogTitle>
          {task.case_name && (
            <DialogDescription>{task.case_name}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <Select
              value={d?.status ?? task.status}
              onValueChange={(v) => mutation.mutate({ field: "status", value: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Urgency */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Urgency
            </span>
            <Select
              value={d?.urgency ?? task.urgency ?? "Medium"}
              onValueChange={(v) => mutation.mutate({ field: "urgency", value: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCIES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Assignee
            </span>
            <Select
              value={
                (d?.assignee_id ?? task.assignee_id)?.toString() ?? "none"
              }
              onValueChange={(v) =>
                mutation.mutate({
                  field: "assignee_id",
                  value: v === "none" ? null : Number(v),
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {staffData?.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.firstName} {s.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Due Date
            </span>
            <InlineEditField
              value={d?.due_date ?? task.due_date ?? ""}
              onSave={(v) =>
                mutation.mutate({ field: "due_date", value: v || null })
              }
              type="date"
              placeholder="No date"
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Linked event */}
        {task.case_id && (
          <div className="border-t pt-3">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Linked Event
            </span>
            <Combobox
              value={caseEvents?.find((e) => e.id === (d?.event_id ?? task.event_id)) ?? null}
              onValueChange={(event: CaseEvent | null) => {
                mutation.mutate({
                  field: "event_id",
                  value: event?.id ?? null,
                })
              }}
              items={caseEvents ?? []}
              itemToStringLabel={(event: CaseEvent) => event.description}
            >
              <ComboboxInput
                placeholder="Search events..."
                showClear={!!(d?.event_id ?? task.event_id)}
                showTrigger
                className="mt-1 text-xs"
              />
              <ComboboxContent container={dialogRef}>
                <ComboboxList>
                  {(event: CaseEvent) => (
                    <ComboboxItem key={event.id} value={event}>
                      <div className="flex flex-col">
                        <span>{event.description}</span>
                        {event.date && (
                          <span className="text-muted-foreground text-[10px]">
                            {event.date}
                          </span>
                        )}
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxList>
                <ComboboxEmpty>No events found</ComboboxEmpty>
              </ComboboxContent>
            </Combobox>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
