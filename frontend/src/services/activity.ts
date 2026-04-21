import { apiFetch } from "@/lib/api"

export interface ActivityUser {
  id: number
  first_name: string
  last_name: string
  email: string
  initials: string
  last_active_at: string | null
}

export interface ActivitySummary {
  users: ActivityUser[]
}

export interface PageViewItem {
  id: number
  path: string
  viewed_at: string | null
  user_id: number
  user_name: string
  user_initials: string
}

export interface PageViewsResponse {
  items: PageViewItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface UserPageViewsResponse {
  items: { id: number; path: string; viewed_at: string | null }[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export async function getActivitySummary(): Promise<ActivitySummary> {
  const res = await apiFetch("/api/v1/activity/summary")
  if (!res.ok) throw new Error("Failed to fetch activity summary")
  const json = await res.json()
  return json.data
}

export async function getPageViews(
  page: number = 1,
  pageSize: number = 25
): Promise<PageViewsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  const res = await apiFetch(`/api/v1/activity/views?${params}`)
  if (!res.ok) throw new Error("Failed to fetch page views")
  const json = await res.json()
  return json.data
}

export async function getUserPageViews(
  userId: number,
  page: number = 1,
  pageSize: number = 25
): Promise<UserPageViewsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  const res = await apiFetch(`/api/v1/activity/user/${userId}?${params}`)
  if (!res.ok) throw new Error("Failed to fetch user page views")
  const json = await res.json()
  return json.data
}
