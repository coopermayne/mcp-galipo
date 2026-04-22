import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons"
import {
  getActivitySummary,
  getPageViews,
  getUserPageViews,
} from "@/services/activity"
import type { ActivityUser } from "@/services/activity"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

import { parseUTC } from "@/lib/utils"

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = parseUTC(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return ""
  const date = parseUTC(dateStr)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function statusColor(dateStr: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!dateStr) return "secondary"
  const diffMs = Date.now() - parseUTC(dateStr).getTime()
  const diffHrs = diffMs / 3600000
  if (diffHrs < 1) return "default"
  if (diffHrs < 24) return "outline"
  return "secondary"
}

export default function ActivityPage() {
  const [selectedUser, setSelectedUser] = useState<ActivityUser | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [userPage, setUserPage] = useState(1)
  const userPageSize = 25

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["activity-summary"],
    queryFn: getActivitySummary,
  })

  const { data: views, isLoading: viewsLoading } = useQuery({
    queryKey: ["activity-views", page, pageSize],
    queryFn: () => getPageViews(page, pageSize),
  })

  const { data: userViews, isLoading: userViewsLoading } = useQuery({
    queryKey: ["activity-user-views", selectedUser?.id, userPage, userPageSize],
    queryFn: () => getUserPageViews(selectedUser!.id, userPage, userPageSize),
    enabled: !!selectedUser,
  })

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm mt-1">
          User activity and page usage tracking
        </p>
      </div>

      {/* User Activity Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Users</h2>
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[150px]">Last Active</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : summary?.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                summary?.users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedUser(user); setUserPage(1) }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {user.first_name} {user.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>{timeAgo(user.last_active_at)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(user.last_active_at)}>
                        {!user.last_active_at
                          ? "Inactive"
                          : Date.now() - parseUTC(user.last_active_at).getTime() < 3600000
                            ? "Online"
                            : Date.now() - parseUTC(user.last_active_at).getTime() < 86400000
                              ? "Today"
                              : "Away"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Page Views Log */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Page Views</h2>
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">User</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="w-[180px]">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : !views?.items.length ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No page views recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                views.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {item.user_initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{item.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.path}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTimestamp(item.viewed_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {views && views.total_pages > 0 && (
          <div className="flex items-center justify-between px-2">
            <div className="text-muted-foreground text-xs">
              {views.total.toLocaleString()} total page views
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <p className="text-xs font-medium">Rows per page</p>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-[100px] items-center justify-center text-xs font-medium">
                Page {views.page} of {views.total_pages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  className="hidden size-8 p-0 lg:flex"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                >
                  <span className="sr-only">Go to first page</span>
                  <HugeiconsIcon icon={ArrowLeftDoubleIcon} className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8 p-0"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <span className="sr-only">Go to previous page</span>
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8 p-0"
                  onClick={() => setPage((p) => Math.min(views.total_pages, p + 1))}
                  disabled={page >= views.total_pages}
                >
                  <span className="sr-only">Go to next page</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden size-8 p-0 lg:flex"
                  onClick={() => setPage(views.total_pages)}
                  disabled={page >= views.total_pages}
                >
                  <span className="sr-only">Go to last page</span>
                  <HugeiconsIcon icon={ArrowRightDoubleIcon} className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.first_name} {selectedUser?.last_name} — Page Views
            </DialogTitle>
          </DialogHeader>
          <div className="border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="w-[180px]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userViewsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : !userViews?.items.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      No page views recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  userViews.items.map((view) => (
                    <TableRow key={view.id}>
                      <TableCell className="font-mono text-sm">{view.path}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatTimestamp(view.viewed_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {userViews && userViews.total_pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-muted-foreground text-xs">
                {userViews.total.toLocaleString()} views
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-xs font-medium">
                  Page {userViews.page} of {userViews.total_pages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    className="size-8 p-0"
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    disabled={userPage <= 1}
                  >
                    <span className="sr-only">Previous page</span>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8 p-0"
                    onClick={() => setUserPage((p) => Math.min(userViews.total_pages, p + 1))}
                    disabled={userPage >= userViews.total_pages}
                  >
                    <span className="sr-only">Next page</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
