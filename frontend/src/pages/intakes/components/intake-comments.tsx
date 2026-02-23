import { useState, useRef, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowTurnForwardIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import type { IntakeComment } from "@/types/intake"
import type { IntakeStatus } from "@/types/intake"
import {
  getIntakeComments,
  createIntakeComment,
  markIntakeRead,
} from "@/services/intakes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "./status-badge"
import { cn } from "@/lib/utils"

// --- Helpers ---

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = today.getTime() - target.getTime()
  const oneDay = 86400000

  if (diff < oneDay) return "Today"
  if (diff < oneDay * 2) return "Yesterday"
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

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
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
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

function TimelineEntry({ comment }: { comment: IntakeComment }) {
  if (comment.is_system) {
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
}

export function IntakeComments({ intakeId }: IntakeCommentsProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["intake-comments", intakeId],
    queryFn: () => getIntakeComments(intakeId),
  })

  // Mark as read on mount
  useEffect(() => {
    markIntakeRead(intakeId).catch(() => {})
  }, [intakeId])

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
      <div className="shrink-0 border-b p-3">
        <h3 className="text-sm font-semibold">Activity</h3>
      </div>

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
