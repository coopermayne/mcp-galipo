import { useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Link04Icon,
  Flag02Icon,
  Tick02Icon,
  Add01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import type { TaskListItem as TaskListItemType } from "@/types/task"
import { getEventsByCase, type CaseEvent } from "@/services/events"
import { getStaff } from "@/services/staff"
import { getCase } from "@/services/cases"
import { Badge } from "@/components/ui/badge"
import { DatePicker } from "@/components/ui/date-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

function StaffRow({
  staffId,
  initials,
  name,
  onClick,
}: {
  staffId: number
  initials: string
  name: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 w-full px-1.5 py-1 text-xs hover:bg-accent transition-colors"
    >
      <span
        className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
        style={getAvatarStyleById(staffId)}
      >
        {initials}
      </span>
      {name}
    </button>
  )
}

function TaskAssigneePicker({
  task,
  onAssign,
}: {
  task: TaskListItemType
  onAssign: (userId: number | null) => void
}) {
  const [open, setOpen] = useState(false)

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    enabled: open,
  })

  const { data: caseData } = useQuery({
    queryKey: ["case", task.case_id],
    queryFn: () => getCase(task.case_id!),
    enabled: open && !!task.case_id,
    staleTime: 60 * 1000,
  })

  const allStaff = staffData?.data ?? []
  const available = allStaff.filter((s) => s.id !== task.assignee_id)

  // Split into case staff vs others
  const caseStaffIds = new Set([
    ...(caseData?.attorneys ?? []).map((a) => a.id),
    ...(caseData?.paralegals ?? []).map((p) => p.id),
  ])
  const onCase = available.filter((s) => caseStaffIds.has(s.id))
  const others = available.filter((s) => !caseStaffIds.has(s.id))

  function pick(id: number) {
    onAssign(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 inline-flex items-center h-4"
          onClick={(e) => e.stopPropagation()}
        >
          {task.assignee ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex size-4 items-center justify-center text-[8px] font-medium leading-none"
                  style={getAvatarStyleById(task.assignee.id)}
                >
                  {task.assignee.initials}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {task.assignee.first_name} {task.assignee.last_name}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="inline-flex size-4 items-center justify-center border border-dashed border-muted-foreground/40 text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground transition-colors">
              <HugeiconsIcon icon={Add01Icon} className="size-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 space-y-0.5">
          {/* Current assignee — with remove */}
          {task.assignee && (
            <>
              <div className="flex items-center justify-between px-1.5 py-1 text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
                    style={getAvatarStyleById(task.assignee.id)}
                  >
                    {task.assignee.initials}
                  </span>
                  {task.assignee.first_name} {task.assignee.last_name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onAssign(null)
                    setOpen(false)
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                </button>
              </div>
              {available.length > 0 && (
                <div className="border-t border-border/50 my-1" />
              )}
            </>
          )}

          {/* Case staff first */}
          {onCase.length > 0 && (
            <>
              {onCase.map((s) => (
                <StaffRow
                  key={s.id}
                  staffId={s.id}
                  initials={s.initials}
                  name={`${s.firstName} ${s.lastName}`}
                  onClick={() => pick(s.id)}
                />
              ))}
              {others.length > 0 && (
                <div className="border-t border-border/50 my-1" />
              )}
            </>
          )}

          {/* Other staff */}
          {others.map((s) => (
            <StaffRow
              key={s.id}
              staffId={s.id}
              initials={s.initials}
              name={`${s.firstName} ${s.lastName}`}
              onClick={() => pick(s.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface TaskListItemProps {
  task: TaskListItemType
  onTaskClick: (task: TaskListItemType) => void
  onUpdateTask: (taskId: number, field: string, value: unknown) => void
  hideCaseBadge?: boolean
  showDone?: boolean
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return parseLocalDate(dateStr) < today
}

function InlineEventLinker({
  task,
  onLink,
}: {
  task: TaskListItemType
  onLink: (eventId: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const { data: caseEvents } = useQuery({
    queryKey: ["events", "case", task.case_id],
    queryFn: () => getEventsByCase(task.case_id!),
    enabled: open && !!task.case_id,
    staleTime: 60 * 1000,
  })

  const selectedEvent = caseEvents?.find((e) => e.id === task.event_id) ?? null

  // Has linked event — show it, click to change
  if (task.has_events && !open) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          if (task.case_id) setOpen(true)
        }}
      >
        <HugeiconsIcon icon={Link04Icon} className="size-3" />
        {task.event_description
          ? <span className="truncate max-w-[160px]">{task.event_description}</span>
          : "Event"}
        {task.event_date && (
          <span className="text-muted-foreground/70">
            {formatDate(task.event_date)}
          </span>
        )}
      </button>
    )
  }

  // No event — show "Link event" button or the open combobox
  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <HugeiconsIcon icon={Link04Icon} className="size-3" />
        Link event
      </button>
    )
  }

  // Combobox is open
  return (
    <div
      ref={anchorRef}
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
    >
      <Combobox
        value={selectedEvent}
        onValueChange={(event: CaseEvent | null) => {
          onLink(event?.id ?? null)
          setOpen(false)
        }}
        items={caseEvents ?? []}
        itemToStringLabel={(event: CaseEvent) => event.description}
        open
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(false)
        }}
      >
        <ComboboxInput
          placeholder="Search events..."
          showClear={!!task.event_id}
          showTrigger={false}
          className="h-6 text-xs w-48"
          autoFocus
        />
        <ComboboxContent anchor={anchorRef}>
          <ComboboxList>
            {(event: CaseEvent) => (
              <ComboboxItem key={event.id} value={event}>
                <div className="flex flex-col">
                  <span>{event.description}</span>
                  {event.date && (
                    <span className="text-muted-foreground text-[10px]">
                      {event.date}
                    </span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>No events found</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function formatCompletionDate(task: TaskListItemType): string {
  const dateStr = task.completion_date
  if (!dateStr) return "Completed"
  const d = parseLocalDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let label: string
  if (d.getTime() === today.getTime()) {
    label = "Today"
  } else if (d.getTime() === yesterday.getTime()) {
    label = "Yesterday"
  } else {
    label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Append time from updated_at if available
  if (task.updated_at) {
    const ts = new Date(task.updated_at)
    label += ` at ${ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
  }

  return label
}

export function TaskListItem({
  task,
  onTaskClick,
  onUpdateTask,
  hideCaseBadge,
  showDone,
}: TaskListItemProps) {
  const isDone = task.status === "Done"
  const status = statuses.find((s) => s.value === task.status)
  const urgency = urgencies.find((u) => u.value === task.urgency)

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2.5 px-3 py-2",
        "border-b border-border/50",
        "hover:bg-accent/50 transition-colors cursor-pointer"
      )}
      onClick={() => onTaskClick(task)}
    >
      {/* Status icon — dropdown to change status */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "shrink-0",
              urgencyRingColor(task.urgency),
              "hover:scale-110 transition-transform",
              isDone && "text-success"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {status && (
              <status.icon className="size-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
          {statuses.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onClick={() => onUpdateTask(task.id, "status", s.value)}
              className="flex items-center justify-between gap-4"
            >
              <span className={cn("inline-flex items-center gap-2", urgencyRingColor(task.urgency))}>
                <s.icon className="size-4" />
                {s.label}
              </span>
              {task.status === s.value && (
                <HugeiconsIcon icon={Tick02Icon} className="size-4 text-foreground" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p
          className={cn(
            "text-xs leading-snug",
            isDone && "text-muted-foreground line-through"
          )}
        >
          {task.description}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-2.5 mt-0.5">
          {showDone ? (
            /* Completion date — static display */
            <span className="text-xs text-muted-foreground">
              {formatCompletionDate(task)}
            </span>
          ) : (
            <>
              {/* Due date — interactive */}
              <div onClick={(e) => e.stopPropagation()}>
                <DatePicker
                  value={task.due_date}
                  onChange={(date) => onUpdateTask(task.id, "due_date", date)}
                  variant="inline"
                  placeholder="Set date"
                  formatValue={formatDate}
                  className={cn(
                    isOverdue(task.due_date) && "text-destructive font-medium"
                  )}
                />
              </div>

              {/* Linked event — inline combobox */}
              {(task.has_events || task.case_id) && (
                <InlineEventLinker
                  task={task}
                  onLink={(eventId) => onUpdateTask(task.id, "event_id", eventId)}
                />
              )}
            </>
          )}

          {/* Urgency — inline select */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="inline-flex"
          >
            <Select
              value={task.urgency ?? ""}
              onValueChange={(val) => onUpdateTask(task.id, "urgency", val || null)}
            >
              <SelectTrigger
                className={cn(
                  "h-5 border-0 bg-transparent px-0 pr-4 shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:border-0",
                  urgency ? urgency.iconColor : "text-muted-foreground/60"
                )}
              >
                <SelectValue placeholder={
                  <span className="inline-flex items-center gap-1 text-xs">
                    <HugeiconsIcon icon={Flag02Icon} className="size-3" />
                    Set urgency
                  </span>
                }>
                  {urgency && (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <HugeiconsIcon icon={Flag02Icon} className="size-3" />
                      {urgency.label}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {urgencies.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    <span className={cn("inline-flex items-center gap-2", u.iconColor)}>
                      <u.icon className="size-3.5" />
                      {u.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Case badge */}
          {task.short_name && !hideCaseBadge && (
            <Badge
              className="text-[10px] px-1.5 py-0 h-4 leading-none"
              style={getBadgeStyle(task.case_color)}
            >
              {task.short_name}
            </Badge>
          )}

          {/* Assignee */}
          <TaskAssigneePicker
            task={task}
            onAssign={(userId) => onUpdateTask(task.id, "assignee_id", userId)}
          />
        </div>
      </div>
    </div>
  )
}
