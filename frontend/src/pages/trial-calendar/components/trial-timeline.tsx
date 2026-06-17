import { useMemo } from "react"
import { useCasePreview } from "@/hooks/use-case-preview"
import {
  startOfMonth,
  endOfMonth,
  addDays,
  differenceInCalendarDays,
  format,
  isMonday,
  isSameDay,
  getDay,
} from "date-fns"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import type { TrialCalendarData, TrialItem, BlockingEvent } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function addWeekdays(start: Date, weekdays: number): Date {
  let remaining = weekdays - 1
  let current = start
  while (remaining > 0) {
    current = addDays(current, 1)
    const dow = getDay(current)
    if (dow !== 0 && dow !== 6) remaining--
  }
  return current
}

const LIGHT_TIP = "bg-popover text-popover-foreground border shadow-md [&>svg]:hidden"

interface LaneItem {
  id: string
  type: "trial" | "vacation" | "event"
  startDay: number
  endDay: number
  lane: number
  trial?: TrialItem
  event?: BlockingEvent
}

export function VerticalTimeline({
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

  const rangeStart = startOfMonth(months[0])
  const rangeEnd = endOfMonth(months[months.length - 1])
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1

  const dayHeight =
    months.length <= 1 ? 20 : months.length <= 3 ? 8 : months.length <= 6 ? 5 : 3
  const showDayLines = dayHeight >= 4
  const totalHeight = totalDays * dayHeight

  const { laneItems, laneCount } = useMemo(() => {
    const rawItems: Array<{
      id: string
      type: "trial" | "vacation" | "event"
      startDay: number
      endDay: number
      trial?: TrialItem
      event?: BlockingEvent
    }> = []

    for (const trial of data.trials) {
      const trialStart = parseDate(trial.trial_date)
      const trialEnd = addWeekdays(
        trialStart,
        Math.max(trial.trial_estimated_days ?? 1, 1),
      )
      const startDay = Math.max(
        differenceInCalendarDays(trialStart, rangeStart),
        0,
      )
      const endDay = Math.min(
        differenceInCalendarDays(trialEnd, rangeStart),
        totalDays - 1,
      )
      if (startDay > totalDays - 1 || endDay < 0) continue
      rawItems.push({
        id: `trial-${trial.case_id}`,
        type: "trial",
        startDay,
        endDay,
        trial,
      })
    }

    for (const evt of data.blocking_events) {
      const evtStart = parseDate(evt.date)
      const evtEnd = evt.end_date ? parseDate(evt.end_date) : evtStart
      const startDay = Math.max(
        differenceInCalendarDays(evtStart, rangeStart),
        0,
      )
      const endDay = Math.min(
        differenceInCalendarDays(evtEnd, rangeStart),
        totalDays - 1,
      )
      if (startDay > totalDays - 1 || endDay < 0) continue
      rawItems.push({
        id: `evt-${evt.id}`,
        type: evt.event_type === "vacation" ? "vacation" : "event",
        startDay,
        endDay,
        event: evt,
      })
    }

    rawItems.sort(
      (a, b) =>
        a.startDay - b.startDay ||
        b.endDay - b.startDay - (a.endDay - a.startDay),
    )

    const laneEnds: number[] = []
    const items: LaneItem[] = rawItems.map((item) => {
      let lane = -1
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] < item.startDay) {
          lane = i
          break
        }
      }
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(-1)
      }
      laneEnds[lane] = item.endDay
      return { ...item, lane }
    })

    return { laneItems: items, laneCount: laneEnds.length }
  }, [data, rangeStart, totalDays])

  const { weekLines, monthLabels, todayOffset } = useMemo(() => {
    const weeks: { day: number; label: string }[] = []
    const monthLbls: { day: number; label: string }[] = []
    let today: number | null = null
    const nowDate = new Date()
    const todayDate = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
    )

    let lastMonth = -1
    for (let d = 0; d < totalDays; d++) {
      const date = addDays(rangeStart, d)
      if (isSameDay(date, todayDate)) today = d
      if (date.getMonth() !== lastMonth) {
        monthLbls.push({ day: d, label: format(date, "MMM yyyy") })
        lastMonth = date.getMonth()
      }
      if (isMonday(date)) {
        weeks.push({ day: d, label: format(date, "d") })
      }
    }

    return { weekLines: weeks, monthLabels: monthLbls, todayOffset: today }
  }, [rangeStart, totalDays])

  const LANE_WIDTH =
    months.length <= 1 ? 140 : months.length <= 3 ? 120 : 100
  const GUTTER_WIDTH = 64
  const timelineWidth = Math.max(laneCount * LANE_WIDTH, 300)

  const attyLabel = (ids: number[]) => {
    if (!ids.length) return ""
    const s = staffMap.get(ids[0])
    return s ? s.initials : ""
  }

  const attyFullNames = (ids: number[]) =>
    ids
      .map((id) => staffMap.get(id))
      .filter(Boolean)
      .map((s) => `${s!.firstName} ${s!.lastName}`)
      .join(", ")

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="overflow-auto border"
        style={{ maxHeight: "calc(100vh - 160px)" }}
      >
        <div className="relative flex" style={{ minHeight: totalHeight }}>
          {/* Left gutter — date axis */}
          <div
            className="bg-card sticky left-0 z-20 flex-none border-r"
            style={{ width: GUTTER_WIDTH, height: totalHeight }}
          >
            <div className="relative" style={{ height: totalHeight }}>
              {monthLabels.map((ml, i) => (
                <div
                  key={`ml-${i}`}
                  className="bg-muted/60 absolute left-0 right-0 border-b px-1.5 text-[10px] font-semibold"
                  style={{
                    top: ml.day * dayHeight,
                    lineHeight: `${Math.max(dayHeight * 3, 18)}px`,
                    height: Math.max(dayHeight * 3, 18),
                    zIndex: 2,
                  }}
                >
                  {ml.label}
                </div>
              ))}
              {weekLines.map((wl, i) => (
                <div
                  key={`wl-${i}`}
                  className="text-muted-foreground absolute right-1.5 text-[9px] leading-none"
                  style={{ top: wl.day * dayHeight + 1 }}
                >
                  {wl.label}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline area */}
          <div
            className="relative flex-none"
            style={{ width: timelineWidth, height: totalHeight }}
          >
            {/* Weekend shading */}
            {dayHeight >= 5 &&
              Array.from({ length: totalDays }, (_, d) => {
                const date = addDays(rangeStart, d)
                const dow = getDay(date)
                if (dow !== 0 && dow !== 6) return null
                return (
                  <div
                    key={`we-${d}`}
                    className="absolute left-0 right-0 bg-muted/30"
                    style={{ top: d * dayHeight, height: dayHeight }}
                  />
                )
              })}

            {/* Day gridlines */}
            {showDayLines &&
              Array.from({ length: totalDays }, (_, d) => (
                <div
                  key={`dl-${d}`}
                  className="absolute left-0 right-0 border-b border-border/15"
                  style={{ top: d * dayHeight }}
                />
              ))}

            {/* Week gridlines */}
            {weekLines.map((wl, i) => (
              <div
                key={`wg-${i}`}
                className="absolute left-0 right-0 border-b border-border/50"
                style={{ top: wl.day * dayHeight }}
              />
            ))}

            {/* Month gridlines */}
            {monthLabels.map((ml, i) => (
              <div
                key={`mg-${i}`}
                className="absolute left-0 right-0 border-b border-border"
                style={{ top: ml.day * dayHeight }}
              />
            ))}

            {/* Today marker */}
            {todayOffset !== null && (
              <div
                className="absolute left-0 right-0 z-30"
                style={{ top: todayOffset * dayHeight }}
              >
                <div className="border-t-2 border-destructive" />
                <span className="bg-destructive absolute -top-[10px] right-0 px-1 text-[8px] font-bold text-white">
                  TODAY
                </span>
              </div>
            )}

            {/* Lane items */}
            {laneItems.map((item) => {
              const top = item.startDay * dayHeight
              const height = Math.max(
                (item.endDay - item.startDay + 1) * dayHeight,
                dayHeight,
              )
              const left = item.lane * LANE_WIDTH + 4
              const width = LANE_WIDTH - 8

              if (item.type === "trial" && item.trial) {
                const t = item.trial
                const opacity = Math.max(
                  (t.trial_likelihood ?? 100) / 100,
                  0.25,
                )
                const color = t.color || "var(--destructive)"
                const shortName =
                  t.short_name || t.case_name.split(" ")[0]
                const initials = attyLabel(t.attorney_ids)
                const label = initials
                  ? `${shortName} (${initials})`
                  : shortName
                const names = attyFullNames(t.attorney_ids)
                const trialStart = parseDate(t.trial_date)

                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="absolute z-10 cursor-pointer overflow-hidden border border-white/20 px-1 pt-0.5 text-left text-[9px] font-medium leading-tight text-white"
                        style={{
                          top,
                          left,
                          width,
                          height,
                          backgroundColor: color,
                          opacity,
                        }}
                        onClick={() => openCasePreview(t.case_id)}
                      >
                        <span className="line-clamp-3">{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className={`max-w-64 ${LIGHT_TIP}`}
                    >
                      {(() => {
                        const isStale = t.status === "Settl. Pend." || t.status === "Closed"
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">{t.case_name}</span>
                              {isStale && (
                                <span className="text-[10px] font-medium px-1 py-px bg-warning/15 text-warning-foreground border border-warning/30">
                                  {t.status}
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              <div>
                                Trial: {format(trialStart, "MMM d, yyyy")}
                                {t.trial_estimated_days
                                  ? ` · ${t.trial_estimated_days} weekdays`
                                  : ""}
                              </div>
                              {t.jurisdiction_name && (
                                <div>{t.jurisdiction_name}</div>
                              )}
                              {names && <div>Atty: {names}</div>}
                              <div>Status: {t.status}</div>
                              <div>
                                Likelihood: {t.trial_likelihood ?? "?"}%
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
              }

              if (item.type === "vacation" && item.event) {
                const evt = item.event
                const evtStart = parseDate(evt.date)
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="absolute z-10 cursor-pointer overflow-hidden border border-white/20 px-1 pt-0.5 text-left text-[9px] font-medium leading-tight text-white"
                        style={{
                          top,
                          left,
                          width,
                          height,
                          backgroundColor: "var(--info)",
                          opacity: 0.7,
                        }}
                        onClick={() => onEditEvent(evt.id)}
                      >
                        <span className="line-clamp-3">
                          {evt.description}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className={`max-w-64 ${LIGHT_TIP}`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {evt.description}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {format(evtStart, "MMM d")}
                          {evt.end_date &&
                            ` – ${format(parseDate(evt.end_date), "MMM d, yyyy")}`}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              if (item.type === "event" && item.event) {
                const evt = item.event
                const evtStart = parseDate(evt.date)
                const size = Math.max(dayHeight * 2, 12)
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="absolute z-10 flex cursor-pointer items-center justify-center"
                        style={{
                          top: top + dayHeight / 2 - size / 2,
                          left: left + width / 2 - size / 2,
                          width: size,
                          height: size,
                        }}
                        onClick={() => onEditEvent(evt.id)}
                      >
                        <div
                          style={{
                            width: size,
                            height: size,
                            backgroundColor: "var(--destructive)",
                          }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className={`max-w-64 ${LIGHT_TIP}`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {evt.description}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          <div>{evt.event_type.replace(/_/g, " ")}</div>
                          <div>{format(evtStart, "MMM d, yyyy")}</div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return null
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
