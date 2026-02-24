import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Markdown from "react-markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon, Loading03Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
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

interface CaseChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CaseChatDialog({ open, onOpenChange }: CaseChatDialogProps) {
  const queryClient = useQueryClient()
  const { messages, send, isStreaming, reset } = useChatStream({ mode: "full" })
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

  // Detect case creation via tool_result for manage_case
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.toolCalls) continue
      for (const tc of msg.toolCalls) {
        if (
          tc.name === "manage_case" &&
          tc.status === "done" &&
          !tc.isError &&
          !hasNotifiedRef.current.has(tc.id)
        ) {
          hasNotifiedRef.current.add(tc.id)
          queryClient.invalidateQueries({ queryKey: ["cases"] })
          queryClient.invalidateQueries({ queryKey: ["case-counts"] })
          toast.success("Case created via AI")
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col data-[side=right]:sm:max-w-[50vw]">
        <SheetHeader>
          <SheetTitle>AI Case Creation</SheetTitle>
          <SheetDescription>
            Describe the case details and Claude will create it for you. You can
            provide case name, status, parties, date of injury, and more.
          </SheetDescription>
        </SheetHeader>

        {/* Messages area */}
        <div className="scrollbar-hidden flex-1 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Describe the new case — e.g. &ldquo;Create a case for Smith v.
                Jones, auto accident on 2025-12-15, pre-filing status&rdquo; —
                and Claude will set it up.
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
            placeholder="Describe the case to create..."
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

function parseCaseId(result?: string): number | null {
  if (!result) return null
  try {
    const parsed = JSON.parse(result)
    return parsed?.case_id ?? parsed?.id ?? null
  } catch {
    return null
  }
}

function ToolIndicator({ tool }: { tool: ToolActivity }) {
  const label =
    tool.name === "manage_case" ? "case" : tool.name.replace(/_/g, " ")
  const caseId = parseCaseId(tool.result)

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
          {caseId && (
            <Link
              to={`/cases/${caseId}`}
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-green-700"
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
