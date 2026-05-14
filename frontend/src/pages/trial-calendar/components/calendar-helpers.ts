import { addDays, getDay, startOfWeek, format } from "date-fns"
import type { TrialItem, BlockingEvent } from "@/services/trial-calendar"

export interface CalendarItem {
  id: string
  kind: "trial" | "vacation" | "event"
  start: Date
  end: Date
  label: string
  status: "firm" | "tentative"
  color?: string
  caseId?: number
  trialRaw?: TrialItem
  eventRaw?: BlockingEvent
}

export interface BusySpan {
  start: Date
  end: Date
}

export interface OpenWindow {
  start: Date
  end: Date
  businessDays: number
}

export interface ClippedItem {
  item: CalendarItem
  colStart: number
  colEnd: number
  lane: number
}

export interface WeekRowData {
  monday: Date
  days: Date[]
  items: ClippedItem[]
  laneCount: number
  conflictColumns: Set<number>
  monthLabel: string | null
  weekLabel: string
}

export interface WindowPill {
  window: OpenWindow
  weekIndex: number
  colStart: number
  colEnd: number
}

// ── Date utilities ──

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toNum(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function isWeekend(d: Date): boolean {
  const dow = getDay(d)
  return dow === 0 || dow === 6
}

export function businessDayCount(start: Date, end: Date): number {
  let count = 0
  let d = new Date(start)
  while (toNum(d) <= toNum(end)) {
    if (!isWeekend(d)) count++
    d = addDays(d, 1)
  }
  return count
}

function addWeekdaysFn(start: Date, weekdays: number): Date {
  let remaining = weekdays - 1
  let current = new Date(start)
  while (remaining > 0) {
    current = addDays(current, 1)
    if (!isWeekend(current)) remaining--
  }
  return current
}

// ── Normalize inputs to unified CalendarItem[] ──

export function normalizeItems(
  trials: TrialItem[],
  events: BlockingEvent[],
): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const t of trials) {
    const start = parseDate(t.trial_date)
    const end = addWeekdaysFn(start, Math.max(t.trial_estimated_days ?? 1, 1))
    items.push({
      id: `trial-${t.case_id}`,
      kind: "trial",
      start,
      end,
      label: t.short_name || t.case_name.split(/\s+v\.?\s+/)[0].trim(),
      status: (t.trial_likelihood ?? 0) >= 75 ? "firm" : "tentative",
      color: t.color ?? undefined,
      caseId: t.case_id,
      trialRaw: t,
    })
  }
  for (const e of events) {
    const start = parseDate(e.date)
    const end = e.end_date ? parseDate(e.end_date) : start
    items.push({
      id: `evt-${e.id}`,
      kind: e.event_type === "vacation" ? "vacation" : "event",
      start,
      end,
      label: e.description,
      status: "firm",
      eventRaw: e,
    })
  }
  return items
}

// ── Merge overlapping/touching busy spans ──

export function mergeBusySpans(items: CalendarItem[]): BusySpan[] {
  if (!items.length) return []
  const intervals = items
    .map((i) => ({ start: new Date(i.start), end: new Date(i.end) }))
    .sort((a, b) => toNum(a.start) - toNum(b.start))
  const merged: BusySpan[] = [{ ...intervals[0] }]
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1]
    const next = intervals[i]
    if (toNum(next.start) <= toNum(addDays(last.end, 1))) {
      if (toNum(next.end) > toNum(last.end)) last.end = new Date(next.end)
    } else {
      merged.push({ start: new Date(next.start), end: new Date(next.end) })
    }
  }
  return merged
}

// ── Open windows (gaps between busy spans) ──

export function computeOpenWindows(
  busySpans: BusySpan[],
  rangeStart: Date,
  rangeEnd: Date,
): OpenWindow[] {
  const windows: OpenWindow[] = []
  let cursor = new Date(rangeStart)
  for (const span of busySpans) {
    if (toNum(cursor) < toNum(span.start)) {
      const windowEnd = addDays(span.start, -1)
      const bd = businessDayCount(cursor, windowEnd)
      if (bd >= 1)
        windows.push({
          start: new Date(cursor),
          end: windowEnd,
          businessDays: bd,
        })
    }
    const after = addDays(span.end, 1)
    if (toNum(after) > toNum(cursor)) cursor = after
  }
  if (toNum(cursor) <= toNum(rangeEnd)) {
    const bd = businessDayCount(cursor, rangeEnd)
    if (bd >= 1)
      windows.push({
        start: new Date(cursor),
        end: new Date(rangeEnd),
        businessDays: bd,
      })
  }
  return windows
}

// ── Open days: weekdays not covered by any item ──

