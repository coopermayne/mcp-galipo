import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
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
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
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
        <button type="button" className="flex items-center cursor-pointer">
          {allAssigned.length > 0 ? (
            <div className="flex gap-1">
              {allAssigned.map((user) => (
                <Avatar key={user.id} size="sm">
                  <AvatarFallback style={getAvatarStyleById(user.id)}>{user.initials}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <Avatar size="sm">
              <AvatarFallback className="text-[10px]">+</AvatarFallback>
            </Avatar>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
          <div className="p-3 space-y-3">
            {/* Assigned staff */}
            {allAssigned.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Assigned
                </p>
                {attorneys.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <span>
                      {a.first_name} {a.last_name}{" "}
                      <span className="text-muted-foreground">Attorney</span>
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
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <span>
                      {p.first_name} {p.last_name}{" "}
                      <span className="text-muted-foreground">Paralegal</span>
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
              </div>
            )}

            {/* Available attorneys */}
            {availableAttorneys.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Add Attorney
                </p>
                {availableAttorneys.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addAttorney.mutate(s.id)}
                    className="flex items-center gap-2 w-full py-1 text-xs hover:bg-accent px-1 transition-colors"
                  >
                    <Avatar size="sm">
                      <AvatarFallback style={getAvatarStyleById(s.id)}>{s.initials}</AvatarFallback>
                    </Avatar>
                    {s.firstName} {s.lastName}
                  </button>
                ))}
              </div>
            )}

            {/* Available paralegals */}
            {availableParalegals.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Add Paralegal
                </p>
                {availableParalegals.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addParalegal.mutate(s.id)}
                    className="flex items-center gap-2 w-full py-1 text-xs hover:bg-accent px-1 transition-colors"
                  >
                    <Avatar size="sm">
                      <AvatarFallback style={getAvatarStyleById(s.id)}>{s.initials}</AvatarFallback>
                    </Avatar>
                    {s.firstName} {s.lastName}
                  </button>
                ))}
              </div>
            )}

            {availableAttorneys.length === 0 &&
              availableParalegals.length === 0 &&
              allAssigned.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  All staff members are already assigned.
                </p>
              )}
          </div>
        </PopoverContent>
    </Popover>
  )
}
