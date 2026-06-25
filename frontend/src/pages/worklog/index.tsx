import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { PenTool01Icon, ArrowLeft01Icon, ArrowRight01Icon, Add01Icon, Target01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { getWorklogDay, addWorklogEntry, formatHours } from "@/services/worklog"
import { WorklogEntryRow } from "@/pages/worklog/components/worklog-entry-row"
import { WorklogComposer } from "@/pages/worklog/components/worklog-composer"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { FeatureGate } from "@/components/common/feature-gate"
import { formatLA } from "@/lib/datetime"

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number)
  const date = new Date(y, m - 1, d + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// "Today" / "Yesterday" / "Tomorrow" relative to the current day, or null.
function relativeDayLabel(key: string): string | null {
  const today = todayKey()
  if (key === today) return "Today"
  if (key === shiftDay(today, -1)) return "Yesterday"
  if (key === shiftDay(today, 1)) return "Tomorrow"
  return null
}

export default function WorklogPage() {
  const queryClient = useQueryClient()
  const [dayKey, setDayKey] = useState<string>(todayKey)

  const { data: day, isLoading } = useQuery({
    queryKey: ["worklog-day", dayKey],
    queryFn: () => getWorklogDay(dayKey),
    // Keep refreshing while a consolidation is in flight for this day.
    refetchInterval: (q) => ((q.state.data?.processing_ids?.length ?? 0) > 0 ? 2500 : false),
  })

  const addEntry = useMutation({
    mutationFn: () => addWorklogEntry({ log_date: dayKey, hours: 0, description: "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worklog-day", dayKey] }),
    onError: (e) => toast.error(e.message),
  })

  const entries = day?.entries ?? []
  const isToday = dayKey === todayKey()
  const weekday = formatLA(`${dayKey}T00:00:00`, { weekday: "long" })
  const relative = relativeDayLabel(dayKey)

  return (
    <FeatureGate feature="log-my-day" redirectTo="/">
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2 mb-6">
        <HugeiconsIcon icon={PenTool01Icon} className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Log my day</h1>
      </div>

      {/* Day navigator */}
      <div className="flex items-start gap-2 mb-4">
        <Button variant="outline" size="icon-sm" onClick={() => setDayKey((k) => shiftDay(k, -1))} title="Previous day">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        </Button>
        <div className="w-44">
          <DatePicker value={dayKey} onChange={(d) => setDayKey(d ?? dayKey)} />
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            {weekday}
            {relative && relative !== "Today" && <span> · {relative}</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setDayKey((k) => shiftDay(k, 1))}
          title="Next day"
          disabled={isToday}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Button>
        {isToday ? (
          <span className="inline-flex h-8 items-center gap-1.5 border border-success/30 bg-success/10 px-2.5 text-xs font-medium text-success">
            <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
            Today
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setDayKey(todayKey())}
            title="Jump to today"
          >
            <HugeiconsIcon icon={Target01Icon} className="size-3.5" />
            Jump to today
          </Button>
        )}
        <span className="ml-auto mt-1.5 text-sm">
          <span className="text-muted-foreground">Total </span>
          <span className="font-semibold tabular-nums">{formatHours(day?.total_hours ?? 0)}</span>
        </span>
      </div>

      {/* Ledger */}
      <div className="space-y-2 mb-6">
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed">
            Nothing logged for {formatLA(`${dayKey}T00:00:00`, { weekday: "long", month: "long", day: "numeric" })} yet.
          </p>
        ) : (
          <div className="divide-y divide-border/50 border">
            {entries.map((e) => <WorklogEntryRow key={e.id} entry={e} dayKey={dayKey} />)}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => addEntry.mutate()}
          disabled={addEntry.isPending}
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          Add entry
        </Button>
      </div>

      {/* Composer */}
      <WorklogComposer dayKey={dayKey} processing={(day?.processing_ids?.length ?? 0) > 0} />
    </main>
    </FeatureGate>
  )
}
