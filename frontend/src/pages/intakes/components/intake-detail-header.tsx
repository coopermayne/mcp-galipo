import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import type { Intake, IntakeStatus } from "@/types/intake"
import { updateIntake, getIntakeTransitions } from "@/services/intakes"
import { StatusBadge } from "@/pages/intakes/components/status-badge"
import { Button } from "@/components/ui/button"

interface IntakeDetailHeaderProps {
  intake: Intake
}

export function IntakeDetailHeader({ intake }: IntakeDetailHeaderProps) {
  const queryClient = useQueryClient()

  const { data: transitions } = useQuery({
    queryKey: ["intake-transitions"],
    queryFn: getIntakeTransitions,
    staleTime: 5 * 60 * 1000,
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus: IntakeStatus) =>
      updateIntake(intake.id, { status: newStatus }),
    onSuccess: (data) => {
      queryClient.setQueryData(["intake", intake.id], data.intake)
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      queryClient.invalidateQueries({ queryKey: ["intake-counts"] })
      queryClient.invalidateQueries({ queryKey: ["intake-comments", intake.id] })
      toast.success(`Status changed to ${data.intake.status}`)
    },
    onError: () => {
      toast.error("Failed to update status")
    },
  })

  const allowedTransitions = transitions?.[intake.status] ?? []

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/intakes"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Intakes
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <h1 className="text-lg font-semibold">{intake.name || "Unnamed Intake"}</h1>
        <StatusBadge status={intake.status} />
      </div>
      <div className="flex items-center gap-2">
        {allowedTransitions.map((status: string) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            onClick={() => statusMutation.mutate(status as IntakeStatus)}
            disabled={statusMutation.isPending}
          >
            {status}
          </Button>
        ))}
      </div>
    </div>
  )
}
