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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function getColumns(options: {
  onView: (intake: Intake) => void
  onDelete: (intake: Intake) => void
}): ColumnDef<Intake>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name") || "—"}</span>
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
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "submitted_on",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Submitted" />
      ),
      cell: ({ row }) => formatDate(row.getValue("submitted_on")),
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
