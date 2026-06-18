import { useState, useRef, useEffect, useMemo } from "react"
import { Link } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowTurnForwardIcon,
  InformationCircleIcon,
  Tick02Icon,
  Calendar03Icon,
  Note01Icon,
  UserAdd01Icon,
  CourtLawIcon,
  Task01Icon,
  Link01Icon,
  ArrowExpand01Icon,
} from "@hugeicons/core-free-icons"
import type { CaseComment, CaseStatus } from "@/types/case"
import {
  getCaseComments,
  createCaseComment,
  markCaseRead,
} from "@/services/cases"
import { formatTime, formatDateHeader, getDateKey } from "@/lib/datetime"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CaseStatusBadge } from "./status-badge"

// --- Helpers ---

// --- Pattern Matchers ---

const STATUS_CHANGE_RE = /^(.+?) changed status from (.+?) to (.+)$/
const TASK_ADDED_RE = /^(.+?) added task: "(.+)"$/
const TASK_COMPLETED_RE = /^(.+?) completed task: "(.+)"$/
const TASK_STATUS_RE = /^(.+?) changed task "(.+)" from (.+) to (.+)$/
const EVENT_ADDED_RE = /^(.+?) added event: "(.+)"$/
const NOTE_ADDED_RE = /^(.+?) added a note$/
const PERSON_ADDED_RE = /^(.+?) added (.+?) as (.+)$/
const PROCEEDING_ADDED_RE = /^(.+?) added proceeding (.+)$/
const STAFF_RE = /^(.+?) (assigned|removed) (.+?) as (Attorney|Paralegal)$/

// Invoice/cost activity is hidden from the case activity log — financial info
// only surfaces where the user is specifically focused on financials.
const INVOICE_ACTIVITY_RE = /^(Invoice|Advance|Transfer) (added|paid):/

function isInvoiceActivity(comment: CaseComment): boolean {
  if (!comment.is_system) return false
  return comment.detail?.type === "invoice" || INVOICE_ACTIVITY_RE.test(comment.content)
}

// Render content with the quoted segment turned into a link (e.g. an intake name).
function renderQuotedLink(content: string, quoteChar: string, to: string | null) {
  const first = content.indexOf(quoteChar)
  const last = content.lastIndexOf(quoteChar)
  if (!to || first === -1 || last === first) return content
  return (
    <>
      {content.slice(0, first + 1)}
      <Link to={to} className="font-medium text-primary hover:underline">
        {content.slice(first + 1, last)}
      </Link>
      {content.slice(last)}
    </>
  )
}

function parseStatusChange(content: string) {
  const m = content.match(STATUS_CHANGE_RE)
  if (!m) return null
  return { name: m[1], from: m[2] as CaseStatus, to: m[3] as CaseStatus }
}

// --- Entry Components ---

