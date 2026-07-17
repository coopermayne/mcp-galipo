import * as React from "react"
import { format, isValid } from "date-fns"
import * as chrono from "chrono-node"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"

interface DatePickerProps {
  value: string | null
  onChange: (date: string | null) => void
  placeholder?: string
  className?: string
  /** "default" = input-like with border; "inline" = compact ghost for inline use */
  variant?: "default" | "inline"
  /** Custom formatter for the trigger display text */
  formatValue?: (iso: string) => string
  /**
   * Enable optional time selection. When on, natural-language input keeps any
   * explicit time ("friday at 3pm" fills both), the popover shows a time field,
   * and the trigger appends the time. Requires `time` / `onTimeChange`.
   */
  withTime?: boolean
  /** Committed time as "HH:MM" (24h). Only used when `withTime`. */
  time?: string | null
  /** Called with "HH:MM" (24h) or null. Only used when `withTime`. */
  onTimeChange?: (time: string | null) => void
}

function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function toTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** "HH:MM" (24h) → "3:00 PM" for display. */
function formatTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  return format(new Date(2000, 0, 1, h, m), "h:mm a")
}

const WEEKDAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

interface ParsedResult {
  date: Date
  /** Whether the natural-language text specified an explicit time. */
  hasTime: boolean
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date...",
  className,
  variant = "default",
  formatValue,
  withTime = false,
  time = null,
  onTimeChange,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [parsedPreview, setParsedPreview] = React.useState<ParsedResult | null>(null)
  const [displayMonth, setDisplayMonth] = React.useState<Date | undefined>(undefined)
  // Local draft for the native time input. A partially-typed time reports value
  // "" via onChange; propagating that upward would clear a saved time (and, in
  // the edit dialog, fire an immediate PUT that wipes it). We mirror the raw
  // input here so typing stays smooth, but only commit complete values upward.
  const [timeDraft, setTimeDraft] = React.useState<string>(time ?? "")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const valueBeforeOpen = React.useRef<string | null>(null)

  // Keep the draft in sync with the committed time (external edits, reopen,
  // NL parse filling a time). Only runs when the committed value actually moves.
  React.useEffect(() => {
    setTimeDraft(time ?? "")
  }, [time])

  const selectedDate = value ? toLocalDate(value) : undefined

