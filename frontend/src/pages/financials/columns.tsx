import type { ColumnDef } from "@tanstack/react-table"
import type { FinancialListItem } from "@/types/financial"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { getAvatarStyleById } from "@/lib/badge-colors"

interface UserInfo {
  id: number
  first_name: string
  last_name: string
  initials: string
}

const RESOLUTION_LABELS: Record<string, string> = {
  settlement: "Settlement",
  verdict: "Verdict",
  judgment: "Judgment",
  arbitration_award: "Arbitration",
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function getColumns(options: {
  usersMap: Map<number, UserInfo>
  isMobile?: boolean
}): ColumnDef<FinancialListItem>[] {
  return [
    {
      accessorKey: "case_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case" />
      ),
      cell: ({ row }) => {
        const name = options.isMobile && row.original.short_name
          ? row.original.short_name
          : row.getValue<string>("case_name")
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{name}</span>
            {row.original.resolution_type && (
              <span className="text-muted-foreground text-[11px]">
                {RESOLUTION_LABELS[row.original.resolution_type] ?? row.original.resolution_type}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "gross_recovery",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gross Recovery" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCurrency(row.original.gross_recovery)}
        </span>
      ),
    },
    {
      id: "our_fee",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Our Fee" />
      ),
      accessorFn: (row) => row.our_fee,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCurrency(row.original.our_fee)}
        </span>
      ),
    },
    {
      id: "finalized",
      header: "Status",
      cell: ({ row }) => (
        row.original.is_finalized
          ? <span className="text-success text-xs font-medium">Final</span>
          : <span className="text-muted-foreground text-xs">Pending</span>
      ),
    },
    {
      id: "attorneys",
      header: "Attorney",
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
      accessorKey: "resolution_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => {
        const date = row.original.resolution_date
        if (!date) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-xs tabular-nums">
            {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )
      },
    },
  ]
}
