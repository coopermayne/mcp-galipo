import { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Search01Icon,
  CheckmarkSquare01Icon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { getTasks } from "@/services/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskListView } from "@/pages/tasks/components/task-list-view"
import { cn } from "@/lib/utils"

interface CaseTasksCardProps {
  caseId: number
  onAdd: () => void
}

export function CaseTasksCard({ caseId, onAdd }: CaseTasksCardProps) {
  const [search, setSearch] = useState("")
  const [showDone, setShowDone] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "case", caseId, showDone],
    queryFn: () =>
      getTasks({
        case_id: caseId,
        limit: 500,
        ...(showDone
          ? { status: "Done" }
          : { exclude_status: "Done" }),
      }),
  })

  const tasks = data?.tasks ?? []

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks
    const q = search.toLowerCase()
    return tasks.filter((t) =>
      t.description.toLowerCase().includes(q)
    )
  }, [tasks, search])

  const countLabel = showDone
    ? `${tasks.length} done`
    : `${tasks.length} pending`

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Tasks
          {tasks.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({countLabel})
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onAdd}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDone(!showDone)}
          className={cn(
            "h-8 px-2.5 border shrink-0",
            showDone
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground"
          )}
        >
          <HugeiconsIcon icon={CheckmarkSquare01Icon} className="size-3.5 mr-1" />
          Done
        </Button>
      </div>
      <CardContent className="p-0">
        <TaskListView
          tasks={filteredTasks}
          isLoading={isLoading}
          groupBy="date"
          showDone={showDone}
          hideCaseBadge
          noBorder
          invalidateKeys={[
            ["tasks", "case", String(caseId), showDone],
            ["tasks", "case", String(caseId), !showDone],
            ["tasks"],
            ["case", String(caseId)],
          ]}
        />
      </CardContent>
    </Card>
  )
}
