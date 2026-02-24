import { useState, useCallback, useRef } from "react"
import { apiFetch } from "@/lib/api"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolActivity[]
}

export interface ToolActivity {
  id: string
  name: string
  status: "running" | "done" | "error"
  result?: string
  isError?: boolean
}

interface UseChatStreamOptions {
  mode: string
}

export function useChatStream({ mode }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const conversationIdRef = useRef<string | null>(null)

  const reset = useCallback(async () => {
    if (conversationIdRef.current) {
      try {
        await apiFetch(
          `/api/v1/chat/conversations/${conversationIdRef.current}`,
          { method: "DELETE" }
        )
      } catch {
        // Ignore cleanup errors
      }
    }
    conversationIdRef.current = null
    setMessages([])
    setIsStreaming(false)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = { role: "user", content: text }
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)

      try {
        const res = await apiFetch("/api/v1/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversation_id: conversationIdRef.current,
            mode,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: "Request failed" } }))
          const errMsg = err?.error?.message || `Error ${res.status}`
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: errMsg },
          ])
          setIsStreaming(false)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setIsStreaming(false)
          return
        }

        const decoder = new TextDecoder()
        let buffer = ""

        // Add a placeholder assistant message
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", toolCalls: [] },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE lines
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            let event: Record<string, unknown>
            try {
              event = JSON.parse(jsonStr)
            } catch {
              continue
            }

            const type = event.type as string

            if (type === "text") {
              const content = event.content as string
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + content,
                  }
                }
                return updated
              })
            } else if (type === "tool_start") {
              const toolActivity: ToolActivity = {
                id: event.id as string,
                name: event.name as string,
                status: "running",
              }
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    toolCalls: [...(last.toolCalls ?? []), toolActivity],
                  }
                }
                return updated
              })
            } else if (type === "tool_result") {
              const toolId = event.id as string
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    toolCalls: (last.toolCalls ?? []).map((tc) =>
                      tc.id === toolId
                        ? {
                            ...tc,
                            status: (event.is_error ? "error" : "done") as ToolActivity["status"],
                            result: event.result as string,
                            isError: event.is_error as boolean,
                          }
                        : tc
                    ),
                  }
                }
                return updated
              })
            } else if (type === "done") {
              conversationIdRef.current =
                (event.conversation_id as string) ?? null
            } else if (type === "error") {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content:
                      last.content ||
                      (event.message as string) ||
                      "Something went wrong.",
                  }
                }
                return updated
              })
            }
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev.filter((m) => m.content !== "" || m.role !== "assistant"),
          {
            role: "assistant",
            content:
              err instanceof Error ? err.message : "Connection failed.",
          },
        ])
      } finally {
        setIsStreaming(false)
      }
    },
    [mode]
  )

  return {
    messages,
    send,
    isStreaming,
    conversationId: conversationIdRef.current,
    reset,
  }
}
