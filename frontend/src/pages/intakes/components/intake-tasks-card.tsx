import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Search01Icon,
  CheckmarkSquare01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { getTasks, createTask } from "@/services/tasks"
import { getStaff } from "@/services/staff"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TaskListView } from "@/pages/tasks/components/task-list-view"
import { cn } from "@/lib/utils"

const URGENCIES = ["Low", "Medium", "High", "Urgent"]

interface IntakeTasksCardProps {
  intakeId: number
  onAiAdd?: () => void
}

export function IntakeTasksCard({ intakeId, onAiAdd }: IntakeTasksCardProps) {
  const [search, setSearch] = useState("")
  const [showDone, setShowDone] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "intake", intakeId, showDone],
    queryFn: () =>
      getTasks({
        intake_id: intakeId,
        limit: 500,
        ...(showDone
          ? { status: "Done" }
          : { exclude_status: "Done" }),
      }),
  })

  const tasks = data?.tasks ?? []

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks
    const q = search.toLowerCase()
    return tasks.filter((t) => t.description.toLowerCase().includes(q))
  }, [tasks, search])

  const countLabel = showDone
    ? `${tasks.length} done`
    : `${tasks.length} pending`

  return (
    <>
      <Card size="sm">
        <CardHeader className="border-b bg-muted/40">
          <CardTitle>
            Tasks
            {tasks.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({countLabel})
              </span>
            )}
          </CardTitle>
          <CardAction>
            {onAiAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onAiAdd}
              >
                <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setShowAdd(true)}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
            />
            <Input
              placeholder="Filter tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDone(!showDone)}
            className={cn(
              "h-8 px-2.5 border shrink-0",
              showDone
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            <HugeiconsIcon icon={CheckmarkSquare01Icon} className="size-3.5 mr-1" />
            Done
          </Button>
        </div>
        <CardContent className="p-0">
          <TaskListView
            tasks={filteredTasks}
            isLoading={isLoading}
            groupBy="date"
            showDone={showDone}
            hideCaseBadge
            noBorder
            invalidateKeys={[
              ["tasks", "intake", intakeId, showDone],
              ["tasks", "intake", intakeId, !showDone],
              ["tasks"],
            ]}
          />
        </CardContent>
      </Card>

      <AddIntakeTaskDialog
        intakeId={intakeId}
        open={showAdd}
        onOpenChange={setShowAdd}
      />
    </>
  )
}

function AddIntakeTaskDialog({
  intakeId,
  open,
  onOpenChange,
}: {
  intakeId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [urgency, setUrgency] = useState("Medium")
  const [assigneeId, setAssigneeId] = useState<string>("")

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () =>
      createTask({
        intake_id: intakeId,
        description,
        due_date: dueDate || undefined,
        urgency,
        assignee_id: assigneeId ? Number(assigneeId) : undefined,
      }),
    onSuccess: () => {
      toast.success("Task created")
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      onOpenChange(false)
      setDescription("")
      setDueDate("")
      setUrgency("Medium")
      setAssigneeId("")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Intake Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <DatePicker
                value={dueDate || null}
                onChange={(d) => setDueDate(d ?? "")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="w-full">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {(staffData?.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.firstName} {s.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!description.trim() || mutation.isPending}
            size="sm"
          >
            {mutation.isPending ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
