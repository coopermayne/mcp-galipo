import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  StarIcon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons"
import type { EventListItem } from "@/types/event"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBadgeStyle } from "@/lib/badge-colors"

export type CalendarMode = "month" | "week" | "day"

interface CalendarViewProps {
  events: EventListItem[]
  mode: CalendarMode
  cursor: Date
  onCursorChange: (d: Date) => void
  onEventClick: (event: EventListItem) => void
  onDateClick: (date: Date) => void
}

/**
 * Parse an event's date (YYYY-MM-DD) and optional end_date into a Date range,
 * anchored to local midnight so day-comparison works without TZ surprises.
 */
function parseEventRange(event: EventListItem): { start: Date; end: Date } {
  const [y, m, d] = event.date.split("-").map(Number)
  const start = new Date(y, m - 1, d)
  let end = start
  if (event.end_date) {
    const [ey, em, ed] = event.end_date.split("-").map(Number)
    end = new Date(ey, em - 1, ed)
  }
  return { start, end }
}

function eventsOnDay(events: EventListItem[], day: Date): EventListItem[] {
  const d = startOfDay(day)
  return events
    .filter((e) => {
      const { start, end } = parseEventRange(e)
      return isWithinInterval(d, {
        start: startOfDay(start),
        end: startOfDay(end),
      })
    })
    .sort((a, b) => {
      // Timed events first (sorted by time), then all-day
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time && !b.time) return -1
      if (!a.time && b.time) return 1
      return a.description.localeCompare(b.description)
    })
}

