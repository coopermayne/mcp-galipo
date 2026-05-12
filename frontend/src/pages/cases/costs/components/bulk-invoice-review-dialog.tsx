import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Alert02Icon,
  Cancel01Icon,
  Loading03Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import type { BulkInvoiceItem } from "./bulk-invoice-upload"
import { BulkInvoiceEditRow } from "./bulk-invoice-edit-row"

interface BulkInvoiceReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: BulkInvoiceItem[]
  progress: { uploaded: number; extracted: number; total: number; errors: number }
  phase: "processing" | "reviewing"
  saving: boolean
  onUpdateItem: (id: string, updates: Partial<BulkInvoiceItem>) => void
  onApplyPayeeToVendor: (
    vendor: string,
    payeeId: number,
    payeeName: string,
    payeeAddress: string | null
  ) => void
  onRemoveItem: (id: string) => void
  onSaveValid: () => Promise<void>
  onCancel: () => void
}

function isItemValid(item: BulkInvoiceItem): boolean {
  return !!(item.payeeId && item.amount && item.date && item.category)
}

export function BulkInvoiceReviewDialog({
  open,
  onOpenChange,
  items,
  progress,
  phase,
  saving,
  onUpdateItem,
  onApplyPayeeToVendor,
  onRemoveItem,
  onSaveValid,
  onCancel,
}: BulkInvoiceReviewDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeItems = useMemo(
    () => items.filter((i) => i.status !== "saved"),
    [items]
  )
  const validCount = useMemo(
    () => activeItems.filter((i) => isItemValid(i) && i.status === "ready").length,
    [activeItems]
  )
  const savedCount = useMemo(
    () => items.filter((i) => i.status === "saved").length,
    [items]
  )
  const incompleteCount = useMemo(
    () =>
      activeItems.filter((i) => i.status === "ready" && !isItemValid(i)).length,
    [activeItems]
  )

  const isProcessing = phase === "processing"
  const uploadPct =
    progress.total > 0
      ? Math.round((progress.uploaded / progress.total) * 100)
      : 0
  const extractPct =
    progress.total > 0
      ? Math.round((progress.extracted / progress.total) * 100)
      : 0

  const doneUploading = progress.uploaded >= progress.total
  const progressPct = doneUploading ? extractPct : uploadPct
  const progressLabel = doneUploading
    ? `Extracting ${progress.extracted} of ${progress.total}...`
    : `Uploading ${progress.uploaded} of ${progress.total}...`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Bulk Invoice Upload
            {savedCount > 0 && (
              <Badge variant="default" className="ml-2">
                {savedCount} saved
              </Badge>
            )}
          </DialogTitle>
          {isProcessing ? (
            <p className="text-sm text-muted-foreground">{progressLabel}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {validCount} of {activeItems.length} ready to save
              {incompleteCount > 0 && ` · ${incompleteCount} incomplete`}
              {progress.errors > 0 && ` · ${progress.errors} errors`}
            </p>
          )}
        </DialogHeader>

        {/* Progress bar during processing */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Review table */}
        <ScrollArea className="flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>File</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeItems.length === 0 && !isProcessing ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No invoices to review.
                  </TableCell>
                </TableRow>
              ) : (
                activeItems.map((item) => {
                  const valid = isItemValid(item)
                  const isExpanded = expandedId === item.id
                  const vendorCount = activeItems.filter(
                    (i) =>
                      i.id !== item.id &&
                      i.vendor &&
                      item.vendor &&
                      i.vendor.trim().toLowerCase() ===
                        item.vendor.trim().toLowerCase() &&
                      !i.payeeId &&
                      i.status !== "saved"
                  ).length

                  return (
                    <TableRowGroup key={item.id}>
                      <TableRow
                        className={`cursor-pointer ${
                          isExpanded ? "bg-accent" : ""
                        } ${item.status === "error" ? "bg-destructive/5" : ""}`}
                        onClick={() =>
                          item.status !== "saving" &&
                          item.status !== "saved" &&
                          setExpandedId(isExpanded ? null : item.id)
                        }
                      >
                        <TableCell>
                          <StatusIcon item={item} valid={valid} />
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs">
                          {item.fileName}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">
                          {item.vendor || (
                            <span className="text-muted-foreground italic">
                              unknown
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {item.amount ? `$${Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : (
                            <span className="text-warning font-medium">
                              missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.date || (
                            <span className="text-warning font-medium">
                              missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">
                          {item.category || (
                            <span className="text-warning font-medium">
                              missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">
                          {item.payeeName || (
                            <span className="text-warning font-medium">
                              unassigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.status !== "saving" &&
                            item.status !== "saved" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRemoveItem(item.id)
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <HugeiconsIcon
                                  icon={Delete02Icon}
                                  className="size-3.5"
                                />
                              </button>
                            )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && item.status === "ready" && (
                        <TableRow>
                          <TableCell colSpan={8} className="p-0">
                            <BulkInvoiceEditRow
                              item={item}
                              onUpdate={(updates) =>
                                onUpdateItem(item.id, updates)
                              }
                              onApplyPayeeToVendor={onApplyPayeeToVendor}
                              vendorCount={vendorCount}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                      {isExpanded && item.status === "error" && (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-xs text-destructive px-4 py-3"
                          >
                            {item.error || "An error occurred processing this file."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableRowGroup>
                  )
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {savedCount > 0 && activeItems.length === 0 ? "Done" : "Cancel"}
          </Button>
          <Button
            onClick={onSaveValid}
            disabled={validCount === 0 || saving || isProcessing}
          >
            {saving
              ? "Saving..."
              : validCount > 0
                ? `Save ${validCount} Invoice${validCount !== 1 ? "s" : ""}`
                : "No valid invoices"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusIcon({
  item,
  valid,
}: {
  item: BulkInvoiceItem
  valid: boolean
}) {
  if (
    item.status === "pending" ||
    item.status === "uploading" ||
    item.status === "extracting" ||
    item.status === "saving"
  ) {
    return (
      <HugeiconsIcon
        icon={Loading03Icon}
        className="size-4 animate-spin text-muted-foreground"
      />
    )
  }
  if (item.status === "error") {
    return (
      <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-destructive" />
    )
  }
  if (item.status === "saved") {
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        className="size-4 text-success"
      />
    )
  }
  if (valid) {
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        className="size-4 text-success"
      />
    )
  }
  return (
    <HugeiconsIcon icon={Alert02Icon} className="size-4 text-warning" />
  )
}

function TableRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
