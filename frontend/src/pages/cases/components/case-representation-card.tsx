import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { RepresentationOrganizer } from "@/pages/cases/components/representation-organizer"
import type { CaseDetail } from "@/types/case"

/**
 * Collapsible "Representation" section on the case detail page. Defaults open
 * once a layout exists, collapsed otherwise to stay out of the way.
 */
export function CaseRepresentationCard({ caseData }: { caseData: CaseDetail }) {
  const hasLayout = (caseData.representation_layout?.rows?.length ?? 0) > 0

  return (
    <Card size="sm">
      <Collapsible defaultOpen={hasLayout}>
        <CollapsibleTrigger className="group/rep flex w-full items-center justify-between border-b bg-muted/40 px-4 py-3 hover:bg-muted transition-colors cursor-pointer">
          <span className="text-sm font-semibold">Representation</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className="size-4 text-muted-foreground transition-transform group-data-[state=closed]/rep:-rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-3">
            <RepresentationOrganizer
              caseId={caseData.id}
              casePersons={caseData.persons}
              initialLayout={caseData.representation_layout}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
