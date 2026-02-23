import { useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getCase } from "@/services/cases"
import { updateCaseAssignment } from "@/services/persons"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { CaseDetailHeader } from "@/pages/cases/components/case-detail-header"
import { CaseInfoCard } from "@/pages/cases/components/case-info-card"
import { CaseCounselCard } from "@/pages/cases/components/case-counsel-card"
import { CaseDatesCard } from "@/pages/cases/components/case-dates-card"
import { PersonCard } from "@/pages/cases/components/person-card"
import { AddPersonDialog } from "@/pages/cases/components/add-person-dialog"
import { CaseTasksCard } from "@/pages/cases/components/case-tasks-card"
import { AddTaskDialog } from "@/pages/cases/components/add-task-dialog"
import { CaseEventsCard } from "@/pages/cases/components/case-events-card"
import { AddEventDialog } from "@/pages/cases/components/add-event-dialog"
import { CaseNotesPanel } from "@/pages/cases/components/case-notes-panel"
import { AddProceedingDialog } from "@/pages/cases/components/add-proceeding-dialog"

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const caseId = Number(id)

  // Dialog state
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [addPersonCategory, setAddPersonCategory] = useState("client")
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [addProceedingOpen, setAddProceedingOpen] = useState(false)

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

  function openAddPerson(category: string) {
    setAddPersonCategory(category)
    setAddPersonOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-4 h-64" />
          <Skeleton className="col-span-4 h-64" />
          <Skeleton className="col-span-4 h-64" />
          <Skeleton className="col-span-3 h-40" />
          <Skeleton className="col-span-3 h-40" />
          <Skeleton className="col-span-3 h-40" />
          <Skeleton className="col-span-3 h-40" />
          <Skeleton className="col-span-6 h-48" />
          <Skeleton className="col-span-6 h-48" />
          <Skeleton className="col-span-12 h-40" />
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
      <div className="flex flex-col gap-4 p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          &larr; Back
        </button>
        <CaseDetailHeader caseData={caseData} />

        {/* 12-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Row 1: Case Info | Counsel & Mediator | Key Dates */}
          <div className="lg:col-span-4">
            <CaseInfoCard
              caseData={caseData}
              onAddProceeding={() => setAddProceedingOpen(true)}
            />
          </div>
          <div className="lg:col-span-4">
            <CaseCounselCard
              persons={caseData.persons}
              onAddPerson={openAddPerson}
              onNest={handleNest}
            />
          </div>
          <div className="lg:col-span-4">
            <CaseDatesCard caseData={caseData} />
          </div>

          {/* Row 2: Clients | Defendants | Experts | Other */}
          <div className="md:col-span-1 lg:col-span-3">
            <PersonCard
              title="Clients"
              category="client"
              persons={caseData.persons}
              onAdd={() => openAddPerson("client")}
              onNest={handleNest}
            />
          </div>
          <div className="md:col-span-1 lg:col-span-3">
            <PersonCard
              title="Defendants"
              category="defendant"
              persons={caseData.persons}
              onAdd={() => openAddPerson("defendant")}
              onNest={handleNest}
            />
          </div>
          <div className="md:col-span-1 lg:col-span-3">
            <PersonCard
              title="Experts"
              category="expert"
              persons={caseData.persons}
              onAdd={() => openAddPerson("expert")}
              onNest={handleNest}
            />
          </div>
          <div className="md:col-span-1 lg:col-span-3">
            <PersonCard
              title="Other"
              category="other"
              persons={caseData.persons}
              onAdd={() => openAddPerson("other")}
              onNest={handleNest}
            />
          </div>

          {/* Row 3: Tasks | Events */}
          <div className="lg:col-span-6">
            <CaseTasksCard
              tasks={caseData.tasks}
              caseId={caseData.id}
              onAdd={() => setAddTaskOpen(true)}
            />
          </div>
          <div className="lg:col-span-6">
            <CaseEventsCard
              events={caseData.events}
              onAdd={() => setAddEventOpen(true)}
            />
          </div>

          {/* Notes — full width */}
          <div className="md:col-span-2 lg:col-span-12">
            <CaseNotesPanel notes={caseData.notes} caseId={caseData.id} />
          </div>
        </div>

        {/* Dialogs */}
        <AddPersonDialog
          open={addPersonOpen}
          onOpenChange={setAddPersonOpen}
          caseId={caseData.id}
          category={addPersonCategory}
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
        <AddProceedingDialog
          open={addProceedingOpen}
          onOpenChange={setAddProceedingOpen}
          caseId={caseData.id}
        />
      </div>
    </TooltipProvider>
  )
}
