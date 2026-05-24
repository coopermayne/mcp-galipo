import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon, StarIcon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { CaseProceeding } from "@/types/case"
import { deleteProceeding, updateProceeding } from "@/services/proceedings"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/** Format judges array into compact string */
function formatJudges(judges: { name: string; role: string | null }[]): string {
  return judges
    .map((j) => {
      if (!j.role || j.role === "Judge") return j.name
      if (j.role === "Magistrate Judge") return `${j.name} (Mag.)`
      return `${j.name} (${j.role})`
    })
    .join(", ")
}

interface ProceedingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  proceedings: CaseProceeding[]
}

export function ProceedingsModal({
  open,
  onOpenChange,
  caseId,
  proceedings,
}: ProceedingsModalProps) {
  const queryClient = useQueryClient()
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProceeding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Proceeding removed")
    },
    onError: (e) => toast.error(e.message),
  })

  const setPrimaryMutation = useMutation({
    mutationFn: (proceedingId: number) =>
      updateProceeding(proceedingId, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Primary proceeding updated")
    },
    onError: (e) => toast.error(e.message),
  })

  // Sort: primary first, then by sort_order
  const sorted = [...proceedings].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Proceedings
            {proceedings.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({proceedings.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {proceedings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No proceedings yet.</p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {sorted.map((p) => (
              <div
                key={p.id}
                className="border p-3 space-y-2 group/proc hover:bg-muted/20 transition-colors"
              >
                {/* Header row: star + case number + primary badge + delete */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!p.is_primary) setPrimaryMutation.mutate(p.id)
                    }}
                    className={cn(
                      "shrink-0",
                      p.is_primary
                        ? "text-warning cursor-default"
                        : "text-muted-foreground/30 hover:text-warning/60 cursor-pointer"
                    )}
                    title={p.is_primary ? "Primary proceeding" : "Set as primary"}
                  >
                    <HugeiconsIcon icon={StarIcon} className="size-3.5" />
                  </button>
                  <span className="text-sm font-mono font-medium">
                    {p.case_number}
                  </span>
                  {p.is_primary && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                      Primary
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover/proc:opacity-100 transition-opacity ml-auto shrink-0"
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                  </button>
                </div>

                {/* Detail rows */}
                <div className="pl-5.5 space-y-1">
                  {p.jurisdiction_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {p.jurisdiction_name}
                      </span>
                      {p.local_rules_link && (
                        <a
                          href={p.local_rules_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <HugeiconsIcon icon={LinkSquare02Icon} className="size-3" />
                          Local Rules
                        </a>
                      )}
                    </div>
                  )}
                  {p.judges.length > 0 && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">
                        {p.judges.length === 1 ? "Judge:" : "Judges:"}
                      </span>{" "}
                      {formatJudges(p.judges)}
                    </p>
                  )}
                  {p.notes && (
                    <p className="text-xs text-muted-foreground italic">{p.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete proceeding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this proceeding and all judge assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
