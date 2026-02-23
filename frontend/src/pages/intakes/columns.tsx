import type { ColumnDef } from "@tanstack/react-table"
import type { Intake } from "@/types/intake"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { StatusBadge } from "@/pages/intakes/components/status-badge"

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
      <span className="rounded bg-red-100 px-1 text-red-600">{days}</span>
    )
  }
  if (days <= 30) {
    return (
      <span className="rounded bg-yellow-100 px-1 text-yellow-700">{days}</span>
    )
  }
  return <span>{days}</span>
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
      cell: ({ row }) => {
        if (row.original.ai_analyzing) {
          return (
            <span className="text-muted-foreground animate-pulse text-xs">
              Analyzing...
            </span>
          )
        }
        const rating = row.getValue("ai_rating") as number | null
        return rating != null ? `${rating}/5` : "—"
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
