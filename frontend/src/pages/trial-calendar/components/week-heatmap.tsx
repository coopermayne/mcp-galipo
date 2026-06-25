import { useMemo } from "react"
import { useCasePreview } from "@/hooks/use-case-preview"
import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  getDay,
  isSameDay,
  startOfMonth,
  endOfMonth,
} from "date-fns"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import type {
  TrialCalendarData,
  TrialItem,
  BlockingEvent,
} from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function addWeekdaysFn(start: Date, weekdays: number): Date {
  let remaining = weekdays - 1
  let current = start
  while (remaining > 0) {
    current = addDays(current, 1)
    if (getDay(current) !== 0 && getDay(current) !== 6) remaining--
  }
  return current
}

const CELL = 52
const PAD = 3
const TOTAL = CELL + PAD * 2
const BAR_H = 14
const BAR_GAP = 2

interface DayInfo {
  date: Date
  dayNum: number
  monthKey: string
  events: BlockingEvent[]
  vacations: BlockingEvent[]
  isToday: boolean
}

interface TrialBar {
  trial: TrialItem
  startCol: number
  endCol: number
  lane: number
}

interface WeekData {
  days: DayInfo[]
  trialBars: TrialBar[]
  maxLanes: number
}

export function WeekHeatmap({
  data,
  months,
  staffMap,
  onEditEvent,
}: {
  data: TrialCalendarData
  months: Date[]
  staffMap: Map<number, StaffMember>
  onEditEvent: (eventId: number) => void
}) {
  const { openCasePreview } = useCasePreview()

  const today = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])

  const trialSpans = useMemo(() => {
    return data.trials.map((t) => {
      const start = parseDate(t.trial_date)
      const end = addWeekdaysFn(start, Math.max(t.trial_estimated_days ?? 1, 1))
      return { trial: t, start, end }
    })
  }, [data.trials])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, BlockingEvent[]>()
    for (const evt of data.blocking_events) {
      if (evt.event_type === "vacation") continue
      const start = parseDate(evt.date)
      const end = evt.end_date ? parseDate(evt.end_date) : start
      let d = start
      while (d <= end) {
        if (getDay(d) !== 0 && getDay(d) !== 6) {
          const key = format(d, "yyyy-MM-dd")
          const arr = map.get(key) ?? []
          arr.push(evt)
          map.set(key, arr)
        }
        d = addDays(d, 1)
      }
    }
    return map
  }, [data.blocking_events])

  const vacationSpans = useMemo(() => {
    return data.blocking_events
      .filter((e) => e.event_type === "vacation")
      .map((e) => ({
        event: e,
        start: parseDate(e.date),
        end: e.end_date ? parseDate(e.end_date) : parseDate(e.date),
      }))
  }, [data.blocking_events])

  const { weeks, monthLabels } = useMemo(() => {
    const rangeStart = startOfMonth(months[0])
    const rangeEnd = endOfMonth(months[months.length - 1])
    let cursor = startOfWeek(rangeStart, { weekStartsOn: 1 })

    const allWeeks: WeekData[] = []
    const labels: { label: string; rowIdx: number }[] = []
    let lastMonthKey = ""

    while (cursor <= rangeEnd) {
      const days: DayInfo[] = []
      for (let i = 0; i < 5; i++) {
        const d = addDays(cursor, i)
        const monthKey = format(d, "yyyy-MM")
        const dayVacations = vacationSpans
          .filter(({ start, end }) => d >= start && d <= end)
          .map(({ event }) => event)
        const dayEvents = eventsByDate.get(format(d, "yyyy-MM-dd")) ?? []

        days.push({
          date: d,
          dayNum: d.getDate(),
          monthKey,
          events: dayEvents,
          vacations: dayVacations,
          isToday: isSameDay(d, today),
        })
      }

      const midWeek = addDays(cursor, 2)
      const midMonthKey = format(midWeek, "yyyy-MM")
      if (midMonthKey !== lastMonthKey) {
        labels.push({ label: format(midWeek, "MMM yyyy"), rowIdx: allWeeks.length })
        lastMonthKey = midMonthKey
      }

      const weekTrials = trialSpans.filter(({ start, end }) => {
        return days.some((d) => d.date >= start && d.date <= end)
      })

      const bars: TrialBar[] = []
      const laneEnds: number[] = []

      for (const { trial, start, end } of weekTrials) {
        let startCol = -1
        let endCol = -1
        for (let i = 0; i < 5; i++) {
          if (days[i].date >= start && days[i].date <= end) {
            if (startCol === -1) startCol = i
            endCol = i
          }
        }
        if (startCol === -1) continue

        let lane = -1
        for (let i = 0; i < laneEnds.length; i++) {
          if (laneEnds[i] < startCol) {
            lane = i
            break
          }
        }
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(-1)
        }
        laneEnds[lane] = endCol

        bars.push({ trial, startCol, endCol, lane })
      }

      allWeeks.push({
        days,
        trialBars: bars,
        maxLanes: laneEnds.length,
      })

      cursor = addWeeks(cursor, 1)
    }

    return { weeks: allWeeks, monthLabels: labels }
  }, [months, trialSpans, vacationSpans, eventsByDate, today])

  const monthIdxMap = useMemo(() => {
    const keys: string[] = []
    for (const week of weeks) {
      for (const day of week.days) {
        if (!keys.includes(day.monthKey)) keys.push(day.monthKey)
      }
    }
    return new Map(keys.map((k, i) => [k, i]))
  }, [weeks])

  const attyNames = (ids: number[]) =>
    ids
      .map((id) => staffMap.get(id))
      .filter(Boolean)
      .map((s) => `${s!.firstName} ${s!.lastName}`)
      .join(", ")

  const labelRowMap = new Map(monthLabels.map((l) => [l.rowIdx, l.label]))

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-auto border bg-card" style={{ maxHeight: "calc(100vh - 200px)" }}>
        <div className="flex">
          {/* Month labels */}
          <div className="sticky left-0 z-20 w-20 shrink-0 bg-card">
            {weeks.map((_, wi) => {
              const label = labelRowMap.get(wi)
              const rowH = Math.max(TOTAL, TOTAL + (weeks[wi].maxLanes > 0 ? weeks[wi].maxLanes * (BAR_H + BAR_GAP) : 0))
              return (
                <div
                  key={wi}
                  className="flex items-start justify-end pr-3 pt-1 border-r"
                  style={{ height: rowH }}
                >
                  {label && (
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                      {label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Calendar grid */}
          <div>
            {/* Day-of-week header */}
            <div
              className="sticky top-0 z-10 flex bg-card border-b"
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium text-muted-foreground py-1"
                  style={{ width: TOTAL }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Week rows */}
            {weeks.map((week, wi) => {
              const barsHeight = week.maxLanes > 0 ? week.maxLanes * (BAR_H + BAR_GAP) : 0
              const rowH = Math.max(TOTAL, TOTAL + barsHeight)
              return (
                <div key={wi} className="relative flex" style={{ height: rowH }}>
                  {/* Day cells with month backgrounds */}
                  {week.days.map((day, di) => {
                    const mIdx = monthIdxMap.get(day.monthKey) ?? 0
                    const bgColor = mIdx % 2 === 0 ? "bg-muted/30" : "bg-muted/70"
                    const hasVacation = day.vacations.length > 0
                    return (
                      <div
                        key={di}
                        className={bgColor}
                        style={{ width: TOTAL, height: TOTAL, padding: PAD }}
                      >
                        <div
                          className={`relative h-full bg-card ${
                            day.isToday
                              ? "ring-2 ring-foreground/40"
                              : "border border-border/40"
                          } ${hasVacation ? "bg-info/10" : ""}`}
                        >
                          {/* Day number */}
                          <span
                            className={`absolute top-0.5 left-1 text-[10px] leading-none ${
                              day.isToday
                                ? "font-bold text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {day.dayNum}
                          </span>

                          {/* Event dots */}
                          {day.events.length > 0 && (
                            <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                              {day.events.map((evt) => (
                                <Tooltip key={evt.id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="size-2 bg-destructive rounded-full cursor-pointer hover:ring-1 hover:ring-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onEditEvent(evt.id)
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="bg-popover text-popover-foreground border shadow-md"
                                  >
                                    <div className="text-xs">
                                      <div className="font-semibold">
                                        {evt.description}
                                      </div>
                                      <div className="text-muted-foreground">
                                        {evt.event_type.replace(/_/g, " ")} ·{" "}
                                        {format(parseDate(evt.date), "MMM d")}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          )}

                          {/* Vacation indicator */}
                          {hasVacation && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="absolute bottom-0.5 left-1 text-[8px] text-info-foreground font-medium cursor-pointer hover:underline truncate"
                                  style={{ maxWidth: CELL - 8 }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEditEvent(day.vacations[0].id)
                                  }}
                                >
                                  PTO
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-popover text-popover-foreground border shadow-md"
                              >
                                <div className="text-xs">
                                  <div className="font-semibold">
                                    {day.vacations[0].description}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {format(parseDate(day.vacations[0].date), "MMM d")}
                                    {day.vacations[0].end_date &&
                                      ` – ${format(parseDate(day.vacations[0].end_date), "MMM d")}`}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Trial bars — positioned below the day cells */}
                  {week.trialBars.map((bar) => {
                    const color = bar.trial.color
                      ? `var(--palette-${bar.trial.color})`
                      : "var(--destructive)"
                    const opacity = Math.max(
                      (bar.trial.trial_likelihood ?? 100) / 100,
                      0.3,
                    )
                    const left = bar.startCol * TOTAL + PAD
                    const width = (bar.endCol - bar.startCol + 1) * TOTAL - PAD * 2
                    const top = TOTAL + bar.lane * (BAR_H + BAR_GAP)
                    const label =
                      bar.trial.short_name || bar.trial.case_name.split(" v.")[0]

                    return (
                      <Tooltip key={`${bar.trial.case_id}-${wi}`}>
                        <TooltipTrigger asChild>
                          <button
                            className="absolute cursor-pointer overflow-hidden flex items-center"
                            style={{
                              left,
                              width,
                              top,
                              height: BAR_H,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openCasePreview(bar.trial.case_id)
                            }}
                          >
                            <div
                              className="absolute inset-0"
                              style={{ backgroundColor: color, opacity }}
                            />
                            <span className="relative text-white text-[9px] font-medium leading-none px-1.5 truncate">
                              {label}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="bg-popover text-popover-foreground border shadow-md max-w-64"
                        >
                          {(() => {
                            const isStale = bar.trial.status === "Settl. Pend." || bar.trial.status === "Closed"
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold">
                                    {bar.trial.case_name}
                                  </span>
                                  {isStale && (
                                    <span className="text-[10px] font-medium px-1 py-px bg-warning/15 text-warning-foreground border border-warning/30">
                                      {bar.trial.status}
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted-foreground text-xs space-y-0.5">
                                  <div>
                                    Trial:{" "}
                                    {format(
                                      parseDate(bar.trial.trial_date),
                                      "MMM d, yyyy",
                                    )}
                                    {bar.trial.trial_estimated_days
                                      ? ` · ${bar.trial.trial_estimated_days} days`
                                      : ""}
                                  </div>
                                  {bar.trial.jurisdiction_name && (
                                    <div>{bar.trial.jurisdiction_name}</div>
                                  )}
                                  {bar.trial.attorney_ids.length > 0 && (
                                    <div>
                                      Atty: {attyNames(bar.trial.attorney_ids)}
                                    </div>
                                  )}
                                  <div>
                                    Likelihood: {bar.trial.trial_likelihood ?? "?"}%
                                  </div>
                                </div>
                                {isStale && (
                                  <div className="text-[11px] text-warning-foreground font-medium pt-0.5 border-t border-warning/20">
                                    Consider updating likelihood or removing trial date
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
