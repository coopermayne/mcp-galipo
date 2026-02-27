import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { SmsConversation } from "@/types/sms"

interface ConversationListProps {
  conversations: SmsConversation[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNewConversation: () => void
  isLoading?: boolean
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5 p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Button onClick={onNewConversation} className="w-full" size="sm">
          New Message
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex flex-col gap-0.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  selectedId === conv.id && "bg-accent"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {conv.label || conv.phone_number}
                  </span>
                  {conv.last_message_at && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(
                        new Date(conv.last_message_at + "Z"),
                        { addSuffix: true }
                      )}
                    </span>
                  )}
                </div>
                {conv.label && (
                  <span className="text-xs text-muted-foreground">
                    {conv.phone_number}
                  </span>
                )}
                {conv.last_message_preview && (
                  <p className="truncate text-xs text-muted-foreground">
                    {conv.last_message_direction === "outbound" && "You: "}
                    {conv.last_message_preview}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
