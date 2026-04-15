import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ToolCall {
  name: string
  input: Record<string, unknown>
  result_preview: string
}

interface StreamEvent {
  type: "iteration" | "api_call" | "tool_call" | "tool_result" | "done" | "error"
  [key: string]: unknown
}

interface Message {
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCall[]
  totalMs?: number
  events?: StreamEvent[]
}

export default function PtcPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [liveEvents, setLiveEvents] = useState<StreamEvent[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Accumulate events in a ref so we can snapshot them into the message
  const eventsRef = useRef<StreamEvent[]>([])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, liveEvents, scrollToBottom])

  const handleSubmit = async () => {
    const query = input.trim()
    if (!query || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: query }])
    setLiveEvents([])
    eventsRef.current = []
    setLoading(true)

    try {
      const token = localStorage.getItem("token")
      const body: Record<string, unknown> = { query }
      if (containerId) body.container_id = containerId

      const res = await fetch("/api/v1/ptc/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.message || `Request failed (${res.status})`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6)
          let event: StreamEvent
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          eventsRef.current = [...eventsRef.current, event]
          setLiveEvents([...eventsRef.current])

          if (event.type === "done") {
            const savedEvents = eventsRef.current.filter((e) => e.type !== "done")
            setContainerId((event.container_id as string) || null)
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: event.text as string,
                toolCalls: event.tool_calls as ToolCall[],
                totalMs: event.total_ms as number,
                events: savedEvents,
              },
            ])
            setLiveEvents([])
            eventsRef.current = []
          } else if (event.type === "error") {
            const savedEvents = eventsRef.current.filter((e) => e.type !== "error")
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Error: ${event.message}`,
                events: savedEvents,
              },
            ])
            setLiveEvents([])
            eventsRef.current = []
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ])
      setLiveEvents([])
      eventsRef.current = []
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const clearConversation = () => {
    setMessages([])
    setContainerId(null)
    setLiveEvents([])
    eventsRef.current = []
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">PTC Test Console</h1>
          {containerId && (
            <Badge variant="outline" className="font-mono text-xs">
              {containerId.slice(0, 24)}...
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={clearConversation}>
          Clear
        </Button>
      </div>

      <ScrollArea ref={scrollRef} className="min-h-0 flex-1 px-6">
        <div className="mx-auto max-w-3xl space-y-6 py-6">
          {messages.length === 0 && !loading && (
            <div className="py-20 text-center text-muted-foreground">
              <p className="text-lg font-medium">PTC Agent</p>
              <p className="mt-1 text-sm">
                Test programmatic tool calling. Claude writes Python in a sandbox to query your data.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "How many cases by status?",
                  "What are my priorities this week?",
                  "Who is on case 5?",
                  "Show all overdue tasks",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q)
                      textareaRef.current?.focus()
                    }}
                    className="border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
              {msg.role === "user" ? (
                <div className="max-w-[80%] bg-primary px-4 py-2 text-primary-foreground">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-3">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.toolCalls.map((tc, j) => (
                        <Badge key={j} variant="secondary" className="font-mono text-xs">
                          {tc.name}({Object.keys(tc.input).length > 0
                            ? Object.entries(tc.input)
                                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                                .join(", ")
                            : ""})
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-3">
                    {msg.totalMs != null && (
                      <span className="text-xs text-muted-foreground">
                        {(msg.totalMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    {msg.events && msg.events.length > 0 && (
                      <EventLog events={msg.events} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Live activity log while streaming */}
          {liveEvents.length > 0 && (
            <div className="space-y-1 border-l-2 border-blue-400/40 pl-4">
              {liveEvents.map((evt, i) => (
                <EventLine key={i} event={evt} />
              ))}
            </div>
          )}

          {loading && liveEvents.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin border-2 border-current border-t-transparent" />
              Connecting...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-6 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your cases, tasks, events..."
            className="min-h-[44px] resize-none"
            rows={1}
            disabled={loading}
          />
          <Button onClick={handleSubmit} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Collapsible event log shown after a response completes */
function EventLog({ events }: { events: StreamEvent[] }) {
  const [open, setOpen] = useState(false)

  // Summarize: count iterations and tool calls
  const iterations = events.filter((e) => e.type === "iteration").length
  const toolCalls = events.filter((e) => e.type === "tool_call").length
  const totalApiMs = events
    .filter((e) => e.type === "api_call" && e.status === "completed")
    .reduce((sum, e) => sum + ((e.duration_ms as number) || 0), 0)
  const totalTokensIn = events
    .filter((e) => e.type === "api_call" && e.status === "completed")
    .reduce((sum, e) => sum + ((e.usage as { input_tokens: number })?.input_tokens || 0), 0)
  const totalTokensOut = events
    .filter((e) => e.type === "api_call" && e.status === "completed")
    .reduce((sum, e) => sum + ((e.usage as { output_tokens: number })?.output_tokens || 0), 0)

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground"
      >
        {open ? "Hide" : "Show"} log
        <span className="ml-1.5 font-mono">
          ({iterations} iter, {toolCalls} tools, {totalApiMs}ms api, {totalTokensIn}+{totalTokensOut} tokens)
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-0.5 border-l-2 border-muted-foreground/20 pl-3">
          {events.map((evt, i) => (
            <EventLine key={i} event={evt} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventLine({ event }: { event: StreamEvent }) {
  switch (event.type) {
    case "iteration":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono text-[10px]">#{event.iteration as number}</span>
          Iteration
        </div>
      )
    case "api_call":
      if (event.status === "started") {
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 animate-spin border border-current border-t-transparent" />
            Calling Claude...
          </div>
        )
      }
      return (
        <div className="text-xs text-muted-foreground">
          API: <span className="font-mono">{event.duration_ms as number}ms</span>
          {" "}&middot;{" "}
          <span className="font-mono">
            {(event.usage as { input_tokens: number })?.input_tokens}in/{(event.usage as { output_tokens: number })?.output_tokens}out
          </span>
          {" "}&middot; stop: {event.stop_reason as string}
        </div>
      )
    case "tool_call":
      return (
        <div className="text-xs">
          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
            {event.name as string}
          </Badge>
          <span className="ml-1.5 text-muted-foreground">
            ({formatInput(event.input as Record<string, unknown>)})
          </span>
        </div>
      )
    case "tool_result":
      return (
        <div className="text-xs text-muted-foreground pl-2">
          &rarr; {formatBytes(event.result_length as number)} in{" "}
          <span className="font-mono">{event.duration_ms as number}ms</span>
        </div>
      )
    default:
      return null
  }
}

function formatInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input || {})
  if (entries.length === 0) return ""
  return entries
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ")
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  return `${(n / 1024).toFixed(1)}KB`
}
