import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { getDaleCalendar } from "@/services/dale"
import { getBadgeStyle } from "@/lib/badge-colors"

export default function DaleCalendarPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dale", "calendar"],
    queryFn: () => getDaleCalendar(6),
  })

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-2xl font-semibold">Trial calendar</h1>
      {isLoading && (
        <p className="text-base text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-base text-destructive">Couldn't load calendar.</p>
      )}
      {data && data.trials.length === 0 && (
        <p className="text-base text-muted-foreground">No upcoming trials.</p>
      )}

      <ul className="flex flex-col">
        {data?.trials.map((t) => (
          <li key={`${t.case_id}-${t.trial_date}`} className="border-b">
            <Link
              to={`/dale/cases/${t.case_id}`}
              className="flex min-h-16 items-center gap-3 py-4 active:bg-muted"
            >
              <span
                className="h-12 w-1.5 shrink-0"
                style={
                  getBadgeStyle(t.color) ?? {
                    backgroundColor: "var(--muted-foreground)",
                  }
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-medium">
                  {t.short_name || t.case_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatTrialDate(t.trial_date)}
                  {t.proposed ? " (proposed)" : ""}
                  {t.trial_estimated_days
                    ? ` · ${t.trial_estimated_days}d`
                    : ""}
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={22}
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatTrialDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
