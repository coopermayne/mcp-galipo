import { useMemo } from "react"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import type { ToolActivity } from "@/hooks/use-chat-stream"
import type { Intake } from "@/types/intake"

interface CaseChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, auto-generates an initial message from intake data */
  intakeData?: Intake | null
}

const TOOL_RULES: ToolCompletionRule[] = [
  {
    toolNames: ["manage_case", "manage_case_staff"],
    queryKeys: [["cases"], ["case-counts"]],
    toastMessage: "Case updated via AI",
  },
  {
    toolNames: ["manage_person", "manage_case_role", "merge_persons"],
    queryKeys: [["cases"], ["persons"]],
    toastMessage: "Person updated via AI",
  },
  {
    toolNames: ["manage_proceeding", "manage_judge"],
    queryKeys: [["cases"], ["judges"]],
    toastMessage: "Proceeding updated via AI",
  },
  {
    toolNames: ["manage_task"],
    queryKeys: [["tasks"]],
    toastMessage: "Task created via AI",
  },
  {
    toolNames: ["manage_event"],
    queryKeys: [["events"]],
    toastMessage: "Event created via AI",
  },
  {
    toolNames: ["manage_note"],
    queryKeys: [["notes"]],
    toastMessage: "Note created via AI",
  },
]

function buildIntakeMessage(intake: Intake): string {
  const lines: string[] = [
    `Create a new case from the following intake (intake_id: ${intake.id}):`,
    "",
  ]

  if (intake.name) lines.push(`**Client/Contact:** ${intake.name}`)
  if (intake.email) lines.push(`**Email:** ${intake.email}`)
  if (intake.phone) lines.push(`**Phone:** ${intake.phone}`)
  if (intake.contact_relationship) lines.push(`**Contact Relationship:** ${intake.contact_relationship}`)
  if (intake.case_type) lines.push(`**Case Type:** ${intake.case_type}`)
  if (intake.incident_date) lines.push(`**Date of Incident:** ${intake.incident_date}`)
  if (intake.incident_time) lines.push(`**Time of Incident:** ${intake.incident_time}`)
  if (intake.location) lines.push(`**Location:** ${intake.location}`)
  if (intake.incident_description) lines.push(`**Incident Description:** ${intake.incident_description}`)
  if (intake.injury_description) lines.push(`**Injury Description:** ${intake.injury_description}`)
  if (intake.referral_name || intake.referral_org) {
    const referral = [intake.referral_name, intake.referral_org].filter(Boolean).join(" / ")
    lines.push(`**Referral:** ${referral}`)
  }
  if (intake.notes) lines.push(`**Notes:** ${intake.notes}`)
  if (intake.ai_summary) lines.push(`**AI Summary:** ${intake.ai_summary}`)

  lines.push("")
  lines.push("Please create the case with the appropriate case name, short name, status, date of injury, claim deadline, and add the client as a person. Set intake_id to " + intake.id + " when creating the case.")

  return lines.join("\n")
}

export function CaseChatDialog({ open, onOpenChange, intakeData }: CaseChatDialogProps) {
  const initialMessage = useMemo(
    () => intakeData ? buildIntakeMessage(intakeData) : undefined,
    [intakeData]
  )

  return (
    <AiChatSheet
      open={open}
      onOpenChange={onOpenChange}
      title={intakeData ? "Create Case from Intake" : "AI Case Setup"}
      description={
        intakeData
          ? `Creating a case from intake: ${intakeData.name || "Unnamed"}. Claude will set up the case with the intake data.`
          : "Paste a case file, complaint, or case details. Claude (Opus) will create the case, add all parties, proceedings, deadlines, and tasks."
      }
      placeholder="Paste case file, complaint, or describe the case to set up..."
      emptyStateText="Paste the full case file or describe the case in detail. Claude will extract everything — parties, proceedings, judges, deadlines, tasks — and set up the entire case."
      mode="case_setup"
      toolCompletionRules={TOOL_RULES}
      renderToolIndicator={(tool) => <CaseToolIndicator tool={tool} />}
      initialMessage={initialMessage}
    />
  )
}

function parseCaseId(result?: string): number | null {
  if (!result) return null
  try {
    const parsed = JSON.parse(result)
    return parsed?.case_id ?? parsed?.id ?? null
  } catch {
    return null
  }
}

const TOOL_LABELS: Record<string, string> = {
  manage_case: "case",
  manage_person: "person",
  manage_case_role: "role assignment",
  merge_persons: "person merge",
  manage_proceeding: "proceeding",
  manage_judge: "judge",
  manage_case_staff: "staff assignment",
  manage_task: "task",
  manage_event: "event",
  manage_note: "note",
}

function CaseToolIndicator({ tool }: { tool: ToolActivity }) {
  const label = TOOL_LABELS[tool.name] ?? tool.name.replace(/_/g, " ")
  const caseId = useMemo(() => parseCaseId(tool.result), [tool.result])

  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      {tool.status === "running" ? (
        <>
          <HugeiconsIcon
            icon={Loading03Icon}
            className="size-3 animate-spin"
          />
          <span>Creating {label}...</span>
        </>
      ) : tool.isError ? (
        <span className="text-destructive">Failed to create {label}</span>
      ) : (
        <span className="text-success inline-flex items-center gap-1.5">
          Created {label}
          {caseId && (
            <Link
              to={`/cases/${caseId}`}
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-success/80"
            >
              View #{caseId}
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          )}
        </span>
      )}
    </div>
  )
}
