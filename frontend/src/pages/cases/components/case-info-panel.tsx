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

  const summary = caseData.case_summary ?? ""
  const SUMMARY_LIMIT = 500

  return (
    <div className="border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Summary</span>
        {summary.length > SUMMARY_LIMIT * 0.8 && (
          <span className={`text-[10px] tabular-nums ${summary.length > SUMMARY_LIMIT ? "text-destructive" : "text-muted-foreground"}`}>
            {summary.length}/{SUMMARY_LIMIT}
          </span>
        )}
      </div>
      <InlineEditField
        value={summary}
        onSave={(v) => {
          if (v.length > SUMMARY_LIMIT) {
            toast.error(`Summary must be ${SUMMARY_LIMIT} characters or fewer`)
            return
          }
          updateMutation.mutate({ case_summary: v })
        }}
        type="textarea"
        placeholder="Add a summary..."
        displayClassName="text-xs whitespace-pre-wrap"
      />
    </div>
  )
}
