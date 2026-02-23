import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, Delete01Icon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { updateCase, deleteCase, type CreateCaseData } from "@/services/cases"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { CaseFormDialog } from "@/pages/cases/components/case-form-dialog"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

interface CaseDetailHeaderProps {
  caseData: CaseDetail
}

export function CaseDetailHeader({ caseData }: CaseDetailHeaderProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data: CreateCaseData) => updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case-counts"] })
      toast.success("Case updated")
      setEditOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCase(caseData.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case-counts"] })
      toast.success("Case deleted")
      navigate("/cases")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{caseData.case_name}</h1>
          <CaseStatusBadge status={caseData.status} />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 size-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      <CaseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={(data) => updateMutation.mutate(data)}
        isPending={updateMutation.isPending}
        initialData={{
          case_name: caseData.case_name,
          status: caseData.status,
          short_name: caseData.short_name ?? "",
          print_code: caseData.print_code ?? "",
          date_of_injury: caseData.date_of_injury ?? "",
          case_summary: caseData.case_summary ?? "",
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this case?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{caseData.case_name}" and all associated tasks, events, notes, and proceedings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
