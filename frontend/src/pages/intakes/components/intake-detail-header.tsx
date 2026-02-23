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
  "New": "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
  "Dave Review": "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900",
  "Needs Follow-Up": "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900",
  "Atty Review": "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900",
  "Needs Rejection Letter": "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  "Rejection Letter Sent": "border-red-200 bg-red-50/50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-900",
  "Needs Retainer": "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900",
  "Retainer Sent": "border-emerald-200 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-900",
  "Retainer Signed": "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900",
  "Archived": "border-neutral-300 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800",
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
              variant="outline"
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
    </>
  )
}
