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
    toolNames: ["manage_case"],
    queryKeys: [["cases"], ["case-counts"]],
    toastMessage: "Case created via AI",
  },
]

export function CaseChatDialog({ open, onOpenChange }: CaseChatDialogProps) {
  return (
    <AiChatSheet
      open={open}
      onOpenChange={onOpenChange}
      title="AI Case Creation"
      description="Describe the case details and Claude will create it for you. You can provide case name, status, parties, date of injury, and more."
      placeholder="Describe the case to create..."
      emptyStateText='Describe the new case — e.g. "Create a case for Smith v. Jones, auto accident on 2025-12-15, pre-filing status" — and Claude will set it up.'
      mode="full"
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

function CaseToolIndicator({ tool }: { tool: ToolActivity }) {
  const label =
    tool.name === "manage_case" ? "case" : tool.name.replace(/_/g, " ")
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
