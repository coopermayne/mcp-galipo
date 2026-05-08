import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  MoreHorizontalIcon,
  Tick02Icon,
  UndoIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import {
  type Invoice,
  markInvoiceUnpaid,
  deleteInvoice,
  getInvoiceFileUrl,
} from "@/services/invoices"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface InvoiceCardProps {
  invoice: Invoice
  onMarkPaid?: () => void
  onClick?: () => void
  onChanged: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatCurrency(amount: string): string {
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

export function InvoiceCard({ invoice, onMarkPaid, onClick, onChanged }: InvoiceCardProps) {
  const [deleting, setDeleting] = useState(false)
  const isPaid = invoice.status === "paid"

  async function handleUndo() {
    try {
      await markInvoiceUnpaid(invoice.id)
      toast.success("Invoice marked unpaid")
      onChanged()
    } catch {
      toast.error("Failed to update invoice")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteInvoice(invoice.id)
      toast.success("Invoice deleted")
      onChanged()
    } catch {
      toast.error("Failed to delete invoice")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="border px-4 py-3 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer" onClick={onClick}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-sm truncate">{invoice.vendor}</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(invoice.amount)}
          </span>
          {isPaid && invoice.paid_date && (
            <span className="text-xs text-muted-foreground">
              Paid {formatDate(invoice.paid_date)}
            </span>
          )}
          {isPaid && invoice.check_number && (
            <span className="text-xs text-muted-foreground">
              Ref: {invoice.check_number}
            </span>
          )}
          {!isPaid && invoice.due_date && (
            <span className="text-xs text-muted-foreground">
              Due {formatDate(invoice.due_date)}
            </span>
          )}
          {invoice.payable_to && (
            <span className="text-xs text-muted-foreground">
              Pay: {invoice.payable_to}
            </span>
          )}
          {invoice.category && (
            <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground">
              {invoice.category}
            </span>
          )}
        </div>
        {invoice.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {invoice.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {invoice.file_path && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            asChild
          >
            <a
              href={getInvoiceFileUrl(invoice.id)}
              target="_blank"
              rel="noopener noreferrer"
              title="View file"
            >
              <HugeiconsIcon icon={Attachment01Icon} className="size-3.5" />
            </a>
          </Button>
        )}
        {!isPaid && onMarkPaid && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onMarkPaid}>
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
            )}
            {isPaid && (
              <DropdownMenuItem onClick={handleUndo}>
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
    </div>
  )
}
