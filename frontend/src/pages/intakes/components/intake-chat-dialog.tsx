import { useMemo } from "react"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import type { ToolActivity } from "@/hooks/use-chat-stream"

interface IntakeChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TOOL_RULES: ToolCompletionRule[] = [
  {
    toolNames: ["manage_intake"],
    queryKeys: [["intakes"], ["intake-counts"]],
    toastMessage: "Intake created via AI",
  },
]

export function IntakeChatDialog({ open, onOpenChange }: IntakeChatDialogProps) {
  return (
    <AiChatSheet
      open={open}
      onOpenChange={onOpenChange}
      title="AI Intake"
      description="Paste an email, voicemail transcript, or notes. Claude will parse it and create the intake."
      placeholder="Paste text or type a message..."
      emptyStateText="Paste an email, voicemail transcript, or notes and Claude will extract the intake details. You can have a conversation to clarify or add more info."
      mode="intakes"
      toolCompletionRules={TOOL_RULES}
      renderToolIndicator={(tool) => <IntakeToolIndicator tool={tool} />}
    />
  )
}

function parseIntakeId(result?: string): number | null {
  if (!result) return null
  try {
    const parsed = JSON.parse(result)
    return parsed?.intake_id ?? null
  } catch {
    return null
  }
}

function IntakeToolIndicator({ tool }: { tool: ToolActivity }) {
  const label =
    tool.name === "manage_intake" ? "intake" : tool.name.replace(/_/g, " ")
  const intakeId = useMemo(() => parseIntakeId(tool.result), [tool.result])

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
        <span className="text-green-600 inline-flex items-center gap-1.5">
          Created {label}
          {intakeId && (
            <Link
              to={`/intakes/${intakeId}`}
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-green-700"
            >
              View #{intakeId}
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          )}
        </span>
      )}
    </div>
  )
}
