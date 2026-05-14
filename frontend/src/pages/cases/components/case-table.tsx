import { useMemo, useState, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
} from "@tanstack/react-table"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  SparklesIcon,
  NoteEditIcon,
  MoreHorizontalIcon,
  Download04Icon,
  PrinterIcon,
  TableIcon,
  LayersLogoIcon,
} from "@hugeicons/core-free-icons"
import { useNavigate } from "react-router"
import { getCase, createCase, type CreateCaseData, exportCaseReport, exportCaseListPdf, type CaseListGroupBy } from "@/services/cases"
import type { ListNavState } from "@/components/common/list-nav"
import { getColumns } from "@/pages/cases/columns"
import { CaseQuickView } from "@/pages/cases/components/case-quick-view"
import { CaseFormDialog } from "@/pages/cases/components/case-form-dialog"
import { CaseChatDialog } from "@/pages/cases/components/case-chat-dialog"
import { CaseGroupedView } from "@/pages/cases/components/case-grouped-view"
import { DataTableFacetedFilter } from "@/components/common/data-table-faceted-filter"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { CaseListItem, CaseStatus } from "@/types/case"

const ALL_STATUSES: CaseStatus[] = [
  "Signing Up",
  "Prospective",
  "Pre-Filing",
  "Pleadings",
  "Discovery",
  "Expert Discovery",
  "Pre-trial",
  "Trial",
  "Post-Trial",
  "Appeal",
  "Settl. Pend.",
  "Stayed",
  "Closed",
]

export type CaseGroupBy = "none" | "status"

export type UsersMap = Map<number, { id: number; first_name: string; last_name: string; initials: string }>

interface CaseTableProps {
  cases: CaseListItem[]
  usersMap: UsersMap
  isLoading: boolean
  isMobile: boolean
  sorting: SortingState
  onSortingChange: (s: SortingState) => void
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (v: VisibilityState) => void
  showFilters?: boolean
  groupBy?: CaseGroupBy
  onGroupByChange?: (g: CaseGroupBy) => void
}

export function CaseTable({
  cases,
  usersMap,
  isLoading,
  isMobile,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  showFilters,
  groupBy = "none",
  onGroupByChange,
}: CaseTableProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [formOpen, setFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [printing, setPrinting] = useState(false)

  const handlePrint = useCallback(async (groupBy: CaseListGroupBy) => {
    setPrinting(true)
    try {
      await exportCaseListPdf(groupBy)
    } finally {
      setPrinting(false)
    }
  }, [])

  const onPreview = useCallback((id: number) => {
    setSelectedCaseId(id)
  }, [])

  const createMutation = useMutation({
    mutationFn: (data: CreateCaseData) => createCase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Case created")
      setFormOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const columns = useMemo(() => getColumns({ usersMap, isMobile }), [usersMap, isMobile])

  const table = useReactTable({
    data: cases,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      onSortingChange(next)
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater
      onColumnVisibilityChange(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    meta: { onPreview },
  })

  const nameColumn = table.getColumn("case_name")
  const statusColumn = table.getColumn("status")
  const attorneysColumn = table.getColumn("attorneys")

  const statusOptions = useMemo(
    () => ALL_STATUSES.map((s) => ({ label: s, value: s })),
    []
  )

  const attorneyOptions = useMemo(() => {
    const users = Array.from(usersMap.values())
    users.sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    )
    return users.map((u) => ({
      label: `${u.first_name} ${u.last_name}`.trim() || u.initials,
      value: String(u.id),
    }))
  }, [usersMap])

  const filteredCases = useMemo(
    () => table.getFilteredRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getFilteredRowModel().rows]
  )

  const { data: selectedCase } = useQuery({
    queryKey: ["case", selectedCaseId],
    queryFn: () => getCase(selectedCaseId!),
    enabled: selectedCaseId != null,
  })

  return (
    <>
      {/* Search + filters + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 max-w-sm">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Search cases..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(e) => nameColumn?.setFilterValue(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        {showFilters && statusColumn && (
          <DataTableFacetedFilter
            column={statusColumn}
            title="Status"
            options={statusOptions}
          />
        )}
        {showFilters && attorneysColumn && (
          <DataTableFacetedFilter
            column={attorneysColumn}
            title="Attorney"
            options={attorneyOptions}
          />
        )}
        {showFilters && columnFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setColumnFilters([])}
            className="h-8 px-2 text-xs"
          >
            Clear
          </Button>
        )}
        {onGroupByChange && (
          <div className="flex items-center border h-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGroupByChange("none")}
              className={cn(
                "h-full px-2.5 border-0",
                groupBy === "none"
                  ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                  : "text-muted-foreground"
              )}
              title="Table view"
            >
              <HugeiconsIcon icon={TableIcon} className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGroupByChange("status")}
              className={cn(
                "h-full px-2.5 border-0",
                groupBy === "status"
                  ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                  : "text-muted-foreground"
              )}
              title="Group by status"
            >
              <HugeiconsIcon icon={LayersLogoIcon} className="size-3.5" />
            </Button>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="h-8 w-8">
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={() => exportCaseReport()}>
              <HugeiconsIcon icon={Download04Icon} className="mr-2 size-4" />
              Download Report
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={printing}>
                <HugeiconsIcon icon={PrinterIcon} className="mr-2 size-4" />
                {printing ? "Generating..." : "Print Case List"}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handlePrint("attorney")}>
                  By Attorney
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint("status")}>
                  By Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint("alphabetical")}>
                  Alphabetical
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChatOpen(true)}>
              <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
              New Case (AI)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFormOpen(true)}>
              <HugeiconsIcon icon={NoteEditIcon} className="mr-2 size-4" />
              New Case (Manual)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table or grouped view */}
      {groupBy === "status" ? (
        <CaseGroupedView
          cases={filteredCases}
          isLoading={isLoading}
          usersMap={usersMap}
        />
      ) : (
      <div className="border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer group/row"
                  data-state={selectedCaseId === row.original.id ? "selected" : undefined}
                  onClick={() => {
                    const rows = table.getRowModel().rows
                    const listIds = rows.map((r) => r.original.id)
                    const listIndex = rows.findIndex((r) => r.id === row.id)
                    navigate(`/cases/${row.original.id}`, {
                      state: { listIds, listIndex, listPath: `/cases${window.location.search}` } satisfies ListNavState,
                    })
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No cases found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Dialogs */}
      <CaseQuickView
        caseData={selectedCase ?? null}
        open={selectedCaseId != null}
        onClose={() => setSelectedCaseId(null)}
        usersMap={usersMap}
      />
      <CaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
      <CaseChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  )
}
