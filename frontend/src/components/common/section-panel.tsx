import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"

interface SectionPanelProps {
  /** Hugeicon shown to the left of the title. */
  icon?: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  title: ReactNode
  /** Right-aligned header content (actions, status, counters). */
  accessory?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Shared panel shell for the case overview sections (Proceedings, Key Dates,
 * Summary, …). Gives every section one consistent frame: square border, a
 * muted header bar with an icon + title and an optional right-side accessory.
 */
export function SectionPanel({ icon, title, accessory, children, className }: SectionPanelProps) {
  return (
    <div className={cn("border bg-card", className)}>
      <div className="flex items-center gap-2 px-3 h-10 border-b bg-muted/30">
        {icon && (
          <HugeiconsIcon icon={icon} className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="text-sm font-semibold leading-none">{title}</div>
        {accessory && (
          <div className="ml-auto flex items-center gap-1">{accessory}</div>
        )}
      </div>
      {children}
    </div>
  )
}
