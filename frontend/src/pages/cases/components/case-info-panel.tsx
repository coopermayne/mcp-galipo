import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { updateCase } from "@/services/cases"
import { getEvents } from "@/services/events"
import { InlineEditField } from "@/components/common/inline-edit-field"

interface CaseInfoPanelProps {
  caseData: CaseDetail
}

const PACIFIC_TZ = "America/Los_Angeles"

function formatEventDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const base = d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: PACIFIC_TZ,
  })
  const dow = d.toLocaleDateString("en-US", { weekday: "short", timeZone: PACIFIC_TZ })
  return `${base} (${dow})`
}

export function CaseInfoPanel({ caseData }: CaseInfoPanelProps) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ case_summary: string }>) =>
      updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: eventsData } = useQuery({
    queryKey: ["events", "case", caseData.id],
    queryFn: () => getEvents({ case_id: caseData.id, limit: 500 }),
  })

  const starredEvents = useMemo(
    () => (eventsData?.events ?? []).filter((e) => e.starred),
    [eventsData]
  )

  return (
    <div className="border p-3 space-y-3">
      {/* Summary */}
      <div>
        <span className="text-xs text-muted-foreground block mb-1">Summary</span>
        <InlineEditField
          value={caseData.case_summary ?? ""}
          onSave={(v) => updateMutation.mutate({ case_summary: v })}
          type="textarea"
          placeholder="Add a summary..."
          displayClassName="text-xs whitespace-pre-wrap"
        />
      </div>

      {/* Important Dates (starred events) */}
      {starredEvents.length > 0 && (
        <div className="border-t pt-3 space-y-1.5">
          <span className="text-xs text-muted-foreground block">Important Dates</span>
          {starredEvents.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs truncate min-w-0">
                <HugeiconsIcon icon={StarIcon} className="size-3 text-warning shrink-0" />
                <span className="truncate">{e.description}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {formatEventDate(e.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
