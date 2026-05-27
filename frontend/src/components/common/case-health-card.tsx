import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"
import { getAlerts, dismissAlert } from "@/services/alerts"
import type { CaseAlert } from "@/types/alert"
import { severityRank } from "@/lib/alert-severity"
import { AlertRow } from "@/components/common/alert-row"

export function CaseHealthCard({ caseId }: { caseId: number }) {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["alerts", "case", caseId],
    queryFn: () => getAlerts({ case_id: caseId }),
  })

  const dismiss = useMutation({
    mutationFn: (a: CaseAlert) =>
      dismissAlert({ case_id: a.case_id, rule_id: a.rule_id, fingerprint: a.fingerprint }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
      toast.success("Alert dismissed")
    },
    onError: () => toast.error("Failed to dismiss alert"),
  })

  const alerts = (data?.alerts ?? [])
    .slice()
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  if (alerts.length === 0) return null

  return (
    <div className="border border-warning/40 bg-warning/5">
      <div className="flex items-center gap-2 border-b border-warning/30 px-3 py-2">
        <HugeiconsIcon icon={Alert02Icon} className="size-4 text-warning" />
        <span className="text-sm font-medium">Case health</span>
        <span className="text-xs text-muted-foreground">
          {alerts.length} issue{alerts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="divide-y">
        {alerts.map((a) => (
          <AlertRow key={a.rule_id} alert={a} onDismiss={(al) => dismiss.mutate(al)} busy={dismiss.isPending} />
        ))}
      </div>
    </div>
  )
}
