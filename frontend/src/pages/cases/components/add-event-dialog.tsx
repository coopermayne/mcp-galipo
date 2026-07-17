import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createEvent } from "@/services/events"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

interface AddEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
}

export function AddEventDialog({
  open,
  onOpenChange,
  caseId,
}: AddEventDialogProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")
  const [starred, setStarred] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      createEvent({
        case_id: caseId,
        date,
        description,
        time: time || undefined,
        location: location || undefined,
        starred,
      }),
    onSuccess: () => {
      toast.success("Event created")
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case-comments", caseId] })
      onOpenChange(false)
      setDescription("")
      setDate("")
      setTime("")
      setLocation("")
      setStarred(false)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event description..."
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date &amp; Time</Label>
            <DatePicker
              value={date || null}
              onChange={(d) => setDate(d ?? "")}
              withTime
              time={time || null}
              onTimeChange={(t) => setTime(t ?? "")}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="starred"
              checked={starred}
              onCheckedChange={(v) => setStarred(v === true)}
            />
            <Label htmlFor="starred" className="text-xs cursor-pointer">
              Star this event
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!description.trim() || !date || mutation.isPending}
            size="sm"
          >
            {mutation.isPending ? "Creating..." : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
