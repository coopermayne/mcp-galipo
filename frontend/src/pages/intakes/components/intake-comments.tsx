import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { IntakeComment } from "@/types/intake"
import {
  getIntakeComments,
  createIntakeComment,
  markIntakeRead,
} from "@/services/intakes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function CommentBubble({ comment }: { comment: IntakeComment }) {
  if (comment.is_system) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-muted-foreground text-xs italic">
          {comment.content}
          <span className="ml-2 opacity-60">{formatTime(comment.created_at)}</span>
        </span>
      </div>
    )
  }

  const initials = comment.user_initials || "?"
  const name = [comment.user_first_name, comment.user_last_name]
    .filter(Boolean)
    .join(" ") || "Unknown"

  return (
    <div className="flex gap-2 py-1.5">
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{name}</span>
          <span className="text-muted-foreground text-[10px]">
            {formatTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.content}</p>
      </div>
    </div>
  )
}

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

  return (
    <div className="flex flex-col border">
      <div className="border-b p-3">
        <h3 className="text-sm font-semibold">Comments</h3>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto p-3",
          "max-h-[400px] min-h-[200px]"
        )}
      >
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.comments.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No comments yet.
          </p>
        ) : (
          data?.comments.map((comment) => (
            <CommentBubble key={comment.id} comment={comment} />
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment..."
          className="border-input bg-transparent placeholder:text-muted-foreground flex-1 border px-2.5 py-1.5 text-sm outline-none focus:border-ring"
          disabled={addComment.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || addComment.isPending}
        >
          Send
        </Button>
      </form>
    </div>
  )
}
