import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createTask } from "@/services/tasks"
import { getStaff } from "@/services/staff"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const URGENCIES = ["Low", "Medium", "High", "Urgent"]

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
}

export function AddTaskDialog({ open, onOpenChange, caseId }: AddTaskDialogProps) {
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
        case_id: caseId,
        description,
        due_date: dueDate || undefined,
        urgency,
        assignee_id: assigneeId ? Number(assigneeId) : undefined,
      }),
    onSuccess: () => {
      toast.success("Task created")
      queryClient.invalidateQueries({ queryKey: ["tasks", "case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
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
          <DialogTitle>Add Task</DialogTitle>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
