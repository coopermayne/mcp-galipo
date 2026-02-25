import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Markdown from "react-markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import type { Intake } from "@/types/intake"
import { analyzeIntake } from "@/services/intakes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function RatingDisplay({
  rating,
  reasoning,
}: {
  rating: number
  reasoning: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold">{rating}</span>
      <span className="text-muted-foreground text-sm">/5</span>
      <div className="ml-2 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-4 ${i < rating ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      {reasoning && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="text-primary hover:text-primary/80 ml-1 cursor-pointer text-xs font-medium underline underline-offset-2 transition-colors">
              Why?
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Rating Reasoning</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{reasoning}</Markdown>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface IntakeAiAnalysisProps {
  intake: Intake
}

export function IntakeAiAnalysis({ intake }: IntakeAiAnalysisProps) {
  const queryClient = useQueryClient()

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeIntake(intake.id),
    onSuccess: () => {
      queryClient.setQueryData(["intake", intake.id], {
        ...intake,
        ai_analyzing: true,
      })
      toast.success("Analysis started")
    },
    onError: () => {
      toast.error("Failed to start analysis")
    },
  })

  const hasAnalysis = intake.ai_rating != null || intake.ai_summary

  if (intake.ai_analyzing) {
    return (
      <div className="border p-4">
        <h3 className="mb-3 text-sm font-semibold">AI Analysis</h3>
        <div className="flex items-center gap-2">
          <div className="bg-muted h-2 w-2 animate-pulse" />
          <span className="text-muted-foreground text-sm">Analyzing...</span>
        </div>
      </div>
    )
  }

  if (!hasAnalysis) {
    return (
      <div className="border p-4">
        <h3 className="mb-3 text-sm font-semibold">AI Analysis</h3>
        <p className="text-muted-foreground mb-3 text-sm">
          No analysis yet. Run AI analysis to get a rating and summary.
        </p>
        <Button
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
          Analyze Intake
        </Button>
      </div>
    )
  }

  return (
    <div className="border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Analysis</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
          Re-analyze
        </Button>
      </div>

      {intake.ai_rating != null && (
        <div className="mb-3 flex items-center gap-6">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs">Case Quality</span>
            <RatingDisplay
              rating={intake.ai_rating}
              reasoning={intake.ai_rating_reasoning}
            />
          </div>
          {intake.ai_injury_rating != null && (
            <div>
              <span className="text-muted-foreground mb-1 block text-xs">Injury Severity</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{intake.ai_injury_rating}</span>
                <span className="text-muted-foreground text-sm">/5</span>
                <div className="ml-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-4 ${i < intake.ai_injury_rating! ? "bg-primary" : "bg-muted"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {intake.ai_summary && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown>{intake.ai_summary}</Markdown>
        </div>
      )}
    </div>
  )
}
