import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Markdown from "react-markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon, Loading03Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useChatStream, type ChatMessage, type ToolActivity } from "@/hooks/use-chat-stream"

interface IntakeChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IntakeChatDialog({ open, onOpenChange }: IntakeChatDialogProps) {
  const queryClient = useQueryClient()
  const { messages, send, isStreaming, reset } = useChatStream({ mode: "intakes" })
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasNotifiedRef = useRef<Set<string>>(new Set())

  // Reset on open/close
  useEffect(() => {
    if (open) {
      reset()
      setInput("")
      hasNotifiedRef.current = new Set()
      // Focus textarea after dialog animation
      setTimeout(() => textareaRef.current?.focus(), 100)
    } else {
      reset()
    }
  }, [open, reset])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Detect intake creation via tool_result for manage_intake
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.toolCalls) continue
      for (const tc of msg.toolCalls) {
        if (
          tc.name === "manage_intake" &&
          tc.status === "done" &&
          !tc.isError &&
          !hasNotifiedRef.current.has(tc.id)
        ) {
          hasNotifiedRef.current.add(tc.id)
          queryClient.invalidateQueries({ queryKey: ["intakes"] })
          queryClient.invalidateQueries({ queryKey: ["intake-counts"] })
          toast.success("Intake created via AI")
        }
      }
    }
  }, [messages, queryClient])

  function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    send(text)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Intake</DialogTitle>
          <DialogDescription>
            Paste an email, voicemail transcript, or notes. Claude will parse it
            and create the intake.
          </DialogDescription>
        </DialogHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[55vh] pr-1">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Paste an email, voicemail transcript, or notes and Claude will
                extract the intake details. You can have a conversation to
                clarify or add more info.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" &&
            !messages[messages.length - 1].content &&
            !(messages[messages.length - 1].toolCalls?.length) && (
              <div className="flex justify-start">
                <div className="bg-muted px-3 py-2 text-sm">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex items-end gap-2 border-t pt-3">
          <Textarea
            ref={textareaRef}
            placeholder="Paste text or type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="min-h-[60px] resize-none"
          />
          <Button
            size="icon"
            className="shrink-0"
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
          >
            <HugeiconsIcon icon={SentIcon} className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {/* Tool activity indicators */}
        {message.toolCalls?.map((tc) => (
          <ToolIndicator key={tc.id} tool={tc} />
        ))}

        {/* Message text */}
        {message.content && (
          isUser ? (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <Markdown>{message.content}</Markdown>
            </div>
          )
        )}
      </div>
    </div>
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

function ToolIndicator({ tool }: { tool: ToolActivity }) {
  const label =
    tool.name === "manage_intake" ? "intake" : tool.name.replace(/_/g, " ")
  const intakeId = parseIntakeId(tool.result)

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
