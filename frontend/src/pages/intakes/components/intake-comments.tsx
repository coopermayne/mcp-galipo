import { useState, useRef, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowTurnForwardIcon,
  InformationCircleIcon,
  SparklesIcon,
  GlobeIcon,
  GridTableIcon,
  AiBrainIcon,
  Mail01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons"
import type { IntakeComment } from "@/types/intake"
import type { IntakeStatus } from "@/types/intake"
import {
  getIntakeComments,
  createIntakeComment,
  markIntakeRead,
} from "@/services/intakes"
import { formatTime, formatDateHeader, getDateKey } from "@/lib/datetime"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "./status-badge"
import { AddInteractionDialog } from "./add-interaction-dialog"
import { cn } from "@/lib/utils"

// --- Helpers ---

// Parse "Name changed status from Old to New"
const STATUS_CHANGE_RE = /^(.+?) changed status from (.+?) to (.+)$/

function parseStatusChange(content: string) {
  const m = content.match(STATUS_CHANGE_RE)
  if (!m) return null
  return { name: m[1], from: m[2] as IntakeStatus, to: m[3] as IntakeStatus }
}

// --- Entry Components ---

function StatusChangeEntry({ comment }: { comment: IntakeComment }) {
  const parsed = parseStatusChange(comment.content)
  if (!parsed) return <SystemMessageEntry comment={comment} />

  return (
    <div className="relative flex gap-3 py-2">
      {/* Icon */}
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon
          icon={ArrowTurnForwardIcon}
          className="size-3 text-muted-foreground"
        />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{parsed.name}</span>
        <StatusBadge status={parsed.from} className="text-[10px] px-1.5 py-0" />
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        <StatusBadge status={parsed.to} className="text-[10px] px-1.5 py-0" />
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function SystemMessageEntry({ comment }: { comment: IntakeComment }) {
  return (
    <div className="relative flex gap-3 py-2">
      {/* Icon */}
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon
          icon={InformationCircleIcon}
          className="size-3 text-muted-foreground"
        />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span>{comment.content}</span>
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function UserCommentEntry({ comment }: { comment: IntakeComment }) {
  const initials = comment.user_initials || "?"
  const name =
    [comment.user_first_name, comment.user_last_name]
      .filter(Boolean)
      .join(" ") || "Unknown"

  return (
    <div className="relative flex gap-3 py-2">
      {/* Avatar */}
      <Avatar size="sm" className="relative z-10 shrink-0">
        <AvatarFallback className="text-[10px]" style={getAvatarStyleById(comment.user_id)}>{initials}</AvatarFallback>
      </Avatar>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(comment.created_at)}
          </span>
        </div>
        <div className="mt-1 bg-muted px-3 py-2">
          <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
        </div>
      </div>
    </div>
  )
}

// --- Detail Dialog ---

function DetailDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: Record<string, unknown>
}) {
  if (detail.type === "chat_transcript") {
    const messages = (detail.messages ?? []) as Array<{
      role: string
      content: string
    }>
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chat Transcript</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary/10 ml-6"
                    : "bg-muted mr-6"
                )}
              >
                <span className="mb-1 block text-[10px] font-medium uppercase text-muted-foreground">
                  {msg.role === "user" ? "You" : "Assistant"}
                </span>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (detail.type === "ai_analysis") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI Analysis Details</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Rating:</span>
              <span className="text-sm">{String(detail.rating)}/5</span>
            </div>
            <div>
              <span className="text-sm font-medium">Reasoning:</span>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {String(detail.reasoning ?? "")}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (detail.type === "interaction") {
    const typeLabel = detail.interaction_type === "phone" ? "Phone Call" : "Email"
    const dirLabel = detail.direction ? ` (${detail.direction})` : ""
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{typeLabel}{dirLabel} — Full Content</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <p className="whitespace-pre-wrap text-sm">
              {String(detail.full_content ?? "")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}

// --- Creation & Analysis Entries ---

const CREATION_RE = /^Intake (created via|imported from)/

function CreationEntry({ comment }: { comment: IntakeComment }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const isAiChat = comment.content.includes("AI chat")
  const isSheets = comment.content.includes("Google Sheets")

  const icon = isAiChat
    ? SparklesIcon
    : isSheets
      ? GridTableIcon
      : GlobeIcon

  return (
    <>
      <div className="relative flex gap-3 py-2">
        <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon icon={icon} className="size-3 text-muted-foreground" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span>{comment.content}</span>
          {comment.detail?.type === "chat_transcript" && (
            <button
              onClick={() => setDialogOpen(true)}
              className="shrink-0 text-[10px] font-medium text-primary hover:underline"
            >
              View conversation
            </button>
          )}
          <span className="ml-auto shrink-0 opacity-60">
            {formatTime(comment.created_at)}
          </span>
        </div>
      </div>
      {comment.detail && (
        <DetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          detail={comment.detail}
        />
      )}
    </>
  )
}

const ANALYSIS_RE = /^AI analysis (completed|regenerated)/

function AnalysisEntry({ comment }: { comment: IntakeComment }) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <div className="relative flex gap-3 py-2">
        <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon
            icon={AiBrainIcon}
            className="size-3 text-muted-foreground"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span>{comment.content}</span>
          {comment.detail?.type === "ai_analysis" && (
            <button
              onClick={() => setDialogOpen(true)}
              className="shrink-0 text-[10px] font-medium text-primary hover:underline"
            >
              View details
            </button>
          )}
          <span className="ml-auto shrink-0 opacity-60">
            {formatTime(comment.created_at)}
          </span>
        </div>
      </div>
      {comment.detail && (
        <DetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          detail={comment.detail}
        />
      )}
    </>
  )
}

function InteractionEntry({ comment }: { comment: IntakeComment }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const detail = comment.detail as Record<string, unknown>
  const isPhone = detail?.interaction_type === "phone"
  const icon = isPhone ? SmartPhone01Icon : Mail01Icon

  return (
    <>
      <div className="relative flex gap-3 py-2">
        <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon icon={icon} className="size-3 text-muted-foreground" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span>{comment.content}</span>
          <button
            onClick={() => setDialogOpen(true)}
            className="shrink-0 text-[10px] font-medium text-primary hover:underline"
          >
            View full content
          </button>
          <span className="ml-auto shrink-0 opacity-60">
            {formatTime(comment.created_at)}
          </span>
        </div>
      </div>
      {detail && (
        <DetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          detail={detail}
        />
      )}
    </>
  )
}

function TimelineEntry({ comment }: { comment: IntakeComment }) {
  if (comment.is_system) {
    if (comment.detail?.type === "interaction") return <InteractionEntry comment={comment} />
    if (CREATION_RE.test(comment.content)) return <CreationEntry comment={comment} />
    if (ANALYSIS_RE.test(comment.content)) return <AnalysisEntry comment={comment} />
    const parsed = parseStatusChange(comment.content)
    if (parsed) return <StatusChangeEntry comment={comment} />
    return <SystemMessageEntry comment={comment} />
  }
  return <UserCommentEntry comment={comment} />
}

// --- Date Grouping ---

interface DateGroup {
  dateKey: string
  label: string
  comments: IntakeComment[]
}

function groupByDate(comments: IntakeComment[]): DateGroup[] {
  const groups: DateGroup[] = []
  let currentKey = ""

  for (const comment of comments) {
    const key = getDateKey(comment.created_at)
    if (key !== currentKey) {
      currentKey = key
      groups.push({
        dateKey: key,
        label: formatDateHeader(comment.created_at),
        comments: [comment],
      })
    } else {
      groups[groups.length - 1].comments.push(comment)
    }
  }

  return groups
}

// --- Main Component ---

interface IntakeCommentsProps {
  intakeId: number
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function IntakeComments({ intakeId, textareaRef }: IntakeCommentsProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const [interactionOpen, setInteractionOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["intake-comments", intakeId],
    queryFn: () => getIntakeComments(intakeId),
  })

  // Mark as read on mount and invalidate unread counts so list page updates
  useEffect(() => {
    markIntakeRead(intakeId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-counts"] })
      })
      .catch(() => {})
  }, [intakeId, queryClient])

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data?.comments])

  const addComment = useMutation({
    mutationFn: (content: string) => createIntakeComment(intakeId, content),
    onSuccess: () => {
      setInput("")
      queryClient.invalidateQueries({ queryKey: ["intake-comments", intakeId] })
      queryClient.invalidateQueries({ queryKey: ["intake", intakeId] })
      markIntakeRead(intakeId).catch(() => {})
    },
    onError: () => {
      toast.error("Failed to add comment")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    addComment.mutate(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const groups = useMemo(
    () => groupByDate(data?.comments ?? []),
    [data?.comments]
  )

  return (
    <div className="flex h-full flex-col border">
      <div className="flex shrink-0 items-center justify-between border-b p-3">
        <h3 className="text-sm font-semibold">Activity</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setInteractionOpen(true)}
        >
          <HugeiconsIcon icon={SparklesIcon} className="size-3 mr-1" />
          Log Interaction
        </Button>
      </div>
      <AddInteractionDialog
        intakeId={intakeId}
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
      />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.comments.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No comments yet.
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

            {groups.map((group) => (
              <div key={group.dateKey}>
                {/* Date header */}
                <div className="relative z-10 mb-1 mt-3 first:mt-0">
                  <span className="bg-background pr-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                {/* Entries */}
                {group.comments.map((comment) => (
                  <TimelineEntry key={comment.id} comment={comment} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          className="min-h-9 flex-1 resize-none"
          disabled={addComment.isPending}
        />
        <Button
          type="submit"
          size="sm"
          className="self-end"
          disabled={!input.trim() || addComment.isPending}
        >
          Send
        </Button>
      </form>
    </div>
  )
}
