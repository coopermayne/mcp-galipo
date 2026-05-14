import { useState, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { updateEvent, deleteEvent } from "@/services/events"
import type { BlockingEvent } from "@/services/trial-calendar"

const EVENT_TYPES = [
  { value: "vacation", label: "Vacation" },
  { value: "oral_argument", label: "Oral Argument" },
  { value: "hearing", label: "Hearing" },
  { value: "conference", label: "Conference" },
  { value: "other", label: "Other" },
]

interface Props {
  event: BlockingEvent | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditEventDialog({ event, onOpenChange, onSuccess }: Props) {
  const [description, setDescription] = useState("")
  const [eventType, setEventType] = useState("other")
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  useEffect(() => {
    if (event) {
      setDescription(event.description)
      setEventType(event.event_type)
      setStartDate(event.date)
      setEndDate(event.end_date)
    }
  }, [event])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateEvent(event!.id, {
        description,
        event_type: eventType,
        date: startDate!,
        end_date: endDate,
      }),
    onSuccess: () => {
      toast.success("Event updated")
      onSuccess()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(event!.id),
    onSuccess: () => {
      toast.success("Event deleted")
      onSuccess()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex !justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{event?.description}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!description || !startDate || updateMutation.isPending}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
