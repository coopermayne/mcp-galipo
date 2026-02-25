import type { ColumnDef } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import type { Intake } from "@/types/intake"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { StatusBadge } from "@/pages/intakes/components/status-badge"
import { analyzeIntake } from "@/services/intakes"

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
      cell: ({ row }) => {
        const count = options.unreadCounts[row.original.id]
        return (
          <span className="inline-flex items-center gap-1.5 font-medium">
            {row.getValue("name") || "—"}
            {count > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 min-w-[18px] text-center inline-block">
                {count}
              </span>
            )}
          </span>
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
