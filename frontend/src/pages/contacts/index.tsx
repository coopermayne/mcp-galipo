import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { useSearchParams, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { searchPersons } from "@/services/persons"
import { getColumns } from "@/pages/contacts/columns"
import { ContactsToolbar } from "@/pages/contacts/components/contacts-toolbar"
import { ContactsListView } from "@/pages/contacts/components/contacts-list-view"
import {
  categoryFromSegment,
  categoryLabel,
  ROLE_CATEGORIES,
} from "@/pages/contacts/contact-data"

export default function ContactsPage() {
  const { "*": splat } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  // Extract category from URL path (e.g., /contacts/clients → "client")
  const segment = splat?.split("/")[0] || undefined
  const category = categoryFromSegment(segment)

  const showArchived = searchParams.get("archived") === "true"

  const setShowArchived = useCallback(
    (show: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (show) {
            next.set("archived", "true")
          } else {
            next.delete("archived")
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const { data, isLoading } = useQuery({
    queryKey: ["persons", category],
    queryFn: () =>
      searchPersons({
        category: category,
        limit: 500,
        include_roles: true,
      }),
  })

  // Filter out archived unless toggled
  const allPersons = useMemo(() => {
    const persons = data?.persons ?? []
    if (showArchived) return persons.filter((p) => p.archived)
    return persons.filter((p) => !p.archived)
  }, [data, showArchived])

  const columns = useMemo(() => getColumns(), [])

  const table = useReactTable({
    data: allPersons,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredPersons = table.getRowModel().rows.map((row) => row.original)

  // Determine page title
  const pageTitle = category
    ? ROLE_CATEGORIES.find((c) => c.value === category)?.label ?? "Contacts"
    : "Contacts"
  const pageDesc = category
    ? `${categoryLabel(category)} in your cases.`
    : "All people across your cases."

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground text-sm">{pageDesc}</p>
      </div>

      <ContactsToolbar
        table={table}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        total={filteredPersons.length}
      />

      <ContactsListView
        persons={filteredPersons}
        isLoading={isLoading}
        groupByCategory={!category}
      />
    </div>
  )
}
