import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCases } from "@/services/cases"
import type { CaseListItem } from "@/types/case"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { getBadgeStyle } from "@/lib/badge-colors"
import { cn } from "@/lib/utils"

/**
 * Compact case selector. The trigger shows one of three states:
 *   - a colored case chip when matched to a case,
 *   - a dashed "unmatched" chip when the AI couldn't match a referenced case
 *     (`guess` present) — needs the user's attention,
 *   - a neutral "General" chip when the entry intentionally has no case.
 * The popover offers "No case (general)" as a first-class choice alongside the
 * searchable case list. onChange fires with the picked case id, or null for
 * General / no case.
 */
export function InlineCasePicker({
  value,
  shortName,
  caseName,
  caseColor,
  guess,
  onChange,
}: {
  value: number | null
  shortName: string | null
  caseName: string | null
  caseColor: string | null
  guess: string | null
  onChange: (caseId: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")

  const { data } = useQuery({
    queryKey: ["cases", "worklog-picker"],
    queryFn: () => getCases({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const filtered = useMemo(() => {
    const cases = (data?.cases ?? []) as CaseListItem[]
    const ql = q.trim().toLowerCase()
    return cases
      .filter((c) => c.status !== "Closed")
      .filter(
        (c) =>
          !ql ||
          (c.short_name ?? "").toLowerCase().includes(ql) ||
          c.case_name.toLowerCase().includes(ql)
      )
      .slice(0, 50)
  }, [data, q])

  const label = shortName || caseName

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ("") }}>
      <PopoverTrigger asChild>
        <button type="button" className="shrink-0 inline-flex items-center" onClick={(e) => e.stopPropagation()}>
          {value && label ? (
            <Badge
              className="h-4 max-w-[10rem] truncate px-1.5 py-0 text-[10px] leading-none"
              style={getBadgeStyle(caseColor)}
            >
              {label}
            </Badge>
          ) : guess ? (
            <Badge
              variant="outline"
              className="h-4 max-w-[10rem] truncate border-dashed px-1.5 py-0 text-[10px] leading-none text-warning-foreground"
              title={`unmatched — ${guess}`}
            >
              {guess}
            </Badge>
          ) : (
            <span className="inline-flex h-4 items-center border bg-muted/60 px-1.5 text-[10px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              General
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b p-1.5">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cases…"
            className="h-7 text-xs"
          />
        </div>
        <div className="max-h-56 overflow-auto p-1">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            className={cn(
              "mb-1 flex w-full items-center gap-2 border-b px-2 py-1.5 text-left hover:bg-accent/50",
              value === null && !guess && "bg-accent/40"
            )}
          >
            <span className="inline-flex h-4 shrink-0 items-center border bg-muted/60 px-1.5 text-[10px] leading-none text-muted-foreground">
              General
            </span>
            <span className="truncate text-[11px] text-muted-foreground">No case — general work</span>
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false) }}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/50",
                c.id === value && "bg-accent/40"
              )}
            >
              <Badge
                className="h-4 shrink-0 px-1.5 py-0 text-[10px] leading-none"
                style={getBadgeStyle(c.color)}
              >
                {c.short_name || c.case_name}
              </Badge>
              <span className="truncate text-[11px] text-muted-foreground">{c.case_name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">No cases</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
