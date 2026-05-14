import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  PrinterIcon,
  ArrowDown01Icon,
  MoreHorizontalIcon,
  SparklesIcon,
  Sun01Icon,
  Calendar01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { getTrialCalendar, downloadTrialCalendarPdf } from "@/services/trial-calendar"
import { createEvent, type CreateEventData } from "@/services/events"
import { downloadBlob } from "@/lib/download"
import { getStaff, type StaffMember } from "@/services/staff"
import { TrialTable } from "@/pages/trial-calendar/components/trial-table"
import { SlotFinder } from "@/pages/trial-calendar/components/slot-finder"
import { AddVacationDialog } from "@/pages/trial-calendar/components/add-vacation-dialog"
import { AddBlockingEventDialog } from "@/pages/trial-calendar/components/add-blocking-event-dialog"
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

type View = "calendar" | "table"

const MONTHS_AHEAD = 49
const MONTHS_BEHIND = 1

export default function TrialCalendarPage() {
  const [vacationOpen, setVacationOpen] = useState(false)
  const [blockingOpen, setBlockingOpen] = useState(false)
  const [slotFinderOpen, setSlotFinderOpen] = useState(false)
  const [view, setView] = useState<View>("calendar")
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
            <ToggleGroupItem value="calendar" className="px-3 text-xs">Calendar</ToggleGroupItem>
            <ToggleGroupItem value="table" className="px-3 text-xs">Table</ToggleGroupItem>
          </ToggleGroup>

          {/* Desktop: full action buttons */}
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={printing}>
                  <HugeiconsIcon icon={PrinterIcon} className="size-3.5" />
                  {printing ? "Generating..." : "Print"}
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
            <Button variant="outline" size="sm" onClick={() => setSlotFinderOpen(true)}>
              <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
              Find Open Slots
            </Button>
            <Button variant="outline" size="sm" onClick={() => setVacationOpen(true)}>
              Add Vacation
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBlockingOpen(true)}>
              Add Event
            </Button>
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
              <DropdownMenuItem onClick={() => setSlotFinderOpen(true)}>
                <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
                Find Open Slots
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVacationOpen(true)}>
                <HugeiconsIcon icon={Sun01Icon} className="mr-2 size-4" />
                Add Vacation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockingOpen(true)}>
                <HugeiconsIcon icon={Calendar01Icon} className="mr-2 size-4" />
                Add Event
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
          <LinearCalendar data={data} staffMap={staffMap} />
        ) : (
          <TrialTable trials={data.trials} staffMap={staffMap} />
        )
      ) : null}

      {/* Dialogs */}
      <SlotFinder open={slotFinderOpen} onOpenChange={setSlotFinderOpen} />
      <AddVacationDialog
        open={vacationOpen}
        onOpenChange={setVacationOpen}
        onSubmit={(eventData) => {
          createEventMutation.mutate(eventData)
          setVacationOpen(false)
        }}
      />
      <AddBlockingEventDialog
        open={blockingOpen}
        onOpenChange={setBlockingOpen}
        onSubmit={(eventData) => {
          createEventMutation.mutate(eventData)
          setBlockingOpen(false)
        }}
      />
    </div>
  )
}

export const Component = TrialCalendarPage
