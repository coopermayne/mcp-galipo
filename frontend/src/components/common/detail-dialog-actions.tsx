import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, Delete01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface DetailDialogActionsProps {
  entityName: string
  onDelete: () => void
  isPending?: boolean
  deleteDescription?: string
}

export function DetailDialogActions({
  entityName,
  onDelete,
  isPending,
  deleteDescription,
}: DetailDialogActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-10"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowConfirm(true)}
          >
            <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
            Delete {entityName}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entityName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDescription ??
                `This will permanently delete this ${entityName}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
