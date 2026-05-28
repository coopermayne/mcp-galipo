import { useState, useRef, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Link01Icon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import type { CaseStatus } from "@/types/case"
import { searchCases, type CaseSearchResult } from "@/services/cases"
import { linkIntakeToCase } from "@/services/intakes"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

interface ConnectCaseDialogProps {
  intakeId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectCaseDialog({
  intakeId,
  open,
  onOpenChange,
}: ConnectCaseDialogProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 200)

  const { data, isFetching } = useQuery({
    queryKey: ["connect-case-search", debouncedQuery],
    queryFn: () =>
      searchCases({
        q: debouncedQuery,
        my_cases: false,
        include_closed: true,
        limit: 20,
      }),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 10_000,
  })

  const cases = useMemo(() => data?.cases ?? [], [data])

  const linkMutation = useMutation({
    mutationFn: (caseId: number) => linkIntakeToCase(intakeId, caseId),
    onSuccess: (res) => {
      queryClient.setQueryData(["intake", intakeId], res.intake)
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      queryClient.invalidateQueries({ queryKey: ["intake-comments", intakeId] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success(`Linked to ${res.intake.case_name || "case"}`)
      handleOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to link case")
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("")
    } else {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-1/3 translate-y-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm">Connect to Existing Case</DialogTitle>
          <DialogDescription className="text-xs">
            Search for a case to link this intake to.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="text-muted-foreground size-4 shrink-0"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases by name..."
            className="placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none"
          />
          {isFetching && (
            <span className="text-muted-foreground shrink-0 text-[10px]">...</span>
          )}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {debouncedQuery.length < 2 ? (
            <div className="text-muted-foreground py-8 text-center text-xs">
              Type at least 2 characters to search
            </div>
          ) : cases.length === 0 && !isFetching ? (
            <div className="text-muted-foreground py-8 text-center text-xs">
              No cases found
            </div>
          ) : (
            cases.map((c: CaseSearchResult) => (
              <button
                key={c.id}
                type="button"
                disabled={linkMutation.isPending}
                onClick={() => linkMutation.mutate(c.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors",
                  "hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{c.case_name}</span>
                  {c.short_name && (
                    <span className="text-muted-foreground text-[11px]">
                      {c.short_name}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CaseStatusBadge status={c.status as CaseStatus} />
                  <HugeiconsIcon
                    icon={Link01Icon}
                    strokeWidth={2}
                    className="text-muted-foreground size-3.5"
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
