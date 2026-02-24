import type { Table } from "@tanstack/react-table"
import type { TaskListItem } from "@/types/task"
import type { TaskGroupBy } from "@/pages/tasks/group-tasks"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Calendar03Icon, Briefcase01Icon, CheckmarkSquare01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"

export type TaskScope = "mine" | "assigned"

interface TaskToolbarProps {
  table: Table<TaskListItem>
  scope?: TaskScope
  onScopeChange?: (scope: TaskScope) => void
  groupBy?: TaskGroupBy
  onGroupByChange?: (groupBy: TaskGroupBy) => void
  showGroupByCase?: boolean
  showDone?: boolean
  onShowDoneChange?: (show: boolean) => void
}

export function TaskToolbar({
  table,
  scope,
  onScopeChange,
  groupBy,
  onGroupByChange,
  showGroupByCase = true,
  showDone,
  onShowDoneChange,
}: TaskToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter tasks..."
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

      {/* Show done toggle */}
      {onShowDoneChange && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShowDoneChange(!showDone)}
          className={cn(
            "h-8 px-2.5 border",
            showDone
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground"
          )}
        >
          <HugeiconsIcon icon={CheckmarkSquare01Icon} className="size-3.5 mr-1" />
          Done
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
          {showGroupByCase && (
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
          )}
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
            onClick={() => onScopeChange("assigned")}
            className={cn(
              "h-full px-2.5 border-0",
              scope === "assigned"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            Assigned
          </Button>
        </div>
      )}
    </div>
  )
}
