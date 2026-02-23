import { Link } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"
import type { Intake } from "@/types/intake"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalCircle01Icon, ViewIcon, Delete01Icon } from "@hugeicons/core-free-icons"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  onView: (intake: Intake) => void
  onDelete: (intake: Intake) => void
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
      cell: ({ row }) => (
        <Link
          to={`/intakes/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("name") || "—"}
        </Link>
      ),
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
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <HugeiconsIcon icon={MoreHorizontalCircle01Icon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => options.onView(row.original)}>
              <HugeiconsIcon icon={ViewIcon} className="mr-2 size-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => options.onDelete(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
