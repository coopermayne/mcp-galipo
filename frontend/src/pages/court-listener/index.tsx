import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
import { Search01Icon } from "@hugeicons/core-free-icons"
import { getWebhooks, deleteWebhook, unlinkWebhook } from "@/services/webhooks"
import { useCasePreview } from "@/hooks/use-case-preview"
import { getColumns, extractEntry } from "@/pages/court-listener/columns"
import { LinkCaseDialog } from "@/pages/court-listener/components/link-case-dialog"
import type { WebhookLog } from "@/types/webhook"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTablePagination } from "@/components/common/data-table-pagination"
import { DataTableFacetedFilter } from "@/components/common/data-table-faceted-filter"
import { DataTableViewOptions } from "@/components/common/data-table-view-options"

const statusFilterOptions = [
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
]

const linkFilterOptions = [
  { label: "Linked", value: "Linked" },
  { label: "Unlinked", value: "Unlinked" },
]

export default function CourtListenerPage() {
  const queryClient = useQueryClient()
  const { openCasePreview } = useCasePreview()
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [payloadWebhook, setPayloadWebhook] = useState<WebhookLog | null>(null)
  const [linkWebhookTarget, setLinkWebhookTarget] = useState<WebhookLog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks", "courtlistener"],
    queryFn: () => getWebhooks({ source: "courtlistener", limit: 1000 }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] })
      toast.success("Webhook deleted")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (id: number) => unlinkWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] })
      toast.success("Unlinked from case")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleDelete = useCallback(
    (webhook: WebhookLog) => {
      deleteMutation.mutate(webhook.id)
    },
    [deleteMutation]
  )

  const handleViewPayload = useCallback((webhook: WebhookLog) => {
    setPayloadWebhook(webhook)
  }, [])

  const handleLink = useCallback((webhook: WebhookLog) => {
    setLinkWebhookTarget(webhook)
  }, [])

  const handleUnlink = useCallback(
    (webhook: WebhookLog) => {
      unlinkMutation.mutate(webhook.id)
    },
    [unlinkMutation]
  )

  const columns = useMemo(
    () =>
      getColumns({
        onViewPayload: handleViewPayload,
        onDelete: handleDelete,
        onLink: handleLink,
        onUnlink: handleUnlink,
        onOpenCase: openCasePreview,
      }),
    [handleViewPayload, handleDelete, handleLink, handleUnlink, openCasePreview]
  )

  const webhooks = data?.webhooks ?? []

  // Docket id + count of other unlinked items sharing it, for the link dialog.
  const linkDocketId = linkWebhookTarget
    ? extractEntry(linkWebhookTarget)?.docketId ?? null
    : null
  const siblingCount =
    linkWebhookTarget && linkDocketId != null
      ? webhooks.filter(
          (w) =>
            w.id !== linkWebhookTarget.id &&
            !w.proceeding_id &&
            extractEntry(w)?.docketId === linkDocketId
        ).length
      : 0

  const table = useReactTable({
    data: webhooks,
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
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const caseNameColumn = table.getColumn("case_name")

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CourtListener</h1>
        <p className="text-muted-foreground text-sm">
          Incoming docket alerts and filings from CourtListener.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[150px] max-w-sm flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter by case name..."
            value={(caseNameColumn?.getFilterValue() as string) ?? ""}
            onChange={(e) => caseNameColumn?.setFilterValue(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        <DataTableFacetedFilter
          column={table.getColumn("link_status")}
          title="Link"
          options={linkFilterOptions}
        />
        <DataTableFacetedFilter
          column={table.getColumn("processing_status")}
          title="Status"
          options={statusFilterOptions}
        />
        <DataTableViewOptions table={table} />
      </div>

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
                <TableRow key={row.id}>
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
                  No webhooks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />

      <Dialog
        open={payloadWebhook !== null}
        onOpenChange={(open) => {
          if (!open) setPayloadWebhook(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Webhook Payload #{payloadWebhook?.id}</DialogTitle>
          </DialogHeader>
          <pre className="overflow-auto flex-1 bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
            {payloadWebhook?.payload
              ? JSON.stringify(payloadWebhook.payload, null, 2)
              : "No payload"}
          </pre>
        </DialogContent>
      </Dialog>

      <LinkCaseDialog
        webhook={linkWebhookTarget}
        docketId={linkDocketId}
        siblingCount={siblingCount}
        open={linkWebhookTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLinkWebhookTarget(null)
        }}
      />
    </div>
  )
}
