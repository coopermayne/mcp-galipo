import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { getStaff, type StaffMember } from "@/services/staff"
import {
  quickCreate,
  type EventDraft,
  type QuickCreateResponse,
  type QuickKind,
} from "@/services/quick-create"
import { cn } from "@/lib/utils"

interface QuickCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: QuickKind
  caseId: number
  caseName: string
}

/** Format a YYYY-MM-DD date-only string as "Fri, Jun 5" in Pacific time. */
function formatDateOnly(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(`${date}T00:00:00`))
}

function staffName(staff: StaffMember[], id: number | null | undefined): string | null {
  if (id == null) return null
  const s = staff.find((m) => m.id === id)
  return s ? `${s.firstName} ${s.lastName}`.trim() : null
}

export function QuickCreateDialog({
  open,
  onOpenChange,
  kind,
  caseId,
  caseName,
}: QuickCreateDialogProps) {
  const queryClient = useQueryClient()
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [text, setText] = useState("")
  const [phase, setPhase] = useState<"input" | "needs_date" | "done">("input")
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [dateInput, setDateInput] = useState("")
  const [timeInput, setTimeInput] = useState("")
  const [result, setResult] = useState<QuickCreateResponse | null>(null)

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })
  const staff = useMemo(() => staffData?.data ?? [], [staffData])

  const noun = kind === "task" ? "task" : "event"

  // Reset everything whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setText("")
      setPhase("input")
      setDraft(null)
      setDateInput("")
      setTimeInput("")
      setResult(null)
      requestAnimationFrame(() => textRef.current?.focus())
    }
  }, [open, kind, caseId])

  function handleSuccess(res: QuickCreateResponse) {
    if (res.status === "needs_date") {
      setDraft(res.draft)
      setTimeInput(res.draft.time ?? "")
      setPhase("needs_date")
      return
    }
    setResult(res)
    setPhase("done")
    queryClient.invalidateQueries({ queryKey: ["tasks"] })
    queryClient.invalidateQueries({ queryKey: ["events"] })
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
    toast.success(`Created ${noun}`)
  }

  const mutation = useMutation({
    mutationFn: quickCreate,
    onSuccess: handleSuccess,
    onError: (e: Error) => toast.error(e.message || `Failed to create ${noun}`),
  })

  function submitText() {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) return
    mutation.mutate({ kind, case_id: caseId, text: trimmed })
  }

  function submitDate() {
    if (!draft || !dateInput || mutation.isPending) return
    mutation.mutate({
      kind: "event",
      case_id: caseId,
      draft: { ...draft, date: dateInput, time: timeInput || null },
    })
  }

  function handleTextKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitText()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <HugeiconsIcon
              icon={kind === "task" ? Task01Icon : Calendar03Icon}
              strokeWidth={2}
              className="size-4"
            />
            New {kind === "task" ? "Task" : "Event"}
          </DialogTitle>
          <DialogDescription className="text-xs">{caseName}</DialogDescription>
        </DialogHeader>

        <div className="px-4 py-3">
          {phase === "input" && (
            <>
              <Textarea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleTextKeyDown}
                disabled={mutation.isPending}
                placeholder={
                  kind === "task"
                    ? "e.g. draft MSJ response, high priority, due Friday — assign to Dana"
                    : "e.g. deposition of plaintiff next Tuesday at 10am at our office"
                }
                className="min-h-24 text-sm"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-muted-foreground text-[10px]">
                  <kbd className="bg-muted px-1 py-0.5">Enter</kbd> create ·{" "}
                  <kbd className="bg-muted px-1 py-0.5">Shift+Enter</kbd> newline
                </span>
                <Button size="sm" onClick={submitText} disabled={!text.trim() || mutation.isPending}>
                  {mutation.isPending ? (
                    <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                  ) : (
                    `Create ${kind === "task" ? "Task" : "Event"}`
                  )}
                </Button>
              </div>
            </>
          )}

          {phase === "needs_date" && draft && (
            <div className="space-y-3">
              <p className="text-sm">
                When is <span className="font-medium">{draft.description}</span>?
              </p>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground text-[11px]">Date</label>
                  <Input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="text-sm"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground text-[11px]">Time (optional)</label>
                  <Input
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <Button size="sm" onClick={submitDate} disabled={!dateInput || mutation.isPending}>
                  {mutation.isPending ? (
                    <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                  ) : (
                    "Create Event"
                  )}
                </Button>
              </div>
            </div>
          )}

          {phase === "done" && result?.status === "created" && (
            <SuccessView
              result={result}
              caseName={caseName}
              staff={staff}
              onAnother={() => {
                setText("")
                setPhase("input")
                setResult(null)
                setDraft(null)
                requestAnimationFrame(() => textRef.current?.focus())
              }}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SuccessView({
  result,
  caseName,
  staff,
  onAnother,
  onClose,
}: {
  result: Extract<QuickCreateResponse, { status: "created" }>
  caseName: string
  staff: StaffMember[]
  onAnother: () => void
  onClose: () => void
}) {
  let title = ""
  const meta: string[] = [caseName]

  if (result.kind === "task") {
    const t = result.task
    title = t.description
    meta.push(t.urgency)
    meta.push(t.due_date ? `due ${formatDateOnly(t.due_date)}` : "no due date")
    const who = staffName(staff, t.assignee_id)
    if (who) meta.push(who)
  } else {
    const ev = result.event
    title = ev.description
    meta.push(formatDateOnly(ev.date))
    if (ev.time) meta.push(ev.time.slice(0, 5))
    if (ev.location) meta.push(ev.location)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          strokeWidth={2}
          className={cn("mt-0.5 size-5 shrink-0", "text-success")}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{meta.join(" · ")}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onAnother}>
          Create another
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
