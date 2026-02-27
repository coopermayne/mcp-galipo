import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getJudges, type JudgeListItem as JudgeListItemType } from "@/services/judges"
import { JudgeListItem } from "@/pages/judges/components/judge-list-item"
import { JudgeDetailDialog } from "@/pages/judges/components/judge-detail-dialog"

const columns: ColumnDef<JudgeListItemType>[] = [
  {
    accessorKey: "name",
    filterFn: (row, _id, value: string) => {
      const q = value.toLowerCase()
      const name = (row.original.name ?? "").toLowerCase()
      const title = (row.original.title ?? "").toLowerCase()
      const jurisdiction = (row.original.jurisdiction_name ?? "").toLowerCase()
      const phones = (row.original.phones ?? [])
        .map((p) => p.value)
        .join(" ")
        .toLowerCase()
      const emails = (row.original.emails ?? [])
        .map((e) => e.value)
        .join(" ")
        .toLowerCase()
      return (
        name.includes(q) ||
        title.includes(q) ||
        jurisdiction.includes(q) ||
        phones.includes(q) ||
        emails.includes(q)
      )
    },
  },
]

export default function JudgesPage() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [selectedJudge, setSelectedJudge] = useState<JudgeListItemType | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["judges"],
    queryFn: () => getJudges(),
  })

  const judges = useMemo(() => data?.judges ?? [], [data])

  const table = useReactTable({
    data: judges,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredJudges = table.getRowModel().rows.map((row) => row.original)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Judges</h1>
        <p className="text-muted-foreground text-sm">
          Judges across your proceedings.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
            />
            <Input
              placeholder="Search judges..."
              value={
                (table.getColumn("name")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="h-8 pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredJudges.length} judge{filteredJudges.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* List */}
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
        ) : filteredJudges.length > 0 ? (
          filteredJudges.map((judge) => (
            <JudgeListItem
              key={judge.id}
              judge={judge}
              onClick={setSelectedJudge}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No judges found.
          </div>
        )}
      </div>

      <JudgeDetailDialog
        judge={selectedJudge}
        open={!!selectedJudge}
        onOpenChange={(open) => {
          if (!open) setSelectedJudge(null)
        }}
      />
    </div>
  )
}
