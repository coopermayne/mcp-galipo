import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getActivitySummary, getUserPageViews } from "@/services/activity"
import type { ActivityUser } from "@/services/activity"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
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

function statusColor(dateStr: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!dateStr) return "secondary"
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffHrs = diffMs / 3600000
  if (diffHrs < 1) return "default"
  if (diffHrs < 24) return "outline"
  return "secondary"
}

export default function ActivityPage() {
  const [selectedUser, setSelectedUser] = useState<ActivityUser | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["activity-summary"],
    queryFn: getActivitySummary,
  })

  const { data: userViews, isLoading: viewsLoading } = useQuery({
    queryKey: ["activity-user-views", selectedUser?.id],
    queryFn: () => getUserPageViews(selectedUser!.id),
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
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : data?.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                data?.users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedUser(user)}
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
                          : Date.now() - new Date(user.last_active_at).getTime() < 3600000
                            ? "Online"
                            : Date.now() - new Date(user.last_active_at).getTime() < 86400000
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

      {/* Top Pages Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Top Pages (Last 30 Days)</h2>
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="w-[120px] text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.top_pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                    No page views recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                data?.top_pages.map((page) => (
                  <TableRow key={page.path}>
                    <TableCell className="font-mono text-sm">{page.path}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {page.view_count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
                  <TableHead className="w-[80px] text-right">Views</TableHead>
                  <TableHead className="w-[120px]">Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : !userViews?.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No page views recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  userViews.map((view) => (
                    <TableRow key={view.path}>
                      <TableCell className="font-mono text-sm">{view.path}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {view.view_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {timeAgo(view.last_viewed)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
