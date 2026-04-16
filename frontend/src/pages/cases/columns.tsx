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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T00:00:00")
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function DateCell({ value, warnDays }: { value: string | null; warnDays?: number }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const days = daysUntil(value)
  const isUrgent = warnDays != null && days != null && days >= 0 && days <= warnDays
  const isPast = days != null && days < 0
  return (
    <span
      className={
        isPast
          ? "text-destructive font-medium"
          : isUrgent
            ? "text-warning-foreground font-medium"
            : ""
      }
    >
      {formatDate(value)}
    </span>
  )
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
      accessorKey: "date_of_injury",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="DOI" />
      ),
      cell: ({ row }) => <DateCell value={row.original.date_of_injury} />,
    },
    {
      accessorKey: "trial_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trial" />
      ),
      cell: ({ row }) => <DateCell value={row.original.trial_date} warnDays={90} />,
    },
    {
      accessorKey: "claim_deadline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Claim DL" />
      ),
      cell: ({ row }) => <DateCell value={row.original.claim_deadline} warnDays={30} />,
    },
    {
      accessorKey: "complaint_deadline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Complaint DL" />
      ),
      cell: ({ row }) => <DateCell value={row.original.complaint_deadline} warnDays={30} />,
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
