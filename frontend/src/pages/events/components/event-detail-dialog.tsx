import { useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { EventListItem } from "@/types/event"
import {
  getEvent,
  updateEvent,
  addAttendee,
  removeAttendee,
} from "@/services/events"
import { getStaff } from "@/services/staff"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { getBadgeStyle, getAvatarStyleById } from "@/lib/badge-colors"
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
import { cn } from "@/lib/utils"

interface EventDetailDialogProps {
  event: EventListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  invalidateKeys?: unknown[][]
}

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  invalidateKeys = [["events"]],
}: EventDetailDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDivElement>(null)

  const { data: detailData } = useQuery({
    queryKey: ["event", event?.id],
    queryFn: () => getEvent(event!.id),
    enabled: !!event && open,
  })

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })

  const detail = detailData?.event ?? null

  const invalidateAll = () => {
    for (const key of invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: key })
    }
    if (event) {
      queryClient.invalidateQueries({ queryKey: ["event", event.id] })
    }
  }

  const mutation = useMutation({
    mutationFn: ({ field, value }: { field: string; value: unknown }) =>
      updateEvent(event!.id, { [field]: value }),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  })

  const addAttendeeMutation = useMutation({
    mutationFn: (userId: number) => addAttendee(event!.id, userId),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  })

  const removeAttendeeMutation = useMutation({
    mutationFn: (userId: number) => removeAttendee(event!.id, userId),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  })

  if (!event) return null

  const attendees = detail?.attendees ?? []
  const attendeeIds = detail?.attendee_ids ?? event.attendee_ids
  const allStaff = staffData?.data ?? []
  const availableStaff = allStaff.filter(
    (s) => !attendeeIds.includes(s.id)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogRef} className="sm:max-w-md">
        <DialogHeader>
          {event.short_name && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                onOpenChange(false)
                navigate(`/cases/${event.case_id}`)
              }}
              className="w-fit h-auto p-0 border-0"
            >
              <Badge
                className="hover:opacity-80 transition-opacity"
                style={getBadgeStyle(event.case_color)}
              >
                {event.short_name}
              </Badge>
            </Button>
          )}
          <DialogTitle>
            <InlineEditField
              value={detail?.description ?? event.description}
              onSave={(v) => mutation.mutate({ field: "description", value: v })}
            />
          </DialogTitle>
          {event.case_name && (
            <DialogDescription>{event.case_name}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {/* Date */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Date
            </span>
            <InlineEditField
              value={detail?.date ?? event.date}
              onSave={(v) => mutation.mutate({ field: "date", value: v })}
              type="date"
              className="h-7 text-xs"
            />
          </div>

          {/* Time */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Time
            </span>
            <InlineEditField
              value={detail?.time ?? event.time ?? ""}
              onSave={(v) =>
                mutation.mutate({ field: "time", value: v || null })
              }
              placeholder="No time"
              className="h-7 text-xs"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1 col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Location
            </span>
            <InlineEditField
              value={detail?.location ?? event.location ?? ""}
              onSave={(v) =>
                mutation.mutate({ field: "location", value: v || null })
              }
              placeholder="No location"
              className="h-7 text-xs"
            />
          </div>

          {/* Starred */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Starred
            </span>
            <button
              type="button"
              onClick={() =>
                mutation.mutate({
                  field: "starred",
                  value: !(detail?.starred ?? event.starred),
                })
              }
              className="flex items-center gap-1.5 h-7 text-xs"
            >
              <HugeiconsIcon
                icon={StarIcon}
                className={cn(
                  "size-4",
                  (detail?.starred ?? event.starred)
                    ? "text-warning"
                    : "text-muted-foreground/40"
                )}
              />
              {(detail?.starred ?? event.starred) ? "Starred" : "Not starred"}
            </button>
          </div>
        </div>

        {/* Document Link */}
        <div className="border-t pt-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Document Link
          </span>
          <InlineEditField
            value={detail?.document_link ?? event.document_link ?? ""}
            onSave={(v) =>
              mutation.mutate({ field: "document_link", value: v || null })
            }
            placeholder="No document link"
            className="mt-1 text-xs"
          />
        </div>

        {/* Calculation Note */}
        <div className="border-t pt-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Calculation Note
          </span>
          <InlineEditField
            value={detail?.calculation_note ?? event.calculation_note ?? ""}
            onSave={(v) =>
              mutation.mutate({ field: "calculation_note", value: v || null })
            }
            type="textarea"
            placeholder="No calculation note"
            displayClassName="text-xs whitespace-pre-wrap"
            className="mt-1 text-xs"
          />
        </div>

        {/* Attendees */}
        <div className="border-t pt-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Attendees
          </span>
          <div className="mt-1.5 space-y-1">
            {attendees.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-flex size-5 items-center justify-center text-[9px] font-medium"
                    style={getAvatarStyleById(a.id)}
                  >
                    {a.initials}
                  </span>
                  {a.first_name} {a.last_name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttendeeMutation.mutate(a.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                </button>
              </div>
            ))}
            {availableStaff.length > 0 && (
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) addAttendeeMutation.mutate(Number(v))
                }}
              >
                <SelectTrigger className="h-7 text-xs mt-1">
                  <SelectValue placeholder="Add attendee..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
