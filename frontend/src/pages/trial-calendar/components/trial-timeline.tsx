import { useMemo, useRef } from "react"
import { useNavigate } from "react-router"
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isWeekend,
  addDays,
  eachWeekOfInterval,
} from "date-fns"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import type { TrialCalendarData, TrialItem, BlockingEvent } from "@/services/trial-calendar"

const DAY_WIDTH = 5
const ROW_HEIGHT = 28
const HEADER_HEIGHT = 48
const MIN_BAR_WIDTH = 8

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function barStyle(startDay: number, days: number, opacity: number) {
  const width = Math.max(days * DAY_WIDTH, MIN_BAR_WIDTH)
  return {
    left: startDay * DAY_WIDTH,
    width,
    opacity: Math.max(opacity, 0.15),
  }
}

export function TrialTimeline({ data }: { data: TrialCalendarData }) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const rangeStart = parseDate(data.range.start)
  const rangeEnd = parseDate(data.range.end)
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart)
  const totalWidth = totalDays * DAY_WIDTH

  const months = useMemo(
    () => eachMonthOfInterval({ start: rangeStart, end: rangeEnd }),
    [data.range.start, data.range.end]
  )

  const weeks = useMemo(
    () => eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }),
    [data.range.start, data.range.end]
  )

  const today = new Date()
  const todayOffset = differenceInCalendarDays(today, rangeStart)
  const showToday = todayOffset >= 0 && todayOffset <= totalDays

  const trialRows = data.trials.length
  const blockingRows = data.blocking_events.length
  const totalRows = trialRows + blockingRows
  const gridHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT + (blockingRows > 0 ? 1 : 0)

  function dayOffset(dateStr: string): number {
    return differenceInCalendarDays(parseDate(dateStr), rangeStart)
  }

  return (
    <div className="border bg-card overflow-x-auto" ref={containerRef}>
      <div className="relative" style={{ width: totalWidth, height: gridHeight }}>
        {/* Month backgrounds (alternating) */}
        {months.map((month, i) => {
          const mStart = month < rangeStart ? rangeStart : month
          const mEnd = endOfMonth(month) > rangeEnd ? rangeEnd : endOfMonth(month)
          const left = differenceInCalendarDays(mStart, rangeStart) * DAY_WIDTH
          const width = (differenceInCalendarDays(mEnd, mStart) + 1) * DAY_WIDTH
          return (
            <div
              key={i}
              className="absolute top-0"
              style={{
                left,
                width,
                height: gridHeight,
                backgroundColor: i % 2 === 0 ? "transparent" : "var(--muted)",
                opacity: 0.3,
              }}
            />
          )
        })}

        {/* Weekend shading */}
        {Array.from({ length: totalDays }, (_, i) => {
          const day = addDays(rangeStart, i)
          if (!isWeekend(day)) return null
          return (
            <div
              key={`we-${i}`}
              className="absolute top-0"
              style={{
                left: i * DAY_WIDTH,
                width: DAY_WIDTH,
                height: gridHeight,
                backgroundColor: "var(--foreground)",
                opacity: 0.03,
              }}
            />
          )
        })}

        {/* Month labels + week numbers header */}
        {months.map((month, i) => {
          const mStart = month < rangeStart ? rangeStart : month
          const left = differenceInCalendarDays(mStart, rangeStart) * DAY_WIDTH
          return (
            <div
              key={`mh-${i}`}
              className="text-muted-foreground absolute text-[10px] font-medium"
              style={{ left: left + 4, top: 4 }}
            >
              {format(month, "MMM yyyy")}
            </div>
          )
        })}
        {weeks.map((week, i) => {
          const left = differenceInCalendarDays(
            week < rangeStart ? rangeStart : week,
            rangeStart
          ) * DAY_WIDTH
          if (left < 0 || left > totalWidth) return null
          return (
            <div
              key={`wk-${i}`}
              className="text-muted-foreground/50 absolute text-[9px]"
              style={{ left: left + 1, top: 20 }}
            >
              {format(week < rangeStart ? rangeStart : week, "d")}
            </div>
          )
        })}

        {/* Header bottom border */}
        <div
          className="border-border absolute w-full border-b"
          style={{ top: HEADER_HEIGHT - 1 }}
        />

        {/* Today marker */}
        {showToday && (
          <div
            className="absolute z-20"
            style={{
              left: todayOffset * DAY_WIDTH,
              top: 0,
              width: 1,
              height: gridHeight,
              borderLeft: "1.5px dashed var(--destructive)",
            }}
          >
            <span
              className="bg-destructive text-destructive-foreground absolute -top-0 -left-3 px-1 text-[8px] font-bold"
              style={{ lineHeight: "14px" }}
            >
              today
            </span>
          </div>
        )}

        {/* Trial bars */}
        {data.trials.map((trial, i) => (
          <TrialBar
            key={`t-${trial.case_id}`}
            trial={trial}
            top={HEADER_HEIGHT + i * ROW_HEIGHT}
            startDay={dayOffset(trial.trial_date)}
            days={trial.trial_estimated_days ?? 1}
            onNavigate={() => navigate(`/cases/${trial.case_id}`)}
          />
        ))}

        {/* Separator between trials and blocking events */}
        {blockingRows > 0 && (
          <div
            className="border-border absolute w-full border-b"
            style={{ top: HEADER_HEIGHT + trialRows * ROW_HEIGHT }}
          />
        )}

        {/* Blocking event bars */}
        {data.blocking_events.map((event, i) => (
          <BlockingBar
            key={`b-${event.id}`}
            event={event}
            top={HEADER_HEIGHT + (trialRows + i) * ROW_HEIGHT + (blockingRows > 0 ? 1 : 0)}
            startDay={dayOffset(event.date)}
            days={
              event.end_date
                ? differenceInCalendarDays(parseDate(event.end_date), parseDate(event.date)) + 1
                : 1
            }
          />
        ))}
      </div>
    </div>
  )
}

