import type { ColumnDef, Row } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import type { Intake } from "@/types/intake"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { StatusBadge } from "@/pages/intakes/components/status-badge"
import { analyzeIntake } from "@/services/intakes"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

const SEARCHABLE_FIELDS: { key: keyof Intake; label: string; weight: number }[] = [
  { key: "name", label: "Name", weight: 100 },
  { key: "email", label: "Email", weight: 90 },
  { key: "phone", label: "Phone", weight: 70 },
  { key: "referral_name", label: "Referring Attorney", weight: 50 },
  { key: "referral_org", label: "Referral Org", weight: 40 },
  { key: "referral_email", label: "Referral Email", weight: 40 },
  { key: "referral_phone", label: "Referral Phone", weight: 40 },
  { key: "location_short", label: "Location", weight: 30 },
  { key: "location", label: "Location", weight: 30 },
  { key: "case_type", label: "Case Type", weight: 30 },
  { key: "notes", label: "Notes", weight: 10 },
  { key: "incident_description", label: "Incident", weight: 10 },
  { key: "injury_description", label: "Injury", weight: 10 },
  { key: "ai_summary", label: "AI Summary", weight: 10 },
]

export function getSearchRank(intake: Intake, search: string): number {
  if (!search) return 0
  const s = search.toLowerCase()
  let best = 0
  for (const { key, weight } of SEARCHABLE_FIELDS) {
    const val = intake[key]
    if (typeof val === "string") {
      const lower = val.toLowerCase()
      if (lower.includes(s)) {
        const bonus = lower.startsWith(s) ? 10 : 0
        best = Math.max(best, weight + bonus)
      }
    }
  }
  return best
}

export function intakeGlobalFilterFn(
  row: Row<Intake>,
  _columnId: string,
  filterValue: string
): boolean {
  if (!filterValue) return true
  const search = filterValue.toLowerCase()
  return SEARCHABLE_FIELDS.some(({ key }) => {
    const val = row.original[key]
    return typeof val === "string" && val.toLowerCase().includes(search)
  })
}

function getMatchReason(
  intake: Intake,
  search: string
): { label: string; value: string } | null {
  if (!search) return null
  const s = search.toLowerCase()
  if (intake.name?.toLowerCase().includes(s)) return null

  for (const { key, label } of SEARCHABLE_FIELDS) {
    if (key === "name") continue
    const val = intake[key]
    if (typeof val === "string" && val.toLowerCase().includes(s)) {
      const display = val.length > 50 ? val.slice(0, 50) + "…" : val
      return { label, value: display }
    }
  }
  return null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  const base = d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `(${dow}) ${base}`
}

/** Parse a date-only string (YYYY-MM-DD) as local midnight, not UTC. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDoi(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function daysUntil(doi: string, months: number): number {
  const d = parseLocalDate(doi)
  const deadline = new Date(d)
  deadline.setMonth(deadline.getMonth() + months)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function SolDays({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="bg-destructive/15 px-1 text-destructive">{days}</span>
    )
  }
  if (days <= 30) {
    return (
      <span className="bg-warning/15 px-1 text-warning-foreground">{days}</span>
    )
  }
  return <span>{days}</span>
}

function AiRatingCell({ intake }: { intake: Intake }) {
  const queryClient = useQueryClient()
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeIntake(intake.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      toast.success("AI analysis started")
    },
    onError: () => toast.error("Failed to start analysis"),
  })

  if (intake.ai_analyzing || analyzeMutation.isPending) {
    return (
      <span className="text-muted-foreground animate-pulse text-xs">
        Analyzing...
      </span>
    )
  }

  if (intake.ai_rating != null) {
    return <span>{intake.ai_rating}/5</span>
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        analyzeMutation.mutate()
      }}
      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      title="Run AI analysis"
    >
      <HugeiconsIcon icon={SparklesIcon} className="size-4" />
    </button>
  )
}

export function getColumns(options: {
  unreadCounts: Record<number, number>
}): ColumnDef<Intake>[] {
  return [
    {
      accessorKey: "submitted_on",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Submitted" />
      ),
      cell: ({ row }) => formatDate(row.getValue("submitted_on")),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row, table }) => {
        const count = options.unreadCounts[row.original.id]
        const globalFilter = table.getState().globalFilter as string
        const match = getMatchReason(row.original, globalFilter)
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 font-medium">
              {row.getValue("name") || "—"}
              {count > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 min-w-[18px] text-center inline-block">
                  {count}
                </span>
              )}
            </span>
            {match && (
              <span className="text-muted-foreground text-xs truncate max-w-[300px]">
                ↳ {match.label}: &ldquo;{match.value}&rdquo;
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: "dupes",
      header: "Dupes",
      cell: ({ row }) => {
        const total = row.original.email_submission_count
        if (!total || total <= 1) return null
        const dupes = total - 1
        const others = row.original.email_submissions
        return (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <span className="bg-warning text-warning-foreground px-1.5 py-0.5 text-xs font-medium cursor-default tabular-nums">
                {dupes}
              </span>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-64">
              <p className="text-xs font-medium mb-1.5">
                {dupes} duplicate{dupes > 1 ? "s" : ""} from this email
              </p>
              <div className="flex flex-col gap-1">
                {others.map((s) => (
                  <a
                    key={s.id}
                    href={`/intakes/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs hover:underline text-primary truncate"
                  >
                    {s.name || "Unnamed"} — {s.status}
                    {s.submitted_on
                      ? ` (${new Date(s.submitted_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                      : ""}
                  </a>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )
      },
    },
    {
      accessorKey: "case_type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case Type" />
      ),
      cell: ({ row }) => row.getValue("case_type") || "—",
    },
    {
      accessorKey: "incident_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="DOI" />
      ),
      cell: ({ row }) => formatDoi(row.getValue("incident_date")),
    },
    {
      id: "sol",
      header: "6MO/2YR",
      cell: ({ row }) => {
        const doi = row.original.incident_date
        if (!doi) return "—"
        const sixMo = daysUntil(doi, 6)
        const twoYr = daysUntil(doi, 24)
        return (
          <span className="tabular-nums">
            <SolDays days={sixMo} /> / <SolDays days={twoYr} />
          </span>
        )
      },
    },
    {
      accessorKey: "ai_rating",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case" />
      ),
      cell: ({ row }) => <AiRatingCell intake={row.original} />,
    },
    {
      accessorKey: "ai_injury_rating",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Injury" />
      ),
      cell: ({ row }) => {
        const rating = row.original.ai_injury_rating
        if (rating == null) return <span className="text-muted-foreground">—</span>
        return <span>{rating}/5</span>
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}
