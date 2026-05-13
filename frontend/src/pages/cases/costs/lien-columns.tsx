import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  MoreHorizontalIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import type { Lien } from "@/services/liens"
import { openLienFile, deleteLien } from "@/services/liens"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatCurrency(amount: string | number): string {
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  negotiated: "bg-info/15 text-info",
  paid: "bg-success/15 text-success",
}

export function getLienColumns(options: {
  onEdit?: (lien: Lien) => void
}): ColumnDef<Lien>[] {
  return [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "payee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Lien Holder" />
      ),
      cell: ({ row }) => (
        <span className="font-medium truncate max-w-[200px] block">
          {row.getValue("payee_name") ?? "No lien holder"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const desc = row.getValue("description") as string | null
        if (!desc) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {desc}
          </span>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: "claimed_amount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Claimed" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-warning">
          {formatCurrency(row.original.claimed_amount)}
        </span>
      ),
      sortingFn: (a, b) =>
        Number(a.original.claimed_amount) - Number(b.original.claimed_amount),
    },
    {
      accessorKey: "negotiated_amount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Negotiated" />
      ),
      cell: ({ row }) => {
        const neg = row.original.negotiated_amount
        if (!neg) return <span className="text-muted-foreground">—</span>
        return (
          <span className="tabular-nums font-semibold text-success">
            {formatCurrency(neg)}
          </span>
        )
      },
      sortingFn: (a, b) =>
        Number(a.original.negotiated_amount ?? 0) -
        Number(b.original.negotiated_amount ?? 0),
    },
    {
      id: "savings",
      header: "Savings",
      cell: ({ row }) => {
        const claimed = Number(row.original.claimed_amount)
        const neg = row.original.negotiated_amount
          ? Number(row.original.negotiated_amount)
          : null
        if (neg == null || claimed === 0)
          return <span className="text-muted-foreground">—</span>
        const savings = claimed - neg
        const pct = ((savings / claimed) * 100).toFixed(0)
        return (
          <span className="tabular-nums text-sm text-success">
            {formatCurrency(savings)} ({pct}%)
          </span>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <span
            className={`text-xs px-1.5 py-0.5 capitalize ${STATUS_STYLES[status] ?? ""}`}
          >
            {status}
          </span>
        )
      },
    },
    {
      id: "file",
      header: "",
      cell: ({ row }) =>
        row.original.file_path ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openLienFile(row.original.id)
            }}
            title="View file"
          >
            <HugeiconsIcon
              icon={Attachment01Icon}
              className="size-3.5 text-muted-foreground hover:text-foreground"
            />
          </button>
        ) : null,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <LienActions lien={row.original} onEdit={options.onEdit} />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

function LienActions({
  lien,
  onEdit,
}: {
  lien: Lien
  onEdit?: (lien: Lien) => void
}) {
  const queryClient = useQueryClient()

  async function handleDelete() {
    if (!confirm("Delete this lien?")) return
    try {
      await deleteLien(lien.id)
      queryClient.invalidateQueries({ queryKey: ["liens"] })
      queryClient.invalidateQueries({ queryKey: ["lien-stats"] })
      toast.success("Lien deleted")
    } catch {
      toast.error("Failed to delete lien")
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) => e.stopPropagation()}
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(lien)}>
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onClick={handleDelete}
          >
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
