import { useMemo } from "react"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import type { ToolActivity } from "@/hooks/use-chat-stream"

interface CaseChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function CaseChatDialog({ open, onOpenChange }: CaseChatDialogProps) {
  return (
    <AiChatSheet
      open={open}
      onOpenChange={onOpenChange}
      title="AI Case Setup"
      description="Paste a case file, complaint, or case details. Claude (Opus) will create the case, add all parties, proceedings, deadlines, and tasks."
      placeholder="Paste case file, complaint, or describe the case to set up..."
      emptyStateText="Paste the full case file or describe the case in detail. Claude will extract everything — parties, proceedings, judges, deadlines, tasks — and set up the entire case."
      mode="case_setup"
      toolCompletionRules={TOOL_RULES}
      renderToolIndicator={(tool) => <CaseToolIndicator tool={tool} />}
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
