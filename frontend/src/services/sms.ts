import type {
  SmsConversation,
  SmsConversationListResponse,
  SmsMessage,
  SmsMessageListResponse,
} from "@/types/sms"
import { apiFetch } from "@/lib/api"

export async function getConversations(
  params: {
    limit?: number
    offset?: number
    archived?: boolean
    search?: string
  } = {}
): Promise<SmsConversationListResponse> {
  const searchParams = new URLSearchParams()
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))
  if (params.archived != null) searchParams.set("archived", String(params.archived))
  if (params.search) searchParams.set("search", params.search)

  const res = await apiFetch(`/api/v1/sms/conversations?${searchParams}`)
  if (!res.ok) throw new Error("Failed to fetch conversations")
  return res.json()
}

export async function getMessages(
  conversationId: number,
  params: { limit?: number; offset?: number } = {}
): Promise<SmsMessageListResponse> {
  const searchParams = new URLSearchParams()
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))

  const res = await apiFetch(
    `/api/v1/sms/conversations/${conversationId}/messages?${searchParams}`
  )
  if (!res.ok) throw new Error("Failed to fetch messages")
  return res.json()
}

export async function createConversation(
  phoneNumber: string,
  label?: string
): Promise<SmsConversation & { created: boolean }> {
  const res = await apiFetch("/api/v1/sms/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, label }),
  })
  if (!res.ok) throw new Error("Failed to create conversation")
  return res.json()
}

export async function sendMessage(
  conversationId: number,
  body: string
): Promise<SmsMessage> {
  const res = await apiFetch("/api/v1/sms/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, body }),
  })
  if (!res.ok) throw new Error("Failed to send message")
  return res.json()
}

export async function updateConversationLabel(
  conversationId: number,
  label: string
): Promise<SmsConversation> {
  const res = await apiFetch(`/api/v1/sms/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  })
  if (!res.ok) throw new Error("Failed to update conversation")
  return res.json()
}

export async function archiveConversation(
  conversationId: number,
  archived: boolean = true
): Promise<SmsConversation> {
  const res = await apiFetch(
    `/api/v1/sms/conversations/${conversationId}/archive`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }
  )
  if (!res.ok) throw new Error("Failed to archive conversation")
  return res.json()
}

export function getMediaProxyUrl(mediaId: number): string {
  return `/api/v1/sms/media/${mediaId}`
}
