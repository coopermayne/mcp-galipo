import { useState } from "react"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  Tick02Icon,
  UndoIcon,
  Delete02Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import type { Invoice } from "@/services/invoices"
import {
  getInvoiceFileUrl,
  markInvoiceUnpaid,
  deleteInvoice,
} from "@/services/invoices"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatCurrency(amount: string): string {
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const SEARCHABLE_FIELDS: { key: keyof Invoice; weight: number }[] = [
  { key: "vendor", weight: 100 },
  { key: "case_name", weight: 90 },
  { key: "description", weight: 50 },
  { key: "category", weight: 40 },
  { key: "check_number", weight: 30 },
  { key: "notes", weight: 10 },
]

export function getSearchRank(invoice: Invoice, search: string): number {
  if (!search) return 0
  const s = search.toLowerCase()
  let best = 0
  for (const { key, weight } of SEARCHABLE_FIELDS) {
    const val = invoice[key]
    if (typeof val === "string") {
      const lower = val.toLowerCase()
      if (lower.includes(s)) {
        const bonus = lower.startsWith(s) ? 10 : 0
        best = Math.max(best, weight + bonus)
      }
    }
  }
  return best
}

export function invoiceGlobalFilterFn(
  row: Row<Invoice>,
  _columnId: string,
  filterValue: string
): boolean {
  if (!filterValue) return true
  const search = filterValue.toLowerCase()
  return SEARCHABLE_FIELDS.some(({ key }) => {
    const val = row.original[key]
    return typeof val === "string" && val.toLowerCase().includes(search)
  })
}

export function getColumns(options: {
  showCase: boolean
  onMarkPaid?: (invoice: Invoice) => void
  onMarkUnpaid?: (invoice: Invoice) => void
}): ColumnDef<Invoice>[] {
  const cols: ColumnDef<Invoice>[] = []

  if (options.showCase) {
    cols.push({
      accessorKey: "case_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case" />
      ),
      cell: ({ row }) => (
        <a
          href={`/cases/${row.original.case_id}/costs`}
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:underline truncate max-w-[200px] block"
        >
          {row.original.case_name || "—"}
        </a>
      ),
    })
  }

  cols.push(
    {
      accessorKey: "vendor",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vendor" />
      ),
      cell: ({ row }) => (
        <span className="font-medium truncate max-w-[200px] block">
          {row.getValue("vendor")}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => {
        const inv = row.original
        const display = inv.case_amount ?? inv.amount
        return (
          <span className="tabular-nums font-semibold">
            {formatCurrency(display)}
            {inv.case_amount && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                of {formatCurrency(inv.amount)}
              </span>
            )}
          </span>
        )
      },
      sortingFn: (a, b) =>
        Number(a.original.case_amount ?? a.original.amount) -
        Number(b.original.case_amount ?? b.original.amount),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        const cat = row.getValue("category") as string | null
        if (!cat) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground">
            {cat}
          </span>
        )
      },
    },
    {
      accessorKey: "due_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row }) => formatDate(row.getValue("due_date")),
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice Date" />
      ),
      cell: ({ row }) => formatDate(row.getValue("date")),
    },
    {
      accessorKey: "paid_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Paid Date" />
      ),
      cell: ({ row }) => formatDate(row.getValue("paid_date")),
    },
    {
      accessorKey: "check_number",
      header: "Ref",
      cell: ({ row }) => {
        const cn = row.getValue("check_number") as string | null
        return cn ? (
          <span className="text-xs text-muted-foreground">{cn}</span>
        ) : null
      },
    },
    {
      accessorKey: "paid_by_name",
      header: "Paid By",
      cell: ({ row }) => {
        const name = row.original.paid_by_name
        if (!name) return null
        return (
          <span className="text-xs text-muted-foreground truncate max-w-[120px] block">
            {name}
          </span>
        )
      },
    },
    {
      id: "file",
      header: "",
      cell: ({ row }) =>
        row.original.file_path ? (
          <a
            href={getInvoiceFileUrl(row.original.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="View file"
          >
            <HugeiconsIcon
              icon={Attachment01Icon}
              className="size-3.5 text-muted-foreground hover:text-foreground"
            />
          </a>
        ) : null,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <InvoiceActions
          invoice={row.original}
          onMarkPaid={options.onMarkPaid}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }
  )

  return cols
}

function InvoiceActions({
  invoice,
  onMarkPaid,
}: {
  invoice: Invoice
  onMarkPaid?: (invoice: Invoice) => void
}) {
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const isPaid = invoice.status === "paid"

  async function handleUnpay() {
    try {
      await markInvoiceUnpaid(invoice.id)
      toast.success("Invoice marked unpaid")
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    } catch {
      toast.error("Failed to update invoice")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteInvoice(invoice.id)
      toast.success("Invoice deleted")
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    } catch {
      toast.error("Failed to delete invoice")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {!isPaid && onMarkPaid && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onMarkPaid(invoice)}
        >
          <HugeiconsIcon icon={Tick02Icon} className="mr-1 size-3" />
          Mark Paid
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {invoice.file_path && (
            <>
              <DropdownMenuItem asChild>
                <a
                  href={getInvoiceFileUrl(invoice.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <HugeiconsIcon icon={Attachment01Icon} className="mr-2 size-4" />
                  View File
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isPaid && (
            <DropdownMenuItem onClick={handleUnpay}>
              <HugeiconsIcon icon={UndoIcon} className="mr-2 size-4" />
              Move to Unpaid
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
