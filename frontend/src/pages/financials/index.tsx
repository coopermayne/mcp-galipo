import { useState, useEffect, useMemo, useCallback } from "react"
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
import { useSearchParams } from "react-router"
import { useCasePreview } from "@/hooks/use-case-preview"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { getFinancials, getFinancialCounts } from "@/services/financials"
import { getUsers } from "@/services/users"
import { getColumns } from "@/pages/financials/columns"
import { FinancialToolbar, type FinancialScope } from "@/pages/financials/components/financial-toolbar"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function FinancialsPage() {
  const { openCasePreview } = useCasePreview()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedType = searchParams.get("type")
  const setSelectedType = useCallback(
    (type: string | null) => {
      setSearchParams(type ? { type } : {}, { replace: true })
    },
    [setSearchParams]
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => ({
    attorneys: !isMobile, finalized: !isMobile, resolution_date: !isMobile,
  }))

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      setColumnVisibility({ attorneys: !e.matches, finalized: !e.matches, resolution_date: !e.matches })
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const [scope, setScope] = useState<FinancialScope>("all")
  const [finalizedFilter, setFinalizedFilter] = useState<boolean | null>(null)

  const attorneyIds = scope === "mine" && user ? [user.id] : undefined

  const { data: financialsData, isLoading } = useQuery({
    queryKey: ["financials", selectedType, scope, user?.id, finalizedFilter],
    queryFn: () =>
      getFinancials({
        resolution_type: selectedType ?? undefined,
        attorney_ids: attorneyIds,
        is_finalized: finalizedFilter ?? undefined,
        limit: 2000,
      }),
  })

  const { data: counts } = useQuery({
    queryKey: ["financial-counts", scope, user?.id],
    queryFn: () => getFinancialCounts(attorneyIds),
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

  const financials = financialsData?.financials ?? []

  const columns = useMemo(() => getColumns({ usersMap, isMobile }), [usersMap, isMobile])

  const table = useReactTable({
    data: financials,
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
          {scope === "mine" ? "Your Financials" : "Case Financials"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Settlement and judgment financial records.
        </p>
      </div>

      <FinancialToolbar
        table={table}
        counts={counts}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        scope={scope}
        onScopeChange={setScope}
        finalizedFilter={finalizedFilter}
        onFinalizedFilterChange={setFinalizedFilter}
      />

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
                  onClick={() => openCasePreview(row.original.case_id)}
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
                  No financial records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {!isLoading && table.getRowModel().rows.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/40">
                <TableCell className="font-medium text-xs">
                  Totals ({table.getRowModel().rows.length})
                </TableCell>
                <TableCell className="tabular-nums font-medium">
                  {formatCurrency(
                    table.getRowModel().rows.reduce(
                      (sum, row) => sum + (row.original.gross_recovery ?? 0), 0
                    )
                  )}
                </TableCell>
                <TableCell className="tabular-nums font-medium">
                  {formatCurrency(
                    table.getRowModel().rows.reduce(
                      (sum, row) => sum + (row.original.our_fee ?? 0), 0
                    )
                  )}
                </TableCell>
                {Array.from({ length: table.getVisibleFlatColumns().length - 3 }).map((_, i) => (
                  <TableCell key={i} />
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
