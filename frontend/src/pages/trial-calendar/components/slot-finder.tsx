import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon, Calendar01Icon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { findTrialSlots } from "@/services/trial-calendar"

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SlotFinder({ open, onOpenChange }: Props) {
  const [estimatedDays, setEstimatedDays] = useState(5)
  const [monthsAhead, setMonthsAhead] = useState(6)
  const [earliestDate, setEarliestDate] = useState("")
  const [searchKey, setSearchKey] = useState<{
    estimatedDays: number
    monthsAhead: number
    earliestDate: string
  } | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["trial-slots", searchKey],
    queryFn: () =>
      findTrialSlots({
        estimated_days: searchKey!.estimatedDays,
        months_ahead: searchKey!.monthsAhead,
        earliest_date: searchKey!.earliestDate || undefined,
      }),
    enabled: searchKey !== null,
  })

  const handleSearch = () => {
    setSearchKey({ estimatedDays, monthsAhead, earliestDate })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Find Available Trial Slots</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (weekdays)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Months ahead</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={monthsAhead}
                onChange={(e) => setMonthsAhead(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Earliest date</Label>
              <Input
                type="date"
                value={earliestDate}
                onChange={(e) => setEarliestDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={isLoading || isFetching}
            className="w-full"
          >
            <HugeiconsIcon icon={SparklesIcon} className="size-4" />
            {isLoading || isFetching
              ? "Searching..."
              : "Find Available Slots"}
          </Button>

          {/* Results */}
          {data && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {data.total_found === 0
                  ? "No available slots found in this range."
                  : `Found ${data.total_found} available slot${data.total_found !== 1 ? "s" : ""}:`}
              </p>

              {data.slots.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {data.slots.map((slot, i) => {
                    const start = parseDate(slot.start_date)
                    const end = parseDate(slot.end_date)
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 border p-2.5 bg-success/10"
                      >
                        <HugeiconsIcon
                          icon={Calendar01Icon}
                          className="size-4 text-success-foreground shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {format(start, "EEE, MMM d")} –{" "}
                            {format(end, "EEE, MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {slot.weekdays} weekday{slot.weekdays !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          #{i + 1}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
