import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CourtLawIcon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { Button } from "@/components/ui/button"
import { PeopleModal } from "./people-modal"
import { ProceedingsModal } from "./proceedings-modal"

interface CaseSummarySectionProps {
  caseData: CaseDetail
  onAddPerson: (category: string) => void
  onAddProceeding: () => void
  onNest: (assignmentId: number, groupedUnderId: number | null) => void
}

/** Categorize persons by role category and count them. */
function usePersonCounts(caseData: CaseDetail) {
  return useMemo(() => {
    const cats: Record<string, number> = {
      client: 0,
      defendant: 0,
      counsel: 0,
      mediator: 0,
      expert: 0,
      other: 0,
    }
    for (const p of caseData.persons) {
      const cat = p.role.category
      if (cat in cats) cats[cat]++
      else cats.other++
    }
    // Merge mediator into counsel for display
    cats.counsel += cats.mediator
    return cats
  }, [caseData.persons])
}

const PERSON_BUTTONS: { category: string; label: string }[] = [
  { category: "client", label: "Clients" },
  { category: "defendant", label: "Defendants" },
  { category: "counsel", label: "Counsel" },
  { category: "expert", label: "Experts" },
  { category: "other", label: "Other" },
]

/** Format judges array into compact string like "Judge X, Mag. Judge Y" */
function formatJudges(judges: { name: string; role: string | null }[]): string {
  return judges
    .map((j) => {
      if (!j.role || j.role === "Judge") return `Judge ${j.name}`
      if (j.role === "Magistrate Judge") return `Mag. Judge ${j.name}`
      return `${j.role} ${j.name}`
    })
    .join(", ")
}

export function CaseSummarySection({
  caseData,
  onAddPerson,
  onAddProceeding,
  onNest,
}: CaseSummarySectionProps) {
  const counts = usePersonCounts(caseData)
  const [peopleCategory, setPeopleCategory] = useState<string | null>(null)
  const [proceedingsOpen, setProceedingsOpen] = useState(false)

  const primary = useMemo(
    () => caseData.proceedings.find((p) => p.is_primary) ?? caseData.proceedings[0] ?? null,
    [caseData.proceedings]
  )

  // Build compact proceedings line: "1-c-1234 (C.D. Cal., Judge Dolly M. Gee)"
  const proceedingLine = useMemo(() => {
    if (!primary) return null
    const parts: string[] = []
    if (primary.jurisdiction_name) parts.push(primary.jurisdiction_name)
    if (primary.judges.length > 0) {
      parts.push(formatJudges(primary.judges))
    } else if (primary.judge_name) {
      parts.push(`Judge ${primary.judge_name}`)
    }
    return {
      caseNumber: primary.case_number,
      detail: parts.length > 0 ? `(${parts.join(", ")})` : null,
    }
  }, [primary])

  const proceedingCount = caseData.proceedings.length

  return (
    <>
      <div className="space-y-2">
        {/* Compact proceedings line */}
        <div className="flex items-center gap-2 text-xs">
          {proceedingLine ? (
            <>
              <HugeiconsIcon icon={CourtLawIcon} className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono font-semibold">{proceedingLine.caseNumber}</span>
              {proceedingLine.detail && (
                <span className="text-muted-foreground">{proceedingLine.detail}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No proceedings</span>
          )}
          <button
            type="button"
            onClick={() => proceedingCount > 0 ? setProceedingsOpen(true) : onAddProceeding()}
            className="text-primary hover:underline shrink-0 ml-auto"
          >
            {proceedingCount > 0 ? `Proceedings (${proceedingCount})` : "+ Add"}
          </button>
        </div>

        {/* People — category buttons */}
        <div className="flex flex-wrap gap-1.5">
          {PERSON_BUTTONS.map(({ category, label }) => {
            const count = counts[category] || 0
            return (
              <Button
                key={category}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setPeopleCategory(category)}
              >
                {label} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      <PeopleModal
        open={peopleCategory !== null}
        onOpenChange={(open) => !open && setPeopleCategory(null)}
        category={peopleCategory ?? "client"}
        persons={caseData.persons}
        onAdd={() => {
          if (peopleCategory) onAddPerson(peopleCategory)
        }}
        onNest={onNest}
      />
      <ProceedingsModal
        open={proceedingsOpen}
        onOpenChange={setProceedingsOpen}
        caseId={caseData.id}
        proceedings={caseData.proceedings}
        onAdd={onAddProceeding}
      />
    </>
  )
}
