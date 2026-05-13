import { useMemo } from "react"
import { useNavigate } from "react-router"
import {
  startOfMonth,
  endOfMonth,
  addDays,
  getDay,
  format,
  isToday,
  isAfter,
} from "date-fns"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import type { TrialCalendarData, TrialItem, BlockingEvent } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"

const LANE_HEIGHT = 15
const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"]
const LIGHT_TIP = "bg-popover text-popover-foreground border shadow-md [&>svg]:hidden"

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function mondayIdx(date: Date): number {
  return (getDay(date) + 6) % 7
}

function getMonthWeeks(month: Date): (Date | null)[][] {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const weeks: (Date | null)[][] = []
  let cursor = addDays(first, -mondayIdx(first))

  while (true) {
    const week: (Date | null)[] = []
    for (let i = 0; i < 7; i++) {
      if (cursor.getMonth() === month.getMonth() && cursor.getFullYear() === month.getFullYear()) {
        week.push(new Date(cursor))
      } else {
        week.push(null)
      }
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
    if (isAfter(cursor, last)) break
  }

  return weeks
}

function attyLabel(ids: number[], staffMap: Map<number, StaffMember>): string {
  if (!ids.length) return ""
  const s = staffMap.get(ids[0])
  return s ? s.initials : ""
}

function attyFullNames(ids: number[], staffMap: Map<number, StaffMember>): string {
  return ids
    .map((id) => {
      const s = staffMap.get(id)
      return s ? `${s.firstName} ${s.lastName}` : null
    })
    .filter(Boolean)
    .join(", ")
}

interface EventSegment {
  id: string
  type: "trial" | "vacation" | "dot"
  label: string
  startCol: number
  endCol: number
  opacity: number
  caseId?: number
  eventId?: number
  tooltipContent: React.ReactNode
  lane: number
}

function buildWeekSegments(
  week: (Date | null)[],
  monthStart: Date,
  monthEnd: Date,
  trials: TrialItem[],
  blockingEvents: BlockingEvent[],
  staffMap: Map<number, StaffMember>,
): { segments: EventSegment[]; laneCount: number } {
  const dates = week.filter((d): d is Date => d !== null)
  if (dates.length === 0) return { segments: [], laneCount: 0 }

  const weekStart = dates[0]
  const weekEnd = dates[dates.length - 1]
  const segments: EventSegment[] = []

  for (const trial of trials) {
    const trialStart = parseDate(trial.trial_date)
    const trialEnd = addDays(trialStart, Math.max((trial.trial_estimated_days ?? 1) - 1, 0))

    const clipStart = trialStart < monthStart ? monthStart : trialStart
    const clipEnd = trialEnd > monthEnd ? monthEnd : trialEnd
    if (clipStart > weekEnd || clipEnd < weekStart) continue

    const segStart = clipStart < weekStart ? weekStart : clipStart
    const segEnd = clipEnd > weekEnd ? weekEnd : clipEnd

    const shortName = trial.short_name || trial.case_name.split(" ")[0]
    const initials = attyLabel(trial.attorney_ids, staffMap)
    const label = initials ? `${shortName} (${initials})` : shortName
    const attyNames = attyFullNames(trial.attorney_ids, staffMap)

    segments.push({
      id: `trial-${trial.case_id}-w${weekStart.getDate()}`,
      type: "trial",
      label,
      startCol: mondayIdx(segStart),
      endCol: mondayIdx(segEnd),
      opacity: Math.max((trial.trial_likelihood ?? 50) / 100, 0.2),
      caseId: trial.case_id,
      tooltipContent: (
        <div className="space-y-1">
          <div className="font-semibold">{trial.case_name}</div>
          <div className="text-muted-foreground text-xs">
            <div>
              Trial: {format(trialStart, "MMM d, yyyy")}
              {trial.trial_estimated_days ? ` · ${trial.trial_estimated_days}d` : ""}
            </div>
            {trial.jurisdiction_name && <div>{trial.jurisdiction_name}</div>}
            {attyNames && <div>Atty: {attyNames}</div>}
            <div>Status: {trial.status}</div>
            <div>Likelihood: {trial.trial_likelihood ?? "?"}%</div>
          </div>
        </div>
      ),
      lane: 0,
    })
  }

  for (const evt of blockingEvents) {
    const evtStart = parseDate(evt.date)
    const evtEnd = evt.end_date ? parseDate(evt.end_date) : evtStart
    const isVacation = evt.event_type === "vacation"

    const clipStart = evtStart < monthStart ? monthStart : evtStart
    const clipEnd = evtEnd > monthEnd ? monthEnd : evtEnd
    if (clipStart > weekEnd || clipEnd < weekStart) continue

    const segStart = clipStart < weekStart ? weekStart : clipStart
    const segEnd = clipEnd > weekEnd ? weekEnd : clipEnd

    if (isVacation) {
      segments.push({
        id: `vac-${evt.id}-w${weekStart.getDate()}`,
        type: "vacation",
        label: evt.description,
        startCol: mondayIdx(segStart),
        endCol: mondayIdx(segEnd),
        opacity: 0.7,
        eventId: evt.id,
        tooltipContent: (
          <div className="space-y-1">
            <div className="font-semibold">{evt.description}</div>
            <div className="text-muted-foreground text-xs">
              {format(evtStart, "MMM d")}
              {evt.end_date && ` – ${format(parseDate(evt.end_date), "MMM d, yyyy")}`}
            </div>
          </div>
        ),
        lane: 0,
      })
    } else {
      segments.push({
        id: `dot-${evt.id}`,
        type: "dot",
        label: "",
        startCol: mondayIdx(segStart),
        endCol: mondayIdx(segStart),
        opacity: 1,
        eventId: evt.id,
        tooltipContent: (
          <div className="space-y-1">
            <div className="font-semibold">{evt.description}</div>
            <div className="text-muted-foreground text-xs">
              <div>{evt.event_type.replace(/_/g, " ")}</div>
              <div>{format(evtStart, "MMM d, yyyy")}</div>
            </div>
          </div>
        ),
        lane: 0,
      })
    }
  }

  segments.sort((a, b) => {
    if (a.type === "dot" && b.type !== "dot") return 1
    if (a.type !== "dot" && b.type === "dot") return -1
    return a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol)
  })

  const laneEnds: number[] = []
  for (const seg of segments) {
    let lane = -1
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < seg.startCol) {
        lane = i
        break
      }
    }
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(-1)
    }
    seg.lane = lane
    laneEnds[lane] = seg.endCol
  }

  return { segments, laneCount: laneEnds.length }
}

