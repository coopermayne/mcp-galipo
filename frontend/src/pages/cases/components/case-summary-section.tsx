import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, SparklesIcon, StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { updateProceeding } from "@/services/proceedings"
import type { CaseDetail, CasePerson, CaseProceeding } from "@/types/case"
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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CaseSummarySectionProps {
  caseData: CaseDetail
  onAddPerson: (category: string, roleId: number) => void
  onAiProceedings?: () => void
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
  onAiProceedings,
  onAiPeople,
  onNest,
}: CaseSummarySectionProps) {
  const queryClient = useQueryClient()
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
  const [detailProceeding, setDetailProceeding] = useState<CaseProceeding | null>(null)

  // Sort proceedings: primary first, then by sort_order
  const sortedProceedings = useMemo(
    () => [...caseData.proceedings].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    }),
    [caseData.proceedings]
  )

  const setPrimaryMutation = useMutation({
    mutationFn: (proceedingId: number) =>
      updateProceeding(proceedingId, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
      toast.success("Primary proceeding updated")
    },
    onError: (e) => toast.error(e.message),
  })

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
        {/* Proceedings list */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 border p-3">
          <div className="flex-1 space-y-1">
            {sortedProceedings.length > 0 ? (
              sortedProceedings.map((p) => {
                const parts: string[] = []
                if (p.jurisdiction_name) parts.push(p.jurisdiction_name)
                if (p.judges.length > 0) {
                  parts.push(formatJudges(p.judges))
                } else if (p.judge_name) {
                  parts.push(`Judge ${p.judge_name}`)
                }
                const detail = parts.length > 0 ? `(${parts.join(", ")})` : null
                return (
                  <div key={p.id} className="flex items-center gap-2 text-xs group/proc">
                    <button
                      type="button"
                      onClick={() => {
                        if (!p.is_primary) setPrimaryMutation.mutate(p.id)
                      }}
                      className={cn(
                        "shrink-0",
                        p.is_primary
                          ? "text-warning cursor-default"
                          : "text-muted-foreground/30 hover:text-warning/60 cursor-pointer"
                      )}
                      title={p.is_primary ? "Primary proceeding" : "Set as primary"}
                    >
                      <HugeiconsIcon icon={StarIcon} className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailProceeding(p)}
                      className="font-mono hover:underline"
                    >
                      {p.case_number}
                    </button>
                    {detail && (
                      <span className="text-muted-foreground">{detail}</span>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-muted-foreground">No proceedings</p>
            )}
          </div>
          {onAiProceedings && (
            <button
              type="button"
              onClick={onAiProceedings}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 self-end sm:self-start"
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
              Manage proceedings
            </button>
          )}
        </div>

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
        extraInvalidateKeys={[["case", caseData.id]]}
      />

      {/* Single proceeding detail dialog */}
      {detailProceeding && (
        <Dialog open={!!detailProceeding} onOpenChange={(open) => { if (!open) setDetailProceeding(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono">{detailProceeding.case_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {detailProceeding.is_primary && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Primary</Badge>
              )}
              {detailProceeding.jurisdiction_name && (
                <p className="text-muted-foreground">
                  {detailProceeding.jurisdiction_name}
                  {detailProceeding.local_rules_link && (
                    <>
                      {" — "}
                      <a
                        href={detailProceeding.local_rules_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Local Rules
                      </a>
                    </>
                  )}
                </p>
              )}
              {detailProceeding.judges.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {detailProceeding.judges.length === 1 ? "Judge" : "Judges"}
                  </p>
                  {detailProceeding.judges.map((j) => (
                    <p key={j.judge_id}>{j.role ? `${j.role}: ` : ""}{j.name}</p>
                  ))}
                </div>
              )}
              {detailProceeding.notes && (
                <p className="text-muted-foreground text-xs">{detailProceeding.notes}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
