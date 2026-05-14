import { useState, useRef, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon, SentIcon, Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useChatStream } from "@/hooks/use-chat-stream"

const TOOL_INVALIDATION: Record<string, string[][]> = {
  manage_event: [["trial-calendar"], ["events"]],
  manage_case: [["trial-calendar"], ["cases"]],
}

export function AiCommandInput() {
  const queryClient = useQueryClient()
  const { messages, send, isStreaming, reset } = useChatStream({ mode: "trial_calendar" })
  const [input, setInput] = useState("")
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    } else {
      reset()
      setInput("")
      notifiedRef.current = new Set()
    }
  }, [expanded, reset])

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.toolCalls) continue
      for (const tc of msg.toolCalls) {
        if (tc.status !== "done" || tc.isError) continue
        if (notifiedRef.current.has(tc.id)) continue
        notifiedRef.current.add(tc.id)
        const keys = TOOL_INVALIDATION[tc.name]
        if (keys) {
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: key })
          }
        }
      }
    }
  }, [messages, queryClient])

  const lastAssistant = messages.filter((m) => m.role === "assistant").at(-1)
  const responseText = lastAssistant?.content ?? ""
  const hasToolsRunning = lastAssistant?.toolCalls?.some((tc) => tc.status === "running")

  function handleSubmit() {
    const text = input.trim()
    if (!text || isStreaming) return
    notifiedRef.current = new Set()
    send(text)
    setInput("")
  }

  function handleClose() {
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        className="gap-1.5"
      >
        <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
        AI
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-xl">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={SparklesIcon}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit()
              if (e.key === "Escape") handleClose()
            }}
            placeholder='e.g., "add vacation Dec 20-31" or "move Smith trial to March 15"'
            className="w-full h-8 pl-8 pr-8 text-sm bg-background border border-input focus:ring-1 focus:ring-ring focus:outline-none placeholder:text-muted-foreground/60"
            disabled={isStreaming}
          />
          {input && !isStreaming && (
            <button
              type="button"
              onClick={handleSubmit}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={SentIcon} className="size-3.5" />
            </button>
          )}
          {isStreaming && (
            <HugeiconsIcon
              icon={Loading03Icon}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin"
            />
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
      {(responseText || hasToolsRunning) && (
        <div
          className={cn(
            "text-xs px-2.5 py-1.5 bg-muted/50 border border-border",
            isStreaming && "animate-pulse",
          )}
        >
          {hasToolsRunning && !responseText && (
            <span className="text-muted-foreground">Working...</span>
          )}
          {responseText && (
            <span className="text-foreground">{responseText}</span>
          )}
        </div>
      )}
    </div>
  )
}
