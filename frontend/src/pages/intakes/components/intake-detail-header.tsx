import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalCircle01Icon, ArrowRight01Icon, PrinterIcon, SparklesIcon } from "@hugeicons/core-free-icons"
import type { Intake, IntakeStatus } from "@/types/intake"
import { updateIntake, getIntakeTransitions, createIntakeComment } from "@/services/intakes"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/pages/intakes/components/status-badge"
import { getIntakeStatusStyle } from "@/pages/intakes/status-colors"
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
import { Textarea } from "@/components/ui/textarea"

const ALL_STATUSES: IntakeStatus[] = [
  "New",
  "Dave Review",
  "Needs Follow-Up",
  "Awaiting PC",
  "Atty Review",
  "Needs Rejection Letter",
  "Rejection Letter Sent",
  "Needs Retainer",
  "Retainer Sent",
  "Retainer Signed",
]

// Statuses where the "Create Case" button should appear
const CASE_CREATION_STATUSES: IntakeStatus[] = [
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
  // To "Awaiting PC" (what follow-up was done?)
  { from: "Needs Follow-Up", to: "Awaiting PC" },
  { from: "Dave Review", to: "Awaiting PC" },
  // From "Awaiting PC" (what did client respond?)
  { from: "Awaiting PC", to: "Needs Follow-Up" },
  { from: "Awaiting PC", to: "Dave Review" },
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

function getCommentPlaceholder(from: IntakeStatus, to: IntakeStatus): string {
  // Contextual hints based on the specific transition
  if (to === "Awaiting PC") return "e.g. Left voicemail, waiting for callback..."
  if (to === "Needs Follow-Up" && from === "Awaiting PC") return "e.g. No response after 3 days, need to try again..."
  if (to === "Needs Follow-Up" && from === "Dave Review") return "e.g. Need police report before we can evaluate..."
  if (to === "Needs Follow-Up" && from === "Atty Review") return "e.g. Attorney wants more info on prior treatment..."
  if (to === "Dave Review" && from === "New") return "e.g. Looks like a PI case, needs Dave's review..."
  if (to === "Dave Review" && from === "Awaiting PC") return "e.g. Client sent medical records, ready for review..."
  if (to === "Dave Review" && from === "Needs Follow-Up") return "e.g. Got the missing info, ready for Dave..."
  if (to === "Dave Review" && from === "Atty Review") return "e.g. Attorney says needs more investigation..."
  if (to === "Atty Review") return "e.g. Liability is questionable..."
  if (to === "Needs Rejection Letter") return "e.g. SOL expired, no viable claim..."
  if (to === "Needs Retainer") return "e.g. Good case, ready to sign up..."
  return "Add a note..."
}

interface IntakeDetailHeaderProps {
  intake: Intake
  onFocusComments?: () => void
  onCreateCase?: () => void
}

export function IntakeDetailHeader({ intake, onCreateCase }: IntakeDetailHeaderProps) {
  const queryClient = useQueryClient()
  const [pendingStatus, setPendingStatus] = useState<IntakeStatus | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
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

  const commentMutation = useMutation({
    mutationFn: (content: string) => createIntakeComment(intake.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake-comments", intake.id] })
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

  const handlePrint = async () => {
    const res = await apiFetch(`/api/v1/intakes/${intake.id}/export`)
    if (!res.ok) return
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "intake.pdf"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const allowedTransitions = transitions?.[intake.status] ?? []
  const moveToStatuses = ALL_STATUSES.filter((s) => s !== intake.status)
  const isArchived = intake.status === "Archived"

  const showCreateCase =
    CASE_CREATION_STATUSES.includes(intake.status) && !intake.case_id
  const hasLinkedCase = !!intake.case_id

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{intake.name || "Unnamed Intake"}</h1>
          <StatusBadge status={intake.status} />
          {hasLinkedCase && (
            <Link
              to={`/cases/${intake.case_id}`}
              className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              Case: {intake.case_name || `#${intake.case_id}`}
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {showCreateCase && (
            <Button
              size="sm"
              className="font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm px-4 gap-2"
              onClick={onCreateCase}
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-4" />
              Create Case
            </Button>
          )}
          {allowedTransitions.length > 0 && (
            <span className="mr-1.5 text-xs text-muted-foreground">
              Move to
            </span>
          )}
          {allowedTransitions.map((status: string) => (
            <Button
              key={status}
              size="sm"
              className="font-medium border hover:opacity-90"
              style={getIntakeStatusStyle(status as IntakeStatus)}
              onClick={() => handleStatusClick(status as IntakeStatus)}
              disabled={statusMutation.isPending}
            >
              {status}
            </Button>
          ))}
          <Button variant="outline" size="icon" className="size-8" onClick={handlePrint} title="Print">
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
          </Button>
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

      <AlertDialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) { setPendingStatus(null); setCommentDraft("") } }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Add a note</AlertDialogTitle>
            <div className="flex items-center justify-center gap-2 py-1">
              <StatusBadge status={intake.status} />
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
              {pendingStatus && <StatusBadge status={pendingStatus} />}
            </div>
            <AlertDialogDescription>
              Leave a note about why you're moving this intake. This helps the team stay in the loop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={pendingStatus ? getCommentPlaceholder(intake.status, pendingStatus) : "Add a note..."}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            className="min-h-[80px] text-sm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const status = pendingStatus
                setPendingStatus(null)
                setCommentDraft("")
                if (status) statusMutation.mutate(status)
              }}
            >
              Skip
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!commentDraft.trim() || commentMutation.isPending}
              onClick={() => {
                const status = pendingStatus
                const note = commentDraft.trim()
                setPendingStatus(null)
                setCommentDraft("")
                if (note) commentMutation.mutate(note)
                if (status) statusMutation.mutate(status)
              }}
            >
              Submit
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
