import type { Table } from "@tanstack/react-table"
import type { EventListItem } from "@/types/event"
import type { EventGroupBy } from "@/pages/events/group-events"
import type { CalendarMode } from "@/pages/events/components/calendar-view"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Calendar03Icon,
  Briefcase01Icon,
  ArrowTurnBackwardIcon,
  Menu01Icon,
  Download01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type EventScope = "mine" | "attending"
export type EventView = "list" | CalendarMode

interface EventToolbarProps {
  table: Table<EventListItem>
  scope?: EventScope
  onScopeChange?: (scope: EventScope) => void
  groupBy?: EventGroupBy
  onGroupByChange?: (groupBy: EventGroupBy) => void
  showPast?: boolean
  onShowPastChange?: (show: boolean) => void
  view?: EventView
  onViewChange?: (view: EventView) => void
  onExport?: () => void
  onAddEvent?: () => void
}

export function EventToolbar({
  table,
  scope,
  onScopeChange,
  groupBy,
  onGroupByChange,
  showPast,
  onShowPastChange,
  view,
  onViewChange,
  onExport,
  onAddEvent,
}: EventToolbarProps) {
  const isList = view === "list" || view === undefined
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
        {/* Search — only meaningful in list mode (table filter) */}
        {isList && (
          <div className="relative min-w-0 flex-1">
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
        )}
        {!isList && onAddEvent && (
          <Button variant="outline" size="sm" className="h-8" onClick={onAddEvent}>
            <HugeiconsIcon icon={Add01Icon} className="size-3.5 mr-1" />
            Add event
          </Button>
        )}
      </div>

      {/* View toggle */}
      {view && onViewChange && (
        <div className="flex items-center border h-8">
          <ViewBtn current={view} value="list" onClick={onViewChange} icon={Menu01Icon}>
            List
          </ViewBtn>
          <ViewBtn current={view} value="month" onClick={onViewChange} icon={Calendar03Icon}>
            Month
          </ViewBtn>
          <ViewBtn current={view} value="week" onClick={onViewChange} icon={Calendar03Icon}>
            Week
          </ViewBtn>
          <ViewBtn current={view} value="day" onClick={onViewChange} icon={Calendar03Icon}>
            Day
          </ViewBtn>
        </div>
      )}

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
              : "text-muted-foreground",
          )}
        >
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5 mr-1" />
          Past
        </Button>
      )}

      {/* Group by toggle — list mode only */}
      {isList && groupBy && onGroupByChange && (
        <div className="flex items-center border h-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGroupByChange("date")}
            className={cn(
              "h-full px-2.5 border-0",
              groupBy === "date"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground",
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
                : "text-muted-foreground",
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
                : "text-muted-foreground",
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
                : "text-muted-foreground",
            )}
          >
            Attending
          </Button>
        </div>
      )}

      {/* Export */}
      {onExport && (
        <Button variant="outline" size="sm" className="h-8" onClick={onExport}>
          <HugeiconsIcon icon={Download01Icon} className="size-3.5 mr-1" />
          .ics
        </Button>
      )}
    </div>
  )
}

interface ViewBtnProps {
  current: EventView
  value: EventView
  onClick: (v: EventView) => void
  icon: typeof Calendar03Icon
  children: React.ReactNode
}

function ViewBtn({ current, value, onClick, icon, children }: ViewBtnProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onClick(value)}
      className={cn(
        "h-full px-2.5 border-0",
        current === value
          ? "bg-foreground text-background hover:bg-foreground hover:text-background"
          : "text-muted-foreground",
      )}
    >
      <HugeiconsIcon icon={icon} className="size-3.5 mr-1" />
      {children}
    </Button>
  )
}
