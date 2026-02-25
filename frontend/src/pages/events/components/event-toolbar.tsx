import type { Table } from "@tanstack/react-table"
import type { EventListItem } from "@/types/event"
import type { EventGroupBy } from "@/pages/events/group-events"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Calendar03Icon,
  Briefcase01Icon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type EventScope = "mine" | "attending"

interface EventToolbarProps {
  table: Table<EventListItem>
  scope?: EventScope
  onScopeChange?: (scope: EventScope) => void
  groupBy?: EventGroupBy
  onGroupByChange?: (groupBy: EventGroupBy) => void
  showPast?: boolean
  onShowPastChange?: (show: boolean) => void
}

export function EventToolbar({
  table,
  scope,
  onScopeChange,
  groupBy,
  onGroupByChange,
  showPast,
  onShowPastChange,
}: EventToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter events..."
            value={
              (table.getColumn("description")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("description")?.setFilterValue(event.target.value)
            }
            className="h-8 pl-8"
          />
        </div>
      </div>

      {/* Past toggle */}
      {onShowPastChange && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShowPastChange(!showPast)}
          className={cn(
            "h-8 px-2.5 border",
            showPast
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground"
          )}
        >
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5 mr-1" />
          Past
        </Button>
      )}

      {/* Group by toggle */}
      {groupBy && onGroupByChange && (
        <div className="flex items-center border h-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGroupByChange("date")}
            className={cn(
              "h-full px-2.5 border-0",
              groupBy === "date"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 mr-1" />
            Date
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGroupByChange("case")}
            className={cn(
              "h-full px-2.5 border-0",
              groupBy === "case"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            <HugeiconsIcon icon={Briefcase01Icon} className="size-3.5 mr-1" />
            Case
          </Button>
        </div>
      )}

      {/* Scope toggle */}
      {scope && onScopeChange && (
        <div className="flex items-center border h-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onScopeChange("mine")}
            className={cn(
              "h-full px-2.5 border-0",
              scope === "mine"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            Your Cases
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onScopeChange("attending")}
            className={cn(
              "h-full px-2.5 border-0",
              scope === "attending"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            Attending
          </Button>
        </div>
      )}
    </div>
  )
}
