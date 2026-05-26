import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { EyeIcon } from "@hugeicons/core-free-icons"
import type { CaseListItem } from "@/types/case"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { StatusSelectCell } from "@/pages/cases/components/status-select-cell"
import { TrialEditCell } from "@/components/common/trial-edit-popover"
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
      id: "attorneys",
      accessorFn: (row) => row.attorney_ids ?? [],
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
      filterFn: (row, id, value: string[]) => {
        const ids = (row.getValue(id) as number[]) ?? []
        if (!value?.length) return true
        return ids.some((aid) => value.includes(String(aid)))
      },
    },
    {
      accessorKey: "case_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case Name" />
      ),
      cell: ({ row }) => {
        const name = options.isMobile && row.original.short_name
          ? row.original.short_name
          : row.getValue<string>("case_name")
        if (options.isMobile) {
          const ids = row.original.attorney_ids ?? []
          const users = ids
            .map((id) => options.usersMap.get(id))
            .filter(Boolean) as UserInfo[]
          return (
            <div className="flex items-center gap-2">
              {users.length > 0 && (
                <div className="flex gap-1 shrink-0">
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
              )}
              <span className="font-medium">{name}</span>
            </div>
          )
        }
        return <span className="font-medium">{name}</span>
      },
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const { case_number, jurisdiction_name } = row.original
        if (!case_number && !jurisdiction_name) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <div className="flex items-center gap-1.5 text-xs">
            {case_number && (
              <span className="font-mono">{case_number}</span>
            )}
            {jurisdiction_name && (
              <span className="text-muted-foreground">({jurisdiction_name})</span>
            )}
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
      cell: ({ row }) => {
        const { trial_date, trial_likelihood, trial_likelihood_note, trial_estimated_days, id } = row.original
        return (
          <TrialEditCell
            caseId={id}
            trialDate={trial_date}
            likelihood={trial_likelihood}
            likelihoodNote={trial_likelihood_note}
            estimatedDays={trial_estimated_days}
          />
        )
      },
    },
    {
      accessorKey: "claim_deadline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Claim DL" />
      ),
      cell: ({ row }) => {
        const done = row.original.status === "Pre-Filing" && row.original.claim_deadline
        if (done) {
          return (
            <span className="flex items-center gap-1">
              <span className="text-success-foreground">✓</span>
              <span className="text-muted-foreground line-through">{formatDate(row.original.claim_deadline)}</span>
            </span>
          )
        }
        return <DateCell value={row.original.claim_deadline} warnDays={30} />
      },
    },
    {
      accessorKey: "complaint_deadline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Complaint DL" />
      ),
      cell: ({ row }) => <DateCell value={row.original.complaint_deadline} warnDays={30} />,
    },
    {
      id: "effective_deadline",
      accessorFn: (row) =>
        row.status === "Pre-Claim" ? row.claim_deadline : row.complaint_deadline,
      header: () => null,
      cell: () => null,
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusSelectCell caseId={row.original.id} status={row.original.status} />,
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      id: "preview",
      header: "",
      size: 40,
      cell: ({ row, table }) => {
        const onPreview = (table.options.meta as { onPreview?: (id: number) => void })?.onPreview
        return (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100 transition-opacity p-1"
            onClick={(e) => {
              e.stopPropagation()
              onPreview?.(row.original.id)
            }}
            title="Quick view"
          >
            <HugeiconsIcon icon={EyeIcon} className="size-4" />
          </button>
        )
      },
    },
  ]
}