function formatHeaderLabel(mode: CalendarMode, cursor: Date): string {
  if (mode === "month") return format(cursor, "MMMM yyyy")
  if (mode === "day") return format(cursor, "EEEE, MMMM d, yyyy")
  // week
  const ws = startOfWeek(cursor, { weekStartsOn: 0 })
  const we = endOfWeek(cursor, { weekStartsOn: 0 })
  if (ws.getMonth() === we.getMonth()) {
    return `${format(ws, "MMM d")} – ${format(we, "d, yyyy")}`
  }
  return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`
}

export function CalendarView({
  events,
  mode,
  cursor,
  onCursorChange,
  onEventClick,
  onDateClick,
}: CalendarViewProps) {
  const goPrev = () => {
    if (mode === "month") onCursorChange(subMonths(cursor, 1))
    else if (mode === "week") onCursorChange(subWeeks(cursor, 1))
    else onCursorChange(addDays(cursor, -1))
  }
  const goNext = () => {
    if (mode === "month") onCursorChange(addMonths(cursor, 1))
    else if (mode === "week") onCursorChange(addWeeks(cursor, 1))
    else onCursorChange(addDays(cursor, 1))
  }
  const goToday = () => onCursorChange(new Date())

  return (
    <div className="flex flex-col border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={goPrev}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={goNext}>
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 ml-1 border"
            onClick={goToday}
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 mr-1" />
            Today
          </Button>
        </div>
        <div className="text-sm font-semibold">{formatHeaderLabel(mode, cursor)}</div>
        <div className="w-[140px]" />
      </div>

      {mode === "month" && (
        <MonthGrid
          cursor={cursor}
          events={events}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
        />
      )}
      {mode === "week" && (
        <WeekGrid
          cursor={cursor}
          events={events}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
        />
      )}
      {mode === "day" && (
        <DayGrid
          cursor={cursor}
          events={events}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
        />
      )}
    </div>
  )
}

// ============================================================================
// Month grid
// ============================================================================

interface GridProps {
  cursor: Date
  events: EventListItem[]
  onEventClick: (event: EventListItem) => void
  onDateClick: (date: Date) => void
}

function MonthGrid({ cursor, events, onEventClick, onDateClick }: GridProps) {
  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(d)
  }

  const today = startOfDay(new Date())
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {dayLabels.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor)
          const isToday = isSameDay(day, today)
          const dayEvents = eventsOnDay(events, day)
          const maxVisible = 3
          const overflow = dayEvents.length - maxVisible

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDateClick(day)}
              className={cn(
                "group min-h-[110px] border-b border-r border-border last:border-r-0 p-1.5 text-left transition-colors hover:bg-muted/40",
                !inMonth && "bg-muted/10 text-muted-foreground/60",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex items-center justify-between",
                  isToday && "font-bold",
                )}
              >
                <span
                  className={cn(
                    "text-xs",
                    isToday &&
                      "inline-flex h-5 min-w-5 items-center justify-center bg-foreground px-1 text-background",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, maxVisible).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                  />
                ))}
                {overflow > 0 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{overflow} more
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Week grid (timed grid with all-day row)
// ============================================================================

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am – 7pm
const HOUR_HEIGHT = 40 // px

function timeToOffset(time: string): number {
  const [h, m] = time.split(":").map(Number)
  const hours = h + m / 60
  const start = HOURS[0]
  return (hours - start) * HOUR_HEIGHT
}

function WeekGrid({ cursor, events, onEventClick, onDateClick }: GridProps) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = startOfDay(new Date())

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/20">
        <div />
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDateClick(day)}
              className={cn(
                "px-2 py-1.5 text-center border-l border-border hover:bg-muted/40 transition-colors",
                isToday && "bg-foreground/5",
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isToday && "font-bold",
                )}
              >
                {format(day, "d")}
              </div>
            </button>
          )
        })}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/10">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground text-right">
          all-day
        </div>
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day).filter((e) => !e.time)
          return (
            <div
              key={day.toISOString()}
              className="border-l border-border min-h-[28px] p-0.5 flex flex-col gap-0.5"
            >
              {dayEvents.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Timed grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
        <div className="flex flex-col">
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/50"
              style={{ height: HOUR_HEIGHT }}
            >
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? "a" : "p"}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day).filter((e) => e.time)
          const isToday = isSameDay(day, today)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-l border-border relative",
                isToday && "bg-foreground/5",
              )}
              style={{ height: HOURS.length * HOUR_HEIGHT }}
              onClick={() => onDateClick(day)}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-b border-border/30"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}
              {dayEvents.map((event) => (
                <TimedEventBlock
                  key={event.id}
                  event={event}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Day grid
// ============================================================================

function DayGrid({ cursor, events, onEventClick, onDateClick }: GridProps) {
  const dayEvents = eventsOnDay(events, cursor)
  const allDay = dayEvents.filter((e) => !e.time)
  const timed = dayEvents.filter((e) => e.time)

  return (
    <div className="flex flex-col">
      {allDay.length > 0 && (
        <div className="border-b border-border bg-muted/10">
          <div className="px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              All Day
            </div>
            <div className="flex flex-wrap gap-1">
              {allDay.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  expanded
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-[60px_1fr] relative">
        <div className="flex flex-col">
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/50"
              style={{ height: HOUR_HEIGHT }}
            >
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? "a" : "p"}
            </div>
          ))}
        </div>
        <div
          className="border-l border-border relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
          onClick={() => onDateClick(cursor)}
        >
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-b border-border/30"
              style={{ height: HOUR_HEIGHT }}
            />
          ))}
          {timed.map((event) => (
            <TimedEventBlock
              key={event.id}
              event={event}
              expanded
              onClick={(e) => {
                e.stopPropagation()
                onEventClick(event)
              }}
            />
          ))}
          {timed.length === 0 && allDay.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No events scheduled
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Event chip / block
// ============================================================================

interface EventChipProps {
  event: EventListItem
  expanded?: boolean
  onClick: (e: React.MouseEvent) => void
}

function EventChip({ event, expanded, onClick }: EventChipProps) {
  const style = getBadgeStyle(event.case_color) ?? {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
  }
  const time = event.time ? formatTimeLabel(event.time) : null
  return (
    <button
      type="button"
      onClick={onClick}
      title={event.description}
      className={cn(
        "flex items-center gap-1 px-1 py-0.5 text-[10px] text-left truncate hover:opacity-80 transition-opacity cursor-pointer w-full",
        expanded && "px-2 py-1 text-xs",
      )}
      style={style}
    >
      {event.starred && (
        <HugeiconsIcon icon={StarIcon} className="size-2.5 shrink-0 fill-current" />
      )}
      {time && <span className="font-medium shrink-0">{time}</span>}
      <span className="truncate">{event.description}</span>
    </button>
  )
}

function TimedEventBlock({
  event,
  expanded,
  onClick,
}: EventChipProps) {
  const top = event.time ? timeToOffset(event.time) : 0
  // Default duration: 1 hour for timed events
  const height = HOUR_HEIGHT
  const style: React.CSSProperties = {
    ...(getBadgeStyle(event.case_color) ?? {
      backgroundColor: "var(--muted)",
      color: "var(--foreground)",
    }),
    position: "absolute",
    top,
    left: 2,
    right: 2,
    minHeight: Math.max(height - 2, 18),
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={event.description}
      className={cn(
        "px-1.5 py-1 text-[10px] text-left overflow-hidden hover:opacity-80 transition-opacity cursor-pointer",
        expanded && "text-xs",
      )}
      style={style}
    >
      <div className="flex items-center gap-1 truncate">
        {event.starred && (
          <HugeiconsIcon icon={StarIcon} className="size-2.5 shrink-0 fill-current" />
        )}
        <span className="font-medium">
          {event.time ? formatTimeLabel(event.time) : ""}
        </span>
        <span className="truncate">{event.description}</span>
      </div>
      {event.short_name && (
        <div className="truncate opacity-80 text-[9px]">{event.short_name}</div>
      )}
    </button>
  )
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const suffix = h < 12 ? "a" : "p"
  if (m === 0) return `${hour12}${suffix}`
  return `${hour12}:${String(m).padStart(2, "0")}${suffix}`
}
