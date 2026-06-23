import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, ArrowLeft01Icon, PenTool01Icon } from "@hugeicons/core-free-icons"
import {
  consolidateWorklog,
  getWorklog,
  listPendingWorklogs,
  confirmWorklog,
  discardWorklog,
  formatMinutes,
} from "@/services/worklog"
import type { WorklogEntryInput, WorklogSelection } from "@/types/worklog"
import { WorklogInput } from "@/pages/worklog/components/worklog-input"
import { WorklogReview } from "@/pages/worklog/components/worklog-review"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatLA } from "@/lib/datetime"
import { cn } from "@/lib/utils"

export default function WorklogPage() {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<number | null>(null)

  // Active log — polled while processing so the page flips to review when ready.
  const { data: activeLog } = useQuery({
    queryKey: ["worklog", activeId],
    queryFn: () => getWorklog(activeId!),
    enabled: activeId != null,
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 2000 : false),
  })

  // Phase is derived from the active log's status — no separate state to sync.
  const status = activeLog?.status
  const phase: "input" | "processing" | "review" | "failed" =
    activeId == null ? "input"
    : status === "ready" || status === "confirmed" ? "review"
    : status === "failed" ? "failed"
    : "processing"

  // Pending "to review" list (processing + ready).
  const { data: pending } = useQuery({
    queryKey: ["worklog-pending"],
    queryFn: listPendingWorklogs,
    refetchInterval: phase === "processing" ? 3000 : false,
  })

  const consolidateMutation = useMutation({
    mutationFn: (payload: { transcript: string; log_date: string; selections: WorklogSelection[] }) =>
      consolidateWorklog(payload),
    onSuccess: (res) => {
      setActiveId(res.voice_log_id)
      queryClient.invalidateQueries({ queryKey: ["worklog-pending"] })
    },
    onError: (e) => toast.error(e.message),
  })

  const confirmMutation = useMutation({
    mutationFn: ({ id, entries }: { id: number; entries: WorklogEntryInput[] }) =>
      confirmWorklog(id, { entries }),
    onSuccess: () => {
      toast.success("Day logged")
      queryClient.invalidateQueries({ queryKey: ["worklog-pending"] })
      queryClient.invalidateQueries({ queryKey: ["worklog-by-case"] })
      setActiveId(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const discardMutation = useMutation({
    mutationFn: (id: number) => discardWorklog(id),
    onSuccess: () => {
      toast.success("Discarded")
      queryClient.invalidateQueries({ queryKey: ["worklog-pending"] })
      setActiveId(null)
    },
    onError: (e) => toast.error(e.message),
  })

  function openLog(id: number) {
    setActiveId(id)
  }

  function backToInput() {
    setActiveId(null)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2 mb-6">
        <HugeiconsIcon icon={PenTool01Icon} className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Log my day</h1>
        {phase !== "input" && (
          <Button variant="ghost" size="sm" onClick={backToInput} className="ml-auto text-xs">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            New log
          </Button>
        )}
      </div>

      {/* To-review list (only on input phase) */}
      {phase === "input" && pending && pending.length > 0 && (
        <div className="mb-6 border">
          <div className="px-3 h-10 flex items-center border-b bg-muted/30">
            <span className="text-sm font-semibold">To review</span>
            <span className="ml-1.5 text-xs text-muted-foreground">({pending.length})</span>
          </div>
          <div className="divide-y divide-border/50">
            {pending.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => openLog(w.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-medium">
                  {w.log_date ? formatLA(`${w.log_date}T00:00:00`, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider px-1.5 py-0.5",
                    w.status === "ready" ? "bg-success/15 text-success-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {w.status === "processing" ? "working…" : "ready"}
                </span>
                {w.status === "ready" && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {w.entries.length} {w.entries.length === 1 ? "entry" : "entries"} ·{" "}
                    {formatMinutes(w.entries.reduce((s, e) => s + e.minutes, 0))}
                  </span>
                )}
                {w.status === "processing" && (
                  <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin ml-auto text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "input" && (
        <WorklogInput
          onConsolidate={(payload) => consolidateMutation.mutate(payload)}
          isSubmitting={consolidateMutation.isPending}
        />
      )}

      {phase === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <HugeiconsIcon icon={Loading03Icon} className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium">Working on your day…</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Claude is splitting and estimating your work. This takes a few seconds — you can
            leave this page and come back; it'll be waiting under “To review.”
          </p>
          <div className="w-full max-w-md mt-4 space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      )}

      {phase === "review" && activeLog && (
        <WorklogReview
          worklog={activeLog}
          onConfirm={(entries) => confirmMutation.mutate({ id: activeLog.id, entries })}
          onDiscard={() => discardMutation.mutate(activeLog.id)}
          isSaving={confirmMutation.isPending}
        />
      )}

      {phase === "failed" && activeLog && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-destructive">Consolidation failed</p>
          <p className="text-xs text-muted-foreground max-w-sm">{activeLog.error || "Something went wrong."}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={backToInput}>Back</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => discardMutation.mutate(activeLog.id)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
