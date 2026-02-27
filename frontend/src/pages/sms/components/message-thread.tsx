import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import type { SmsMessage } from "@/types/sms"

interface MessageThreadProps {
  messages: SmsMessage[]
  isLoading?: boolean
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return ""
  const d = new Date(dateStr + "Z")
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (isToday) return time

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`

  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              i % 2 === 0 ? "justify-start" : "justify-end"
            )}
          >
            <Skeleton className="h-16 w-48" />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No messages yet. Send the first message below.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-4">
        {messages.map((msg) => {
          const isOutbound = msg.direction === "outbound"

          return (
            <div
              key={msg.id}
              className={cn(
                "flex items-end gap-2",
                isOutbound ? "flex-row-reverse" : "flex-row"
              )}
            >
              {isOutbound && msg.sent_by_initials ? (
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px]">
                    {msg.sent_by_initials}
                  </AvatarFallback>
                </Avatar>
              ) : !isOutbound ? (
                <Avatar size="sm">
                  <AvatarFallback className="bg-muted text-[10px]">
                    SM
                  </AvatarFallback>
                </Avatar>
              ) : null}

              <div
                className={cn(
                  "max-w-[70%] px-3 py-2",
                  isOutbound
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    isOutbound
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {formatTime(msg.created_at)}
                  {msg.status === "failed" && " · Failed"}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
