import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, SparklesIcon, StarIcon, CourtLawIcon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { updateProceeding } from "@/services/proceedings"
import type { CaseDetail, CaseProceeding } from "@/types/case"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddProceedingDialog } from "@/pages/cases/components/add-proceeding-dialog"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"

interface CaseProceedingsCardProps {
  caseData: CaseDetail
}

/** Format judges array into compact string like "Judge X, Mag. Judge Y" */
function formatJudges(judges: { name: string; role: string | null }[]): string {
  return judges
    .map((j) => {
      if (!j.role || j.role === "Judge") return `Judge ${j.name}`
      if (j.role === "Magistrate Judge") return `Mag. Judge ${j.name}`
      return `${j.role} ${j.name}`
    })
    .join(", ")
}

export function CaseProceedingsCard({ caseData }: CaseProceedingsCardProps) {
  const queryClient = useQueryClient()
  const [addProceedingOpen, setAddProceedingOpen] = useState(false)
  const [detailProceeding, setDetailProceeding] = useState<CaseProceeding | null>(null)
  const [aiOpen, setAiOpen] = useState(false)

  const aiProceedingsRules: ToolCompletionRule[] = useMemo(() => [
    {
      toolNames: ["manage_proceeding"],
      queryKeys: [["case", caseData.id], ["cases"]],
      toastMessage: "Proceeding updated via AI",
    },
    {
      toolNames: ["manage_judge"],
      queryKeys: [["case", caseData.id], ["judges"]],
      toastMessage: "Judge updated via AI",
    },
  ], [caseData.id])

  // Sort proceedings: primary first, then by sort_order
  const sortedProceedings = useMemo(
    () => [...caseData.proceedings].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    }),
    [caseData.proceedings]
  )

  const setPrimaryMutation = useMutation({
    mutationFn: (proceedingId: number) =>
      updateProceeding(proceedingId, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
      toast.success("Primary proceeding updated")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <>
      <Card size="sm">
        <CardHeader className="border-b bg-muted/40">
          <CardTitle>
            Proceedings
            {sortedProceedings.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({sortedProceedings.length})
              </span>
            )}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setAiOpen(true)}
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setAddProceedingOpen(true)}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {sortedProceedings.length > 0 ? (
            <div className="divide-y divide-border/50">
              {sortedProceedings.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-2.5 px-3 py-2.5 group/proc hover:bg-muted/30 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!p.is_primary) setPrimaryMutation.mutate(p.id)
                    }}
                    className={cn(
                      "shrink-0 mt-0.5",
                      p.is_primary
                        ? "text-warning cursor-default"
                        : "text-muted-foreground/30 hover:text-warning/60 cursor-pointer"
                    )}
                    title={p.is_primary ? "Primary proceeding" : "Set as primary"}
                  >
                    <HugeiconsIcon icon={StarIcon} className={cn("size-3.5", p.is_primary && "fill-warning")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailProceeding(p)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium hover:underline">
                        {p.case_number}
                      </span>
                      {p.is_primary && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {(p.jurisdiction_name || p.judges.length > 0 || p.judge_name) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {p.jurisdiction_name && (
                          <span className="text-[11px] text-muted-foreground">
                            {p.jurisdiction_name}
                          </span>
                        )}
                        {(p.judges.length > 0 || p.judge_name) && (
                          <>
                            {p.jurisdiction_name && (
                              <span className="text-muted-foreground/40 text-[11px]">/</span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {p.judges.length > 0
                                ? formatJudges(p.judges)
                                : p.judge_name
                                  ? `Judge ${p.judge_name}`
                                  : null}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <HugeiconsIcon icon={CourtLawIcon} className="size-5 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No proceedings yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => setAddProceedingOpen(true)}
              >
                Add Proceeding
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single proceeding detail dialog */}
      {detailProceeding && (
        <Dialog open={!!detailProceeding} onOpenChange={(open) => { if (!open) setDetailProceeding(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono">{detailProceeding.case_number}</span>
                {detailProceeding.is_primary && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">Primary</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {detailProceeding.jurisdiction_name && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Jurisdiction</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{detailProceeding.jurisdiction_name}</p>
                    {detailProceeding.local_rules_link && (
                      <a
                        href={detailProceeding.local_rules_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <HugeiconsIcon icon={LinkSquare02Icon} className="size-3" />
                        Local Rules
                      </a>
                    )}
                  </div>
                </div>
              )}
              {detailProceeding.judges.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {detailProceeding.judges.length === 1 ? "Judge" : "Judges"}
                  </p>
                  <div className="space-y-1">
                    {detailProceeding.judges.map((j) => (
                      <div key={j.judge_id} className="flex items-baseline gap-2 text-sm">
                        <span>{j.name}</span>
                        {j.role && j.role !== "Judge" && (
                          <span className="text-[11px] text-muted-foreground">({j.role})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailProceeding.notes && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-muted-foreground">{detailProceeding.notes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add proceeding dialog */}
      <AddProceedingDialog
        open={addProceedingOpen}
        onOpenChange={setAddProceedingOpen}
        caseId={caseData.id}
      />

      {/* AI proceedings chat — floating modal */}
      <AiChatSheet
        variant="dialog"
        open={aiOpen}
        onOpenChange={setAiOpen}
        title="AI Proceedings"
        description="Manage court proceedings, judges, and jurisdictions for this case via chat."
        placeholder="e.g. Add a proceeding in C.D. Cal. case #2:24-cv-01234, assigned to Judge Dolly Gee..."
        emptyStateText="Describe proceedings to add or edit. Claude can create proceedings, search/create judges, and assign them."
        mode="proceedings"
        caseContext={caseData.id}
        toolCompletionRules={aiProceedingsRules}
      />
    </>
  )
}
