import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import type { CaseDetail, CasePerson } from "@/types/case"
import type { PersonListItem } from "@/types/person"
import { getRoles } from "@/services/roles"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PersonTree } from "@/components/common/person-tree"
import { ContactDetailDialog } from "@/components/common/contact-detail-dialog"
import { CaseProceedingsCard } from "@/pages/cases/components/case-proceedings-card"

interface CaseSummarySectionProps {
  caseData: CaseDetail
  onAddPerson: (category: string, roleId: number) => void
  onAiPeople?: () => void
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

const PERSON_BUTTONS: { category: string; label: string; hideCount?: boolean }[] = [
  { category: "all", label: "All", hideCount: true },
  { category: "client", label: "Clients" },
  { category: "defendant", label: "Defendants" },
  { category: "counsel", label: "Counsel" },
  { category: "expert", label: "Experts" },
  { category: "other", label: "Other" },
]

const CATEGORY_LABELS: Record<string, string> = {
  all: "All People",
  client: "Clients",
  defendant: "Defendants",
  counsel: "Counsel & Mediators",
  expert: "Experts",
  other: "Other",
}

function formatRoleName(name: string) {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Map a CasePerson to the PersonListItem shape that ContactDetailDialog expects. */
function casePersonToListItem(p: CasePerson): PersonListItem {
  return {
    id: p.id,
    name: p.name,
    phones: (p.phones ?? []) as PersonListItem["phones"],
    emails: (p.emails ?? []) as PersonListItem["emails"],
    organization: p.organization,
    notes: p.person_notes,
    archived: null,
    created_at: null,
  }
}

export function CaseSummarySection({
  caseData,
  onAddPerson,
  onAiPeople,
  onNest,
}: CaseSummarySectionProps) {
  const counts = usePersonCounts(caseData)
  const [peopleCategory, setPeopleCategory] = useState<string | null>(null)

  // Fetch roles for the active category (for the "+" dropdown)
  // For counsel drawer, fetch both counsel and mediator roles
  const roleQueryCategory = peopleCategory === "counsel" ? undefined : peopleCategory
  const { data: rolesData } = useQuery({
    queryKey: ["roles", roleQueryCategory],
    queryFn: () => getRoles(roleQueryCategory ?? undefined),
    enabled: !!peopleCategory && peopleCategory !== "all",
  })
  const categoryRoles = useMemo(() => {
    const all = rolesData?.roles ?? []
    if (peopleCategory === "counsel") {
      return all.filter((r) => r.category === "counsel" || r.category === "mediator")
    }
    return all
  }, [rolesData, peopleCategory])
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null)

  // Filter persons for the active drawer category
  const filteredPersons = useMemo(() => {
    if (!peopleCategory) return []
    if (peopleCategory === "all") return caseData.persons
    if (peopleCategory === "counsel") {
      return caseData.persons.filter(
        (p) => p.role.category === "counsel" || p.role.category === "mediator"
      )
    }
    return caseData.persons.filter((p) => p.role.category === peopleCategory)
  }, [caseData.persons, peopleCategory])

  function toggleCategory(category: string) {
    setPeopleCategory((prev) => (prev === category ? null : category))
  }

  function handlePersonClick(person: CasePerson) {
    setSelectedPerson(casePersonToListItem(person))
  }

  return (
    <>
      <div className="space-y-4">
        {/* Proceedings */}
        <CaseProceedingsCard caseData={caseData} />

        {/* People — category buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {PERSON_BUTTONS.map(({ category, label, hideCount }) => {
              const count = counts[category] || 0
              const isActive = peopleCategory === category
              return (
                <Button
                  key={category}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => toggleCategory(category)}
                >
                  {label}{hideCount ? "" : ` (${count})`}
                </Button>
              )
            })}
          </div>
          {onAiPeople && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs ml-auto"
              onClick={onAiPeople}
            >
              <HugeiconsIcon icon={SparklesIcon} className="mr-1 size-3" />
              People
            </Button>
          )}
        </div>

        {/* Inline people drawer */}
        {peopleCategory && (
          <div className="ring-1 ring-foreground/10 bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {CATEGORY_LABELS[peopleCategory] ?? peopleCategory}
              </span>
              {peopleCategory !== "all" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6">
                      <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {categoryRoles.map((role) => (
                      <DropdownMenuItem
                        key={role.id}
                        onClick={() => onAddPerson(peopleCategory, role.id)}
                      >
                        {formatRoleName(role.name)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <TooltipProvider>
              {filteredPersons.length > 0 ? (
                <PersonTree
                  persons={filteredPersons}
                  onNest={onNest}
                  onPersonClick={handlePersonClick}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  No persons in this category.
                </p>
              )}
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Contact detail dialog */}
      <ContactDetailDialog
        person={selectedPerson}
        open={!!selectedPerson}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null)
        }}
        caseId={caseData.id}
        extraInvalidateKeys={[["case", caseData.id]]}
      />
    </>
  )
}
