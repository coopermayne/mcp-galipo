import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateCase } from "@/services/cases"
import type { CaseStatus } from "@/types/case"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const STATUS_GROUPS: { label: string; statuses: CaseStatus[] }[] = [
  { label: "Pre-Litigation", statuses: ["Signing Up", "Prospective", "Pre-Claim", "Pre-Filing"] },
  { label: "Litigation", statuses: ["Pleadings", "Discovery", "Expert Discovery", "Pre-trial"] },
  { label: "Trial & Appeal", statuses: ["Trial", "Post-Trial", "Appeal"] },
  { label: "Resolution", statuses: ["Settl. Pend.", "Stayed", "Closed"] },
]

interface StatusSelectCellProps {
  caseId: number
  status: CaseStatus
}

export function StatusSelectCell({ caseId, status }: StatusSelectCellProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (newStatus: CaseStatus) => updateCase(caseId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Status updated")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <CaseStatusBadge
            status={status}
            className={cn(
              "transition-opacity",
              mutation.isPending && "opacity-50"
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        {STATUS_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            {group.statuses.map((s) => (
              <DropdownMenuItem
                key={s}
                className={cn(
                  "gap-2 text-xs",
                  s === status && "bg-accent font-medium"
                )}
                onClick={() => {
                  if (s !== status) mutation.mutate(s)
                }}
              >
                <CaseStatusBadge status={s} className="text-[10px] px-1.5 py-0 h-4" />
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
