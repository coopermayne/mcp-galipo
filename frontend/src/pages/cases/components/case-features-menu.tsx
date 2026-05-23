import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon } from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { updateCase } from "@/services/cases"
import {
  CASE_FEATURE_DEFINITIONS,
  isCaseFeatureEnabled,
  type CaseDetail,
  type CaseFeatureKey,
  type CaseFeatureToggles,
} from "@/types/case"

interface CaseFeaturesMenuProps {
  caseData: CaseDetail
}

export function CaseFeaturesMenu({ caseData }: CaseFeaturesMenuProps) {
  const queryClient = useQueryClient()
  const toggles = caseData.feature_toggles ?? {}
  const counts = caseData.feature_data_counts ?? {
    tasks: 0, events: 0, financials: 0, costs: 0,
  }

  const mutation = useMutation({
    mutationFn: (next: CaseFeatureToggles) =>
      updateCase(caseData.id, { feature_toggles: next }),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
    },
    onError: (e) => toast.error(e.message),
  })

  function handleToggle(key: CaseFeatureKey, on: boolean) {
    const next: CaseFeatureToggles = { ...toggles, [key]: on }
    mutation.mutate(next)
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Case sections"
            >
              <HugeiconsIcon icon={Settings02Icon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Show/hide sections</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Page sections</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CASE_FEATURE_DEFINITIONS.map((def) => {
          const isOn = isCaseFeatureEnabled(toggles, def.key)
          const count = counts[def.key] ?? 0
          const lockedOn = isOn && count > 0
          return (
            <DropdownMenuCheckboxItem
              key={def.key}
              checked={isOn}
              disabled={lockedOn}
              onCheckedChange={(checked) => handleToggle(def.key, !!checked)}
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex flex-col">
                <span>{def.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {lockedOn
                    ? `${count} record${count === 1 ? "" : "s"} — delete to hide`
                    : def.description}
                </span>
              </div>
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
