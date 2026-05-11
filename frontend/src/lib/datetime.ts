const LA = "America/Los_Angeles"

export function formatLA(
  iso: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", { timeZone: LA, ...opts })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ""
  return formatLA(iso, { hour: "numeric", minute: "2-digit" })
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—"
  return formatLA(iso, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatTimestampRaw(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatDateHeader(iso: string): string {
  const d = new Date(iso)
  const now = new Date()

  const laDate = d.toLocaleDateString("en-US", { timeZone: LA })
  const laToday = now.toLocaleDateString("en-US", { timeZone: LA })
  if (laDate === laToday) return "Today"

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const laYesterday = yesterday.toLocaleDateString("en-US", { timeZone: LA })
  if (laDate === laYesterday) return "Yesterday"

  return formatLA(iso, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function getDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return "Just now"
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  const days = Math.floor(ms / 86400000)
  if (days < 30) return `${days}d ago`
  return formatLA(iso, { month: "short", day: "numeric" })
}