function StatusChangeEntry({ comment }: { comment: CaseComment }) {
  const parsed = parseStatusChange(comment.content)
  if (!parsed) return <SystemMessageEntry comment={comment} />

  return (
    <div className="relative flex gap-3 py-2">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon
          icon={ArrowTurnForwardIcon}
          className="size-3 text-muted-foreground"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{parsed.name}</span>
        <CaseStatusBadge status={parsed.from} className="text-[10px] px-1.5 py-0" />
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        <CaseStatusBadge status={parsed.to} className="text-[10px] px-1.5 py-0" />
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function IconEntry({
  comment,
  icon,
}: {
  comment: CaseComment
  icon: typeof InformationCircleIcon
}) {
  return (
    <div className="relative flex gap-3 py-2">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon icon={icon} className="size-3 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span>{comment.content}</span>
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function SystemMessageEntry({ comment }: { comment: CaseComment }) {
  return <IconEntry comment={comment} icon={InformationCircleIcon} />
}

function IntakeLinkEntry({ comment }: { comment: CaseComment }) {
  const intakeId = comment.detail?.intake_id as number | undefined
  return (
    <div className="relative flex gap-3 py-2">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon icon={Link01Icon} className="size-3 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span>
          {renderQuotedLink(comment.content, '"', intakeId ? `/intakes/${intakeId}` : null)}
        </span>
        <span className="ml-auto shrink-0 opacity-60">
          {formatTime(comment.created_at)}
        </span>
      </div>
    </div>
  )
}

function UserCommentEntry({ comment }: { comment: CaseComment }) {
  const initials = comment.user_initials || "?"
  const name =
    [comment.user_first_name, comment.user_last_name]
      .filter(Boolean)
      .join(" ") || "Unknown"

  return (
    <div className="relative flex gap-3 py-2">
      <Avatar size="sm" className="relative z-10 shrink-0">
        <AvatarFallback className="text-[10px]" style={getAvatarStyleById(comment.user_id)}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(comment.created_at)}
          </span>
        </div>
        <div className="mt-1 bg-muted px-3 py-2">
          <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
        </div>
      </div>
    </div>
  )
}

function TimelineEntry({ comment }: { comment: CaseComment }) {
  if (comment.is_system) {
    if (comment.detail?.type === "intake_link") return <IntakeLinkEntry comment={comment} />
    if (parseStatusChange(comment.content)) return <StatusChangeEntry comment={comment} />
    if (TASK_COMPLETED_RE.test(comment.content)) return <IconEntry comment={comment} icon={Tick02Icon} />
    if (TASK_STATUS_RE.test(comment.content)) return <IconEntry comment={comment} icon={Task01Icon} />
    if (TASK_ADDED_RE.test(comment.content)) return <IconEntry comment={comment} icon={Task01Icon} />
    if (EVENT_ADDED_RE.test(comment.content)) return <IconEntry comment={comment} icon={Calendar03Icon} />
    if (NOTE_ADDED_RE.test(comment.content)) return <IconEntry comment={comment} icon={Note01Icon} />
    if (PERSON_ADDED_RE.test(comment.content)) return <IconEntry comment={comment} icon={UserAdd01Icon} />
    if (PROCEEDING_ADDED_RE.test(comment.content)) return <IconEntry comment={comment} icon={CourtLawIcon} />
    if (STAFF_RE.test(comment.content)) return <IconEntry comment={comment} icon={UserAdd01Icon} />
    return <SystemMessageEntry comment={comment} />
  }
  return <UserCommentEntry comment={comment} />
}

// --- Date Grouping ---

interface DateGroup {
  dateKey: string
  label: string
  comments: CaseComment[]
}

function groupByDate(comments: CaseComment[]): DateGroup[] {
  const groups: DateGroup[] = []
  let currentKey = ""

  for (const comment of comments) {
    const key = getDateKey(comment.created_at)
    if (key !== currentKey) {
      currentKey = key
      groups.push({
        dateKey: key,
        label: formatDateHeader(comment.created_at),
        comments: [comment],
      })
    } else {
      groups[groups.length - 1].comments.push(comment)
    }
  }

  return groups
}

// --- Shared Feed Content ---

function FeedContent({
  groups,
  isLoading,
  isEmpty,
  scrollRef,
}: {
  groups: DateGroup[]
  isLoading: boolean
  isEmpty: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-1 h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No activity yet.
        </p>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
          {groups.map((group) => (
            <div key={group.dateKey}>
              <div className="relative z-10 mb-1 mt-3 first:mt-0">
                <span className="bg-background pr-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
              </div>
              {group.comments.map((comment) => (
                <TimelineEntry key={comment.id} comment={comment} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CommentForm({
  input,
  setInput,
  onSubmit,
  isPending,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 border-t p-3">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        className="min-h-9 flex-1 resize-none"
        disabled={isPending}
      />
      <Button
        type="submit"
        size="sm"
        className="self-end"
        disabled={!input.trim() || isPending}
      >
        Send
      </Button>
    </form>
  )
}

// --- Main Component ---

interface CaseActivityFeedProps {
  caseId: number
}

export function CaseActivityFeed({ caseId }: CaseActivityFeedProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const [panelOpen, setPanelOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelScrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["case-comments", caseId],
    queryFn: () => getCaseComments(caseId),
  })

  useEffect(() => {
    markCaseRead(caseId).catch(() => {})
  }, [caseId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data?.comments])

  useEffect(() => {
    if (panelOpen && panelScrollRef.current) {
      panelScrollRef.current.scrollTop = panelScrollRef.current.scrollHeight
    }
  }, [data?.comments, panelOpen])

  const addComment = useMutation({
    mutationFn: (content: string) => createCaseComment(caseId, content),
    onSuccess: () => {
      setInput("")
      queryClient.invalidateQueries({ queryKey: ["case-comments", caseId] })
      markCaseRead(caseId).catch(() => {})
    },
    onError: () => {
      toast.error("Failed to add comment")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    addComment.mutate(trimmed)
  }

  const visibleComments = useMemo(
    () => (data?.comments ?? []).filter((c) => !isInvoiceActivity(c)),
    [data?.comments]
  )

  const groups = useMemo(
    () => groupByDate(visibleComments),
    [visibleComments]
  )

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col border">
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/40 p-3">
          <h3 className="text-sm font-semibold">Activity</h3>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPanelOpen(true)}
            title="Expand activity"
          >
            <HugeiconsIcon icon={ArrowExpand01Icon} className="size-3.5" />
          </Button>
        </div>

        <FeedContent
          groups={groups}
          isLoading={isLoading}
          isEmpty={visibleComments.length === 0}
          scrollRef={scrollRef}
        />

        <CommentForm
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isPending={addComment.isPending}
        />
      </div>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="flex w-full flex-col data-[side=right]:sm:max-w-[50vw]">
          <SheetHeader className="shrink-0 border-b">
            <SheetTitle>Activity</SheetTitle>
          </SheetHeader>
          <FeedContent
            groups={groups}
            isLoading={isLoading}
            isEmpty={visibleComments.length === 0}
            scrollRef={panelScrollRef}
          />
          <CommentForm
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isPending={addComment.isPending}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
