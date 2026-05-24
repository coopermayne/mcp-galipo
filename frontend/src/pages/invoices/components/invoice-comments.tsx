import { useState, useRef, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowTurnForwardIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import {
  getComments,
  createComment,
  markRead,
  type Comment,
} from "@/services/comments"
import type { InvoiceStage } from "@/services/invoices"
import { formatTime, formatDateHeader, getDateKey } from "@/lib/datetime"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceStageBadge } from "./invoice-stage-badge"

const STAGE_CHANGE_RE = /^(.+?) changed stage from (.+?) to (.+)$/

function parseStageChange(content: string) {
  const m = content.match(STAGE_CHANGE_RE)
  if (!m) return null
  return { name: m[1], from: m[2] as InvoiceStage, to: m[3] as InvoiceStage }
}

function StageChangeEntry({ comment }: { comment: Comment }) {
  const parsed = parseStageChange(comment.content)
  if (!parsed) return <SystemMessageEntry comment={comment} />

  return (
    <div className="relative flex gap-3 py-2">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon
          icon={ArrowTurnForwardIcon}
          className="size-3 text-muted-foreground"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{parsed.name}</span>
        <InvoiceStageBadge stage={parsed.from} className="text-[10px] px-1.5 py-0" />
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        <InvoiceStageBadge stage={parsed.to} className="text-[10px] px-1.5 py-0" />
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function SystemMessageEntry({ comment }: { comment: Comment }) {
  return (
    <div className="relative flex gap-3 py-2">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon
          icon={InformationCircleIcon}
          className="size-3 text-muted-foreground"
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span>{comment.content}</span>
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function UserCommentEntry({ comment }: { comment: Comment }) {
  const initials = comment.user_initials || "?"
  const name =
    [comment.user_first_name, comment.user_last_name]
      .filter(Boolean)
      .join(" ") || "Unknown"

  return (
    <div className="relative flex gap-3 py-2">
      <Avatar size="sm" className="relative z-10 shrink-0">
        <AvatarFallback className="text-[10px]" style={getAvatarStyleById(comment.user_id ?? 0)}>
          {initials}
        </AvatarFallback>
      </Avatar>
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

function TimelineEntry({ comment }: { comment: Comment }) {
  if (comment.is_system) {
    if (parseStageChange(comment.content)) return <StageChangeEntry comment={comment} />
    return <SystemMessageEntry comment={comment} />
  }
  return <UserCommentEntry comment={comment} />
}

interface DateGroup {
  dateKey: string
  label: string
  comments: Comment[]
}

function groupByDate(comments: Comment[]): DateGroup[] {
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

export function InvoiceComments({ invoiceId }: { invoiceId: number }) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["comments", "invoice", invoiceId],
    queryFn: () => getComments("invoice", invoiceId),
  })

  // Mark read on open so the user's unread badge clears on the list page.
  useEffect(() => {
    markRead("invoice", invoiceId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["invoice-unread-counts"] })
      })
      .catch(() => {})
  }, [invoiceId, queryClient])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data?.comments])

  const addComment = useMutation({
    mutationFn: (content: string) => createComment("invoice", invoiceId, content),
    onSuccess: () => {
      setInput("")
      queryClient.invalidateQueries({ queryKey: ["comments", "invoice", invoiceId] })
      markRead("invoice", invoiceId).catch(() => {})
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

  const groups = useMemo(() => groupByDate(data?.comments ?? []), [data?.comments])

  return (
    <div className="flex h-full min-h-0 flex-col border">
      <div className="flex shrink-0 items-center border-b p-3">
        <h3 className="text-sm font-semibold">Activity</h3>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
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
            No activity yet.
          </p>
        ) : (
          <div className="relative">
            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
            {groups.map((group) => (
              <div key={group.dateKey}>
                <div className="relative z-10 mb-1 mt-3 first:mt-0">
                  <span className="bg-background pr-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                </div>
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
