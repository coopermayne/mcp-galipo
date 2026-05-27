import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CreateEventData } from "@/services/events"
import { EVENT_TYPE_OPTIONS } from "@/lib/event-types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateEventData) => void
}

export function AddBlockingEventDialog({ open, onOpenChange, onSubmit }: Props) {
  const [description, setDescription] = useState("")
  const [eventType, setEventType] = useState("vacation")
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  function handleSubmit() {
    if (!description || !startDate) return
    onSubmit({
      description,
      date: startDate,
      end_date: endDate ?? undefined,
      event_type: eventType,
      notes: notes.trim() || undefined,
    })
    setDescription("")
    setStartDate(null)
    setEndDate(null)
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((t) => (
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
              placeholder="Firm holiday, vacation, bar conference..."
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
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Optional notes about this event"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!description || !startDate}>
            Add Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
