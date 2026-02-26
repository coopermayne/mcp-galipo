import { useState, useMemo, useCallback } from "react"
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
import { useNavigate, useSearchParams } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { getCases, getCaseCounts, createCase, type CreateCaseData } from "@/services/cases"
import { getUsers } from "@/services/users"
import { getColumns } from "@/pages/cases/columns"
import { CaseToolbar, type CaseScope, type CaseViewMode } from "@/pages/cases/components/case-toolbar"
import { CaseGroupedView } from "@/pages/cases/components/case-grouped-view"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { ListNavState } from "@/components/common/list-nav"

export default function CasesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const selectedStatus = searchParams.get("status")
  const setSelectedStatus = useCallback(
    (status: string | null) => {
      setSearchParams(status ? { status } : {}, { replace: true })
    },
    [setSearchParams]
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [formOpen, setFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [scope, setScope] = useState<CaseScope>("mine")
  const [viewMode, setViewMode] = useState<CaseViewMode>("table")
  const [showClosed, setShowClosed] = useState(false)

  const attorneyIds = scope === "mine" && user ? [user.id] : undefined

  const { data: casesData, isLoading } = useQuery({
    queryKey: ["cases", selectedStatus, scope, user?.id],
    queryFn: () =>
      getCases({
        status: selectedStatus ?? undefined,
        attorney_ids: attorneyIds,
        limit: 2000,
      }),
  })

  const { data: counts } = useQuery({
    queryKey: ["case-counts", scope, user?.id],
    queryFn: () => getCaseCounts(attorneyIds),
  })

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
    staleTime: 5 * 60 * 1000,
  })

  const usersMap = useMemo(() => {
    const map = new Map<number, { id: number; first_name: string; last_name: string; initials: string }>()
    if (usersData?.data) {
      for (const u of usersData.data) {
        map.set(u.id, {
          id: u.id,
          first_name: u.firstName ?? "",
          last_name: u.lastName ?? "",
          initials: u.initials ?? "",
        })
      }
    }
    return map
  }, [usersData])

  const createMutation = useMutation({
    mutationFn: (data: CreateCaseData) => createCase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case-counts"] })
      toast.success("Case created")
      setFormOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const filteredCases = useMemo(() => {
    const cases = casesData?.cases ?? []
    if (showClosed) return cases.filter((c) => c.status === "Closed")
    return cases.filter((c) => c.status !== "Closed")
  }, [casesData, showClosed])

  const columns = useMemo(() => getColumns({ usersMap }), [usersMap])

  const table = useReactTable({
    data: filteredCases,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {showClosed
            ? "Closed Cases"
            : scope === "mine"
              ? "Your Cases"
              : "All Cases"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {showClosed
            ? "Cases that have been closed."
            : scope === "mine"
              ? "Cases assigned to you."
              : "All cases in the system."}
        </p>
      </div>

      <CaseToolbar
        table={table}
        counts={counts}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        scope={scope}
        onScopeChange={setScope}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showClosed={showClosed}
        onShowClosedChange={(show) => {
          setShowClosed(show)
          if (show) setSelectedStatus(null)
        }}
        onNewCaseChat={() => setChatOpen(true)}
        onNewCaseManual={() => setFormOpen(true)}
      />

      {viewMode === "status" ? (
        <CaseGroupedView
          cases={table.getRowModel().rows.map((r) => r.original)}
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
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                    className="cursor-pointer"
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
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No cases found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <CaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
      <CaseChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}
