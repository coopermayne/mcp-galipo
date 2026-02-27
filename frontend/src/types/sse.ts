export interface SSEEvent {
  entity: string
  action: string
  id: number | null
  intake_id?: number | null
  conversation_id?: number | null
  user_id?: number | null
}
