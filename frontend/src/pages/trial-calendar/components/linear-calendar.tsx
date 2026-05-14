import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { format } from "date-fns"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { TrialCalendarData } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"
import {
  normalizeItems,
  mergeBusySpans,
  computeOpenWindows,
  computeOpenDays,
  generateWeeks,
  buildWeekRows,
  computeWindowPills,
  parseDate,
  dateKey,
  type CalendarItem,
  type OpenWindow,
  type WindowPill,
} from "./calendar-helpers"

const DAYNUM_H = 20
const LANE_H = 22
const LANE_GAP = 2
const BOTTOM_PAD = 6
const GUTTER_W = 112

function rh(laneCount: number): number {
  return (
    DAYNUM_H +
    laneCount * LANE_H +
    Math.max(laneCount - 1, 0) * LANE_GAP +
    BOTTOM_PAD
  )
}

function getItemStyle(item: CalendarItem): React.CSSProperties {
  if (item.kind === "vacation") return { backgroundColor: "var(--info)" }
  if (item.kind === "event") return { backgroundColor: "var(--destructive)" }
  const likelihood = item.trialRaw?.trial_likelihood ?? 50
  const opacity = Math.max(likelihood / 100, 0.3)
  return { backgroundColor: "var(--destructive)", opacity }
}

