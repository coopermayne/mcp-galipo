import { useQuery } from "@tanstack/react-query"
import { PenTool01Icon } from "@hugeicons/core-free-icons"
import { getWorklogByCase, formatHours } from "@/services/worklog"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { SectionPanel } from "@/components/common/section-panel"
import { formatLA } from "@/lib/datetime"

interface CaseWorkLogProps {
  caseId: number
}

/** Confirmed worklog entries for a case, grouped by day with a running total.
 * Firm-wide: each entry shows its author's initials. */
export function CaseWorkLog({ caseId }: CaseWorkLogProps) {
  const { data } = useQuery({
    queryKey: ["worklog-by-case", caseId],
    queryFn: () => getWorklogByCase(caseId),
  })

  const days = data?.days ?? []
  const total = data?.total_hours ?? 0

  return (
    <SectionPanel
      icon={PenTool01Icon}
      title="Work Log"
      accessory={
        total > 0 ? (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {formatHours(total)}
          </span>
        ) : null
      }
    >
      {days.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">No logged work yet.</p>
      ) : (
        <div className="divide-y divide-border/50">
          {days.map((day) => (
            <div key={day.date} className="px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {formatLA(`${day.date}T00:00:00`, { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatHours(day.hours)}
                </span>
              </div>
              <div className="space-y-1.5">
                {day.entries.map((e) => (
                  <div key={e.id} className="flex items-start gap-2">
                    {e.author_initials && (
                      <span
                        className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0 mt-0.5"
                        style={e.author_id ? getAvatarStyleById(e.author_id) : undefined}
                        title={e.author_initials}
                      >
                        {e.author_initials}
                      </span>
                    )}
                    <span className="flex-1 text-xs">{e.description}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                      {formatHours(e.hours)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  )
}
