export interface WebhookLog {
  id: number
  source: string
  event_type: string | null
  idempotency_key: string | null
  payload: Record<string, unknown> | null
  headers: Record<string, unknown> | null
  proceeding_id: number | null
  task_id: number | null
  event_id: number | null
  processing_status: string
  processing_error: string | null
  created_at: string | null
  processed_at: string | null
}

export type WebhookProcessingStatus = "pending" | "processing" | "completed" | "failed"

export interface WebhookListResponse {
  webhooks: WebhookLog[]
}