function OpenWindowsStrip({ windows }: { windows: OpenWindow[] }) {
  if (!windows.length) return null
  const maxBd = Math.max(...windows.map((w) => w.businessDays))
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {windows.map((w, i) => {
        const isMax = w.businessDays === maxBd && windows.length > 1
        return (
          <div
            key={i}
            className={cn(
              "shrink-0 border px-3 py-2",
              isMax ? "border-success/60 bg-success/5" : "border-border",
            )}
          >
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {format(w.start, "MMM d")} – {format(w.end, "MMM d")}
            </div>
            <div
              className={cn(
                "text-sm font-semibold tabular-nums",
                isMax ? "text-success" : "text-foreground",
              )}
            >
              {w.businessDays} trial days
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LinearCalendar({
  data,
  staffMap,
}: {
  data: TrialCalendarData
  staffMap: Map<number, StaffMember>
}) {
  const navigate = useNavigate()
  const [highlightOpen, setHighlightOpen] = useState(true)

  const todayKey = useMemo(() => {
    const n = new Date()
    return dateKey(new Date(n.getFullYear(), n.getMonth(), n.getDate()))
  }, [])

  const { openWindows, weekRows, openDays, windowPills } = useMemo(() => {
    const rangeStart = parseDate(data.range.start)
    const rangeEnd = parseDate(data.range.end)
    const items = normalizeItems(data.trials, data.blocking_events)
    const busy = mergeBusySpans(items)
    const openWindows = computeOpenWindows(busy, rangeStart, rangeEnd)
    const openDays = computeOpenDays(items, rangeStart, rangeEnd)
    const weeks = generateWeeks(rangeStart, rangeEnd)
    const weekRows = buildWeekRows(weeks, items)
    const windowPills = computeWindowPills(openWindows, weeks)
    return { openWindows, weekRows, openDays, windowPills }
  }, [data])

  const pillsByWeek = useMemo(() => {
    const m = new Map<number, WindowPill[]>()
    for (const p of windowPills) {
      const arr = m.get(p.weekIndex) ?? []
      arr.push(p)
      m.set(p.weekIndex, arr)
    }
    return m
  }, [windowPills])

  const attyNames = (ids: number[]) =>
    ids
      .map((id) => staffMap.get(id))
      .filter(Boolean)
      .map((s) => `${s!.firstName} ${s!.lastName}`)
      .join(", ")

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-3">
        <OpenWindowsStrip windows={openWindows} />

        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-muted-foreground w-fit">
          <input
            type="checkbox"
            checked={highlightOpen}
            onChange={(e) => setHighlightOpen(e.target.checked)}
            className="accent-[var(--success)]"
          />
          Highlight open windows
        </label>

        <div
          className="overflow-auto border bg-card"
          style={{ maxHeight: "calc(100vh - 340px)" }}
        >
          {/* Sticky weekday header */}
          <div className="sticky top-0 z-30 flex border-b bg-card">
            <div
              className="shrink-0 border-r bg-card"
              style={{ width: GUTTER_W }}
            />
            <div className="flex-1 grid grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (d, i) => (
                  <div
                    key={d}
                    className={cn(
                      "text-center text-[11px] font-medium py-1.5",
                      i >= 5
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground",
                    )}
                  >
                    {d}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Week rows */}
          {weekRows.map((week, wi) => {
            const h = rh(week.laneCount)
            const pills = pillsByWeek.get(wi) ?? []
            const hasConflict = week.conflictColumns.size > 0

            return (
              <div
                key={wi}
                className={cn(
                  "flex",
                  week.monthLabel &&
                    wi > 0 &&
                    "border-t-2 border-border",
                )}
                style={{ height: h }}
              >
                {/* Gutter */}
                <div
                  className="shrink-0 border-r px-2 pt-1 flex flex-col"
                  style={{ width: GUTTER_W }}
                >
                  {week.monthLabel && (
                    <span className="text-sm font-bold text-foreground leading-tight">
                      {week.monthLabel}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {week.weekLabel}
                  </span>
                  {hasConflict && (
                    <span className="mt-0.5 inline-block bg-destructive text-white text-[9px] font-bold px-1 py-px self-start">
                      CONFLICT
                    </span>
                  )}
                </div>

                {/* Seven-day area */}
                <div className="flex-1 relative">
                  {/* Background grid */}
                  <div
                    className="absolute inset-0 grid grid-cols-7"
                    style={{ height: h }}
                  >
                    {week.days.map((day, col) => {
                      const dk = dateKey(day)
                      const isWe = col >= 5
                      const isToday = dk === todayKey
                      const isConflict = week.conflictColumns.has(col)
                      const isOpen = highlightOpen && openDays.has(dk)

                      return (
                        <div
                          key={col}
                          className={cn(
                            "relative border-r border-b border-border/20",
                            !isConflict && !isOpen && isWe && "bg-muted/30",
                            isToday && "ring-2 ring-inset ring-primary",
                          )}
                          style={{ height: h }}
                        >
                          {isConflict && (
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundColor: "var(--destructive)",
                                opacity: 0.07,
                              }}
                            />
                          )}
                          {isOpen && !isConflict && (
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundColor: "var(--success)",
                                opacity: 0.07,
                              }}
                            />
                          )}
                          <span
                            className={cn(
                              "absolute top-0.5 left-1 text-[10px] leading-none z-10",
                              isToday
                                ? "font-bold text-primary"
                                : isWe
                                  ? "text-muted-foreground/30"
                                  : "text-muted-foreground/60",
                            )}
                          >
                            {day.getDate()}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Overlay: item bars + pills */}
                  <div className="absolute inset-0" style={{ height: h }}>
                    {week.items.map((ci, idx) => {
                      const left = `${(ci.colStart / 7) * 100}%`
                      const width = `${((ci.colEnd - ci.colStart + 1) / 7) * 100}%`
                      const top =
                        DAYNUM_H + ci.lane * (LANE_H + LANE_GAP)

                      let tooltipBody: React.ReactNode
                      if (ci.item.kind === "trial" && ci.item.trialRaw) {
                        const t = ci.item.trialRaw
                        tooltipBody = (
                          <div className="space-y-1 max-w-64">
                            <div className="font-semibold">
                              {t.case_name}
                            </div>
                            <div className="text-muted-foreground text-xs space-y-0.5">
                              <div>
                                Trial:{" "}
                                {format(
                                  parseDate(t.trial_date),
                                  "MMM d, yyyy",
                                )}
                                {t.trial_estimated_days
                                  ? ` · ${t.trial_estimated_days} days`
                                  : ""}
                              </div>
                              {t.jurisdiction_name && (
                                <div>{t.jurisdiction_name}</div>
                              )}
                              {t.judge_names && (
                                <div>Judge: {t.judge_names}</div>
                              )}
                              {t.attorney_ids.length > 0 && (
                                <div>
                                  Atty: {attyNames(t.attorney_ids)}
                                </div>
                              )}
                              <div>
                                Likelihood: {t.trial_likelihood ?? "?"}%
                              </div>
                              {t.case_number && (
                                <div>#{t.case_number}</div>
                              )}
                            </div>
                          </div>
                        )
                      } else {
                        tooltipBody = (
                          <div className="space-y-1 max-w-64">
                            <div className="font-semibold">
                              {ci.item.label}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {ci.item.kind === "vacation"
                                ? "Vacation"
                                : ci.item.eventRaw?.event_type?.replace(
                                    /_/g,
                                    " ",
                                  )}
                              {" · "}
                              {format(ci.item.start, "MMM d")}
                              {dateKey(ci.item.start) !==
                                dateKey(ci.item.end) &&
                                ` – ${format(ci.item.end, "MMM d")}`}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <Tooltip
                          key={`${ci.item.id}-${wi}-${idx}`}
                        >
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "absolute flex items-center overflow-hidden px-1.5",
                                ci.item.caseId && "cursor-pointer",
                              )}
                              style={{
                                left,
                                width,
                                top,
                                height: LANE_H,
                                ...getItemStyle(ci.item),
                              }}
                              onClick={
                                ci.item.caseId
                                  ? () =>
                                      navigate(
                                        `/cases/${ci.item.caseId}`,
                                      )
                                  : undefined
                              }
                            >
                              <span className="text-[10px] font-medium leading-none text-white truncate">
                                {ci.item.label}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="bg-popover text-popover-foreground border shadow-md"
                          >
                            {tooltipBody}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}

                    {/* Open window pills */}
                    {highlightOpen &&
                      pills.map((pill, pi) => {
                        const left = `${(pill.colStart / 7) * 100}%`
                        const width = `${((pill.colEnd - pill.colStart + 1) / 7) * 100}%`
                        return (
                          <div
                            key={`pill-${pi}`}
                            className="absolute flex items-center justify-center"
                            style={{
                              left,
                              width,
                              top: DAYNUM_H,
                              height: LANE_H,
                            }}
                          >
                            <span className="border border-dashed border-success/60 text-success text-[10px] font-medium px-2 py-0.5 bg-success/5 whitespace-nowrap">
                              {pill.window.businessDays} trial days open
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
