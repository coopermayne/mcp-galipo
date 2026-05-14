import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INVOICE_CATEGORIES } from "@/services/invoices"
import { PayeeSearch } from "./payee-search"
import type { BulkInvoiceItem } from "./bulk-invoice-upload"

interface BulkInvoiceEditRowProps {
  item: BulkInvoiceItem
  onUpdate: (updates: Partial<BulkInvoiceItem>) => void
  onApplyPayeeToVendor: (
    vendor: string,
    payeeId: number,
    payeeName: string,
    payeeAddress: string | null
  ) => void
  vendorCount: number
}

export function BulkInvoiceEditRow({
  item,
  onUpdate,
  onApplyPayeeToVendor,
  vendorCount,
}: BulkInvoiceEditRowProps) {
  return (
    <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <PayeeSearch
            value={item.payeeId}
            valueName={item.payeeName}
            valueAddress={item.payeeAddress}
            onChange={(payeeId) => {
              onUpdate({ payeeId })
            }}
            extractedName={
              item.extracted?.vendor || item.extracted?.payable_to
            }
            extractedAddress={item.extracted?.payment_address}
            onPayeeSelected={(payeeId, payeeName, payeeAddress) => {
              onUpdate({ payeeId, payeeName, payeeAddress })
            }}
          />
          {item.payeeId && vendorCount > 0 && item.vendor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                onApplyPayeeToVendor(
                  item.vendor!,
                  item.payeeId!,
                  item.payeeName!,
                  item.payeeAddress ?? null
                )
              }
            >
              Apply to all {vendorCount} other{" "}
              {vendorCount === 1 ? "invoice" : "invoices"} from{" "}
              {item.vendor}
            </Button>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={item.amount}
                onChange={(e) => onUpdate({ amount: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={item.category}
                onValueChange={(v) => onUpdate({ category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Invoice Date</Label>
              <DatePicker
                value={item.date || null}
                onChange={(d) => onUpdate({ date: d ?? "" })}
              />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <DatePicker
                value={item.dueDate || null}
                onChange={(d) => onUpdate({ dueDate: d ?? "" })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={item.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={2}
              placeholder="Special payment instructions"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
