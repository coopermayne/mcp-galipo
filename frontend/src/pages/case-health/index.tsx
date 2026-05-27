import { useMemo } from "react"
import { Link, Navigate, useSearchParams } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { getAlerts, dismissAlert, undismissAlert } from "@/services/alerts"
import { getStaff } from "@/services/staff"
import type { CaseAlert } from "@/types/alert"
import { severityRank } from "@/lib/alert-severity"
import { AlertRow } from "@/components/common/alert-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getBadgeStyle } from "@/lib/badge-colors"
import { cn } from "@/lib/utils"

type SeverityFilter = "all" | "error" | "warning"

export default function CaseHealthPage() {
  const { user } = useAuth()
  // Opt-in feature: hidden unless explicitly enabled for the user.
  if (user && !user.visibleFeatures?.includes("case-health")) {
    return <Navigate to="/" replace />
  }
  return <CaseHealthContent />
}

function CaseHealthContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const severityFilter = (searchParams.get("severity") as SeverityFilter) || "all"
  const showDismissed = searchParams.get("dismissed") === "true"
  const assigneeFilter = searchParams.get("assignee") || "all"

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true }
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", { includeDismissed: showDismissed }],
    queryFn: () => getAlerts({ include_dismissed: showDismissed }),
  })

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
  })

  const dismiss = useMutation({
    mutationFn: (a: CaseAlert) =>
      dismissAlert({ case_id: a.case_id, rule_id: a.rule_id, fingerprint: a.fingerprint }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
      toast.success("Alert dismissed")
    },
    onError: () => toast.error("Failed to dismiss alert"),
  })

  const restore = useMutation({
    mutationFn: (a: CaseAlert) => undismissAlert(a.case_id, a.rule_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
      toast.success("Alert restored")
    },
    onError: () => toast.error("Failed to restore alert"),
  })

  // Staff who are assigned to at least one alerted case — the people who can
  // actually act on these issues. Keeps the dropdown free of irrelevant names.
  const assigneeOptions = useMemo(() => {
    const alerts = data?.alerts ?? []
    const assigned = new Set<number>()
    for (const a of alerts) {
      for (const id of a.attorney_ids ?? []) assigned.add(id)
      for (const id of a.paralegal_ids ?? []) assigned.add(id)
    }
    return (staffData?.data ?? [])
      .filter((s) => assigned.has(s.id))
      .map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, staffData])

  const groups = useMemo(() => {
    const alerts = data?.alerts ?? []
    const assigneeId = assigneeFilter === "all" ? null : Number(assigneeFilter)
    const filtered = alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false
      if (
        assigneeId !== null &&
        !(a.attorney_ids ?? []).includes(assigneeId) &&
        !(a.paralegal_ids ?? []).includes(assigneeId)
      ) {
        return false
      }
      return true
    })
    const byCase = new Map<number, { case: CaseAlert; alerts: CaseAlert[] }>()
    for (const a of filtered) {
      if (!byCase.has(a.case_id)) byCase.set(a.case_id, { case: a, alerts: [] })
      byCase.get(a.case_id)!.alerts.push(a)
    }
    const arr = [...byCase.values()]
    for (const g of arr) {
      g.alerts.sort((x, y) => severityRank[x.severity] - severityRank[y.severity])
    }
    arr.sort((a, b) => {
      const aMin = Math.min(...a.alerts.map((x) => severityRank[x.severity]))
      const bMin = Math.min(...b.alerts.map((x) => severityRank[x.severity]))
      if (aMin !== bMin) return aMin - bMin
      const an = a.case.short_name ?? a.case.case_name
      const bn = b.case.short_name ?? b.case.case_name
      return an.localeCompare(bn)
    })
    return arr
  }, [data, severityFilter, assigneeFilter])

  const busy = dismiss.isPending || restore.isPending

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Case Health</h1>
        <p className="text-muted-foreground text-sm">
          Data-quality and consistency issues across active cases.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={severityFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setParam("severity", "")}
          >
            All{data ? ` (${data.error_count + data.warning_count})` : ""}
          </Button>
          <Button
            variant={severityFilter === "error" ? "default" : "outline"}
            size="sm"
            onClick={() => setParam("severity", "error")}
          >
            Must fix{data ? ` (${data.error_count})` : ""}
          </Button>
          <Button
            variant={severityFilter === "warning" ? "default" : "outline"}
            size="sm"
            onClick={() => setParam("severity", "warning")}
          >
            Review{data ? ` (${data.warning_count})` : ""}
          </Button>
          <Select
            value={assigneeFilter}
            onValueChange={(v) => setParam("assignee", v === "all" ? "" : v)}
          >
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue placeholder="Assigned to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {assigneeOptions.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={showDismissed ? "secondary" : "ghost"}
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => setParam("dismissed", showDismissed ? "" : "true")}
        >
          {showDismissed ? "Hide dismissed" : "Show dismissed"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-8 text-success" />
          <p className="text-sm text-muted-foreground">
            No issues. Every active case looks healthy.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.case.case_id} className="border bg-card">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    style={getBadgeStyle(g.case.case_color)}
                    className="whitespace-nowrap"
                  >
                    {g.case.short_name ?? g.case.case_name}
                  </Badge>
                  <span className="truncate text-sm text-muted-foreground">
                    {g.case.case_name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    · {g.case.case_status}
                  </span>
                </div>
                <Link
                  to={`/cases/${g.case.case_id}`}
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-xs text-muted-foreground",
                    "hover:text-foreground"
                  )}
                >
                  Open case
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                </Link>
              </div>
              <div className="divide-y">
                {g.alerts.map((a) => (
                  <AlertRow
                    key={a.rule_id}
                    alert={a}
                    onDismiss={(al) => dismiss.mutate(al)}
                    onRestore={(al) => restore.mutate(al)}
                    busy={busy}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