  // When popover opens, reset input state
  React.useEffect(() => {
    if (open) {
      valueBeforeOpen.current = value
      setInputValue("")
      setParsedPreview(null)
      // Focus the input after popover animation
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open, value])

  function parseInput(text: string): ParsedResult | null {
    if (!text.trim()) return null
    const now = new Date()
    const results = chrono.parse(text, now, { forwardDate: true })
    if (results.length === 0) return null
    const start = results[0].start
    const d = start.date()
    if (!isValid(d)) return null
    const hasTime = start.isCertain("hour")

    // Law-firm bias: a bare hour with no am/pm ("at 5") almost always means PM.
    // chrono defaults such hours to AM, so bump early-hour uncertain times to PM.
    if (hasTime && !start.isCertain("meridiem")) {
      const h = d.getHours()
      if (h >= 1 && h <= 6) d.setHours(h + 12)
    }

    // A weekday name typed on that same weekday ("friday" on a Friday) should
    // mean next week, not today. forwardDate keeps it on today; push it out.
    const matched = results[0].text.toLowerCase()
    const namesToday = WEEKDAYS.some((w) => matched.includes(w))
    if (namesToday && isSameDay(d, now)) d.setDate(d.getDate() + 7)

    return { date: d, hasTime }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setInputValue(text)
    setParsedPreview(parseInput(text))
  }

  function commit(parsed: ParsedResult | null) {
    onChange(parsed ? toISODate(parsed.date) : null)
    // Only override the time when the user actually typed one; a bare date
    // ("next friday") leaves any existing time untouched.
    if (withTime && parsed?.hasTime && onTimeChange) {
      onTimeChange(toTimeString(parsed.date))
    }
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (inputValue.trim() === "") {
        // Empty input → clear
        commit(null)
      } else if (parsedPreview) {
        commit(parsedPreview)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      // Revert to value before opening
      if (valueBeforeOpen.current !== value) {
        onChange(valueBeforeOpen.current)
      }
      setOpen(false)
    }
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (date) {
      commit({ date, hasTime: false })
    }
  }

  // The date to highlight on the calendar: parsed preview takes priority, then committed value
  const calendarHighlight = parsedPreview?.date ?? selectedDate

  // Sync displayed month to the highlighted date when it changes (new selection, parsed preview),
  // but allow the user to navigate freely via the calendar arrows.
  React.useEffect(() => {
    if (calendarHighlight) setDisplayMonth(calendarHighlight)
  }, [calendarHighlight?.getTime()])

  const displayText = value
    ? (formatValue ? formatValue(value) : format(toLocalDate(value), "MMM d, yyyy"))
    : placeholder
  // Show the time even when no date is set yet, so a pending time isn't hidden
  // (it would otherwise silently attach to whatever date is picked next).
  const timeSuffix = withTime && time ? ` · ${formatTimeDisplay(time)}` : ""

  const isInline = variant === "inline"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            isInline
              ? "inline-flex items-center gap-1 text-xs outline-none hover:underline"
              : "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-none border bg-transparent px-2.5 py-1 text-xs transition-colors focus-visible:ring-1 md:text-xs w-full min-w-0 outline-none inline-flex items-center gap-2 text-left",
            !value && (isInline ? "text-muted-foreground/60" : "text-muted-foreground"),
            className
          )}
        >
          <HugeiconsIcon
            icon={Calendar03Icon}
            className={cn("shrink-0", isInline ? "size-3" : "size-3.5 text-muted-foreground")}
          />
          <span className={cn(!isInline && "truncate")}>
            {displayText}
            {timeSuffix && <span className="text-muted-foreground">{timeSuffix}</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 gap-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Text input for natural language */}
        <div className="p-2.5 pb-0">
          <div className="relative">
            <HugeiconsIcon
              icon={Calendar03Icon}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                value
                  ? format(toLocalDate(value), "MMM d, yyyy")
                  : "e.g. next friday, in 30 days..."
              }
              className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-none border bg-transparent pl-7 pr-7 py-1 text-xs transition-colors focus-visible:ring-1 md:text-xs w-full min-w-0 outline-none"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue("")
                  setParsedPreview(null)
                  inputRef.current?.focus()
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            )}
          </div>
          {/* Parsed preview hint */}
          {inputValue.trim() && (
            <div className="mt-1.5 text-xs px-0.5">
              {parsedPreview ? (
                <span className="text-muted-foreground">
                  {"→ "}
                  <span className="text-foreground font-medium">
                    {format(parsedPreview.date, "EEE, MMM d, yyyy")}
                    {withTime && parsedPreview.hasTime &&
                      ` at ${format(parsedPreview.date, "h:mm a")}`}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/60">
                  Couldn't parse a date
                </span>
              )}
            </div>
          )}
        </div>

        {/* Time field */}
        {withTime && (
          <div className="flex items-center gap-2 px-2.5 pt-2.5">
            <Label className="text-xs text-muted-foreground shrink-0">Time</Label>
            <input
              type="time"
              value={timeDraft}
              onChange={(e) => {
                const v = e.target.value
                setTimeDraft(v)
                // Commit only complete values; an incomplete/empty input must
                // not clear the saved time (use the ✕ button to clear).
                if (v) onTimeChange?.(v)
              }}
              className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-none border bg-transparent px-2 py-1 text-xs transition-colors focus-visible:ring-1 md:text-xs flex-1 min-w-0 outline-none"
            />
            {timeDraft && (
              <button
                type="button"
                onClick={() => {
                  setTimeDraft("")
                  onTimeChange?.(null)
                }}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Calendar */}
        <Calendar
          mode="single"
          selected={calendarHighlight}
          onSelect={handleCalendarSelect}
          month={displayMonth ?? calendarHighlight ?? new Date()}
          onMonthChange={setDisplayMonth}
          defaultMonth={calendarHighlight ?? new Date()}
          className="p-2.5"
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
export type { DatePickerProps }
