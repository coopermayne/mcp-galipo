import type { WebhookListResponse } from "@/types/webhook"
import { apiFetch } from "@/lib/api"

interface GetWebhooksParams {
  source?: string
  status?: string
  limit?: number
  offset?: number
}

export async function getWebhooks(
  params: GetWebhooksParams = {}
): Promise<WebhookListResponse> {
  const searchParams = new URLSearchParams()
  if (params.source) searchParams.set("source", params.source)
  if (params.status) searchParams.set("status", params.status)
  if (params.limit != null) searchParams.set("limit", String(params.limit))
  if (params.offset != null) searchParams.set("offset", String(params.offset))

  const qs = searchParams.toString()
  const res = await apiFetch(`/api/v1/webhooks${qs ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error("Failed to fetch webhooks")
  return res.json()
}

export async function deleteWebhook(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/webhooks/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete webhook")
  return res.json()
}

interface LinkWebhookData {
  proceeding_id: number
  docket_id?: number | null
  link_siblings?: boolean
}

export async function linkWebhook(
  id: number,
  data: LinkWebhookData
): Promise<{ success: boolean; linked_ids: number[]; count: number }> {
  const res = await apiFetch(`/api/v1/webhooks/${id}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to link webhook")
  return res.json()
}

export async function unlinkWebhook(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/webhooks/${id}/unlink`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to unlink webhook")
  return res.json()
}
