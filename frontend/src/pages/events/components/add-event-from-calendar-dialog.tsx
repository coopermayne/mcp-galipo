import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createEvent } from "@/services/events"
import { getCases } from "@/services/cases"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AddEventFromCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string | null
}

export function AddEventFromCalendarDialog({
  open,
  onOpenChange,
  initialDate,
}: AddEventFromCalendarDialogProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")
  const [starred, setStarred] = useState(false)
  const [caseId, setCaseId] = useState<string>("")

  // Sync initialDate when dialog opens
  useEffect(() => {
    if (open && initialDate) setDate(initialDate)
  }, [open, initialDate])

  const { data: casesData } = useQuery({
    queryKey: ["cases", "for-event-picker"],
    queryFn: () => getCases({ limit: 500 }),
    enabled: open,
  })

  const reset = () => {
    setDescription("")
    setDate("")
    setTime("")
    setLocation("")
    setStarred(false)
    setCaseId("")
  }

  const mutation = useMutation({
    mutationFn: () =>
      createEvent({
        case_id: caseId ? Number(caseId) : undefined,
        date,
        description,
        time: time || undefined,
        location: location || undefined,
        starred,
      }),
    onSuccess: () => {
      toast.success("Event created")
      queryClient.invalidateQueries({ queryKey: ["events"] })
      onOpenChange(false)
      reset()
    },
    onError: (e) => toast.error(e.message),
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <Label className="text-xs">Case</Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="(No case — personal event)" />
              </SelectTrigger>
              <SelectContent>
                {(casesData?.cases ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.short_name || c.case_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <DatePicker
                value={date || null}
                onChange={(d) => setDate(d ?? "")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
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
              id="cal-starred"
              checked={starred}
              onCheckedChange={(v) => setStarred(v === true)}
            />
            <Label htmlFor="cal-starred" className="text-xs cursor-pointer">
              Star this event
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            size="sm"
          >
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
