import { cn } from "@/lib/utils"

/**
 * Single-line text that clips with an ellipsis once it exceeds its max width.
 * Keeps table columns from growing unboundedly with long free-text values;
 * the full value is available on hover (and on the detail page).
 */
export function TruncatedText({
  text,
  className,
}: {
  text: string | null | undefined
  className?: string
}) {
  if (!text) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn("block truncate", className)} title={text}>
      {text}
    </span>
  )
}
