import { useParams, useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { getCase } from "@/services/cases"
import { CaseDetailHeader } from "@/pages/cases/components/case-detail-header"
import { CaseMetadata } from "@/pages/cases/components/case-metadata"
import { CaseStaff } from "@/pages/cases/components/case-staff"
import { CasePersons } from "@/pages/cases/components/case-persons"
import { CaseEvents } from "@/pages/cases/components/case-events"
import { CaseTasks } from "@/pages/cases/components/case-tasks"
import { CaseProceedings } from "@/pages/cases/components/case-proceedings"
import { CaseNotes } from "@/pages/cases/components/case-notes"
import { Skeleton } from "@/components/ui/skeleton"

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const caseId = Number(id)

  const {
    data: caseData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: !isNaN(caseId),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
            <Skeleton className="h-28" />
            <Skeleton className="h-36" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-64" />
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
    <div className="flex flex-col gap-6 p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back
      </button>
      <CaseDetailHeader caseData={caseData} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — case details */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          <CaseMetadata caseData={caseData} />
          <CasePersons persons={caseData.persons} />
          <CaseEvents events={caseData.events} />
          <CaseTasks tasks={caseData.tasks} />
          <CaseProceedings proceedings={caseData.proceedings} />
        </div>

        {/* Right column — staff + notes (sticky) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="lg:sticky lg:top-6 flex flex-col gap-6">
            <CaseStaff
              attorneys={caseData.attorneys}
              paralegals={caseData.paralegals}
            />
            <CaseNotes notes={caseData.notes} />
          </div>
        </div>
      </div>
    </div>
  )
}
