import type { EventListItem } from "@/types/event"

export type EventGroupBy = "date" | "case"

export interface EventGroup {
  key: string
  label: string
  events: EventListItem[]
  sortOrder: number
  caseColor?: string | null
}

function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function endOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + daysUntilSunday)
  return d
}

const sortByDateAsc = (a: EventListItem, b: EventListItem) =>
  a.date.localeCompare(b.date)

const sortByDateDesc = (a: EventListItem, b: EventListItem) =>
  b.date.localeCompare(a.date)

export function groupEventsByDate(events: EventListItem[]): EventGroup[] {
  const today = todayMidnight()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const thisWeekEnd = endOfWeek(today)
  const nextWeekEnd = new Date(thisWeekEnd)
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

  const buckets: Record<string, EventListItem[]> = {
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    later: [],
  }

  for (const event of events) {
    const d = parseLocalDate(event.date)
    if (d.getTime() === today.getTime()) {
      buckets.today.push(event)
    } else if (d.getTime() === tomorrow.getTime()) {
      buckets.tomorrow.push(event)
    } else if (d <= thisWeekEnd) {
      buckets.this_week.push(event)
    } else if (d <= nextWeekEnd) {
      buckets.next_week.push(event)
    } else {
      buckets.later.push(event)
    }
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort(sortByDateAsc)
  }

  const config: { key: string; label: string; sortOrder: number }[] = [
    { key: "today", label: "Today", sortOrder: 0 },
    { key: "tomorrow", label: "Tomorrow", sortOrder: 1 },
    { key: "this_week", label: "This Week", sortOrder: 2 },
    { key: "next_week", label: "Next Week", sortOrder: 3 },
    { key: "later", label: "Later", sortOrder: 4 },
  ]

  return config
    .filter((c) => buckets[c.key].length > 0)
    .map((c) => ({
      key: c.key,
      label: c.label,
      events: buckets[c.key],
      sortOrder: c.sortOrder,
    }))
}

export function groupEventsByCase(events: EventListItem[]): EventGroup[] {
  const caseMap = new Map<string, { label: string; events: EventListItem[]; caseColor: string | null }>()
  const noCaseEvents: EventListItem[] = []

  for (const event of events) {
    if (!event.case_id || !event.short_name) {
      noCaseEvents.push(event)
      continue
    }
    const key = String(event.case_id)
    if (!caseMap.has(key)) {
      caseMap.set(key, { label: event.short_name, events: [], caseColor: event.case_color ?? null })
    }
    caseMap.get(key)!.events.push(event)
  }

  const sorted = Array.from(caseMap.entries()).sort((a, b) =>
    a[1].label.localeCompare(b[1].label)
  )

  const groups: EventGroup[] = sorted.map(([key, val], idx) => ({
    key: `case-${key}`,
    label: val.label,
    events: val.events,
    sortOrder: idx,
    caseColor: val.caseColor,
  }))

  if (noCaseEvents.length > 0) {
    groups.push({
      key: "no-case",
      label: "No Case",
      events: noCaseEvents,
      sortOrder: groups.length,
    })
  }

  return groups
}

export function groupPastEventsByDate(events: EventListItem[]): EventGroup[] {
  const today = todayMidnight()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const thisWeekStart = new Date(today)
  const dayOfWeek = thisWeekStart.getDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceMonday)

  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const buckets: Record<string, EventListItem[]> = {
    yesterday: [],
    this_week: [],
    last_week: [],
    earlier: [],
  }

  for (const event of events) {
    const d = parseLocalDate(event.date)
    if (d.getTime() >= yesterday.getTime() && d < today) {
      buckets.yesterday.push(event)
    } else if (d >= thisWeekStart) {
      buckets.this_week.push(event)
    } else if (d >= lastWeekStart) {
      buckets.last_week.push(event)
    } else {
      buckets.earlier.push(event)
    }
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort(sortByDateDesc)
  }

  const config: { key: string; label: string; sortOrder: number }[] = [
    { key: "yesterday", label: "Yesterday", sortOrder: 0 },
    { key: "this_week", label: "This Week", sortOrder: 1 },
    { key: "last_week", label: "Last Week", sortOrder: 2 },
    { key: "earlier", label: "Earlier", sortOrder: 3 },
  ]

  return config
    .filter((c) => buckets[c.key].length > 0)
    .map((c) => ({
      key: c.key,
      label: c.label,
      events: buckets[c.key],
      sortOrder: c.sortOrder,
    }))
}

export function groupPastEventsByCase(events: EventListItem[]): EventGroup[] {
  const groups = groupEventsByCase(events)
  for (const group of groups) {
    group.events.sort(sortByDateDesc)
  }
  return groups
}

export function groupEvents(
  events: EventListItem[],
  groupBy: EventGroupBy,
  showPast?: boolean,
): EventGroup[] {
  if (showPast) {
    return groupBy === "date"
      ? groupPastEventsByDate(events)
      : groupPastEventsByCase(events)
  }
  return groupBy === "date"
    ? groupEventsByDate(events)
    : groupEventsByCase(events)
}
