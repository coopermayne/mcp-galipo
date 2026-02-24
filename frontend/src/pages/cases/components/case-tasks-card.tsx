import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
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
import { TaskListView } from "@/pages/tasks/components/task-list-view"

interface CaseTasksCardProps {
  caseId: number
  onAdd: () => void
}

export function CaseTasksCard({ caseId, onAdd }: CaseTasksCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "case", caseId],
    queryFn: () => getTasks({ case_id: caseId, limit: 500 }),
  })

  const tasks = data?.tasks ?? []
  const pendingCount = tasks.filter((t) => t.status !== "Done").length

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Tasks
          {pendingCount > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({pendingCount} pending)
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
      <CardContent className="p-0">
        <TaskListView
          tasks={tasks}
          isLoading={isLoading}
          groupBy="date"
          hideCaseBadge
          noBorder
          invalidateKeys={[["tasks", "case", String(caseId)], ["tasks"], ["case", String(caseId)]]}
        />
      </CardContent>
    </Card>
  )
}
