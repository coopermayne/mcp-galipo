import { useState, useMemo, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { getCases, createCaseComment } from "@/services/cases"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const ACTIONS = ["go", "task", "note", "event"] as const
type QuickAction = (typeof ACTIONS)[number]

const ACTION_LABELS: Record<QuickAction, string> = {
  go: "Open",
  task: "Task",
  note: "Note",
  event: "Event",
}


interface QuickCaseSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface InputMode {
  caseId: number
  caseName: string
}

export function QuickCaseSearch({ open, onOpenChange }: QuickCaseSearchProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [actionIndex, setActionIndex] = useState(0)
  const [inputMode, setInputMode] = useState<InputMode | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setActionIndex(0)
      setInputMode(null)
      setInputValue("")
      setIsSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (inputMode) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [inputMode])

  const { data } = useQuery({
    queryKey: ["cases", "quick-search", user?.id],
    queryFn: () =>
      getCases({ attorney_ids: user ? [user.id] : undefined, limit: 500 }),
    enabled: open && !!user,
    staleTime: 30_000,
  })

  const cases = useMemo(
    () => (data?.cases ?? []).filter((c) => c.status !== "Closed"),
    [data]
  )

  useEffect(() => {
    if (!open || inputMode) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        e.stopPropagation()
        setActionIndex((i) => (i - 1 + ACTIONS.length) % ACTIONS.length)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        e.stopPropagation()
        setActionIndex((i) => (i + 1) % ACTIONS.length)
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        setActionIndex(0)
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [open, inputMode])

  function handleSelect(caseId: number, caseName: string) {
    const action = ACTIONS[actionIndex]
    if (action === "task" || action === "event") {
      onOpenChange(false)
      navigate(`/cases/${caseId}?ai=${action === "task" ? "tasks" : "events"}`)
    } else if (action === "note") {
      setInputMode({ caseId, caseName })
      setInputValue("")
    } else {
      onOpenChange(false)
      navigate(`/cases/${caseId}`)
    }
  }

  async function handleSubmitInput() {
    if (!inputMode || !inputValue.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createCaseComment(inputMode.caseId, inputValue.trim())
      queryClient.invalidateQueries({ queryKey: ["cases", inputMode.caseId] })
      setInputMode(null)
      setActionIndex(0)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && inputMode) {
      setInputMode(null)
      setActionIndex(0)
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>
          {inputMode ? "Add Note" : "Quick Case Search"}
        </DialogTitle>
        <DialogDescription>
          {inputMode
            ? `Add a note to ${inputMode.caseName}`
            : "Search for a case by name"}
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        className="rounded-none top-1/3 translate-y-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        {inputMode ? (
          <div className="flex flex-col">
            <div className="border-b px-3 py-2">
              <span className="text-muted-foreground text-xs">
                Add Note to{" "}
              </span>
              <span className="text-xs font-medium">{inputMode.caseName}</span>
            </div>
            <div className="border-b px-3 py-2">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleSubmitInput()
                  }
                }}
                placeholder="Enter activity note..."
                className="w-full bg-transparent text-xs outline-none"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground">
              <span>
                <kbd className="bg-muted px-1 py-0.5">Enter</kbd> to create
                {" · "}
                <kbd className="bg-muted px-1 py-0.5">Esc</kbd> to go back
              </span>
              {isSubmitting && <span>Creating...</span>}
            </div>
          </div>
        ) : (
          <Command className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium">
            <CommandInput placeholder="Search cases..." />
            <CommandList>
              <CommandEmpty>No cases found.</CommandEmpty>
              <CommandGroup heading="Cases">
                {cases.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.case_name} ${c.short_name ?? ""}`}
                    onSelect={() => handleSelect(c.id, c.case_name)}
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{c.case_name}</span>
                          {c.short_name && (
                            <span className="text-muted-foreground text-[11px]">
                              {c.short_name}
                            </span>
                          )}
                        </div>
                        <CaseStatusBadge status={c.status} />
                      </div>
                      <div className="hidden items-center gap-0.5 pt-0.5 group-data-[selected=true]/command-item:flex">
                        {ACTIONS.map((action, idx) => (
                          <span
                            key={action}
                            className={cn(
                              "px-1.5 py-0.5 text-[10px] transition-colors",
                              idx === actionIndex
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {ACTION_LABELS[action]}
                          </span>
                        ))}
                        <span className="text-muted-foreground/50 ml-auto text-[10px]">
                          ← →
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  )
}
