import { useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { getIntake } from "@/services/intakes"
import { IntakeDetailHeader } from "@/pages/intakes/components/intake-detail-header"
import { IntakeMetadata } from "@/pages/intakes/components/intake-metadata"
import { IntakeSubmission } from "@/pages/intakes/components/intake-submission"
import { IntakeAiAnalysis } from "@/pages/intakes/components/intake-ai-analysis"
import { IntakeComments } from "@/pages/intakes/components/intake-comments"
import { IntakeNotes } from "@/pages/intakes/components/intake-notes"
import { Skeleton } from "@/components/ui/skeleton"

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const intakeId = Number(id)

  const {
    data: intake,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["intake", intakeId],
    queryFn: () => getIntake(intakeId),
    enabled: !isNaN(intakeId),
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
            <Skeleton className="h-36" />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !intake) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12">
        <p className="text-muted-foreground">Intake not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <IntakeDetailHeader intake={intake} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — submission, AI analysis, notes */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          <IntakeSubmission intake={intake} />
          <IntakeAiAnalysis intake={intake} />
          <IntakeNotes intake={intake} />
        </div>

        {/* Right column — metadata, comments */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <IntakeMetadata intake={intake} />
          <IntakeComments intakeId={intake.id} />
        </div>
      </div>
    </div>
  )
}
