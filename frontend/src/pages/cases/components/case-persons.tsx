import { useMemo } from "react"
import type { CasePerson } from "@/types/case"

interface CasePersonsProps {
  persons: CasePerson[]
}

const CATEGORY_LABELS: Record<string, string> = {
  client: "Clients",
  internal_team: "Internal Team",
  opposing_team: "Opposing Team",
  third_party: "Third Party",
}

const CATEGORY_ORDER = ["client", "opposing_team", "third_party", "internal_team"]

export function CasePersons({ persons }: CasePersonsProps) {
  const grouped = useMemo(() => {
    const groups = new Map<string, CasePerson[]>()
    for (const p of persons) {
      const cat = p.role.category
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(p)
    }
    return CATEGORY_ORDER
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat] ?? cat, persons: groups.get(cat)! }))
  }, [persons])

  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Persons
      </h2>
      {persons.length === 0 ? (
        <p className="text-sm text-muted-foreground">No persons assigned.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.persons.map((p) => (
                  <div key={p.assignment_id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.organization && (
                        <span className="text-muted-foreground ml-1">
                          ({p.organization})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.role.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
