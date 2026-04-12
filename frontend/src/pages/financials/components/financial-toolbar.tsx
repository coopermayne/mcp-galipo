import { useState } from "react"
import type { Table } from "@tanstack/react-table"
import type { FinancialListItem, FinancialCountsResponse } from "@/types/financial"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  ArrowDown01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type FinancialScope = "mine" | "all"

const RESOLUTION_TYPES = [
  { value: "settlement", label: "Settlement" },
  { value: "verdict", label: "Verdict" },
  { value: "judgment", label: "Judgment" },
  { value: "arbitration_award", label: "Arbitration" },
]

interface FinancialToolbarProps {
  table: Table<FinancialListItem>
  counts: FinancialCountsResponse | undefined
  selectedType: string | null
  onTypeChange: (type: string | null) => void
  scope: FinancialScope
  onScopeChange: (scope: FinancialScope) => void
  finalizedFilter: boolean | null
  onFinalizedFilterChange: (value: boolean | null) => void
  onNewFinancial?: () => void
}

export function FinancialToolbar({
  table,
  counts,
  selectedType,
  onTypeChange,
  scope,
  onScopeChange,
  finalizedFilter,
  onFinalizedFilterChange,
  onNewFinancial,
}: FinancialToolbarProps) {
  const nameColumn = table.getColumn("case_name")
  const [filterOpen, setFilterOpen] = useState(false)

  const totalCount = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0

  const scopeLabel = scope === "mine" ? "Your Cases" : "All Cases"
  const typeLabel = selectedType
    ? RESOLUTION_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType
    : null
  const finalizedLabel = finalizedFilter === true ? "Final" : finalizedFilter === false ? "Pending" : null
  const parts = [scopeLabel, typeLabel, finalizedLabel].filter(Boolean)
  const filterLabel = parts.join(" · ")

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

            {/* Resolution type picker */}
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  onTypeChange(null)
                  setFilterOpen(false)
                }}
                className={cn(
                  "text-xs font-medium tracking-wide uppercase transition-colors text-left",
                  !selectedType
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn(!selectedType && "underline underline-offset-4 decoration-2")}>
                  All Types
                </span>
                {counts && (
                  <span className="ml-1 tabular-nums opacity-60">({totalCount})</span>
                )}
              </button>
              {RESOLUTION_TYPES.map((rt) => {
                const isActive = selectedType === rt.value
                const count = counts?.[rt.value] ?? 0
                return (
                  <button
                    key={rt.value}
                    onClick={() => {
                      onTypeChange(isActive ? null : rt.value)
                      setFilterOpen(false)
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs transition-colors text-left",
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
                    <span className={cn(isActive && "underline underline-offset-4 decoration-2")}>
                      {rt.label}
                    </span>
                    <span className="tabular-nums opacity-50">({count})</span>
                  </button>
                )
              })}
            </div>

            <div className="border-t" />

            {/* Finalized filter */}
            <div className="flex items-center gap-1">
              {([
                { value: null, label: "All" },
                { value: true, label: "Final" },
                { value: false, label: "Pending" },
              ] as const).map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => {
                    onFinalizedFilterChange(opt.value)
                    setFilterOpen(false)
                  }}
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium tracking-wide uppercase transition-colors",
                    finalizedFilter === opt.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {onNewFinancial && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="h-8 w-8">
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={onNewFinancial}>
              Add Financial Record
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
