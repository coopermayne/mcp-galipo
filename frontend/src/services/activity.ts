import { apiFetch } from "@/lib/api"

export interface ActivityUser {
  id: number
  first_name: string
  last_name: string
  email: string
  initials: string
  last_active_at: string | null
}

export interface TopPage {
  path: string
  view_count: number
}

export interface ActivitySummary {
  users: ActivityUser[]
  top_pages: TopPage[]
}

export interface UserPageView {
  path: string
  view_count: number
  last_viewed: string | null
}

export async function getActivitySummary(): Promise<ActivitySummary> {
  const res = await apiFetch("/api/v1/activity/summary")
  if (!res.ok) throw new Error("Failed to fetch activity summary")
  const json = await res.json()
  return json.data
}

export async function getUserPageViews(userId: number): Promise<UserPageView[]> {
  const res = await apiFetch(`/api/v1/activity/user/${userId}`)
  if (!res.ok) throw new Error("Failed to fetch user page views")
  const json = await res.json()
  return json.data
}
