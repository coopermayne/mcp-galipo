import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon } from "@hugeicons/core-free-icons"
import type { CaseProceeding } from "@/types/case"
import { deleteProceeding } from "@/services/proceedings"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proceedings ({proceedings.length})</DialogTitle>
        </DialogHeader>
        <div className="pt-2 space-y-3">
          {proceedings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No proceedings yet.
            </p>
          ) : (
            proceedings.map((p) => (
              <div
                key={p.id}
                className="border p-3 space-y-1.5 group/proc"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold">
                    {p.case_number}
                  </span>
                  {p.is_primary && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
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
                {p.jurisdiction_name && (
                  <p className="text-xs text-muted-foreground">
                    {p.jurisdiction_name}
                    {p.local_rules_link && (
                      <>
                        {" "}
                        <a
                          href={p.local_rules_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Local Rules
                        </a>
                      </>
                    )}
                  </p>
                )}
                {p.judges.length > 0 && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">
                      {p.judges.length === 1 ? "Judge:" : "Judges:"}
                    </span>{" "}
                    {p.judges.map((j) => j.name).join(", ")}
                  </p>
                )}
                {p.notes && (
                  <p className="text-xs text-muted-foreground">{p.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
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
