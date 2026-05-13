import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { CaseDetail } from "@/types/case"
import { updateCase } from "@/services/cases"
import { InlineEditField } from "@/components/common/inline-edit-field"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface CaseDatesCardProps {
  caseData: CaseDetail
}

export function CaseDatesCard({ caseData }: CaseDatesCardProps) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: { date_of_injury?: string; trial_date?: string }) =>
      updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Key Dates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground shrink-0">
            Date of Injury
          </span>
          <InlineEditField
            value={caseData.date_of_injury ?? ""}
            onSave={(v) => updateMutation.mutate({ date_of_injury: v })}
            type="date"
            displayClassName="text-xs justify-end"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground shrink-0">
            Trial Date
          </span>
          <InlineEditField
            value={caseData.trial_date ?? ""}
            onSave={(v) => updateMutation.mutate({ trial_date: v })}
            type="date"
            displayClassName="text-xs justify-end"
          />
        </div>
      </CardContent>
    </Card>
  )
}
