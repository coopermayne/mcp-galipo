import type { IntakeCountsResponse, IntakeStatus } from "@/types/intake"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Pipeline {
  label: string
  badgeClass: string
  statuses: IntakeStatus[]
}

const PIPELINES: Pipeline[] = [
  {
    label: "REVIEW",
    badgeClass: "bg-warning/15 text-warning border-warning/25",
    statuses: ["New", "Dave Review", "Needs Follow-Up", "Atty Review"],
  },
  {
    label: "REJECT",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/25",
    statuses: ["Needs Rejection Letter", "Rejection Letter Sent"],
  },
  {
    label: "ACCEPT",
    badgeClass: "bg-success/15 text-success border-success/25",
    statuses: ["Needs Retainer", "Retainer Sent", "Retainer Signed"],
  },
]

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
    <div className="flex flex-col gap-2 border-b pb-4">
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
          <Breadcrumb key={pipeline.label}>
            <BreadcrumbList className="flex-nowrap gap-1">
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
                return (
                  <BreadcrumbItem key={status} className="gap-1">
                    {i > 0 && <BreadcrumbSeparator />}
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
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ))}
    </div>
  )
}
