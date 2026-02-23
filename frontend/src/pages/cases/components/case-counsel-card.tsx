import { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import type { CasePerson } from "@/types/case"
import { PersonTree } from "@/components/common/person-tree"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CaseCounselCardProps {
  persons: CasePerson[]
  onAddPerson: (category: string) => void
  onNest?: (assignmentId: number, groupedUnderId: number | null) => void
}

export function CaseCounselCard({ persons, onAddPerson, onNest }: CaseCounselCardProps) {
  const counsel = useMemo(
    () => persons.filter((p) => p.role.category === "counsel"),
    [persons]
  )
  const mediators = useMemo(
    () => persons.filter((p) => p.role.category === "mediator"),
    [persons]
  )

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Counsel & Mediator</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onAddPerson("counsel")}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Counsel section */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Counsel
          </p>
          <PersonTree persons={counsel} onNest={onNest} />
        </div>

        {/* Mediator section */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Mediator
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={() => onAddPerson("mediator")}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3" />
            </Button>
          </div>
          <PersonTree persons={mediators} onNest={onNest} />
        </div>
      </CardContent>
    </Card>
  )
}
