import { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import type { PersonListItem } from "@/types/person"
import { ContactListItem } from "@/pages/contacts/components/contact-list-item"
import { ContactDetailDialog } from "@/components/common/contact-detail-dialog"
import { categoryLabel } from "@/pages/contacts/contact-data"

interface ContactsListViewProps {
  persons: PersonListItem[]
  isLoading?: boolean
  groupByCategory?: boolean
}

interface ContactGroup {
  key: string
  label: string
  persons: PersonListItem[]
}

function groupByRoleCategory(persons: PersonListItem[]): ContactGroup[] {
  const order = ["client", "counsel", "defendant", "expert", "mediator", "other"]
  const grouped = new Map<string, PersonListItem[]>()

  // Track which persons have been placed
  const placed = new Set<number>()

  for (const person of persons) {
    const categories = new Set(
      (person.roles ?? []).map((r) => r.role.category)
    )

    if (categories.size === 0) {
      // No roles - put in "unassigned"
      const list = grouped.get("unassigned") ?? []
      list.push(person)
      grouped.set("unassigned", list)
      placed.add(person.id)
      continue
    }

    // Place in primary category (first matching in order)
    for (const cat of order) {
      if (categories.has(cat)) {
        const list = grouped.get(cat) ?? []
        list.push(person)
        grouped.set(cat, list)
        placed.add(person.id)
        break
      }
    }

    // Fallback for unknown categories
    if (!placed.has(person.id)) {
      const list = grouped.get("other") ?? []
      list.push(person)
      grouped.set("other", list)
    }
  }

  const groups: ContactGroup[] = []
  for (const cat of [...order, "unassigned"]) {
    const list = grouped.get(cat)
    if (list && list.length > 0) {
      groups.push({
        key: cat,
        label: cat === "unassigned" ? "Unassigned" : categoryLabel(cat),
        persons: list,
      })
    }
  }

  return groups
}

export function ContactsListView({
  persons,
  isLoading,
  groupByCategory = false,
}: ContactsListViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null)

  const groups = useMemo(() => {
    if (!groupByCategory) {
      return [{ key: "all", label: "All", persons }]
    }
    return groupByRoleCategory(persons)
  }, [persons, groupByCategory])

  return (
    <>
      <div className="border border-border">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length > 0 && persons.length > 0 ? (
          groups.map((group) =>
            groupByCategory ? (
              <Collapsible key={group.key} defaultOpen>
                <div className="flex w-full items-center bg-muted/50 border-b border-border/50">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2 hover:bg-muted transition-colors cursor-pointer">
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-3.5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {group.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {group.persons.length}
                    </span>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  {group.persons.map((person) => (
                    <ContactListItem
                      key={person.id}
                      person={person}
                      onClick={setSelectedPerson}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <div key={group.key}>
                {group.persons.map((person) => (
                  <ContactListItem
                    key={person.id}
                    person={person}
                    onClick={setSelectedPerson}
                  />
                ))}
              </div>
            )
          )
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No contacts found.
          </div>
        )}
      </div>

      <ContactDetailDialog
        person={selectedPerson}
        open={!!selectedPerson}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null)
        }}
      />
    </>
  )
}
