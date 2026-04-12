import { useState, useCallback, useMemo } from "react"
import { useParams } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import { getCase } from "@/services/cases"
import { updateCaseAssignment } from "@/services/persons"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import { CaseDetailHeader } from "@/pages/cases/components/case-detail-header"
import { CaseSummarySection } from "@/pages/cases/components/case-summary-section"
import { CaseActivityFeed } from "@/pages/cases/components/case-activity-feed"
import { CaseInfoPanel } from "@/pages/cases/components/case-info-panel"
import { AddPersonDialog } from "@/pages/cases/components/add-person-dialog"
import { CaseTasksCard } from "@/pages/cases/components/case-tasks-card"
import { AddTaskDialog } from "@/pages/cases/components/add-task-dialog"
import { CaseEventsCard } from "@/pages/cases/components/case-events-card"
import { AddEventDialog } from "@/pages/cases/components/add-event-dialog"
import { CaseNotesPanel } from "@/pages/cases/components/case-notes-panel"
import { CaseFinancialsCard } from "@/pages/cases/components/case-financials-card"
import { ListNav } from "@/components/common/list-nav"

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const caseId = Number(id)

  // Dialog state
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [addPersonCategory, setAddPersonCategory] = useState("client")
  const [addPersonRoleId, setAddPersonRoleId] = useState<number | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [aiTasksEventsOpen, setAiTasksEventsOpen] = useState(false)
  const [aiPeopleOpen, setAiPeopleOpen] = useState(false)
  const [aiProceedingsOpen, setAiProceedingsOpen] = useState(false)

  const queryClient = useQueryClient()

  const {
    data: caseData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: !isNaN(caseId),
  })

  const nestMutation = useMutation({
    mutationFn: ({ assignmentId, groupedUnderId }: { assignmentId: number; groupedUnderId: number | null }) =>
      updateCaseAssignment(caseId, assignmentId, { grouped_under_id: groupedUnderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Updated grouping")
    },
    onError: (e) => toast.error(e.message),
  })

  const handleNest = useCallback(
    (assignmentId: number, groupedUnderId: number | null) => {
      nestMutation.mutate({ assignmentId, groupedUnderId })
    },
    [nestMutation]
  )

  function openAddPerson(category: string, roleId: number) {
    setAddPersonCategory(category)
    setAddPersonRoleId(roleId)
    setAddPersonOpen(true)
  }

  const aiTasksEventsRules: ToolCompletionRule[] = useMemo(() => [
    {
      toolNames: ["manage_task"],
      queryKeys: [["tasks", "case", caseId], ["tasks"], ["case", caseId]],
      toastMessage: "Task created via AI",
    },
    {
      toolNames: ["manage_event"],
      queryKeys: [["events", "case", caseId], ["events"], ["case", caseId]],
      toastMessage: "Event created via AI",
    },
  ], [caseId])

  const aiPeopleRules: ToolCompletionRule[] = useMemo(() => [
    {
      toolNames: ["manage_person", "manage_case_role"],
      queryKeys: [["case", caseId], ["cases"]],
      toastMessage: "Person added via AI",
    },
  ], [caseId])

  const aiProceedingsRules: ToolCompletionRule[] = useMemo(() => [
    {
      toolNames: ["manage_proceeding"],
      queryKeys: [["case", caseId], ["cases"]],
      toastMessage: "Proceeding updated via AI",
    },
    {
      toolNames: ["manage_judge"],
      queryKeys: [["case", caseId], ["judges"]],
      toastMessage: "Judge updated via AI",
    },
  ], [caseId])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-48" />
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12">
        <p className="text-muted-foreground">Case not found.</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6">
        <ListNav basePath="/cases" currentId={caseId} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <CaseDetailHeader caseData={caseData} />
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiTasksEventsOpen(true)}
            >
              <HugeiconsIcon icon={SparklesIcon} className="mr-1.5 size-3.5" />
              Tasks & Events
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiPeopleOpen(true)}
            >
              <HugeiconsIcon icon={SparklesIcon} className="mr-1.5 size-3.5" />
              People
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left column — proceedings, people, tasks, events, notes */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <CaseSummarySection
              caseData={caseData}
              onAddPerson={openAddPerson}
              onAiProceedings={() => setAiProceedingsOpen(true)}
              onNest={handleNest}
            />
            <CaseTasksCard
              caseId={caseData.id}
              onAdd={() => setAddTaskOpen(true)}
              onAiAdd={() => setAiTasksEventsOpen(true)}
            />
            <CaseEventsCard
              caseId={caseData.id}
              onAdd={() => setAddEventOpen(true)}
              onAiAdd={() => setAiTasksEventsOpen(true)}
            />
            <CaseNotesPanel caseId={caseData.id} notes={caseData.notes} />
            <CaseFinancialsCard caseId={caseData.id} casePersons={caseData.persons} />
          </div>

          {/* Right column — activity feed + summary/dates */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 flex flex-col gap-4 lg:h-[calc(100vh-9rem)]">
              <CaseInfoPanel caseData={caseData} />
              <CaseActivityFeed caseId={caseData.id} />
            </div>
          </div>
        </div>

        {/* Dialogs */}
        <AddPersonDialog
          open={addPersonOpen}
          onOpenChange={setAddPersonOpen}
          caseId={caseData.id}
          category={addPersonCategory}
          roleId={addPersonRoleId}
        />
        <AddTaskDialog
          open={addTaskOpen}
          onOpenChange={setAddTaskOpen}
          caseId={caseData.id}
        />
        <AddEventDialog
          open={addEventOpen}
          onOpenChange={setAddEventOpen}
          caseId={caseData.id}
        />
        <AiChatSheet
          open={aiTasksEventsOpen}
          onOpenChange={setAiTasksEventsOpen}
          title="AI Tasks & Events"
          description="Describe tasks or events and Claude will create them for this case. Events have dates/times; tasks are action items."
          placeholder="e.g. Follow up with client by Friday, schedule depo for March 20 at 10am..."
          emptyStateText="Describe tasks or calendar events to add to this case. Claude will figure out which is which and create them."
          mode="tasks_events"
          caseContext={caseData.id}
          toolCompletionRules={aiTasksEventsRules}
        />
        <AiChatSheet
          open={aiPeopleOpen}
          onOpenChange={setAiPeopleOpen}
          title="AI People"
          description="Describe people to add to this case. Include their name and role (e.g. plaintiff expert, opposing counsel)."
          placeholder='e.g. Add Dr. Smith as plaintiff expert, add Jane Doe as opposing counsel...'
          emptyStateText="Describe people to add to this case with their role. Claude will create them and assign them."
          mode="people"
          caseContext={caseData.id}
          toolCompletionRules={aiPeopleRules}
        />
        <AiChatSheet
          open={aiProceedingsOpen}
          onOpenChange={setAiProceedingsOpen}
          title="AI Proceedings"
          description="Manage court proceedings, judges, and jurisdictions for this case via chat."
          placeholder="e.g. Add a proceeding in C.D. Cal. case #2:24-cv-01234, assigned to Judge Dolly Gee..."
          emptyStateText="Describe proceedings to add or edit. Claude can create proceedings, search/create judges, and assign them."
          mode="proceedings"
          caseContext={caseData.id}
          toolCompletionRules={aiProceedingsRules}
        />
      </div>
    </TooltipProvider>
  )
}
