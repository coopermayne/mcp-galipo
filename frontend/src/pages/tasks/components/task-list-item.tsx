import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Tick02Icon,
  Delete02Icon,
  Calendar03Icon,
  Link04Icon,
  Flag02Icon,
} from "@hugeicons/core-free-icons"
import type { TaskListItem as TaskListItemType } from "@/types/task"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getBadgeStyle, getAvatarStyleById } from "@/lib/badge-colors"
import { statuses, urgencies } from "@/pages/tasks/task-data"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (d.getTime() === today.getTime()) return "Today"
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Map urgency to a ring color for the status icon */
function urgencyRingColor(urgency: string | null): string {
  switch (urgency) {
    case "Urgent":
      return "text-destructive"
    case "High":
      return "text-warning"
    case "Medium":
      return "text-info"
    case "Low":
      return "text-muted-foreground"
    default:
      return "text-muted-foreground/50"
  }
}

interface TaskListItemProps {
  task: TaskListItemType
  onTaskClick: (task: TaskListItemType) => void
  onMarkDone: (task: TaskListItemType) => void
  onDelete: (task: TaskListItemType) => void
}

export function TaskListItem({
  task,
  onTaskClick,
  onMarkDone,
  onDelete,
}: TaskListItemProps) {
  const isDone = task.status === "Done"
  const status = statuses.find((s) => s.value === task.status)
  const urgency = urgencies.find((u) => u.value === task.urgency)

  const isOverdue =
    task.due_date &&
    !isDone &&
    parseLocalDate(task.due_date) < (() => {
      const t = new Date()
      t.setHours(0, 0, 0, 0)
      return t
    })()

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-3 py-2.5",
        "border-b border-border/50",
        "hover:bg-accent/50 transition-colors cursor-pointer"
      )}
      onClick={() => onTaskClick(task)}
    >
      {/* Status icon — colored by urgency */}
      <button
        className={cn(
          "mt-0.5 shrink-0",
          urgencyRingColor(task.urgency),
          "hover:scale-110 transition-transform",
          isDone && "text-success"
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (!isDone) onMarkDone(task)
        }}
        title={isDone ? "Done" : "Mark as done"}
      >
        {status && (
          <status.icon className="size-5" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p
          className={cn(
            "text-sm leading-snug",
            isDone && "text-muted-foreground line-through"
          )}
        >
          {task.description}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {/* Due date */}
          {task.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                isOverdue
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              <HugeiconsIcon icon={Calendar03Icon} className="size-3" />
              {formatDate(task.due_date)}
            </span>
          )}

          {/* Linked event (shown separately from date) */}
          {task.has_events && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Link04Icon} className="size-3" />
              {task.event_description
                ? <span className="truncate max-w-[160px]">{task.event_description}</span>
                : "Event"}
              {task.event_date && (
                <span className="text-muted-foreground/70">
                  {formatDate(task.event_date)}
                </span>
              )}
            </span>
          )}

          {/* Urgency flag */}
          {urgency && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                urgency.iconColor
              )}
            >
              <HugeiconsIcon icon={Flag02Icon} className="size-3" />
              {urgency.label}
            </span>
          )}

          {/* Case badge */}
          {task.short_name && (
            <Badge
              className="text-[10px] px-1.5 py-0 h-4 leading-none"
              style={getBadgeStyle(task.case_color)}
            >
              {task.short_name}
            </Badge>
          )}

          {/* Assignee */}
          {task.assignee && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex size-4 shrink-0 items-center justify-center text-[8px] font-medium"
                  style={getAvatarStyleById(task.assignee.id)}
                >
                  {task.assignee.initials}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {task.assignee.first_name} {task.assignee.last_name}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div
        className={cn(
          "shrink-0 flex items-center gap-0.5",
          "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            onTaskClick(task)
          }}
          title="Edit"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} className="size-3.5" />
        </Button>
        {!isDone && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation()
              onMarkDone(task)
            }}
            title="Mark done"
          >
            <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task)
          }}
          title="Delete"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