export function computeOpenDays(
  items: CalendarItem[],
  rangeStart: Date,
  rangeEnd: Date,
): Set<string> {
  const covered = new Set<string>()
  for (const item of items) {
    let d = new Date(Math.max(item.start.getTime(), rangeStart.getTime()))
    const end = new Date(Math.min(item.end.getTime(), rangeEnd.getTime()))
    while (toNum(d) <= toNum(end)) {
      covered.add(dateKey(d))
      d = addDays(d, 1)
    }
  }
  const open = new Set<string>()
  let d = new Date(rangeStart)
  while (toNum(d) <= toNum(rangeEnd)) {
    if (!isWeekend(d) && !covered.has(dateKey(d))) open.add(dateKey(d))
    d = addDays(d, 1)
  }
  return open
}

// ── Generate Monday-aligned weeks ──

export function generateWeeks(rangeStart: Date, rangeEnd: Date): Date[][] {
  let mon = startOfWeek(rangeStart, { weekStartsOn: 1 })
  const weeks: Date[][] = []
  while (toNum(mon) <= toNum(rangeEnd)) {
    const w: Date[] = []
    for (let i = 0; i < 7; i++) w.push(addDays(mon, i))
    weeks.push(w)
    mon = addDays(mon, 7)
  }
  return weeks
}

// ── Per-week: clip items, assign lanes, detect conflicts ──

export function processWeek(
  weekDays: Date[],
  allItems: CalendarItem[],
): { items: ClippedItem[]; laneCount: number; conflictColumns: Set<number> } {
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  const intersecting = allItems.filter(
    (item) =>
      toNum(item.start) <= toNum(weekEnd) &&
      toNum(item.end) >= toNum(weekStart),
  )

  const clipped: { item: CalendarItem; colStart: number; colEnd: number }[] = []
  for (const item of intersecting) {
    let cs = -1
    let ce = -1
    for (let i = 0; i < 7; i++) {
      if (
        toNum(weekDays[i]) >= toNum(item.start) &&
        toNum(weekDays[i]) <= toNum(item.end)
      ) {
        if (cs === -1) cs = i
        ce = i
      }
    }
    if (cs >= 0) clipped.push({ item, colStart: cs, colEnd: ce })
  }

  clipped.sort(
    (a, b) =>
      a.colStart - b.colStart ||
      b.colEnd - b.colStart - (a.colEnd - a.colStart),
  )

  const laneEnds: number[] = []
  const items: ClippedItem[] = clipped.map(({ item, colStart, colEnd }) => {
    let lane = laneEnds.findIndex((e) => e < colStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(-1)
    }
    laneEnds[lane] = colEnd
    return { item, colStart, colEnd, lane }
  })

  const conflictColumns = new Set<number>()
  for (let col = 0; col < 7; col++) {
    if (items.filter((i) => col >= i.colStart && col <= i.colEnd).length >= 2)
      conflictColumns.add(col)
  }

  return { items, laneCount: Math.max(laneEnds.length, 1), conflictColumns }
}

// ── Build all week rows with labels ──

export function buildWeekRows(
  weeks: Date[][],
  allItems: CalendarItem[],
): WeekRowData[] {
  let lastMonth = -1
  return weeks.map((days) => {
    const { items, laneCount, conflictColumns } = processWeek(days, allItems)
    const monday = days[0]
    const mid = days[2]
    const mNum = mid.getMonth()
    const isFirst = mNum !== lastMonth
    if (isFirst) lastMonth = mNum
    return {
      monday,
      days,
      items,
      laneCount,
      conflictColumns,
      monthLabel: isFirst ? format(mid, "MMMM") : null,
      weekLabel: isFirst ? format(mid, "yyyy") : format(monday, "MMM d"),
    }
  })
}

// ── Window pill placement (>= 3 business days, midpoint week) ──

export function computeWindowPills(
  windows: OpenWindow[],
  weeks: Date[][],
): WindowPill[] {
  return windows
    .filter((w) => w.businessDays >= 3)
    .map((w) => {
      const diffDays = Math.round(
        (w.end.getTime() - w.start.getTime()) / 86400000,
      )
      const mid = addDays(w.start, Math.floor(diffDays / 2))

      let wi = 0
      for (let i = 0; i < weeks.length; i++) {
        if (
          toNum(mid) >= toNum(weeks[i][0]) &&
          toNum(mid) <= toNum(weeks[i][6])
        ) {
          wi = i
          break
        }
      }

      let cs = 0
      let ce = 4
      let found = false
      for (let i = 0; i < 7; i++) {
        const d = weeks[wi][i]
        const inWin =
          toNum(d) >= toNum(w.start) &&
          toNum(d) <= toNum(w.end) &&
          !isWeekend(d)
        if (inWin && !found) {
          cs = i
          found = true
        }
        if (inWin) ce = i
      }

      return { window: w, weekIndex: wi, colStart: cs, colEnd: ce }
    })
}
