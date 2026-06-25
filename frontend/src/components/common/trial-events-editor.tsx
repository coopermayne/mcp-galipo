import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Add01Icon } from "@hugeicons/core-free-icons"
import {
  getTrialEventsByCase,
  createEvent,
  deleteEvent,
} from "@/services/events"
import { TRIAL_EVENT_TYPE_OPTIONS, getEventTypeLabel, getEventTypeColor } from "@/lib/event-types"
import { formatTrialDate } from "@/components/common/trial-edit-popover"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

/**
 * Manage a case's trial-calendar events (FPTC, PTC, trial readiness, MIL
 * hearings, etc.). These are stored as regular events flagged
 * on_trial_calendar=true so they surface on the trial calendar. Display-only:
 * they do not block trial-slot availability.
 */
export function TrialEventsEditor({
  caseId,
  enabled = true,
}: {
  caseId: number
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [draftType, setDraftType] = useState("fptc")
  const [draftDate, setDraftDate] = useState<string | null>(null)
  const [draftDesc, setDraftDesc] = useState("")

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["case-trial-events", caseId],
    queryFn: () => getTrialEventsByCase(caseId),
    enabled,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["case-trial-events", caseId] })
    queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
    queryClient.invalidateQueries({ queryKey: ["events"] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createEvent({
        case_id: caseId,
        date: draftDate!,
        event_type: draftType,
        description: draftDesc.trim() || getEventTypeLabel(draftType),
        on_trial_calendar: true,
      }),
    onSuccess: () => {
      invalidate()
      toast.success("Trial event added")
      setDraftDate(null)
      setDraftDesc("")
      setAdding(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      invalidate()
      toast.success("Trial event removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div>
      <p className="mb-4 text-xs font-medium text-muted-foreground">Events</p>

      <div className="space-y-2">
      {events.length > 0 && (
        <div className="space-y-1">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1.5 border border-input px-2 py-1"
            >
              <Badge
                className="shrink-0 text-[9px] px-1 py-0 font-normal border-transparent text-white"
                style={{ backgroundColor: getEventTypeColor(e.event_type ?? "") }}
              >
                {getEventTypeLabel(e.event_type ?? "")}
              </Badge>
              <span className="text-[11px] flex-1 truncate" title={e.description ?? ""}>
                {e.description && e.description !== getEventTypeLabel(e.event_type ?? "")
                  ? e.description
                  : null}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {formatTrialDate(e.date)}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive shrink-0"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(e.id)}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <p className="text-[10px] text-muted-foreground">Loading…</p>
      )}

      {adding ? (
        <div className="space-y-1.5 border border-input p-2">
          <Select value={draftType} onValueChange={setDraftType}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIAL_EVENT_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker value={draftDate} onChange={setDraftDate} placeholder="Date" />
          <Input
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            placeholder={`e.g. ${getEventTypeLabel(draftType)} before Judge…`}
            className="h-7 text-xs"
          />
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={!draftDate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Add
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          Add trial event
        </button>
      )}
      </div>
    </div>
  )
}
