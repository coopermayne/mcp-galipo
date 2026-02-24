import { useState } from "react"
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

const statusButtonColors: Record<IntakeStatus, string> = {
  "New": "border-info bg-info text-info-foreground hover:bg-info/85",
  "Dave Review": "border-warning bg-warning text-warning-foreground hover:bg-warning/85",
  "Needs Follow-Up": "border-warning bg-warning text-warning-foreground hover:bg-warning/85",
  "Atty Review": "border-purple bg-purple text-purple-foreground hover:bg-purple/85",
  "Needs Rejection Letter": "border-destructive bg-destructive text-white hover:bg-destructive/85",
  "Rejection Letter Sent": "border-destructive bg-destructive text-white hover:bg-destructive/85",
  "Needs Retainer": "border-success bg-success text-success-foreground hover:bg-success/85",
  "Retainer Sent": "border-success bg-success text-success-foreground hover:bg-success/85",
  "Retainer Signed": "border-success bg-success text-success-foreground hover:bg-success/85",
  "Archived": "border-muted bg-muted text-muted-foreground hover:bg-muted/85",
}

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

// Transitions that encourage a comment before proceeding
const COMMENT_ENCOURAGED_TRANSITIONS: Array<{ from: IntakeStatus; to: IntakeStatus }> = [
  // From "New" (triage notes)
  { from: "New", to: "Dave Review" },
  { from: "New", to: "Needs Follow-Up" },
  { from: "New", to: "Atty Review" },
  { from: "New", to: "Needs Rejection Letter" },
  { from: "New", to: "Needs Retainer" },
  // To "Needs Follow-Up" (why?)
  { from: "Dave Review", to: "Needs Follow-Up" },
  { from: "Atty Review", to: "Needs Follow-Up" },
  // From "Needs Follow-Up" (what happened?)
  { from: "Needs Follow-Up", to: "New" },
  { from: "Needs Follow-Up", to: "Dave Review" },
  { from: "Needs Follow-Up", to: "Atty Review" },
  { from: "Needs Follow-Up", to: "Needs Rejection Letter" },
  { from: "Needs Follow-Up", to: "Needs Retainer" },
  // To "Atty Review" (what should attorney look at?)
  { from: "New", to: "Atty Review" },
  { from: "Dave Review", to: "Atty Review" },
  { from: "Needs Follow-Up", to: "Atty Review" },
  // From "Atty Review" → "Dave Review" (what did attorney say?)
  { from: "Atty Review", to: "Dave Review" },
]

function shouldEncourageComment(from: IntakeStatus, to: IntakeStatus): boolean {
  return COMMENT_ENCOURAGED_TRANSITIONS.some(
    (t) => t.from === from && t.to === to
  )
}

interface IntakeDetailHeaderProps {
  intake: Intake
  onFocusComments: () => void
}

export function IntakeDetailHeader({ intake, onFocusComments }: IntakeDetailHeaderProps) {
  const queryClient = useQueryClient()
  const [pendingStatus, setPendingStatus] = useState<IntakeStatus | null>(null)
  const [showArchiveWarning, setShowArchiveWarning] = useState(false)

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

  const handleStatusClick = (newStatus: IntakeStatus) => {
    if (
      shouldEncourageComment(intake.status, newStatus) &&
      !intake.has_comment_since_status_change
    ) {
      setPendingStatus(newStatus)
    } else {
      statusMutation.mutate(newStatus)
    }
  }

  const allowedTransitions = transitions?.[intake.status] ?? []
  const moveToStatuses = ALL_STATUSES.filter((s) => s !== intake.status)
  const isArchived = intake.status === "Archived"

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{intake.name || "Unnamed Intake"}</h1>
          <StatusBadge status={intake.status} />
        </div>
        <div className="flex items-center gap-1.5">
          {allowedTransitions.length > 0 && (
            <span className="mr-1.5 text-xs text-muted-foreground">
              Move to
            </span>
          )}
          {allowedTransitions.map((status: string) => (
            <Button
              key={status}
              size="sm"
              className={cn(
                "font-medium",
                statusButtonColors[status as IntakeStatus]
              )}
              onClick={() => handleStatusClick(status as IntakeStatus)}
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
                  onClick={() => handleStatusClick(status)}
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
                  onClick={() => {
                    const safeToArchive: IntakeStatus[] = [
                      "Rejection Letter Sent",
                      "Retainer Signed",
                    ]
                    if (safeToArchive.includes(intake.status)) {
                      statusMutation.mutate("Archived")
                    } else {
                      setShowArchiveWarning(true)
                    }
                  }}
                  disabled={statusMutation.isPending}
                >
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Add a comment first?</AlertDialogTitle>
            <AlertDialogDescription>
              Leaving a note about why you're moving this intake helps the team stay in the loop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const status = pendingStatus
                setPendingStatus(null)
                if (status) statusMutation.mutate(status)
              }}
            >
              Skip
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingStatus(null)
                onFocusComments()
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showArchiveWarning} onOpenChange={setShowArchiveWarning}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this intake?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving removes this intake from the active pipeline. This should generally only be done after a rejection letter has been sent or a retainer has been signed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setShowArchiveWarning(false)
                statusMutation.mutate("Archived")
              }}
            >
              Archive Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
