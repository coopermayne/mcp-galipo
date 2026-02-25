import type { ColumnDef, Row } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import type { Intake } from "@/types/intake"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { StatusBadge } from "@/pages/intakes/components/status-badge"
import { analyzeIntake } from "@/services/intakes"

const SEARCHABLE_FIELDS: { key: keyof Intake; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "referral_name", label: "Referring Attorney" },
  { key: "referral_org", label: "Referral Org" },
  { key: "referral_email", label: "Referral Email" },
  { key: "referral_phone", label: "Referral Phone" },
  { key: "location_short", label: "Location" },
  { key: "location", label: "Location" },
  { key: "case_type", label: "Case Type" },
  { key: "notes", label: "Notes" },
  { key: "incident_description", label: "Incident" },
  { key: "injury_description", label: "Injury" },
  { key: "ai_summary", label: "AI Summary" },
]

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
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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
        <DataTableColumnHeader column={column} title="AI Rating" />
      ),
      cell: ({ row }) => <AiRatingCell intake={row.original} />,
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
