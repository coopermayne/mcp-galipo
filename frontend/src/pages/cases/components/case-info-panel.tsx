import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Note01Icon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { updateCase } from "@/services/cases"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { SectionPanel } from "@/components/common/section-panel"

interface CaseInfoPanelProps {
  caseData: CaseDetail
}

const SUMMARY_LIMIT = 500

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

  const counter =
    summary.length > SUMMARY_LIMIT * 0.8 ? (
      <span
        className={`text-[10px] tabular-nums ${summary.length > SUMMARY_LIMIT ? "text-destructive" : "text-muted-foreground"}`}
      >
        {summary.length}/{SUMMARY_LIMIT}
      </span>
    ) : null

  return (
    <SectionPanel icon={Note01Icon} title="Summary" accessory={counter}>
      <div className="p-3">
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
    </SectionPanel>
  )
}
