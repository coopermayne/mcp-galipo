import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { updateCase } from "@/services/cases"
import { deleteProceeding } from "@/services/proceedings"
import { InlineEditField } from "@/components/common/inline-edit-field"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CaseInfoCardProps {
  caseData: CaseDetail
  onAddProceeding: () => void
}

export function CaseInfoCard({ caseData, onAddProceeding }: CaseInfoCardProps) {
  const queryClient = useQueryClient()

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
    queryClient.invalidateQueries({ queryKey: ["case-counts"] })
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ case_summary: string }>) =>
      updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      invalidate()
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteProceedingMutation = useMutation({
    mutationFn: (id: number) => deleteProceeding(id),
    onSuccess: () => {
      invalidate()
      toast.success("Proceeding removed")
    },
    onError: (e) => toast.error(e.message),
  })

  const primary = useMemo(
    () => caseData.proceedings.find((p) => p.is_primary) ?? caseData.proceedings[0] ?? null,
    [caseData.proceedings]
  )
  const others = useMemo(
    () => caseData.proceedings.filter((p) => p.id !== primary?.id),
    [caseData.proceedings, primary]
  )

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Proceedings
          {caseData.proceedings.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({caseData.proceedings.length})
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onAddProceeding}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary proceeding — full detail */}
        {primary ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 group/proc">
              <span className="text-sm font-mono font-semibold">
                {primary.case_number}
              </span>
              {primary.jurisdiction_name && (
                <>
                  <span className="text-muted-foreground text-xs">&middot;</span>
                  <span className="text-xs text-muted-foreground">
                    {primary.jurisdiction_name}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => deleteProceedingMutation.mutate(primary.id)}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover/proc:opacity-100 transition-opacity ml-auto shrink-0"
              >
                <HugeiconsIcon icon={Delete01Icon} className="size-3" />
              </button>
            </div>
            {primary.judge_name && (
              <p className="text-xs">
                <span className="text-muted-foreground">Judge:</span>{" "}
                {primary.judge_name}
              </p>
            )}
            {primary.notes && (
              <p className="text-xs text-muted-foreground">{primary.notes}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No proceedings.</p>
        )}

        {/* Other proceedings — compact list */}
        {others.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs text-muted-foreground">Other:</p>
            {others.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-xs group/proc"
              >
                <span className="font-mono font-medium">{p.case_number}</span>
                {p.jurisdiction_name && (
                  <span className="text-muted-foreground">
                    {p.jurisdiction_name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => deleteProceedingMutation.mutate(p.id)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover/proc:opacity-100 transition-opacity ml-auto shrink-0"
                >
                  <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Case Summary */}
        <div className="pt-2 border-t">
          <span className="text-xs text-muted-foreground block mb-1">
            Case Summary
          </span>
          <InlineEditField
            value={caseData.case_summary ?? ""}
            onSave={(v) => updateMutation.mutate({ case_summary: v })}
            type="textarea"
            placeholder="Add a summary..."
            displayClassName="text-xs whitespace-pre-wrap"
          />
        </div>
      </CardContent>
    </Card>
  )
}
