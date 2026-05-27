import type { ColumnDef } from "@tanstack/react-table"
import type { TaskListItem } from "@/types/task"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalCircle01Icon,
  PencilEdit01Icon,
  Tick02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { getBadgeStyle, getAvatarStyleById } from "@/lib/badge-colors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { statuses, urgencies } from "@/pages/tasks/task-data"
import { todayInLA } from "@/lib/datetime"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = parseLocalDate(dateStr)
  const base = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${base} (${dow})`
}

export function getColumns(options: {
  onTaskClick: (task: TaskListItem) => void
  onMarkDone: (task: TaskListItem) => void
  onDelete: (task: TaskListItem) => void
}): ColumnDef<TaskListItem>[] {
  return [
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = statuses.find((s) => s.value === row.getValue("status"))
        if (!status) return row.getValue("status")
        return (
          <div className="flex items-center gap-2">
            <status.icon className={cn("size-4", status.iconColor)} />
            <span>{status.label}</span>
          </div>
        )
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => {
        const isDone = row.original.status === "Done"
        return (
          <span
            className={cn(
              "max-w-[500px] truncate block",
              isDone && "text-muted-foreground line-through"
            )}
          >
            {row.getValue("description")}
          </span>
        )
      },
      filterFn: (row, _id, value: string) => {
        const q = value.toLowerCase()
        const desc = (row.getValue("description") as string).toLowerCase()
        const caseName = (row.original.short_name ?? row.original.case_name ?? "").toLowerCase()
        return desc.includes(q) || caseName.includes(q)
      },
    },
    {
      id: "case",
      accessorFn: (row) => row.short_name ?? row.case_name,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case" />
      ),
      cell: ({ row }) => {
        const task = row.original
        if (!task.short_name) return <span className="text-muted-foreground">—</span>
        return (
          <Badge
            className="whitespace-nowrap"
            style={getBadgeStyle(task.case_color)}
          >
            {task.short_name}
          </Badge>
        )
      },
    },
    {
      accessorKey: "urgency",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Urgency" />
      ),
      cell: ({ row }) => {
        const urgency = urgencies.find((u) => u.value === row.getValue("urgency"))
        if (!urgency) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-2">
            <urgency.icon className={cn("size-4", urgency.iconColor)} />
            <span>{urgency.label}</span>
          </div>
        )
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "due_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row }) => {
        const dateStr = row.getValue("due_date") as string | null
        if (!dateStr) return <span className="text-muted-foreground">—</span>
        const isOverdue =
          parseLocalDate(dateStr) < todayInLA() && row.original.status !== "Done"
        return (
          <span className={cn(isOverdue && "text-destructive font-medium")}>
            {formatDate(dateStr)}
          </span>
        )
      },
    },
    {
      id: "assignee",
      accessorFn: (row) =>
        row.assignee
          ? `${row.assignee.first_name} ${row.assignee.last_name}`
          : null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assignee" />
      ),
      cell: ({ row }) => {
        const assignee = row.original.assignee
        if (!assignee) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-2">
            <span
              className="flex size-5 shrink-0 items-center justify-center text-[9px] font-medium"
              style={getAvatarStyleById(assignee.id)}
            >
              {assignee.initials}
            </span>
            <span className="truncate">
              {assignee.first_name} {assignee.last_name}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const task = row.original
        const isDone = task.status === "Done"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="size-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <HugeiconsIcon
                  icon={MoreHorizontalCircle01Icon}
                  className="size-4"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => options.onTaskClick(task)}>
                <HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              {!isDone && (
                <DropdownMenuItem onClick={() => options.onMarkDone(task)}>
                  <HugeiconsIcon icon={Tick02Icon} className="mr-2 size-4" />
                  Mark Done
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => options.onDelete(task)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