function MonthCard({
  month,
  trials,
  blockingEvents,
  staffMap,
  onNavigateToCase,
  onEditEvent,
}: {
  month: Date
  trials: TrialItem[]
  blockingEvents: BlockingEvent[]
  staffMap: Map<number, StaffMember>
  onNavigateToCase: (caseId: number) => void
  onEditEvent: (eventId: number) => void
}) {
  const weeks = useMemo(() => getMonthWeeks(month), [month.getTime()])
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)

  const weekData = useMemo(
    () => weeks.map((week) => buildWeekSegments(week, monthStart, monthEnd, trials, blockingEvents, staffMap)),
    [weeks, trials, blockingEvents, staffMap, monthStart.getTime(), monthEnd.getTime()],
  )

  return (
    <div className="border bg-card p-2">
      <div className="mb-1 text-[11px] font-semibold">{format(month, "MMMM yyyy")}</div>
      <div className="grid grid-cols-7 text-center">
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="text-muted-foreground/60 text-[9px] font-medium leading-[14px]">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi}>
          <div className="grid grid-cols-7 text-center">
            {week.map((date, di) => (
              <div
                key={di}
                className={`text-[10px] leading-[18px] ${
                  date && isToday(date)
                    ? "bg-destructive text-destructive-foreground font-bold"
                    : di >= 5
                      ? "text-muted-foreground/40"
                      : "text-foreground"
                } ${!date ? "text-transparent" : ""}`}
              >
                {date ? date.getDate() : ""}
              </div>
            ))}
          </div>
          <div
            className="relative"
            style={{ height: Math.max(weekData[wi].laneCount, 1) * LANE_HEIGHT }}
          >
            {weekData[wi].segments.map((seg) => {
              if (seg.type === "dot") {
                return (
                  <Tooltip key={seg.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="absolute flex cursor-pointer items-center justify-center"
                        style={{
                          left: `${(seg.startCol / 7) * 100}%`,
                          width: `${(1 / 7) * 100}%`,
                          top: seg.lane * LANE_HEIGHT + 1,
                          height: LANE_HEIGHT - 3,
                        }}
                        onClick={() => seg.eventId && onEditEvent(seg.eventId)}
                      >
                        <div
                          style={{
                            width: LANE_HEIGHT - 3,
                            height: LANE_HEIGHT - 3,
                            backgroundColor: "var(--destructive)",
                          }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className={`max-w-64 ${LIGHT_TIP}`}>
                      {seg.tooltipContent}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              const span = seg.endCol - seg.startCol + 1
              const color = seg.type === "trial" ? "var(--destructive)" : "var(--info)"

              return (
                <Tooltip key={seg.id}>
                  <TooltipTrigger asChild>
                    <button
                      className="absolute flex cursor-pointer items-center overflow-hidden px-0.5 text-[8px] font-medium text-white"
                      style={{
                        left: `${(seg.startCol / 7) * 100}%`,
                        width: `${(span / 7) * 100}%`,
                        top: seg.lane * LANE_HEIGHT + 1,
                        height: LANE_HEIGHT - 3,
                        backgroundColor: color,
                        opacity: seg.opacity,
                      }}
                      onClick={() => {
                        if (seg.type === "trial" && seg.caseId) onNavigateToCase(seg.caseId)
                        else if (seg.eventId) onEditEvent(seg.eventId)
                      }}
                    >
                      <span className="truncate">{seg.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className={`max-w-64 ${LIGHT_TIP}`}>
                    {seg.tooltipContent}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MonthCalendarGrid({
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
  const navigate = useNavigate()

  const gridCols =
    months.length <= 1
      ? "grid-cols-1 max-w-sm mx-auto w-full"
      : months.length <= 3
        ? "grid-cols-3"
        : months.length <= 6
          ? "grid-cols-3"
          : "grid-cols-4"

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`grid gap-3 ${gridCols}`}>
        {months.map((month) => (
          <MonthCard
            key={format(month, "yyyy-MM")}
            month={month}
            trials={data.trials}
            blockingEvents={data.blocking_events}
            staffMap={staffMap}
            onNavigateToCase={(id) => navigate(`/cases/${id}`)}
            onEditEvent={onEditEvent}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}
