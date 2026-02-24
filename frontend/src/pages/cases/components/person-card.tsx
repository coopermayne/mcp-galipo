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

interface PersonCardProps {
  title: string
  category: string
  persons: CasePerson[]
  onAdd: () => void
  onNest?: (assignmentId: number, groupedUnderId: number | null) => void
}

export function PersonCard({
  title,
  category,
  persons,
  onAdd,
  onNest,
}: PersonCardProps) {
  const filtered = useMemo(
    () => persons.filter((p) => p.role.category === category),
    [persons, category]
  )

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          {title}
          {filtered.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onAdd}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <PersonTree persons={filtered} onNest={onNest} />
      </CardContent>
    </Card>
  )
}