function TrialBar({
  trial,
  top,
  startDay,
  days,
  onNavigate,
}: {
  trial: TrialItem
  top: number
  startDay: number
  days: number
  onNavigate: () => void
}) {
  const likelihood = trial.trial_likelihood ?? 50
  const { left, width, opacity } = barStyle(startDay, days, likelihood / 100)
  const label = [trial.short_name || trial.case_name.split(" ")[0], trial.jurisdiction_name]
    .filter(Boolean)
    .join(" · ")
  const showLabelOutside = width < 60

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="absolute flex cursor-pointer items-center text-[10px] font-medium transition-shadow hover:z-10"
          style={{
            left,
            top: top + 2,
            height: ROW_HEIGHT - 4,
          }}
        >
          <div
            className="flex h-full items-center overflow-hidden px-1 text-white"
            style={{
              width,
              backgroundColor: "var(--primary)",
              opacity,
              minWidth: MIN_BAR_WIDTH,
            }}
          >
            {!showLabelOutside && <span className="truncate">{label}</span>}
          </div>
          {showLabelOutside && (
            <span
              className="text-muted-foreground ml-1 whitespace-nowrap"
              style={{ opacity: Math.max(opacity, 0.4) }}
            >
              {label}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3 text-sm" align="start">
        <div className="font-semibold">{trial.case_name}</div>
        <div className="text-muted-foreground space-y-1 text-xs">
          <div>
            Trial: {format(parseDate(trial.trial_date), "MMM d, yyyy")}
            {trial.trial_estimated_days && ` · ${trial.trial_estimated_days}d`}
          </div>
          {trial.jurisdiction_name && <div>{trial.jurisdiction_name}</div>}
          <div>Status: {trial.status}</div>
          <div>Likelihood: {trial.trial_likelihood ?? "?"}%</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onNavigate}
        >
          View Case
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function BlockingBar({
  event,
  top,
  startDay,
  days,
}: {
  event: BlockingEvent
  top: number
  startDay: number
  days: number
}) {
  const { left, width } = barStyle(startDay, days, 1)
  const isVacation = event.event_type === "vacation"
  const showLabelOutside = width < 60

  const bgStyle = isVacation
    ? `repeating-linear-gradient(-45deg, var(--destructive), var(--destructive) 3px, transparent 3px, transparent 6px)`
    : "var(--warning)"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="absolute flex cursor-pointer items-center text-[10px] font-medium transition-shadow hover:z-10"
          style={{
            left,
            top: top + 2,
            height: ROW_HEIGHT - 4,
          }}
        >
          <div
            className="flex h-full items-center overflow-hidden px-1"
            style={{
              width,
              minWidth: MIN_BAR_WIDTH,
              color: isVacation ? "var(--destructive-foreground)" : "var(--warning-foreground)",
              background: bgStyle,
              opacity: 0.7,
            }}
          >
            {!showLabelOutside && <span className="truncate">{event.description}</span>}
          </div>
          {showLabelOutside && (
            <span className="text-muted-foreground ml-1 whitespace-nowrap opacity-70">
              {event.description}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-1 p-3 text-sm" align="start">
        <div className="font-semibold">{event.description}</div>
        <div className="text-muted-foreground text-xs">
          <div>Type: {event.event_type}</div>
          <div>
            {format(parseDate(event.date), "MMM d, yyyy")}
            {event.end_date && ` – ${format(parseDate(event.end_date), "MMM d, yyyy")}`}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
