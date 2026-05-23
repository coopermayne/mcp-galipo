import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AiMarkdown } from "@/components/common/ai-markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useChatStream, type ChatMessage, type ToolActivity } from "@/hooks/use-chat-stream"

export interface ToolCompletionRule {
  /** Tool name(s) to watch for (e.g. "manage_task", "manage_event") */
  toolNames: string[]
  /** Query keys to invalidate when tool completes successfully */
  queryKeys: unknown[][]
  /** Toast message shown on success */
  toastMessage: string
}

interface AiChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  placeholder: string
  emptyStateText: string
  mode: string
  caseContext?: number
  intakeContext?: number
  toolCompletionRules: ToolCompletionRule[]
  /** Optional custom render for tool indicators */
  renderToolIndicator?: (tool: ToolActivity) => React.ReactNode
}

export function AiChatSheet({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  emptyStateText,
  mode,
  caseContext,
  intakeContext,
  toolCompletionRules,
  renderToolIndicator,
}: AiChatSheetProps) {
  const queryClient = useQueryClient()
  const { messages, send, isStreaming, reset } = useChatStream({ mode, caseContext, intakeContext })
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
      setTimeout(() => textareaRef.current?.focus(), 100)
    } else {
      reset()
    }
  }, [open, reset])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Detect tool completions and fire invalidation + toasts
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.toolCalls) continue
      for (const tc of msg.toolCalls) {
        if (tc.status !== "done" || tc.isError || hasNotifiedRef.current.has(tc.id)) continue
        for (const rule of toolCompletionRules) {
          if (rule.toolNames.includes(tc.name)) {
            hasNotifiedRef.current.add(tc.id)
            for (const qk of rule.queryKeys) {
              queryClient.invalidateQueries({ queryKey: qk })
            }
            toast.success(rule.toastMessage)
            break
          }
        }
      }
    }
  }, [messages, queryClient, toolCompletionRules])

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col data-[side=right]:sm:max-w-[50vw]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {/* Messages area */}
        <div className="scrollbar-hidden flex-1 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm text-center max-w-md">
                {emptyStateText}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
              renderToolIndicator={renderToolIndicator}
            />
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
            placeholder={placeholder}
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
      </SheetContent>
    </Sheet>
  )
}

function MessageBubble({
  message,
  isStreaming,
  renderToolIndicator,
}: {
  message: ChatMessage
  isStreaming?: boolean
  renderToolIndicator?: (tool: ToolActivity) => React.ReactNode
}) {
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
        {message.toolCalls?.map((tc) =>
          renderToolIndicator ? (
            <div key={tc.id}>{renderToolIndicator(tc)}</div>
          ) : (
            <ToolIndicator key={tc.id} tool={tc} />
          )
        )}

        {/* Message text */}
        {message.content && (
          isUser ? (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <AiMarkdown isStreaming={isStreaming}>{message.content}</AiMarkdown>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function ToolIndicator({ tool }: { tool: ToolActivity }) {
  // Derive a human-readable label from tool name: manage_task → "task", manage_event → "event"
  const label = tool.name.startsWith("manage_")
    ? tool.name.replace("manage_", "")
    : tool.name.replace(/_/g, " ")

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
