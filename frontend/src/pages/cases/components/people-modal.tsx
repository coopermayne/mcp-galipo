import { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import type { CasePerson } from "@/types/case"
import { PersonTree } from "@/components/common/person-tree"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TooltipProvider } from "@/components/ui/tooltip"

const CATEGORY_LABELS: Record<string, string> = {
  client: "Clients",
  defendant: "Defendants",
  counsel: "Counsel & Mediators",
  expert: "Experts",
  other: "Other",
}

interface PeopleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: string
  persons: CasePerson[]
  onAdd: () => void
  onNest: (assignmentId: number, groupedUnderId: number | null) => void
}

export function PeopleModal({
  open,
  onOpenChange,
  category,
  persons,
  onAdd,
  onNest,
}: PeopleModalProps) {
  const filtered = useMemo(() => {
    if (category === "counsel") {
      return persons.filter(
        (p) => p.role.category === "counsel" || p.role.category === "mediator"
      )
    }
    return persons.filter((p) => p.role.category === category)
  }, [persons, category])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{CATEGORY_LABELS[category] ?? category}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={() => {
                onAdd()
                onOpenChange(false)
              }}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
              Add
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <TooltipProvider>
            <PersonTree persons={filtered} onNest={onNest} />
          </TooltipProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
