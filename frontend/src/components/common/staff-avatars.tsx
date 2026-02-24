import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { CaseStaffUser } from "@/types/case"
import {
  getStaff,
  assignAttorney,
  removeAttorney,
  assignParalegal,
  removeParalegal,
} from "@/services/staff"
import { getAvatarStyleById } from "@/lib/badge-colors"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface StaffAvatarsProps {
  caseId: number
  attorneys: CaseStaffUser[]
  paralegals: CaseStaffUser[]
}

export function StaffAvatars({
  caseId,
  attorneys,
  paralegals,
}: StaffAvatarsProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    enabled: open,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
  }

  const addAttorney = useMutation({
    mutationFn: (userId: number) => assignAttorney(caseId, userId),
    onSuccess: () => {
      toast.success("Attorney assigned")
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const removeAtty = useMutation({
    mutationFn: (userId: number) => removeAttorney(caseId, userId),
    onSuccess: () => {
      toast.success("Attorney removed")
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const addParalegal = useMutation({
    mutationFn: (userId: number) => assignParalegal(caseId, userId),
    onSuccess: () => {
      toast.success("Paralegal assigned")
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const removePara = useMutation({
    mutationFn: (userId: number) => removeParalegal(caseId, userId),
    onSuccess: () => {
      toast.success("Paralegal removed")
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const allStaff = staffData?.data ?? []
  const assignedIds = new Set([
    ...attorneys.map((a) => a.id),
    ...paralegals.map((p) => p.id),
  ])
  const availableAttorneys = allStaff.filter(
    (s) => s.position === "attorney" && !assignedIds.has(s.id)
  )
  const availableParalegals = allStaff.filter(
    (s) => s.position === "paralegal" && !assignedIds.has(s.id)
  )

  const allAssigned = [...attorneys, ...paralegals]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1 cursor-pointer">
          {allAssigned.length > 0 ? (
            allAssigned.map((user) => (
              <span
                key={user.id}
                className="inline-flex size-5 items-center justify-center text-[9px] font-medium shrink-0"
                style={getAvatarStyleById(user.id)}
              >
                {user.initials}
              </span>
            ))
          ) : (
            <span className="inline-flex size-5 items-center justify-center border border-dashed border-muted-foreground/40 text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground transition-colors">
              <HugeiconsIcon icon={Add01Icon} className="size-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-0">
        <div className="p-2 space-y-0.5">
          {/* Assigned staff */}
          {allAssigned.length > 0 && (
            <>
              {attorneys.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-1.5 py-1 text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
                      style={getAvatarStyleById(a.id)}
                    >
                      {a.initials}
                    </span>
                    {a.first_name} {a.last_name}
                    <span className="text-muted-foreground">Atty</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAtty.mutate(a.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                  </button>
                </div>
              ))}
              {paralegals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-1.5 py-1 text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
                      style={getAvatarStyleById(p.id)}
                    >
                      {p.initials}
                    </span>
                    {p.first_name} {p.last_name}
                    <span className="text-muted-foreground">PL</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removePara.mutate(p.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                  </button>
                </div>
              ))}
              <div className="border-t border-border/50 my-1" />
            </>
          )}

          {/* Available attorneys */}
          {availableAttorneys.length > 0 && (
            <>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1.5 pt-1">
                Attorneys
              </p>
              {availableAttorneys.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addAttorney.mutate(s.id)}
                  className="flex items-center gap-1.5 w-full px-1.5 py-1 text-xs hover:bg-accent transition-colors"
                >
                  <span
                    className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
                    style={getAvatarStyleById(s.id)}
                  >
                    {s.initials}
                  </span>
                  {s.firstName} {s.lastName}
                </button>
              ))}
            </>
          )}

          {/* Available paralegals */}
          {availableParalegals.length > 0 && (
            <>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1.5 pt-1">
                Paralegals
              </p>
              {availableParalegals.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addParalegal.mutate(s.id)}
                  className="flex items-center gap-1.5 w-full px-1.5 py-1 text-xs hover:bg-accent transition-colors"
                >
                  <span
                    className="inline-flex size-4 items-center justify-center text-[8px] font-medium shrink-0"
                    style={getAvatarStyleById(s.id)}
                  >
                    {s.initials}
                  </span>
                  {s.firstName} {s.lastName}
                </button>
              ))}
            </>
          )}

          {availableAttorneys.length === 0 &&
            availableParalegals.length === 0 &&
            allAssigned.length > 0 && (
              <p className="text-xs text-muted-foreground px-1.5 py-1">
                All staff assigned.
              </p>
            )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
