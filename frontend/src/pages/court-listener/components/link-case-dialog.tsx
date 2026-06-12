import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Tick02Icon,
  PlusSignIcon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/use-debounce"
import { searchCases, type CaseSearchResult } from "@/services/cases"
import {
  getProceedings,
  createProceeding,
  type Proceeding,
} from "@/services/proceedings"
import { linkWebhook } from "@/services/webhooks"
import type { WebhookLog } from "@/types/webhook"
import { cn } from "@/lib/utils"

interface LinkCaseDialogProps {
  webhook: WebhookLog | null
  docketId: number | null
  /** Other unlinked CourtListener items that share this docket id. */
  siblingCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LinkCaseDialog({
  webhook,
  docketId,
  siblingCount,
  open,
  onOpenChange,
}: LinkCaseDialogProps) {
  const queryClient = useQueryClient()

  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 200)
  const [selectedCase, setSelectedCase] = useState<CaseSearchResult | null>(null)
  const [selectedProceedingId, setSelectedProceedingId] = useState<number | null>(null)
  const [newCaseNumber, setNewCaseNumber] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [linkSiblings, setLinkSiblings] = useState(true)

  // Reset everything whenever the dialog opens for a new webhook.
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedCase(null)
      setSelectedProceedingId(null)
      setNewCaseNumber("")
      setShowCreate(false)
      setLinkSiblings(true)
    }
  }, [open, webhook?.id])

  const { data: caseResults, isFetching: casesFetching } = useQuery({
    queryKey: ["link-case-search", debouncedQuery],
    queryFn: () => searchCases({ q: debouncedQuery, include_closed: true, limit: 15 }),
    enabled: open && !selectedCase && debouncedQuery.trim().length > 0,
  })

  const { data: proceedings, isLoading: proceedingsLoading } = useQuery({
    queryKey: ["proceedings", selectedCase?.id],
    queryFn: () => getProceedings(selectedCase!.id),
    enabled: open && !!selectedCase,
  })

  const createProceedingMutation = useMutation({
    mutationFn: () =>
      createProceeding(selectedCase!.id, { case_number: newCaseNumber.trim() }),
    onSuccess: async (res) => {
      const created: Proceeding = res.proceeding
      await queryClient.invalidateQueries({ queryKey: ["proceedings", selectedCase?.id] })
      setSelectedProceedingId(created.id)
      setShowCreate(false)
      setNewCaseNumber("")
    },
    onError: (e) => toast.error(e.message),
  })

  const linkMutation = useMutation({
    mutationFn: () =>
      linkWebhook(webhook!.id, {
        proceeding_id: selectedProceedingId!,
        docket_id: docketId ?? undefined,
        link_siblings: linkSiblings && siblingCount > 0,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] })
      toast.success(
        res.count > 1 ? `Linked ${res.count} items to case` : "Linked to case"
      )
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const canLink = !!selectedCase && !!selectedProceedingId && !linkMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to a proceeding</DialogTitle>
          <DialogDescription>
            {selectedCase
              ? "Choose which proceeding on this case this filing belongs to."
              : "Find the case this CourtListener filing belongs to."}
          </DialogDescription>
        </DialogHeader>

        {!selectedCase ? (
          /* ---- Step 1: pick a case ---- */
          <div className="flex flex-col gap-2">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
              />
              <Input
                autoFocus
                placeholder="Search cases by name or number..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-72 overflow-y-auto border">
              {casesFetching ? (
                <div className="flex flex-col gap-2 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : !debouncedQuery.trim() ? (
                <p className="text-muted-foreground p-3 text-sm">
                  Start typing to search cases.
                </p>
              ) : caseResults?.cases.length ? (
                caseResults.cases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCase(c)}
                    className="hover:bg-accent flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0"
                  >
                    <span className="text-sm font-medium">{c.case_name}</span>
                    {c.short_name && (
                      <span className="text-muted-foreground text-xs">
                        {c.short_name}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground p-3 text-sm">No cases found.</p>
              )}
            </div>
          </div>
        ) : (
          /* ---- Step 2: pick a proceeding ---- */
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCase(null)
                setSelectedProceedingId(null)
                setShowCreate(false)
              }}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
              {selectedCase.case_name}
            </button>

            {proceedingsLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {proceedings?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProceedingId(p.id)}
                    className={cn(
                      "flex items-center justify-between border px-3 py-2 text-left",
                      selectedProceedingId === p.id
                        ? "border-primary bg-accent"
                        : "hover:bg-accent"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{p.case_number}</span>
                      <span className="text-muted-foreground text-xs">
                        {[p.jurisdiction_name, p.judge_name]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {p.is_primary ? " · Primary" : ""}
                      </span>
                    </div>
                    {selectedProceedingId === p.id && (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="text-primary size-4"
                      />
                    )}
                  </button>
                ))}

                {!proceedings?.length && !showCreate && (
                  <p className="text-muted-foreground text-sm">
                    This case has no proceedings yet.
                  </p>
                )}

                {showCreate ? (
                  <div className="flex flex-col gap-2 border p-3">
                    <Label htmlFor="new-case-number">New proceeding</Label>
                    <Input
                      id="new-case-number"
                      autoFocus
                      placeholder="Court case number (e.g. 24STCV12345)"
                      value={newCaseNumber}
                      onChange={(e) => setNewCaseNumber(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={
                          !newCaseNumber.trim() || createProceedingMutation.isPending
                        }
                        onClick={() => createProceedingMutation.mutate()}
                      >
                        Create
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowCreate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setShowCreate(true)}
                  >
                    <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
                    New proceeding
                  </Button>
                )}
              </div>
            )}

            {docketId != null && siblingCount > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={linkSiblings}
                  onCheckedChange={(v) => setLinkSiblings(!!v)}
                />
                Also link {siblingCount} other item{siblingCount === 1 ? "" : "s"} from
                this docket (#{docketId})
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canLink} onClick={() => linkMutation.mutate()}>
            {linkMutation.isPending ? "Linking..." : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
