import { useParams, useNavigate, Link } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import {
  getConversation,
  getMessages,
  sendMessage,
  markSmsConversationRead,
} from "@/services/sms"
import { MessageThread } from "@/pages/sms/components/message-thread"
import { ComposeInput } from "@/pages/sms/components/compose-input"
import { Button } from "@/components/ui/button"
import { formatPhone } from "@/lib/utils"

export default function SmsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const conversationId = Number(id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Fetch conversation info for header
  const { data: conversation } = useQuery({
    queryKey: ["sms-conversation", conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: !isNaN(conversationId),
  })

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["sms-messages", conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: !isNaN(conversationId),
  })

  const messages = messagesData?.messages ?? []

  // Mark as read on mount
  useQuery({
    queryKey: ["sms-mark-read", conversationId],
    queryFn: async () => {
      await markSmsConversationRead(conversationId)
      queryClient.invalidateQueries({ queryKey: ["sms-unread-counts"] })
      return null
    },
    enabled: !isNaN(conversationId),
    staleTime: 30_000,
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sms-messages", conversationId],
      })
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
    },
    onError: () => {
      toast.error("Failed to send message")
    },
  })

  if (isNaN(conversationId)) {
    navigate("/sms", { replace: true })
    return null
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
          <Link to="/sms">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Link>
        </Button>
        <h2 className="text-sm font-medium">
          {conversation?.label || (conversation?.phone_number ? formatPhone(conversation.phone_number) : "Loading...")}
        </h2>
        {conversation?.label && (
          <span className="text-xs text-muted-foreground">
            {formatPhone(conversation.phone_number)}
          </span>
        )}
      </div>

      {/* Messages */}
      <MessageThread messages={messages} isLoading={isLoading} />

      {/* Compose */}
      <ComposeInput
        onSend={(body) => sendMutation.mutate(body)}
        isSending={sendMutation.isPending}
      />
    </div>
  )
}
