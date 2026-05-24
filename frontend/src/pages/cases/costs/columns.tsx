import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  Tick02Icon,
  UndoIcon,
  Delete02Icon,
  MoreHorizontalIcon,
  ArrowDataTransferHorizontalIcon,
} from "@hugeicons/core-free-icons"
import type { Invoice } from "@/services/invoices"
import { PerfectionBadge } from "@/pages/cases/costs/components/perfection-badge"
import {
  openInvoiceFile,
  markInvoiceUnpaid,
  deleteInvoice,
  updateInvoice,
  INVOICE_CATEGORIES,
  type InvoiceCategory,
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

export function getCaseCostColumns(options: {
  onMarkPaid?: (invoice: Invoice) => void
  onEdit?: (invoice: Invoice) => void
  isAdvance?: boolean
}): ColumnDef<Invoice>[] {
  return [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={options.isAdvance ? "Agreement Date" : "Date"} />
      ),
      cell: ({ row }) => {
        const inv = row.original
        if (inv.is_transfer) {
          return (
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon
                icon={ArrowDataTransferHorizontalIcon}
                className="size-3.5 text-purple"
              />
              <span>{formatDate(inv.date)}</span>
            </div>
          )
        }
        return formatDate(inv.date)
      },
    },
    {
      accessorKey: options.isAdvance ? "advanced_to_name" : "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={options.isAdvance ? "Advanced To" : "Category"} />
      ),
      cell: ({ row }) => {
        if (options.isAdvance) {
          const name = row.original.advanced_to_name
          return (
            <span className="text-sm truncate max-w-[180px] block">
              {name ?? <span className="text-muted-foreground">—</span>}
            </span>
          )
        }
        if (row.original.is_transfer) {
          const isPaid = row.original.status === "paid"
          return (
            <span
              className={`text-xs px-1.5 py-0.5 ${
                isPaid
                  ? "bg-purple/15 text-purple"
                  : "border border-purple/40 text-purple"
              }`}
            >
              Transfer{isPaid ? "" : " (pending)"}
            </span>
          )
        }
        return <CategoryCell invoice={row.original} />
      },
    },
    {
      accessorKey: "payee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payee" />
      ),
      cell: ({ row }) => {
        const inv = row.original
        if (inv.is_transfer) {
          const from = inv.paid_by_name ?? "Our Firm"
          const to = inv.transfer_to_name ?? "Our Firm"
          return (
            <span className="font-medium truncate max-w-[200px] block">
              {from} → {to}
            </span>
          )
        }
        return (
          <span className="font-medium truncate max-w-[200px] flex items-center gap-1.5">
            {row.getValue("payee_name") ?? "No payee"}
            <PerfectionBadge invoice={inv} />
          </span>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const desc = row.getValue("description") as string | null
        if (!desc) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[250px] block">
            {desc}
          </span>
        )
      },
      enableSorting: false,
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
      accessorKey: "paid_by_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Paid By" />
      ),
      cell: ({ row }) => {
        const inv = row.original
        const name = inv.paid_by_name ?? "Our Firm"
        return (
          <span className="text-xs truncate max-w-[140px] block">
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openInvoiceFile(row.original.id)
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
        <CostActions
          invoice={row.original}
          onMarkPaid={options.onMarkPaid}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

function CategoryCell({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient()

  async function handleSelect(category: InvoiceCategory | null) {
    try {
      await updateInvoice(invoice.id, { category: category ?? undefined })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    } catch {
      toast.error("Failed to update category")
    }
  }

  const current = invoice.category

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
        >
          {current || "—"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {INVOICE_CATEGORIES.map((cat) => (
          <DropdownMenuItem
            key={cat}
            className={current === cat ? "bg-accent" : ""}
            onClick={() => handleSelect(cat)}
          >
            {cat}
          </DropdownMenuItem>
        ))}
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-muted-foreground"
              onClick={() => handleSelect(null)}
            >
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CostActions({
  invoice,
  onMarkPaid,
}: {
  invoice: Invoice
  onMarkPaid?: (invoice: Invoice) => void
}) {
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const isPaid = invoice.status === "paid"

  function invalidateCosts() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["cost-summary", invoice.case_id] })
    queryClient.invalidateQueries({ queryKey: ["equalization"] })
  }

  async function handleUnpay() {
    try {
      await markInvoiceUnpaid(invoice.id)
      toast.success("Invoice marked unpaid")
      invalidateCosts()
    } catch {
      toast.error("Failed to update invoice")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteInvoice(invoice.id)
      toast.success("Invoice deleted")
      invalidateCosts()
    } catch {
      toast.error("Failed to delete invoice")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {!isPaid && onMarkPaid && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onMarkPaid(invoice)}
        >
          <HugeiconsIcon icon={Tick02Icon} className="mr-1 size-3" />
          Pay
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
              <DropdownMenuItem onClick={() => openInvoiceFile(invoice.id)}>
                <HugeiconsIcon
                  icon={Attachment01Icon}
                  className="mr-2 size-4"
                />
                View File
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
