import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  StarIcon,
  Location01Icon,
  Task01Icon,
  Add01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import type { EventListItem as EventListItemType } from "@/types/event"
import { getStaff } from "@/services/staff"
import { Badge } from "@/components/ui/badge"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getBadgeStyle, getAvatarStyleById } from "@/lib/badge-colors"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (d.getTime() === today.getTime()) return "Today"
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow"
  const base = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${base} (${dow})`
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null
  const [h, m] = timeStr.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function StaffRow({
  staffId,
  initials,
  name,
  onClick,
}: {
  staffId: number
  initials: string
  name: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 w-full px-1.5 py-1 text-xs hover:bg-accent transition-colors"
    >
      <span
        className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
        style={getAvatarStyleById(staffId)}
      >
        {initials}
      </span>
      {name}
    </button>
  )
}

function EventAttendeePicker({
  event,
  onAdd,
  onRemove,
}: {
  event: EventListItemType
  onAdd: (userId: number) => void
  onRemove: (userId: number) => void
}) {
  const [open, setOpen] = useState(false)

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    enabled: open,
  })

  const allStaff = staffData?.data ?? []
  const attendeeSet = new Set(event.attendee_ids)
  const currentAttendees = allStaff.filter((s) => attendeeSet.has(s.id))
  const available = allStaff.filter((s) => !attendeeSet.has(s.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 inline-flex items-center h-4 gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {event.attendee_ids.length > 0 ? (
            <div className="flex -space-x-1">
              {event.attendee_ids.slice(0, 3).map((id) => {
                const staff = allStaff.find((s) => s.id === id)
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex size-4 items-center justify-center text-[8px] font-medium leading-none border border-background"
                        style={getAvatarStyleById(id)}
                      >
                        {staff?.initials ?? "?"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {staff ? `${staff.firstName} ${staff.lastName}` : `User ${id}`}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              {event.attendee_ids.length > 3 && (
                <span className="inline-flex size-4 items-center justify-center text-[7px] font-medium bg-muted text-muted-foreground border border-background">
                  +{event.attendee_ids.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="inline-flex size-4 items-center justify-center border border-dashed border-muted-foreground/40 text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground transition-colors">
              <HugeiconsIcon icon={Add01Icon} className="size-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 space-y-0.5">
          {currentAttendees.length > 0 && (
            <>
              {currentAttendees.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-1.5 py-1 text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
                      style={getAvatarStyleById(s.id)}
                    >
                      {s.initials}
                    </span>
                    {s.firstName} {s.lastName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                  </button>
                </div>
              ))}
              {available.length > 0 && (
                <div className="border-t border-border/50 my-1" />
              )}
            </>
          )}
          {available.map((s) => (
            <StaffRow
              key={s.id}
              staffId={s.id}
              initials={s.initials}
              name={`${s.firstName} ${s.lastName}`}
              onClick={() => onAdd(s.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface EventListItemProps {
  event: EventListItemType
  onEventClick: (event: EventListItemType) => void
  onUpdateEvent: (eventId: number, field: string, value: unknown) => void
  onAddAttendee: (eventId: number, userId: number) => void
  onRemoveAttendee: (eventId: number, userId: number) => void
  hideCaseBadge?: boolean
  showPast?: boolean
}

export function EventListItem({
  event,
  onEventClick,
  onUpdateEvent,
  onAddAttendee,
  onRemoveAttendee,
  hideCaseBadge,
}: EventListItemProps) {
  const isPast = parseLocalDate(event.date) < (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })()

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2.5 px-3 py-2",
        "border-b border-border/50",
        "hover:bg-accent/50 transition-colors cursor-pointer",
        isPast && "opacity-60"
      )}
      onClick={() => onEventClick(event)}
    >
      {/* Star toggle */}
      <button
        className="shrink-0 mt-0.5"
        onClick={(e) => {
          e.stopPropagation()
          onUpdateEvent(event.id, "starred", !event.starred)
        }}
      >
        <HugeiconsIcon
          icon={StarIcon}
          className={cn(
            "size-4 transition-colors",
            event.starred
              ? "text-warning"
              : "text-muted-foreground/30 hover:text-warning/60"
          )}
        />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs leading-snug", isPast && "text-muted-foreground")}>
          {event.description}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-2.5 mt-0.5">
          {/* Date — interactive */}
          <div onClick={(e) => e.stopPropagation()}>
            <DatePicker
              value={event.date}
              onChange={(date) => onUpdateEvent(event.id, "date", date)}
              variant="inline"
              placeholder="Set date"
              formatValue={formatDate}
            />
          </div>

          {/* Time */}
          {event.time && (
            <span className="text-xs text-muted-foreground">
              {formatTime(event.time)}
            </span>
          )}

          {/* Location */}
          {event.location && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground truncate max-w-[140px]">
              <HugeiconsIcon icon={Location01Icon} className="size-3 shrink-0" />
              {event.location}
            </span>
          )}

          {/* Task count */}
          {event.task_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Task01Icon} className="size-3" />
              {event.task_count}
            </span>
          )}

          {/* Case badge */}
          {event.short_name && !hideCaseBadge && (
            <Badge
              className="text-[10px] px-1.5 py-0 h-4 leading-none"
              style={getBadgeStyle(event.case_color)}
            >
              {event.short_name}
            </Badge>
          )}

          {/* Attendee picker */}
          <EventAttendeePicker
            event={event}
            onAdd={(userId) => onAddAttendee(event.id, userId)}
            onRemove={(userId) => onRemoveAttendee(event.id, userId)}
          />
        </div>
      </div>
    </div>
  )
}
