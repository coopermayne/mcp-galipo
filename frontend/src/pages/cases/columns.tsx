import type { ColumnDef } from "@tanstack/react-table"
import type { CaseListItem } from "@/types/case"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { getAvatarStyleById } from "@/lib/badge-colors"

interface UserInfo {
  id: number
  first_name: string
  last_name: string
  initials: string
}

export function getColumns(options: {
  usersMap: Map<number, UserInfo>
  isMobile?: boolean
}): ColumnDef<CaseListItem>[] {
  return [
    {
      accessorKey: "case_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case Name" />
      ),
      cell: ({ row }) => {
        const name = options.isMobile && row.original.short_name
          ? row.original.short_name
          : row.getValue<string>("case_name")
        return <span className="font-medium">{name}</span>
      },
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const { case_number, jurisdiction_name, judge } = row.original
        if (!case_number && !jurisdiction_name && !judge) {
          return <span className="text-muted-foreground">—</span>
        }
        const parts: string[] = []
        if (jurisdiction_name) parts.push(jurisdiction_name)
        if (judge) parts.push(`Judge ${judge}`)
        return (
          <div className="flex items-center gap-1.5 text-xs">
            {case_number && (
              <span className="font-mono">{case_number}</span>
            )}
            {parts.length > 0 && (
              <span className="text-muted-foreground">({parts.join(", ")})</span>
            )}
          </div>
        )
      },
    },
    {
      id: "attorneys",
      header: "Team",
      cell: ({ row }) => {
        const ids = row.original.attorney_ids ?? []
        if (ids.length === 0) return <span className="text-muted-foreground">—</span>
        const users = ids
          .map((id) => options.usersMap.get(id))
          .filter(Boolean) as UserInfo[]
        return (
          <div className="flex gap-1">
            {users.map((u) => (
              <span
                key={u.id}
                className="inline-flex size-5 items-center justify-center text-[9px] font-medium shrink-0"
                style={getAvatarStyleById(u.id)}
                title={`${u.first_name} ${u.last_name}`}
              >
                {u.initials}
              </span>
            ))}
          </div>
        )
      },
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
