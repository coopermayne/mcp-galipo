import type { TaskListItem } from "@/types/task"
import { todayInLA } from "@/lib/datetime"

export type TaskGroupBy = "date" | "case"

export interface TaskGroup {
  key: string
  label: string
  tasks: TaskListItem[]
  sortOrder: number
  caseColor?: string | null
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function endOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // End of week = Sunday (day 0 means we're already at Sunday, otherwise go to next Sunday)
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + daysUntilSunday)
  return d
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function groupTasksByDate(tasks: TaskListItem[]): TaskGroup[] {
  const today = todayInLA()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfterTomorrow = new Date(tomorrow)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)
  const thisWeekEnd = endOfWeek(today)
  const nextWeekEnd = new Date(thisWeekEnd)
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

  const buckets: Record<string, TaskListItem[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    next_week: [],
    later: [],
    no_date: [],
  }

  const dayBuckets = new Map<string, { label: string; tasks: TaskListItem[]; sortOrder: number }>()

  for (const task of tasks) {
    if (!task.due_date) {
      buckets.no_date.push(task)
      continue
    }
    const d = parseLocalDate(task.due_date)
    if (d < today) {
      buckets.overdue.push(task)
    } else if (d.getTime() === today.getTime()) {
      buckets.today.push(task)
    } else if (d.getTime() === tomorrow.getTime()) {
      buckets.tomorrow.push(task)
    } else if (d >= dayAfterTomorrow && d <= thisWeekEnd) {
      const dayKey = `day_${task.due_date}`
      if (!dayBuckets.has(dayKey)) {
        dayBuckets.set(dayKey, {
          label: DAY_NAMES[d.getDay()],
          tasks: [],
          sortOrder: d.getTime(),
        })
      }
      dayBuckets.get(dayKey)!.tasks.push(task)
    } else if (d <= nextWeekEnd) {
      buckets.next_week.push(task)
    } else {
      buckets.later.push(task)
    }
  }

  const urgencyRank: Record<string, number> = {
    Urgent: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  }
  const rankUrgency = (u: string | null) =>
    u && urgencyRank[u] !== undefined ? urgencyRank[u] : 99

  const sortByDateThenUrgency = (a: TaskListItem, b: TaskListItem) => {
    if (!a.due_date && !b.due_date) return rankUrgency(a.urgency) - rankUrgency(b.urgency)
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    const dateCmp = a.due_date.localeCompare(b.due_date)
    if (dateCmp !== 0) return dateCmp
    return rankUrgency(a.urgency) - rankUrgency(b.urgency)
  }
  for (const key of Object.keys(buckets)) {
    buckets[key].sort(sortByDateThenUrgency)
  }
  for (const bucket of dayBuckets.values()) {
    bucket.tasks.sort(sortByDateThenUrgency)
  }

  const groups: TaskGroup[] = []
  let order = 0

  if (buckets.overdue.length > 0) {
    groups.push({ key: "overdue", label: "Overdue", tasks: buckets.overdue, sortOrder: order++ })
  }
  if (buckets.today.length > 0) {
    groups.push({ key: "today", label: "Today", tasks: buckets.today, sortOrder: order++ })
  }
  if (buckets.tomorrow.length > 0) {
    groups.push({ key: "tomorrow", label: "Tomorrow", tasks: buckets.tomorrow, sortOrder: order++ })
  }

  const sortedDayBuckets = Array.from(dayBuckets.entries()).sort(
    (a, b) => a[1].sortOrder - b[1].sortOrder
  )
  for (const [key, bucket] of sortedDayBuckets) {
    groups.push({ key, label: bucket.label, tasks: bucket.tasks, sortOrder: order++ })
  }

  if (buckets.next_week.length > 0) {
    groups.push({ key: "next_week", label: "Next Week", tasks: buckets.next_week, sortOrder: order++ })
  }
  if (buckets.later.length > 0) {
    groups.push({ key: "later", label: "Later", tasks: buckets.later, sortOrder: order++ })
  }
  if (buckets.no_date.length > 0) {
    groups.push({ key: "no_date", label: "No Date", tasks: buckets.no_date, sortOrder: order++ })
  }

  return groups
}

