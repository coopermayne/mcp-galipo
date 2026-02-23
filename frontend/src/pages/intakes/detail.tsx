import { useRef, useState, useCallback } from "react"
import { useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { getIntake } from "@/services/intakes"
import { useBreadcrumbLabel } from "@/hooks/use-breadcrumb-label"
import { IntakeDetailHeader } from "@/pages/intakes/components/intake-detail-header"
import { IntakeMetadata } from "@/pages/intakes/components/intake-metadata"
import { IntakeSubmission } from "@/pages/intakes/components/intake-submission"
import { IntakeAiAnalysis } from "@/pages/intakes/components/intake-ai-analysis"
import { IntakeComments } from "@/pages/intakes/components/intake-comments"
import { IntakeNotes } from "@/pages/intakes/components/intake-notes"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const intakeId = Number(id)

  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const commentsPanelRef = useRef<HTMLDivElement>(null)
  const [highlightComments, setHighlightComments] = useState(false)

  const {
    data: intake,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["intake", intakeId],
    queryFn: () => getIntake(intakeId),
    enabled: !isNaN(intakeId),
  })

  useBreadcrumbLabel(intake?.name)

  const handleFocusComments = useCallback(() => {
    commentInputRef.current?.focus()
    setHighlightComments(true)
    setTimeout(() => setHighlightComments(false), 1500)
  }, [])

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
            <Skeleton className="h-96" />
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
      <IntakeDetailHeader intake={intake} onFocusComments={handleFocusComments} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — details, AI analysis, notes, submission text */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          <IntakeMetadata intake={intake} />
          <IntakeAiAnalysis intake={intake} />
          <IntakeNotes intake={intake} />
          <IntakeSubmission intake={intake} />
        </div>

        {/* Right column — activity feed (sticky) */}
        <div className="lg:col-span-2">
          <div
            ref={commentsPanelRef}
            className={cn(
              "lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)] transition-shadow duration-500",
              highlightComments && "ring-2 ring-primary"
            )}
          >
            <IntakeComments intakeId={intake.id} textareaRef={commentInputRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
