import React from "react"
import type { CaseCountsResponse, CaseStatus } from "@/types/case"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

interface Pipeline {
  label: string
  labelClass: string
  statuses: CaseStatus[]
}

const PIPELINES: Pipeline[] = [
  {
    label: "PRE-LIT",
    labelClass: "text-muted-foreground",
    statuses: ["Signing Up", "Pre-Claim", "Pre-Filing"],
  },
  {
    label: "LITIGATION",
    labelClass: "text-info",
    statuses: [
      "Pleadings",
      "Discovery",
      "Expert Discovery",
      "Pre-trial",
      "Trial",
      "Post-Trial",
      "Appeal",
    ],
  },
  {
    label: "RESOLUTION",
    labelClass: "text-success",
    statuses: ["Settl. Pend.", "Stayed", "Closed"],
  },
]

interface CasePipelinesProps {
  counts: CaseCountsResponse | undefined
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
}

export function CasePipelines({
  counts,
  selectedStatus,
  onStatusChange,
}: CasePipelinesProps) {
  const totalCount = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onStatusChange(null)}
          className={cn(
            "text-xs font-medium tracking-wide uppercase transition-colors",
            selectedStatus === null
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              selectedStatus === null &&
                "underline underline-offset-4 decoration-2"
            )}
          >
            All Cases
          </span>
          {counts && (
            <span className="ml-1 tabular-nums opacity-60">
              ({totalCount})
            </span>
          )}
        </button>
      </div>

      {PIPELINES.map((pipeline) => (
        <Breadcrumb key={pipeline.label}>
          <BreadcrumbList className="flex-nowrap gap-1">
            <BreadcrumbItem>
              <span
                className={cn(
                  "mr-1 text-[10px] font-bold tracking-widest uppercase",
                  pipeline.labelClass
                )}
              >
                {pipeline.label}
              </span>
            </BreadcrumbItem>
            {pipeline.statuses.map((status, i) => {
              const isActive = selectedStatus === status
              const count = counts?.[status] ?? 0
              return (
                <React.Fragment key={status}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem className="gap-1">
                  <button
                    onClick={() =>
                      onStatusChange(isActive ? null : status)
                    }
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
                      {status}
                    </span>
                    <span className="tabular-nums opacity-50">
                      ({count})
                    </span>
                  </button>
                </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ))}
    </div>
  )
}
