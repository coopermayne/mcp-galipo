import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { CaseDetail } from "@/types/case"
import { updateCase } from "@/services/cases"
import { InlineEditField } from "@/components/common/inline-edit-field"

interface CaseInfoPanelProps {
  caseData: CaseDetail
}

export function CaseInfoPanel({ caseData }: CaseInfoPanelProps) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ case_summary: string; date_of_injury: string }>) =>
      updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const createdDate = useMemo(
    () =>
      caseData.created_at
        ? new Date(caseData.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
    [caseData.created_at]
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

      {/* Key Dates */}
      <div className="border-t pt-3 space-y-1.5">
        <span className="text-xs text-muted-foreground block">Key Dates</span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Date of Injury</span>
          <InlineEditField
            value={caseData.date_of_injury ?? ""}
            onSave={(v) => updateMutation.mutate({ date_of_injury: v })}
            type="date"
            displayClassName="text-xs justify-end"
          />
        </div>
        {createdDate && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Case Opened</span>
            <span className="text-xs">{createdDate}</span>
          </div>
        )}
      </div>
    </div>
  )
}
