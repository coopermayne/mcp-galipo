import { useState, useRef, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import type { Comment } from "@/services/comments"
import {
  getComments,
  createComment,
  markRead,
} from "@/services/comments"
import { formatTime, formatDateHeader, getDateKey } from "@/lib/datetime"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

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

function SystemMessageEntry({ comment }: { comment: Comment }) {
  return (
    <div className="relative flex gap-3 py-2">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon
          icon={InformationCircleIcon}
          className="size-3 text-muted-foreground"
        />
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-xs text-muted-foreground">{comment.content}</p>
        <span className="text-[10px] text-muted-foreground/60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function UserCommentEntry({ comment }: { comment: Comment }) {
  const style = comment.user_id ? getAvatarStyleById(comment.user_id) : {}
  return (
    <div className="relative flex gap-3 py-2">
      <Avatar className="relative z-10 size-6 shrink-0 text-[10px]" style={style}>
        <AvatarFallback style={style}>
          {comment.user_initials ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 pt-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">
            {comment.user_first_name} {comment.user_last_name}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {formatTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-xs whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  )
}

function TimelineEntry({ comment }: { comment: Comment }) {
  if (comment.is_system) return <SystemMessageEntry comment={comment} />
  return <UserCommentEntry comment={comment} />
}

interface ActivityFeedProps {
  entityType: string
  entityId: number
  className?: string
}

export function ActivityFeed({
  entityType,
  entityId,
  className,
}: ActivityFeedProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => getComments(entityType, entityId),
  })

  useEffect(() => {
    markRead(entityType, entityId)
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ["comment-unread-counts"],
        })
      })
      .catch(() => {})
  }, [entityType, entityId, queryClient])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data?.comments])

  const addComment = useMutation({
    mutationFn: (content: string) =>
      createComment(entityType, entityId, content),
    onSuccess: () => {
      setInput("")
      queryClient.invalidateQueries({
        queryKey: ["comments", entityType, entityId],
      })
      markRead(entityType, entityId).catch(() => {})
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
    <div className={className}>
      <div
        ref={scrollRef}
        className="max-h-48 min-h-0 overflow-y-auto"
      >
        {isLoading ? (
          <div className="flex flex-col gap-3 p-1">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : data?.comments.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
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

      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-3 mt-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          className="min-h-9 flex-1 resize-none text-xs"
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
