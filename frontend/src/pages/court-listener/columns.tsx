import type { ColumnDef } from "@tanstack/react-table"
import type { WebhookLog } from "@/types/webhook"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, ViewIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** Extract a nested value from the CourtListener webhook payload. */
function extractPayload(webhook: WebhookLog) {
  const raw = webhook.payload as Record<string, unknown> | null
  if (!raw) return null

  // CourtListener webhook body: { payload: { results: [...] }, webhook: { ... } }
  // The DB `payload` column stores the full webhook body
  const inner = raw.payload as Record<string, unknown> | undefined
  const results = inner?.results as Record<string, unknown>[] | undefined
  if (!results?.length) return null

  const docket = results[0]
  const entries = docket.docket_entries as unknown[] | undefined

  return {
    caseName: (docket.case_name as string) ?? null,
    docketNumber: (docket.docket_number as string) ?? null,
    court: (docket.court as string) ?? null,
    docketId: (docket.docket_id as number) ?? (docket.id as number) ?? null,
    entryCount: entries?.length ?? 0,
  }
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  processing: "bg-info text-info-foreground",
  completed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

interface ColumnOptions {
  onViewPayload: (webhook: WebhookLog) => void
  onDelete: (webhook: WebhookLog) => void
}

export function getColumns({ onViewPayload, onDelete }: ColumnOptions): ColumnDef<WebhookLog>[] {
  return [
    {
      id: "case_name",
      accessorFn: (row) => extractPayload(row)?.caseName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case Name" />
      ),
      cell: ({ row }) => {
        const info = extractPayload(row.original)
        if (!info?.caseName) return <span className="text-muted-foreground">—</span>
        return <span className="font-medium">{info.caseName}</span>
      },
      filterFn: "includesString",
    },
    {
      id: "docket_number",
      accessorFn: (row) => extractPayload(row)?.docketNumber ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Docket #" />
      ),
      cell: ({ row }) => {
        const info = extractPayload(row.original)
        if (!info?.docketNumber) return <span className="text-muted-foreground">—</span>
        return <span className="font-mono text-xs">{info.docketNumber}</span>
      },
    },
    {
      id: "court",
      accessorFn: (row) => extractPayload(row)?.court ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Court" />
      ),
      cell: ({ row }) => {
        const info = extractPayload(row.original)
        if (!info?.court) return <span className="text-muted-foreground">—</span>
        return <span className="text-xs">{info.court}</span>
      },
    },
    {
      id: "entries",
      accessorFn: (row) => extractPayload(row)?.entryCount ?? 0,
      header: "Entries",
      cell: ({ row }) => {
        const info = extractPayload(row.original)
        const count = info?.entryCount ?? 0
        if (count === 0) return <span className="text-muted-foreground">—</span>
        return <span className="text-xs">{count}</span>
      },
    },
    {
      accessorKey: "processing_status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.processing_status
        return (
          <Badge className={cn("border-0 font-medium", statusStyles[status] ?? "bg-muted text-muted-foreground")}>
            {status}
          </Badge>
        )
      },
      filterFn: (row, id, value: string[]) => {
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Received" />
      ),
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewPayload(row.original)}>
              <HugeiconsIcon icon={ViewIcon} className="mr-2 size-4" />
              View Payload
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original)}
            >
              <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
