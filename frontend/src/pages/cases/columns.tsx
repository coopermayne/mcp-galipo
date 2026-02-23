import type { ColumnDef } from "@tanstack/react-table"
import type { CaseListItem } from "@/types/case"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"

interface UserInfo {
  id: number
  first_name: string
  last_name: string
  initials: string
}

export function getColumns(options: {
  usersMap: Map<number, UserInfo>
}): ColumnDef<CaseListItem>[] {
  return [
    {
      accessorKey: "case_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("case_name")}</span>
      ),
    },
    {
      id: "attorneys",
      header: "Attorney(s)",
      cell: ({ row }) => {
        const ids = row.original.attorney_ids ?? []
        if (ids.length === 0) return <span className="text-muted-foreground">—</span>
        const names = ids
          .map((id) => options.usersMap.get(id))
          .filter(Boolean)
          .map((u) => u!.initials)
        return <span>{names.join(", ") || "—"}</span>
      },
    },
    {
      accessorKey: "judge",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Judge" />
      ),
      cell: ({ row }) => row.getValue("judge") || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "case_number",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case No" />
      ),
      cell: ({ row }) =>
        row.getValue("case_number") || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "jurisdiction_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Jurisdiction" />
      ),
      cell: ({ row }) =>
        row.getValue("jurisdiction_name") || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
    },
  ]
}
