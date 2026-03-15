import type { Table } from "@tanstack/react-table"
import type { PersonListItem } from "@/types/person"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Archive02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ContactsToolbarProps {
  table: Table<PersonListItem>
  showArchived: boolean
  onShowArchivedChange: (show: boolean) => void
  total: number
}

export function ContactsToolbar({
  table,
  showArchived,
  onShowArchivedChange,
  total,
}: ContactsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Search contacts..."
            value={
              (table.getColumn("name")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {total} contacts
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onShowArchivedChange(!showArchived)}
        className={cn(
          "h-8 px-2.5 border",
          showArchived
            ? "bg-foreground text-background hover:bg-foreground hover:text-background"
            : "text-muted-foreground"
        )}
      >
        <HugeiconsIcon icon={Archive02Icon} className="size-3.5 mr-1" />
        Archived
      </Button>
    </div>
  )
}
