import { request } from './common';

export interface WebhookLog {
  id: number;
  source: string;
  event_type: string | null;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  proceeding_id: number | null;
  task_id: number | null;
  event_id: number | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface GetWebhooksParams {
  source?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function getWebhooks(params: GetWebhooksParams = {}): Promise<{ webhooks: WebhookLog[] }> {
  const searchParams = new URLSearchParams();
  if (params.source) searchParams.set('source', params.source);
  if (params.status) searchParams.set('status', params.status);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  return request(`/webhooks${query ? `?${query}` : ''}`);
}

export async function getWebhook(id: number): Promise<{ webhook: WebhookLog }> {
  return request(`/webhooks/${id}`);
}
