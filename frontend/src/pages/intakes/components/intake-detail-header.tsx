import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalCircle01Icon } from "@hugeicons/core-free-icons"
import type { Intake, IntakeStatus } from "@/types/intake"
import { updateIntake, getIntakeTransitions } from "@/services/intakes"
import { StatusBadge } from "@/pages/intakes/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ALL_STATUSES: IntakeStatus[] = [
  "New",
  "Dave Review",
  "Needs Follow-Up",
  "Atty Review",
  "Needs Rejection Letter",
  "Rejection Letter Sent",
  "Needs Retainer",
  "Retainer Sent",
  "Retainer Signed",
]

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
  const moveToStatuses = ALL_STATUSES.filter((s) => s !== intake.status)
  const isArchived = intake.status === "Archived"

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreHorizontalCircle01Icon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {moveToStatuses.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => statusMutation.mutate(status)}
                disabled={statusMutation.isPending}
              >
                {status}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {isArchived ? (
              <DropdownMenuItem
                onClick={() => statusMutation.mutate("New")}
                disabled={statusMutation.isPending}
              >
                Unarchive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => statusMutation.mutate("Archived")}
                disabled={statusMutation.isPending}
              >
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
