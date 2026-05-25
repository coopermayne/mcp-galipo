import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateCase } from "@/services/cases"
import type { CaseStatus } from "@/types/case"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface StatusGroup {
  label: string
  labelClass: string
  statuses: CaseStatus[]
}

const STATUS_GROUPS: StatusGroup[] = [
  {
    label: "PRE-LIT",
    labelClass: "text-muted-foreground",
    statuses: ["Signing Up", "Pre-Claim", "Pre-Filing"],
  },
  {
    label: "LITIGATION",
    labelClass: "text-info",
    statuses: [
      "Pleadings",
      "Discovery",
      "Expert Discovery",
      "Pre-trial",
      "Trial",
      "Post-Trial",
      "Appeal",
    ],
  },
  {
    label: "RESOLUTION",
    labelClass: "text-success",
    statuses: ["Settl. Pend.", "Stayed", "Closed"],
  },
]

interface StatusSelectCellProps {
  caseId: number
  status: CaseStatus
}

export function StatusSelectCell({ caseId, status }: StatusSelectCellProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: (newStatus: CaseStatus) => updateCase(caseId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Status updated")
    },
    onError: (e) => toast.error(e.message),
  })

  function handleStatusChange(newStatus: CaseStatus) {
    if (newStatus !== status) mutation.mutate(newStatus)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {STATUS_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase mb-1.5",
                  group.labelClass
                )}
              >
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.statuses.map((s) => {
                  const isActive = status === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 text-xs transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block size-1.5 shrink-0 border",
                          isActive
                            ? "border-foreground bg-foreground"
                            : "border-muted-foreground/50 bg-transparent"
                        )}
                      />
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
