import { useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { getCases } from "@/services/cases"

interface QuickCaseSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickCaseSearch({ open, onOpenChange }: QuickCaseSearchProps) {
  const navigate = useNavigate()

  const { data } = useQuery({
    queryKey: ["cases", "quick-search"],
    queryFn: () => getCases({ limit: 500 }),
    enabled: open,
    staleTime: 30_000,
  })

  const cases = data?.cases ?? []

  function handleSelect(caseId: number) {
    onOpenChange(false)
    navigate(`/cases/${caseId}`)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Case Search"
      description="Search for a case by name"
    >
      <CommandInput placeholder="Search cases..." />
      <CommandList>
        <CommandEmpty>No cases found.</CommandEmpty>
        <CommandGroup heading="Cases">
          {cases.map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.case_name} ${c.short_name ?? ""}`}
              onSelect={() => handleSelect(c.id)}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{c.case_name}</span>
                  {c.short_name && (
                    <span className="text-muted-foreground text-[11px]">
                      {c.short_name}
                    </span>
                  )}
                </div>
                <CaseStatusBadge status={c.status} />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
