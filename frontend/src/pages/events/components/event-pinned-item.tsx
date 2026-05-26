import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import type { EventListItem as EventListItemType } from "@/types/event"
import { cn } from "@/lib/utils"

function formatPinnedDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface EventPinnedItemProps {
  event: EventListItemType
  onEventClick: (event: EventListItemType) => void
  onToggleStar: (eventId: number, starred: boolean) => void
}

export function EventPinnedItem({
  event,
  onEventClick,
  onToggleStar,
}: EventPinnedItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5",
        "border-b border-border/50",
        "hover:bg-accent/50 transition-colors cursor-pointer"
      )}
      onClick={() => onEventClick(event)}
    >
      <button
        type="button"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onToggleStar(event.id, !event.starred)
        }}
      >
        <HugeiconsIcon
          icon={StarIcon}
          className={cn(
            "size-3.5 transition-colors",
            event.starred
              ? "text-warning fill-warning"
              : "text-muted-foreground/30 hover:text-warning/60"
          )}
        />
      </button>

      <span className="flex-1 min-w-0 truncate text-xs">{event.description}</span>

      <span className="shrink-0 text-xs text-muted-foreground">
        {formatPinnedDate(event.date)}
      </span>
    </div>
  )
}
