import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  PrinterIcon,
  ArrowDown01Icon,
  MoreHorizontalIcon,
  SparklesIcon,
  Calendar01Icon,
  TableIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { getTrialCalendar, downloadTrialCalendarPdf } from "@/services/trial-calendar"
import { createEvent, type CreateEventData } from "@/services/events"
import { downloadBlob } from "@/lib/download"
import { getStaff, type StaffMember } from "@/services/staff"
import { getDateKey } from "@/lib/datetime"
import { TrialTable } from "@/pages/trial-calendar/components/trial-table"
import { TrialListMobile } from "@/pages/trial-calendar/components/trial-list-mobile"
import { SlotFinder } from "@/pages/trial-calendar/components/slot-finder"
import { AddBlockingEventDialog } from "@/pages/trial-calendar/components/add-blocking-event-dialog"
import { EditEventDialog } from "@/pages/trial-calendar/components/edit-event-dialog"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import { LinearCalendar } from "@/pages/trial-calendar/components/linear-calendar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { BlockingEvent } from "@/services/trial-calendar"

type View = "calendar" | "table"

const MONTHS_AHEAD = 49
const MONTHS_BEHIND = 0

const AI_RULES: ToolCompletionRule[] = [
  {
    toolNames: ["manage_event"],
    queryKeys: [["trial-calendar"], ["events"]],
    toastMessage: "Calendar updated",
  },
  {
    toolNames: ["manage_case"],
    queryKeys: [["trial-calendar"], ["cases"]],
    toastMessage: "Trial updated",
  },
]

export default function TrialCalendarPage() {
  const [blockingOpen, setBlockingOpen] = useState(false)
  const [slotFinderOpen, setSlotFinderOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<BlockingEvent | null>(null)
  const [view, setView] = useState<View>("table")
  const [printing, setPrinting] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["trial-calendar", MONTHS_AHEAD, MONTHS_BEHIND],
    queryFn: () => getTrialCalendar(MONTHS_AHEAD, MONTHS_BEHIND),
  })

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })

  const staffMap = useMemo(() => {
    const map = new Map<number, StaffMember>()
    for (const s of staffData?.data ?? []) map.set(s.id, s)
    return map
  }, [staffData])

  // Trial calendar is forward-looking — drop trials whose date is in the past.
  const upcomingTrials = useMemo(() => {
    if (!data) return []
    const todayKey = getDateKey(new Date().toISOString())
    return data.trials.filter((t) => t.trial_date >= todayKey)
  }, [data])

  const createEventMutation = useMutation({
    mutationFn: (eventData: CreateEventData) => createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
    },
  })

  const handlePrint = useCallback(async (style: "list" | "visual") => {
    setPrinting(true)
    try {
      const blob = await downloadTrialCalendarPdf(MONTHS_AHEAD, MONTHS_BEHIND, style)
      downloadBlob(blob, `trial-calendar-${style}.pdf`)
    } finally {
      setPrinting(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Trial Calendar</h1>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => { if (v) setView(v as View) }}
            className="border"
          >
            <ToggleGroupItem value="table" className="h-7 px-2.5 gap-1.5 text-xs">
              <HugeiconsIcon icon={TableIcon} className="size-3.5" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" className="h-7 px-2.5 gap-1.5 text-xs">
              <HugeiconsIcon icon={Calendar01Icon} className="size-3.5" />
              Calendar
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Desktop: full action buttons */}
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={printing}>
                  <HugeiconsIcon icon={PrinterIcon} className="size-3.5" />
                  <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlePrint("list")}>
                  Print List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint("visual")}>
                  Print Visual
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  Add Event
                  <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setBlockingOpen(true)}>
                  Add Manually
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAiOpen(true)}>
                  <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
                  Create with AI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile: overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="h-8 w-8 md:hidden"
                aria-label="More actions"
                disabled={printing}
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem onClick={() => setBlockingOpen(true)}>
                <HugeiconsIcon icon={Calendar01Icon} className="mr-2 size-4" />
                Add Manually
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiOpen(true)}>
                <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
                Create with AI
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePrint("list")} disabled={printing}>
                <HugeiconsIcon icon={PrinterIcon} className="mr-2 size-4" />
                Print List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("visual")} disabled={printing}>
                <HugeiconsIcon icon={PrinterIcon} className="mr-2 size-4" />
                Print Visual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">Loading...</div>
      ) : data ? (
        view === "calendar" ? (
          <LinearCalendar data={data} staffMap={staffMap} onEditEvent={setEditingEvent} />
        ) : (
          <>
            <div className="hidden md:block">
              <TrialTable trials={upcomingTrials} blockingEvents={data.blocking_events} staffMap={staffMap} onEditEvent={setEditingEvent} />
            </div>
            <div className="md:hidden">
              <TrialListMobile trials={upcomingTrials} blockingEvents={data.blocking_events} staffMap={staffMap} onEditEvent={setEditingEvent} />
            </div>
          </>
        )
      ) : null}

      {/* Dialogs */}
      <SlotFinder open={slotFinderOpen} onOpenChange={setSlotFinderOpen} />
      <AddBlockingEventDialog
        open={blockingOpen}
        onOpenChange={setBlockingOpen}
        onSubmit={(eventData) => {
          createEventMutation.mutate({ ...eventData, blocks_calendar: true })
          setBlockingOpen(false)
        }}
      />
      <EditEventDialog
        event={editingEvent}
        onOpenChange={(open) => { if (!open) setEditingEvent(null) }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
          setEditingEvent(null)
        }}
      />
      <AiChatSheet
        open={aiOpen}
        onOpenChange={setAiOpen}
        title="Trial Calendar AI"
        description="Create events, schedule trials, update duration & likelihood"
        placeholder='e.g., "add vacation Dec 20-31" or "move Smith trial to March 15"'
        emptyStateText="Ask me to create events, schedule or reschedule trials, or update trial details."
        mode="trial_calendar"
        toolCompletionRules={AI_RULES}
      />
    </div>
  )
}

export const Component = TrialCalendarPage
