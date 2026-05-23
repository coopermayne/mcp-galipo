import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { getSignedMediaUrl } from "@/services/sms"
import type { SmsMessage, SmsMediaAttachment } from "@/types/sms"

function MessageStatus({ status }: { status: string }) {
  switch (status) {
    case "queued":
    case "accepted":
      return <span> · Queued</span>
    case "sent":
      return <span> · Sent ✓</span>
    case "delivered":
      return <span> · Delivered ✓✓</span>
    case "read":
      return <span> · Read</span>
    case "failed":
    case "undelivered":
      return <span className="text-red-300"> · Failed ✗</span>
    default:
      return null
  }
}

interface MessageThreadProps {
  messages: SmsMessage[]
  isLoading?: boolean
}

function formatMsgTime(dateStr: string | null) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  const now = new Date()
  const LA = "America/Los_Angeles"
  const laDate = d.toLocaleDateString("en-US", { timeZone: LA })
  const laToday = now.toLocaleDateString("en-US", { timeZone: LA })
  const time = d.toLocaleTimeString("en-US", { timeZone: LA, hour: "numeric", minute: "2-digit" })
  if (laDate === laToday) return time

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const laYesterday = yesterday.toLocaleDateString("en-US", { timeZone: LA })
  if (laDate === laYesterday) return `Yesterday ${time}`

  return `${d.toLocaleDateString("en-US", { timeZone: LA, month: "short", day: "numeric" })} ${time}`
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/")
}

function MediaAttachment({ media }: { media: SmsMediaAttachment }) {
  const [signedUrl, setSignedUrl] = useState<string>()

  useEffect(() => {
    getSignedMediaUrl(media.id).then(setSignedUrl)
  }, [media.id])

  if (!signedUrl) return null

  if (isImageType(media.content_type)) {
    return (
      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={signedUrl}
          alt={media.filename || "Image"}
          className="max-h-48 max-w-full object-contain"
          loading="lazy"
        />
      </a>
    )
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs underline"
    >
      {media.filename || "Download file"}
      {media.file_size != null && (
        <span className="text-[10px] opacity-70">
          ({(media.file_size / 1024).toFixed(0)} KB)
        </span>
      )}
    </a>
  )
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
    <ScrollArea className="min-h-0 flex-1 [&>div>div]:!block">
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
                  "max-w-[70%] min-w-0 break-words px-3 py-2",
                  isOutbound
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.media.length > 0 && (
                  <div className="mb-1.5 flex flex-col gap-1.5">
                    {msg.media.map((m) => (
                      <MediaAttachment key={m.id} media={m} />
                    ))}
                  </div>
                )}
                {msg.body && (
                  <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{msg.body}</p>
                )}
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    isOutbound
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {formatMsgTime(msg.created_at)}
                  {isOutbound && <MessageStatus status={msg.status} />}
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
