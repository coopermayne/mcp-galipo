import React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ACTIVE_INVOICE_STAGES, type InvoiceStage } from "@/services/invoices"

interface InvoicePipelinesProps {
  counts: Record<string, number> | undefined
  selectedStage: string | null
  onStageChange: (stage: string | null) => void
}

export function InvoicePipelines({
  counts,
  selectedStage,
  onStageChange,
}: InvoicePipelinesProps) {
  const paidCount = counts?.["Paid"] ?? 0
  const activeCount = counts
    ? ACTIVE_INVOICE_STAGES.reduce((sum, stage) => sum + (counts[stage] ?? 0), 0)
    : 0

  const isPaidView = selectedStage === "Paid"
  const isActiveView = !isPaidView

  return (
    <div className="flex flex-col gap-2 border-b pb-4 min-w-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onStageChange(null)}
          className={cn(
            "text-xs font-medium tracking-wide uppercase transition-colors",
            isActiveView && selectedStage === null
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              isActiveView && selectedStage === null &&
                "underline underline-offset-4 decoration-2"
            )}
          >
            Active
          </span>
          {counts && (
            <span className="ml-1 tabular-nums opacity-60">({activeCount})</span>
          )}
        </button>
        <button
          onClick={() => onStageChange("Paid")}
          className={cn(
            "text-xs font-medium tracking-wide uppercase transition-colors",
            isPaidView
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              isPaidView && "underline underline-offset-4 decoration-2"
            )}
          >
            Paid
          </span>
          {counts && (
            <span className="ml-1 tabular-nums opacity-60">({paidCount})</span>
          )}
        </button>
      </div>

      {isActiveView && (
        <Breadcrumb className="min-w-0 overflow-x-auto scrollbar-hidden">
          <BreadcrumbList className="flex-nowrap gap-1 whitespace-nowrap">
            <BreadcrumbItem>
              <Badge
                variant="outline"
                className="mr-1 text-[10px] font-bold tracking-widest uppercase bg-info/15 text-info border-info/25"
              >
                WORKFLOW
              </Badge>
            </BreadcrumbItem>
            {ACTIVE_INVOICE_STAGES.map((stage: InvoiceStage, i) => {
              const isActive = selectedStage === stage
              const count = counts?.[stage] ?? 0
              return (
                <React.Fragment key={stage}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem className="gap-1">
                    <button
                      onClick={() => onStageChange(isActive ? null : stage)}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs transition-colors",
                        isActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block size-1.5 shrink-0 border",
                          isActive
                            ? "border-foreground bg-foreground"
                            : "border-muted-foreground/50 bg-transparent"
                        )}
                      />
                      <span
                        className={cn(
                          isActive &&
                            "underline underline-offset-4 decoration-2"
                        )}
                      >
                        {stage}
                      </span>
                      <span className="tabular-nums opacity-50">({count})</span>
                    </button>
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </div>
  )
}