export function groupTasksByCase(tasks: TaskListItem[]): TaskGroup[] {
  const caseMap = new Map<string, { label: string; tasks: TaskListItem[]; caseColor: string | null }>()
  const noCaseTasks: TaskListItem[] = []

  for (const task of tasks) {
    if (!task.case_id || !task.short_name) {
      noCaseTasks.push(task)
      continue
    }
    const key = String(task.case_id)
    if (!caseMap.has(key)) {
      caseMap.set(key, { label: task.short_name, tasks: [], caseColor: task.case_color ?? null })
    }
    caseMap.get(key)!.tasks.push(task)
  }

  // Sort case groups alphabetically by label
  const sorted = Array.from(caseMap.entries()).sort((a, b) =>
    a[1].label.localeCompare(b[1].label)
  )

  const groups: TaskGroup[] = sorted.map(([key, val], idx) => ({
    key: `case-${key}`,
    label: val.label,
    tasks: val.tasks,
    sortOrder: idx,
    caseColor: val.caseColor,
  }))

  if (noCaseTasks.length > 0) {
    groups.push({
      key: "no-case",
      label: "No Case",
      tasks: noCaseTasks,
      sortOrder: groups.length,
    })
  }

  return groups
}

/** Sort by completion_date descending (most recently completed first) */
const sortByCompletionDesc = (a: TaskListItem, b: TaskListItem) => {
  if (!a.completion_date) return 1
  if (!b.completion_date) return -1
  return b.completion_date.localeCompare(a.completion_date)
}

export function groupDoneTasksByDate(tasks: TaskListItem[]): TaskGroup[] {
  const today = todayInLA()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Start of this week (Monday)
  const thisWeekStart = new Date(today)
  const dayOfWeek = thisWeekStart.getDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceMonday)

  // Start of last week
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const buckets: Record<string, TaskListItem[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    last_week: [],
    earlier: [],
  }

  for (const task of tasks) {
    if (!task.completion_date) {
      buckets.earlier.push(task)
      continue
    }
    const d = parseLocalDate(task.completion_date)
    if (d.getTime() >= today.getTime()) {
      buckets.today.push(task)
    } else if (d.getTime() >= yesterday.getTime()) {
      buckets.yesterday.push(task)
    } else if (d >= thisWeekStart) {
      buckets.this_week.push(task)
    } else if (d >= lastWeekStart) {
      buckets.last_week.push(task)
    } else {
      buckets.earlier.push(task)
    }
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort(sortByCompletionDesc)
  }

  const config: { key: string; label: string; sortOrder: number }[] = [
    { key: "today", label: "Today", sortOrder: 0 },
    { key: "yesterday", label: "Yesterday", sortOrder: 1 },
    { key: "this_week", label: "This Week", sortOrder: 2 },
    { key: "last_week", label: "Last Week", sortOrder: 3 },
    { key: "earlier", label: "Earlier", sortOrder: 4 },
  ]

  return config
    .filter((c) => buckets[c.key].length > 0)
    .map((c) => ({
      key: c.key,
      label: c.label,
      tasks: buckets[c.key],
      sortOrder: c.sortOrder,
    }))
}

export function groupDoneTasksByCase(tasks: TaskListItem[]): TaskGroup[] {
  const groups = groupTasksByCase(tasks)
  for (const group of groups) {
    group.tasks.sort(sortByCompletionDesc)
  }
  return groups
}

export function groupTasks(
  tasks: TaskListItem[],
  groupBy: TaskGroupBy,
  showDone?: boolean,
): TaskGroup[] {
  if (showDone) {
    return groupBy === "date"
      ? groupDoneTasksByDate(tasks)
      : groupDoneTasksByCase(tasks)
  }
  return groupBy === "date"
    ? groupTasksByDate(tasks)
    : groupTasksByCase(tasks)
}
