import type { Intake } from "@/types/intake"

interface IntakeSubmissionProps {
  intake: Intake
}

export function IntakeSubmission({ intake }: IntakeSubmissionProps) {
  const hasIncident = !!intake.incident_description
  const hasInjury = !!intake.injury_description

  if (!hasIncident && !hasInjury) {
    return (
      <div className="border p-4">
        <h3 className="mb-2 text-sm font-semibold">Submission</h3>
        <p className="text-muted-foreground text-sm">No submission text available.</p>
      </div>
    )
  }

  return (
    <div className="border p-4">
      {hasIncident && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Incident Description</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {intake.incident_description}
          </p>
        </div>
      )}

      {hasInjury && (
        <div className={hasIncident ? "mt-4" : ""}>
          <h3 className="mb-2 text-sm font-semibold">Injury Description</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {intake.injury_description}
          </p>
        </div>
      )}
    </div>
  )
}
