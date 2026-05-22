import { useState } from "react"
import { Link } from "react-router"
import { formatDistanceToNow } from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Archive02Icon,
  MoreVerticalIcon,
  InboxIcon,
  Delete01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import type { SmsConversation } from "@/types/sms"

function getInitials(label: string | null, phone: string): string {
  if (label) {
    const parts = label.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return label.slice(0, 2).toUpperCase()
  }
  const digits = phone.replace(/\D/g, "")
  return digits.slice(-2) || "?"
}

interface ConversationListProps {
  conversations: SmsConversation[]
  onNewConversation: () => void
  onArchive: (id: number, archived: boolean) => void
  onDelete: (id: number) => void
  onRename: (id: number, currentLabel: string) => void
  showArchived: boolean
  onShowArchivedChange: (show: boolean) => void
  searchValue: string
  onSearchChange: (value: string) => void
  isLoading?: boolean
  unreadCounts?: Record<number, number>
  firmNumber?: string | null
}

function ConversationActions({
  conv,
  onArchive,
  onDelete,
  onRename,
}: {
  conv: SmsConversation
  onArchive: (id: number, archived: boolean) => void
  onDelete: (id: number) => void
  onRename: (id: number, currentLabel: string) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 mr-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => onRename(conv.id, conv.label || "")}
          >
            <HugeiconsIcon
              icon={PencilEdit01Icon}
              size={14}
              className="mr-2"
            />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onArchive(conv.id, !conv.archived)}
          >
            <HugeiconsIcon
              icon={conv.archived ? InboxIcon : Archive02Icon}
              size={14}
              className="mr-2"
            />
            {conv.archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          {conv.archived && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setShowConfirm(true)}
            >
              <HugeiconsIcon
                icon={Delete01Icon}
                size={14}
                className="mr-2"
              />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(conv.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ConversationList({
  conversations,
  onNewConversation,
  onArchive,
  onDelete,
  onRename,
  showArchived,
  onShowArchivedChange,
  searchValue,
  onSearchChange,
  isLoading,
  unreadCounts,
  firmNumber,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5 p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <Button onClick={onNewConversation} className="flex-1" size="sm">
            New Message
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShowArchivedChange(!showArchived)}
            className={cn(
              "h-8 w-8 p-0 border",
              showArchived
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
            title={showArchived ? "Showing archived" : "Show archived"}
          >
            <HugeiconsIcon icon={Archive02Icon} size={14} />
          </Button>
        </div>
        {firmNumber && (
          <p className="text-xs text-muted-foreground">
            Sending from {firmNumber}
          </p>
        )}
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search conversations..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <TooltipProvider delayDuration={300}>
        <div className="flex flex-col">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {showArchived
                ? "No archived conversations"
                : searchValue
                  ? "No matching conversations"
                  : "No conversations yet"}
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className="group flex items-start border-b transition-colors hover:bg-accent"
              >
                <Link
                  to={`/sms/${conv.id}`}
                  className="flex flex-1 items-start gap-2.5 px-3 py-2.5 text-left"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center bg-muted text-muted-foreground text-xs font-medium">
                        {getInitials(conv.label, conv.phone_number)}
                      </span>
                    </TooltipTrigger>
                    {conv.label && (
                      <TooltipContent side="right">
                        <div className="text-xs">
                          <div className="font-medium">{conv.label}</div>
                          <div className="text-muted-foreground">{conv.phone_number}</div>
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {conv.label || conv.phone_number}
                        {(unreadCounts?.[conv.id] ?? 0) > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 min-w-[18px] text-center inline-block">
                            {unreadCounts![conv.id]}
                          </span>
                        )}
                      </span>
                      {conv.last_message_at && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(conv.last_message_at),
                            { addSuffix: true }
                          )}
                        </span>
                      )}
                    </div>
                    {conv.label && (
                      <span className="text-xs text-muted-foreground">
                        {conv.phone_number}
                      </span>
                    )}
                    {conv.last_message_preview && (
                      <p className="truncate text-xs text-muted-foreground">
                        {conv.last_message_direction === "outbound" && "You: "}
                        {conv.last_message_preview}
                      </p>
                    )}
                  </div>
                </Link>
                <ConversationActions
                  conv={conv}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onRename={onRename}
                />
              </div>
            ))
          )}
        </div>
        </TooltipProvider>
      </ScrollArea>
    </div>
  )
}
