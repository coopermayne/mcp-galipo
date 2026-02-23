import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { CaseDetail, CaseStatus } from "@/types/case"
import { updateCase } from "@/services/cases"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { StaffAvatars } from "@/components/common/staff-avatars"
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
    statuses: ["Signing Up", "Prospective", "Pre-Filing"],
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

interface CaseDetailHeaderProps {
  caseData: CaseDetail
}

export function CaseDetailHeader({ caseData }: CaseDetailHeaderProps) {
  const queryClient = useQueryClient()
  const [statusOpen, setStatusOpen] = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
    queryClient.invalidateQueries({ queryKey: ["case-counts"] })
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ case_name: string; short_name: string; status: string }>) =>
      updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      invalidate()
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  function handleStatusChange(status: CaseStatus) {
    updateMutation.mutate({ status })
    setStatusOpen(false)
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <InlineEditField
          value={caseData.case_name}
          onSave={(v) => updateMutation.mutate({ case_name: v })}
          displayClassName="text-lg font-semibold w-fit"
          className="text-lg font-semibold"
        />
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="cursor-pointer shrink-0">
              <CaseStatusBadge status={caseData.status} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3">
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
                    {group.statuses.map((status) => {
                      const isActive = caseData.status === status
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(status)}
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
                          {status}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <StaffAvatars
          caseId={caseData.id}
          attorneys={caseData.attorneys}
          paralegals={caseData.paralegals}
        />
      </div>
      <InlineEditField
        value={caseData.short_name ?? ""}
        onSave={(v) => updateMutation.mutate({ short_name: v })}
        placeholder="Add short name..."
        displayClassName="text-xs text-muted-foreground"
      />
    </div>
  )
}
