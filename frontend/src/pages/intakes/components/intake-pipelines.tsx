import React from "react"
import type { IntakeCountsResponse, IntakeStatus } from "@/types/intake"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getIntakeStatusColorVar } from "@/pages/intakes/status-colors"

interface Pipeline {
  label: string
  badgeClass: string
  statuses: IntakeStatus[]
}

const PIPELINES: Pipeline[] = [
  {
    label: "REVIEW",
    badgeClass: "bg-warning/15 text-warning border-warning/25",
    statuses: ["New", "Dave Review", "Needs Follow-Up", "Awaiting PC", "Atty Review"],
  },
  {
    label: "REJECT",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/25",
    statuses: ["Needs Rejection Letter", "Rejection Letter Sent", "No Response Needed"],
  },
  {
    label: "ACCEPT",
    badgeClass: "bg-success/15 text-success border-success/25",
    statuses: ["Needs Retainer", "Retainer Sent", "Retainer Signed"],
  },
]

/**
 * Rectilinear step arrow used between pipeline statuses — a straight shaft with
 * a sharp (square-cap, miter-join) head, matching the app's square theme.
 * Inherits color/size from BreadcrumbSeparator (muted-foreground, size-3.5).
 */
function StepArrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M2.5 8h9M8.5 5l3 3-3 3" />
    </svg>
  )
}

interface IntakePipelinesProps {
  counts: IntakeCountsResponse | undefined
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
}

export function IntakePipelines({
  counts,
  selectedStatus,
  onStatusChange,
}: IntakePipelinesProps) {
  const archivedCount = counts?.["Archived"] ?? 0
  const activeCount = counts
    ? Object.entries(counts)
        .filter(([status]) => status !== "Archived")
        .reduce((sum, [, count]) => sum + count, 0)
    : 0

  const isArchivedView = selectedStatus === "Archived"
  const isActiveView = !isArchivedView

  return (
    <div className="flex flex-col gap-2 border-b pb-4 min-w-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onStatusChange(null)}
          className={cn(
            "text-xs font-medium tracking-wide uppercase transition-colors",
            isActiveView && selectedStatus === null
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              isActiveView && selectedStatus === null &&
                "underline underline-offset-4 decoration-2"
            )}
          >
            Active
          </span>
          {counts && (
            <span className="ml-1 tabular-nums opacity-60">
              ({activeCount})
            </span>
          )}
        </button>
        <button
          onClick={() => onStatusChange("Archived")}
          className={cn(
            "text-xs font-medium tracking-wide uppercase transition-colors",
            isArchivedView
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              isArchivedView &&
                "underline underline-offset-4 decoration-2"
            )}
          >
            Archived
          </span>
          {counts && (
            <span className="ml-1 tabular-nums opacity-60">
              ({archivedCount})
            </span>
          )}
        </button>
      </div>

      {isActiveView &&
        PIPELINES.map((pipeline) => (
          <Breadcrumb key={pipeline.label} className="min-w-0 overflow-x-auto scrollbar-hidden">
            <BreadcrumbList className="flex-nowrap gap-1 whitespace-nowrap">
              <BreadcrumbItem>
                <Badge
                  variant="outline"
                  className={cn(
                    "mr-1 text-[10px] font-bold tracking-widest uppercase",
                    pipeline.badgeClass
                  )}
                >
                  {pipeline.label}
                </Badge>
              </BreadcrumbItem>
              {pipeline.statuses.map((status, i) => {
                const isActive = selectedStatus === status
                const count = counts?.[status] ?? 0
                const statusColor = getIntakeStatusColorVar(status)
                return (
                  <React.Fragment key={status}>
                    {i > 0 && (
                      <BreadcrumbSeparator>
                        <StepArrow />
                      </BreadcrumbSeparator>
                    )}
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
                          className="inline-block size-1.5 shrink-0 border"
                          style={{
                            backgroundColor: statusColor,
                            borderColor: isActive ? "var(--foreground)" : statusColor,
                          }}
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
