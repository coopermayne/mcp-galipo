import type { ColumnDef } from "@tanstack/react-table"
import type { EventListItem } from "@/types/event"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, Location01Icon } from "@hugeicons/core-free-icons"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { getBadgeStyle } from "@/lib/badge-colors"
import { Badge } from "@/components/ui/badge"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const base = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${base} (${dow})`
}

export function getColumns(): ColumnDef<EventListItem>[] {
  return [
    {
      accessorKey: "starred",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="" />
      ),
      cell: ({ row }) => {
        const starred = row.getValue("starred") as boolean | null
        return (
          <HugeiconsIcon
            icon={StarIcon}
            className={`size-3.5 ${starred ? "text-warning fill-warning" : "text-transparent"}`}
          />
        )
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[500px] truncate block">
          {row.getValue("description")}
        </span>
      ),
      filterFn: (row, _id, value: string) => {
        const q = value.toLowerCase()
        const desc = (row.getValue("description") as string).toLowerCase()
        const caseName = (row.original.short_name ?? row.original.case_name ?? "").toLowerCase()
        return desc.includes(q) || caseName.includes(q)
      },
    },
    {
      id: "case",
      accessorFn: (row) => row.short_name ?? row.case_name,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case" />
      ),
      cell: ({ row }) => {
        const event = row.original
        if (!event.short_name) return <span className="text-muted-foreground">&mdash;</span>
        return (
          <Badge
            className="whitespace-nowrap"
            style={getBadgeStyle(event.case_color)}
          >
            {event.short_name}
          </Badge>
        )
      },
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => {
        const dateStr = row.getValue("date") as string
        return <span>{formatDate(dateStr)}</span>
      },
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => {
        const location = row.getValue("location") as string | null
        if (!location) return <span className="text-muted-foreground">&mdash;</span>
        return (
          <span className="flex items-center gap-1 truncate">
            <HugeiconsIcon icon={Location01Icon} className="size-3 text-muted-foreground shrink-0" />
            {location}
          </span>
        )
      },
    },
  ]
}
