import { useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table"
import { useNavigate } from "react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TrialItem, BlockingEvent } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"
import { getTrialColumns, type CalendarTableRow } from "@/pages/trial-calendar/components/trial-columns"

export function TrialTable({
  trials,
  blockingEvents,
  staffMap,
  onEditEvent,
}: {
  trials: TrialItem[]
  blockingEvents: BlockingEvent[]
  staffMap: Map<number, StaffMember>
  onEditEvent?: (event: BlockingEvent) => void
}) {
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([
    { id: "trial", desc: false },
  ])

  const rows = useMemo<CalendarTableRow[]>(() => {
    const trialRows: CalendarTableRow[] = trials.map((t) => ({
      kind: "trial" as const,
      date: t.trial_date,
      trial: t,
    }))
    const eventRows: CalendarTableRow[] = blockingEvents.map((e) => ({
      kind: "event" as const,
      date: e.date,
      event: e,
    }))
    return [...trialRows, ...eventRows]
  }, [trials, blockingEvents])

  const columns = useMemo(() => getTrialColumns({ staffMap }), [staffMap])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
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
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer group/row"
                onClick={() => {
                  if (row.original.kind === "trial") {
                    navigate(`/cases/${row.original.trial.case_id}`)
                  } else if (row.original.kind === "event" && onEditEvent) {
                    onEditEvent(row.original.event)
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No upcoming items.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
