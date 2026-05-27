import { useState, useCallback, useEffect, useMemo } from "react"
import { useParams, useSearchParams, Link, useLocation, useNavigate } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getCase, deleteCase } from "@/services/cases"
import { updateCaseAssignment } from "@/services/persons"
import { getInvoiceStats } from "@/services/invoices"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import { FeatureGate } from "@/components/common/feature-gate"
import { CaseDetailHeader } from "@/pages/cases/components/case-detail-header"
import { CaseSummarySection } from "@/pages/cases/components/case-summary-section"
import { CaseActivityFeed } from "@/pages/cases/components/case-activity-feed"
import { CaseInfoPanel } from "@/pages/cases/components/case-info-panel"
import { AddPersonDialog } from "@/pages/cases/components/add-person-dialog"
import { CaseTasksCard } from "@/pages/cases/components/case-tasks-card"
import { AddTaskDialog } from "@/pages/cases/components/add-task-dialog"
import { CaseEventsCard } from "@/pages/cases/components/case-events-card"
import { AddEventDialog } from "@/pages/cases/components/add-event-dialog"
import { CaseKeyDates } from "@/pages/cases/components/case-key-dates"
import { CaseNotesPanel } from "@/pages/cases/components/case-notes-panel"
import { CaseFinancialsCard } from "@/pages/cases/components/case-financials-card"
import { CaseFeaturesMenu } from "@/pages/cases/components/case-features-menu"
import { ListNav } from "@/components/common/list-nav"
import { CaseHealthCard } from "@/components/common/case-health-card"
import { isCaseFeatureEnabled } from "@/types/case"

export default function CaseDetailPage() {
  return (
    <FeatureGate feature="case-detail" redirectTo="/your-cases">
      <CaseDetailContent />
    </FeatureGate>
  )
}

function CaseDetailContent() {
  const { id } = useParams<{ id: string }>()
  const caseId = Number(id)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Dialog state
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [addPersonCategory, setAddPersonCategory] = useState("client")
  const [addPersonRoleId, setAddPersonRoleId] = useState<number | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [aiTasksOpen, setAiTasksOpen] = useState(false)
  const [aiEventsOpen, setAiEventsOpen] = useState(false)
  const [aiPeopleOpen, setAiPeopleOpen] = useState(false)
  const [aiProceedingsOpen, setAiProceedingsOpen] = useState(false)

  useEffect(() => {
    const aiMode = searchParams.get("ai")
    if (!aiMode) return
    if (aiMode === "tasks") setAiTasksOpen(true)
    else if (aiMode === "events") setAiEventsOpen(true)
    setSearchParams((prev) => { prev.delete("ai"); return prev }, { replace: true })
  }, [searchParams, setSearchParams])

  const queryClient = useQueryClient()

  const {
    data: caseData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: !isNaN(caseId),
    retry: (failureCount, err) => {
      const status = (err as { status?: number })?.status
      if (status === 404) return false
      return failureCount < 3
    },
  })

  const { data: invoiceStats } = useQuery({
    queryKey: ["invoices", "stats", caseId, "cost"],
    queryFn: () => getInvoiceStats(caseId, "cost"),
    enabled: !isNaN(caseId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Case deleted")
      navigate("/your-cases")
    },
    onError: () => toast.error("Failed to delete case"),
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

  const aiTasksOnlyRules: ToolCompletionRule[] = useMemo(() => [
    {
      toolNames: ["manage_task"],
      queryKeys: [["tasks", "case", caseId], ["tasks"], ["case", caseId]],
      toastMessage: "Task created via AI",
    },
  ], [caseId])

  const aiEventsOnlyRules: ToolCompletionRule[] = useMemo(() => [
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
    const status = (error as { status?: number } | null)?.status
    const isNotFound = status === 404
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12">
        <p className="text-muted-foreground">
          {isNotFound ? "Case not found." : "Something went wrong loading this case."}
        </p>
        {!isNotFound && (
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["case", caseId] })}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  const toggles = caseData.feature_toggles
  const showTasks = isCaseFeatureEnabled(toggles, "tasks")
  const showEvents = isCaseFeatureEnabled(toggles, "events")
  const showFinancials = isCaseFeatureEnabled(toggles, "financials")
  const userHasInvoicesFeature =
    user?.visibleFeatures == null || user.visibleFeatures.includes("invoices")
  const showCosts = isCaseFeatureEnabled(toggles, "costs") && userHasInvoicesFeature

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6">
        <ListNav basePath="/cases" currentId={caseId} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <CaseDetailHeader caseData={caseData} />
          <div className="flex items-center gap-2 shrink-0">
            {showCosts && (
              <Link
                to={`/cases/${caseId}/costs`}
                state={location.state}
                className="flex items-center gap-3 text-xs border bg-muted/40 px-3 py-1.5"
              >
                <span className="text-muted-foreground">Costs</span>
                {invoiceStats && (
                  <>
                    <span className="text-success tabular-nums">
                      ${Number(invoiceStats.paid_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-destructive tabular-nums">
                      ${Number(invoiceStats.unpaid_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </Link>
            )}
            <CaseFeaturesMenu caseData={caseData} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left column — proceedings, people, tasks, events, notes */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <CaseSummarySection
              caseData={caseData}
              onAddPerson={openAddPerson}
              onAiProceedings={() => setAiProceedingsOpen(true)}
              onAiPeople={() => setAiPeopleOpen(true)}
              onNest={handleNest}
            />
            {showTasks && (
              <CaseTasksCard
                caseId={caseData.id}
                onAdd={() => setAddTaskOpen(true)}
                onAiAdd={() => setAiTasksOpen(true)}
              />
            )}
            {showEvents && (
              <CaseEventsCard
                caseId={caseData.id}
                onAdd={() => setAddEventOpen(true)}
                onAiAdd={() => setAiEventsOpen(true)}
              />
            )}
            <CaseNotesPanel caseId={caseData.id} notes={caseData.notes} />
            {showFinancials && (
              <CaseFinancialsCard caseId={caseData.id} casePersons={caseData.persons} />
            )}

            {user?.isAdmin && (
              <div className="flex justify-end pt-4 border-t border-border/40">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive">
                      Delete case
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this case?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the case and all associated data including tasks, events, notes, proceedings, financials, and invoices. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Right column — key dates, summary, activity feed */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 flex flex-col gap-4 lg:h-[calc(100vh-9rem)]">
              <CaseHealthCard caseId={caseData.id} />
              <CaseKeyDates caseData={caseData} />
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
          open={aiTasksOpen}
          onOpenChange={setAiTasksOpen}
          title="AI Tasks"
          description="Describe tasks and Claude will create them for this case."
          placeholder="e.g. Follow up with client by Friday, file MSJ, respond to discovery..."
          emptyStateText="Describe tasks to add to this case. Claude will create them with the right priority and due date."
          mode="tasks"
          caseContext={caseData.id}
          toolCompletionRules={aiTasksOnlyRules}
        />
        <AiChatSheet
          open={aiEventsOpen}
          onOpenChange={setAiEventsOpen}
          title="AI Events"
          description="Describe calendar events and Claude will create them for this case."
          placeholder="e.g. Depo next Tuesday at 10am, mediation March 15, MSJ hearing on Friday..."
          emptyStateText="Describe calendar events to add to this case. Claude will create them with the right date and time."
          mode="events"
          caseContext={caseData.id}
          toolCompletionRules={aiEventsOnlyRules}
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
