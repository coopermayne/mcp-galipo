import type { ColumnDef } from "@tanstack/react-table"
import { Link } from "react-router"
import type { WebhookLog } from "@/types/webhook"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  ViewIcon,
  MoreHorizontalIcon,
  Download04Icon,
  Link01Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { formatTimestamp } from "@/lib/datetime"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const CL_STORAGE_BASE = "https://storage.courtlistener.com"
const CL_BASE = "https://www.courtlistener.com"

interface RecapDocument {
  id: number
  description: string
  filepath_local: string
  is_available: boolean
  page_count: number | null
  document_number: string
  attachment_number: number | null
  absolute_url: string
  file_size: number | null
}

interface DocketEntry {
  id: number
  docket: number
  description: string
  entry_number: number | null
  date_filed: string | null
  recap_documents: RecapDocument[]
}

export interface ParsedEntry {
  caseName: string | null
  docketId: number
  entryNumber: number | null
  description: string
  dateFiled: string | null
  documents: RecapDocument[]
}

/** Extract structured data from a CourtListener webhook payload. */
export function extractEntry(webhook: WebhookLog): ParsedEntry | null {
  const raw = webhook.payload as Record<string, unknown> | null
  if (!raw) return null

  // Structure: { payload: { results: [DocketEntry] }, webhook: { ... } }
  const inner = raw.payload as Record<string, unknown> | undefined
  const results = inner?.results as DocketEntry[] | undefined
  if (!results?.length) return null

  const entry = results[0]
  const docs = entry.recap_documents ?? []

  // Extract case name from first document's absolute_url slug
  // e.g. "/docket/67667753/89/ev-v-city-of-covina/" → "Ev v. City of Covina"
  let caseName: string | null = null
  if (docs.length > 0 && docs[0].absolute_url) {
    const parts = docs[0].absolute_url.split("/").filter(Boolean)
    // format: ["docket", docketId, entryNum, "case-name-slug"]
    if (parts.length >= 4) {
      caseName = slugToCaseName(parts[3])
    }
  }

  return {
    caseName,
    docketId: entry.docket,
    entryNumber: entry.entry_number,
    description: entry.description,
    dateFiled: entry.date_filed,
    documents: docs,
  }
}

/** Convert a URL slug like "ev-v-city-of-covina" to "Ev v. City of Covina" */
function slugToCaseName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(/ V /g, " v. ")
    .replace(/ Of /g, " of ")
    .replace(/ The /g, " the ")
    .replace(/ And /g, " and ")
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  processing: "bg-info text-info-foreground",
  completed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(dateStr: string | null): string {
  return formatTimestamp(dateStr)
}

interface ColumnOptions {
  onViewPayload: (webhook: WebhookLog) => void
  onDelete: (webhook: WebhookLog) => void
  onLink: (webhook: WebhookLog) => void
  onUnlink: (webhook: WebhookLog) => void
}

export function getColumns({
  onViewPayload,
  onDelete,
  onLink,
  onUnlink,
}: ColumnOptions): ColumnDef<WebhookLog>[] {
  return [
    {
      id: "linked_case",
      accessorFn: (row) => row.case_name ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Case" />
      ),
      cell: ({ row }) => {
        const wh = row.original
        if (!wh.case_id || !wh.case_name) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <Link
            to={`/cases/${wh.case_id}`}
            className="font-medium hover:underline"
            title={wh.case_number ?? undefined}
          >
            {wh.case_name}
          </Link>
        )
      },
      filterFn: "includesString",
    },
    {
      id: "link_status",
      accessorFn: (row) => (row.proceeding_id ? "Linked" : "Unlinked"),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Link" />
      ),
      cell: ({ row }) => {
        const linked = !!row.original.proceeding_id
        return (
          <Badge
            className={cn(
              "border-0 font-medium",
              linked
                ? "bg-success text-success-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {linked ? "Linked" : "Unlinked"}
          </Badge>
        )
      },
      filterFn: (row, id, value: string[]) => {
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      id: "case_name",
      accessorFn: (row) => extractEntry(row)?.caseName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Docket" />
      ),
      cell: ({ row }) => {
        const entry = extractEntry(row.original)
        if (!entry?.caseName) return <span className="text-muted-foreground">—</span>
        return (
          <a
            href={`${CL_BASE}/docket/${entry.docketId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {entry.caseName}
          </a>
        )
      },
      filterFn: "includesString",
    },
    {
      id: "entry_number",
      accessorFn: (row) => extractEntry(row)?.entryNumber ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Entry #" />
      ),
      cell: ({ row }) => {
        const entry = extractEntry(row.original)
        if (!entry?.entryNumber) return <span className="text-muted-foreground">—</span>
        return <span className="font-mono text-xs">{entry.entryNumber}</span>
      },
    },
    {
      id: "description",
      accessorFn: (row) => extractEntry(row)?.description ?? "",
      header: "Description",
      cell: ({ row }) => {
        const entry = extractEntry(row.original)
        if (!entry?.description) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-xs line-clamp-2 max-w-md" title={entry.description}>
            {entry.description}
          </span>
        )
      },
    },
    {
      id: "date_filed",
      accessorFn: (row) => extractEntry(row)?.dateFiled ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Filed" />
      ),
      cell: ({ row }) => {
        const entry = extractEntry(row.original)
        return (
          <span className="text-xs whitespace-nowrap">
            {formatDate(entry?.dateFiled ?? null)}
          </span>
        )
      },
    },
    {
      id: "documents",
      header: "Docs",
      cell: ({ row }) => {
        const entry = extractEntry(row.original)
        const docs = entry?.documents.filter((d) => d.is_available) ?? []
        if (docs.length === 0) return <span className="text-muted-foreground">—</span>
        if (docs.length === 1) {
          const doc = docs[0]
          return (
            <a
              href={`${CL_STORAGE_BASE}/${doc.filepath_local}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:underline"
              title={doc.description}
            >
              <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
              <span>PDF{doc.page_count ? ` (${doc.page_count}p)` : ""}</span>
            </a>
          )
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <HugeiconsIcon icon={Download04Icon} className="mr-1 size-3.5" />
                {docs.length} files
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {docs.map((doc) => (
                <DropdownMenuItem key={doc.id} asChild>
                  <a
                    href={`${CL_STORAGE_BASE}/${doc.filepath_local}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    #{doc.document_number}
                    {doc.attachment_number != null ? `-${doc.attachment_number}` : ""}
                    {" — "}
                    {doc.description || "Document"}
                    {doc.page_count ? ` (${doc.page_count}p)` : ""}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
    {
      accessorKey: "processing_status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.processing_status
        return (
          <Badge className={cn("border-0 font-medium", statusStyles[status] ?? "bg-muted text-muted-foreground")}>
            {status}
          </Badge>
        )
      },
      filterFn: (row, id, value: string[]) => {
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Received" />
      ),
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.proceeding_id ? (
              <DropdownMenuItem onClick={() => onUnlink(row.original)}>
                <HugeiconsIcon icon={Unlink01Icon} className="mr-2 size-4" />
                Unlink from case
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onLink(row.original)}>
                <HugeiconsIcon icon={Link01Icon} className="mr-2 size-4" />
                Link to case
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onViewPayload(row.original)}>
              <HugeiconsIcon icon={ViewIcon} className="mr-2 size-4" />
              View Payload
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original)}
            >
              <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
