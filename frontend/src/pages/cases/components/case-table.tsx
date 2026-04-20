import { useMemo, useState, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
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
} from "@hugeicons/core-free-icons"
import { useNavigate } from "react-router"
import { getCase, createCase, type CreateCaseData, exportCaseReport } from "@/services/cases"
import type { ListNavState } from "@/components/common/list-nav"
import { getColumns } from "@/pages/cases/columns"
import { CaseQuickView } from "@/pages/cases/components/case-quick-view"
import { CaseFormDialog } from "@/pages/cases/components/case-form-dialog"
import { CaseChatDialog } from "@/pages/cases/components/case-chat-dialog"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import type { CaseListItem } from "@/types/case"

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
}: CaseTableProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [formOpen, setFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)

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
    meta: { onPreview },
  })

  const nameColumn = table.getColumn("case_name")

  const { data: selectedCase } = useQuery({
    queryKey: ["case", selectedCaseId],
    queryFn: () => getCase(selectedCaseId!),
    enabled: selectedCaseId != null,
  })

  return (
    <>
      {/* Search + actions */}
      <div className="flex items-center gap-2">
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

      {/* Table */}
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
