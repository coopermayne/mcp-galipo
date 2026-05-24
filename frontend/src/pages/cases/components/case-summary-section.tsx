import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, SparklesIcon, StarIcon, CourtLawIcon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { updateProceeding } from "@/services/proceedings"
import type { CaseDetail, CasePerson, CaseProceeding } from "@/types/case"
import type { PersonListItem } from "@/types/person"
import { getRoles } from "@/services/roles"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
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
import { AddProceedingDialog } from "@/pages/cases/components/add-proceeding-dialog"

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
  const [addProceedingOpen, setAddProceedingOpen] = useState(false)

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
        {/* Proceedings */}
        <Card size="sm">
          <CardHeader className="border-b bg-muted/40">
            <CardTitle>
              Proceedings
              {sortedProceedings.length > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({sortedProceedings.length})
                </span>
              )}
            </CardTitle>
            <CardAction>
              {onAiProceedings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={onAiProceedings}
                >
                  <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setAddProceedingOpen(true)}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {sortedProceedings.length > 0 ? (
              <div className="divide-y divide-border/50">
                {sortedProceedings.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 group/proc hover:bg-muted/30 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!p.is_primary) setPrimaryMutation.mutate(p.id)
                      }}
                      className={cn(
                        "shrink-0 mt-0.5",
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
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium hover:underline">
                          {p.case_number}
                        </span>
                        {p.is_primary && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                            Primary
                          </Badge>
                        )}
                      </div>
                      {(p.jurisdiction_name || p.judges.length > 0 || p.judge_name) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {p.jurisdiction_name && (
                            <span className="text-[11px] text-muted-foreground">
                              {p.jurisdiction_name}
                            </span>
                          )}
                          {(p.judges.length > 0 || p.judge_name) && (
                            <>
                              {p.jurisdiction_name && (
                                <span className="text-muted-foreground/40 text-[11px]">/</span>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {p.judges.length > 0
                                  ? formatJudges(p.judges)
                                  : p.judge_name
                                    ? `Judge ${p.judge_name}`
                                    : null}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <HugeiconsIcon icon={CourtLawIcon} className="size-5 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No proceedings yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={() => setAddProceedingOpen(true)}
                >
                  Add Proceeding
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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

      {/* Single proceeding detail dialog */}
      {detailProceeding && (
        <Dialog open={!!detailProceeding} onOpenChange={(open) => { if (!open) setDetailProceeding(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono">{detailProceeding.case_number}</span>
                {detailProceeding.is_primary && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">Primary</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {detailProceeding.jurisdiction_name && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Jurisdiction</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{detailProceeding.jurisdiction_name}</p>
                    {detailProceeding.local_rules_link && (
                      <a
                        href={detailProceeding.local_rules_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <HugeiconsIcon icon={LinkSquare02Icon} className="size-3" />
                        Local Rules
                      </a>
                    )}
                  </div>
                </div>
              )}
              {detailProceeding.judges.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {detailProceeding.judges.length === 1 ? "Judge" : "Judges"}
                  </p>
                  <div className="space-y-1">
                    {detailProceeding.judges.map((j) => (
                      <div key={j.judge_id} className="flex items-baseline gap-2 text-sm">
                        <span>{j.name}</span>
                        {j.role && j.role !== "Judge" && (
                          <span className="text-[11px] text-muted-foreground">({j.role})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailProceeding.notes && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-muted-foreground">{detailProceeding.notes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add proceeding dialog */}
      <AddProceedingDialog
        open={addProceedingOpen}
        onOpenChange={setAddProceedingOpen}
        caseId={caseData.id}
      />
    </>
  )
}
