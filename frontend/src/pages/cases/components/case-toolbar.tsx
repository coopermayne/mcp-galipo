import React, { useState } from "react"
import { useNavigate } from "react-router"
import type { Table } from "@tanstack/react-table"
import type { CaseListItem, CaseCountsResponse, CaseStatus } from "@/types/case"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  SparklesIcon,
  MoreHorizontalIcon,
  NoteEditIcon,
  ArrowDown01Icon,
  Layers01Icon,
  Archive01Icon,
  Download04Icon,
  MoneyBag02Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { exportCaseReport } from "@/services/cases"

export type CaseScope = "mine" | "all"
export type CaseViewMode = "table" | "status"

interface Pipeline {
  label: string
  labelClass: string
  statuses: CaseStatus[]
}

const PIPELINES: Pipeline[] = [
  {
    label: "PRE-LIT",
    labelClass: "text-muted-foreground",
    statuses: ["Signing Up", "Prospective", "Pre-Claim", "Pre-Filing"],
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
    statuses: ["Settl. Pend.", "Stayed"],
  },
]

interface CaseToolbarProps {
  table: Table<CaseListItem>
  counts: CaseCountsResponse | undefined
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
  scope: CaseScope
  onScopeChange: (scope: CaseScope) => void
  viewMode: CaseViewMode
  onViewModeChange: (mode: CaseViewMode) => void
  showClosed: boolean
  onShowClosedChange: (show: boolean) => void
  onNewCaseChat: () => void
  onNewCaseManual: () => void
}

export function CaseToolbar({
  table,
  counts,
  selectedStatus,
  onStatusChange,
  scope,
  onScopeChange,
  viewMode,
  onViewModeChange,
  showClosed,
  onShowClosedChange,
  onNewCaseChat,
  onNewCaseManual,
}: CaseToolbarProps) {
  const navigate = useNavigate()
  const nameColumn = table.getColumn("case_name")
  const [filterOpen, setFilterOpen] = useState(false)

  const totalCount = counts
    ? Object.entries(counts).reduce(
        (sum, [status, count]) => sum + (status === "Closed" ? 0 : count),
        0
      )
    : 0

  // Parse selected statuses (supports comma-separated for group selection)
  const selectedStatuses = selectedStatus
    ? new Set(selectedStatus.split(","))
    : new Set<string>()

  // Check if a full pipeline group is selected
  const activePipeline = PIPELINES.find(
    (p) =>
      p.statuses.length === selectedStatuses.size &&
      p.statuses.every((s) => selectedStatuses.has(s))
  )

  // Build button label
  const scopeLabel = scope === "mine" ? "Your Cases" : "All Cases"
  const statusLabel = activePipeline
    ? activePipeline.label.charAt(0) + activePipeline.label.slice(1).toLowerCase()
    : selectedStatuses.size === 1
      ? [...selectedStatuses][0]
      : null
  const filterLabel = statusLabel
    ? `${scopeLabel} · ${statusLabel}`
    : scopeLabel

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-40">
        <HugeiconsIcon
          icon={Search01Icon}
          className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          placeholder="Filter by case name..."
          value={(nameColumn?.getFilterValue() as string) ?? ""}
          onChange={(e) => nameColumn?.setFilterValue(e.target.value)}
          className="h-8 pl-8"
        />
      </div>

      {/* Combined filter popover: scope + status */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <HugeiconsIcon icon={ArrowDown01Icon} className="mr-2 size-4" />
            {filterLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
          <div className="flex flex-col gap-3">
            {/* Scope selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onScopeChange("mine")}
                className={cn(
                  "px-2 py-0.5 text-xs font-medium tracking-wide uppercase transition-colors",
                  scope === "mine"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Your Cases
              </button>
              <button
                onClick={() => onScopeChange("all")}
                className={cn(
                  "px-2 py-0.5 text-xs font-medium tracking-wide uppercase transition-colors",
                  scope === "all"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Cases
              </button>
            </div>

            <div className="border-t" />

            {/* Status picker */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  onStatusChange(null)
                  setFilterOpen(false)
                }}
                className={cn(
                  "text-xs font-medium tracking-wide uppercase transition-colors text-left",
                  selectedStatuses.size === 0
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    selectedStatuses.size === 0 &&
                      "underline underline-offset-4 decoration-2"
                  )}
                >
                  All Statuses
                </span>
                {counts && (
                  <span className="ml-1 tabular-nums opacity-60">
                    ({totalCount})
                  </span>
                )}
              </button>

              {PIPELINES.map((pipeline) => {
                const isGroupActive =
                  activePipeline?.label === pipeline.label
                const groupCount = pipeline.statuses.reduce(
                  (sum, s) => sum + (counts?.[s] ?? 0),
                  0
                )
                return (
                  <Breadcrumb key={pipeline.label}>
                    <BreadcrumbList className="flex-wrap gap-1">
                      <BreadcrumbItem>
                        <button
                          onClick={() => {
                            if (isGroupActive) {
                              onStatusChange(null)
                            } else {
                              onStatusChange(pipeline.statuses.join(","))
                            }
                            setFilterOpen(false)
                          }}
                          className={cn(
                            "mr-1 text-[10px] font-bold tracking-widest uppercase transition-colors",
                            isGroupActive
                              ? `${pipeline.labelClass} underline underline-offset-4 decoration-2`
                              : `${pipeline.labelClass} hover:opacity-80`
                          )}
                        >
                          {pipeline.label}
                          <span className="ml-0.5 tabular-nums opacity-60 font-medium">
                            ({groupCount})
                          </span>
                        </button>
                      </BreadcrumbItem>
                      {pipeline.statuses.map((status, i) => {
                        const isActive = selectedStatuses.has(status)
                        const count = counts?.[status] ?? 0
                        return (
                          <React.Fragment key={status}>
                            {i > 0 && <BreadcrumbSeparator />}
                            <BreadcrumbItem className="gap-1">
                              <button
                                onClick={() => {
                                  onStatusChange(isActive ? null : status)
                                  setFilterOpen(false)
                                }}
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
                )
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Group by status toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewModeChange(viewMode === "status" ? "table" : "status")}
        className={cn(
          "h-8 px-2.5 border",
          viewMode === "status"
            ? "bg-foreground text-background hover:bg-foreground hover:text-background"
            : "text-muted-foreground"
        )}
      >
        <HugeiconsIcon icon={Layers01Icon} className="size-3.5 mr-1" />
        Status
      </Button>

      {/* Overflow menu: New Case, Manual Form, Column toggles */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" className="h-8 w-8">
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuItem onClick={() => onShowClosedChange(!showClosed)}>
            <HugeiconsIcon icon={Archive01Icon} className="mr-2 size-4" />
            Closed Cases
            {showClosed && (
              <span className="bg-foreground text-background ml-auto px-1.5 py-0.5 text-[10px] font-medium leading-none">
                ON
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportCaseReport()}>
            <HugeiconsIcon icon={Download04Icon} className="mr-2 size-4" />
            Download Case Report
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/financials")}>
            <HugeiconsIcon icon={MoneyBag02Icon} className="mr-2 size-4" />
            Financials
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onNewCaseChat}>
            <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
            New Case (AI)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewCaseManual}>
            <HugeiconsIcon icon={NoteEditIcon} className="mr-2 size-4" />
            New Case (Manual)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
