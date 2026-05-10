export interface SmsConversation {
  id: number
  phone_number: string
  label: string | null
  case_id: number | null
  person_id: number | null
  last_message_at: string | null
  created_at: string | null
  archived: boolean
  last_message_preview?: string | null
  last_message_direction?: string | null
}

export interface SmsMediaAttachment {
  id: number
  content_type: string
  filename: string | null
  file_size: number | null
}

export interface SmsMessage {
  id: number
  conversation_id: number
  direction: "inbound" | "outbound"
  body: string
  sent_by_user_id: number | null
  sent_by_initials: string | null
  twilio_sid: string | null
  status: string
  created_at: string | null
  media: SmsMediaAttachment[]
}

export interface SmsConversationListResponse {
  conversations: SmsConversation[]
  total: number
}

export interface SmsMessageListResponse {
  messages: SmsMessage[]
  total: number
}
