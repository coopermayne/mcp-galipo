import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import type { ToolActivity } from "@/hooks/use-chat-stream"

interface TaskChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TOOL_RULES: ToolCompletionRule[] = [
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
]

export function TaskChatDialog({ open, onOpenChange }: TaskChatDialogProps) {
  return (
    <AiChatSheet
      open={open}
      onOpenChange={onOpenChange}
      title="AI Task Creation"
      description="Describe the tasks you need. Claude will create them on the right cases with due dates and priorities."
      placeholder="e.g. File MSJ on Smith case by Friday, follow up with Dr. Jones next week..."
      emptyStateText="Describe one or more tasks and Claude will create them. Include case names, due dates, and priorities if you have them."
      mode="tasks"
      toolCompletionRules={TOOL_RULES}
      renderToolIndicator={(tool) => <TaskToolIndicator tool={tool} />}
    />
  )
}

function TaskToolIndicator({ tool }: { tool: ToolActivity }) {
  const label = tool.name === "manage_task" ? "task" : tool.name.replace(/_/g, " ")

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
        <span className="text-success">Created {label}</span>
      )}
    </div>
  )
}
