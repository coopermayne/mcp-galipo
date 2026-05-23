import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { getDaleCases } from "@/services/dale"
import { getBadgeStyle } from "@/lib/badge-colors"

export default function DaleCasesListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dale", "cases"],
    queryFn: getDaleCases,
  })

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-2xl font-semibold">Cases</h1>
      {isLoading && (
        <p className="text-base text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-base text-destructive">Couldn't load cases.</p>
      )}
      {data && data.cases.length === 0 && (
        <p className="text-base text-muted-foreground">No open cases.</p>
      )}
      <ul className="flex flex-col">
        {data?.cases.map((c) => (
          <li key={c.id} className="border-b">
            <Link
              to={`/dale/cases/${c.id}`}
              className="flex min-h-16 items-center gap-3 py-4 active:bg-muted"
            >
              <span
                className="h-10 w-1.5 shrink-0"
                style={getBadgeStyle(c.color) ?? { backgroundColor: "var(--muted-foreground)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-medium">
                  {c.short_name || c.case_name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.status}
                  {c.trial_date && ` · Trial ${formatShortDate(c.trial_date)}`}
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

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
