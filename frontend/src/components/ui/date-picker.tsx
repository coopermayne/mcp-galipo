import * as React from "react"
import { format, isValid } from "date-fns"
import * as chrono from "chrono-node"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  value: string | null
  onChange: (date: string | null) => void
  placeholder?: string
  className?: string
  /** "default" = input-like with border; "inline" = compact ghost for inline use */
  variant?: "default" | "inline"
  /** Custom formatter for the trigger display text */
  formatValue?: (iso: string) => string
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

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date...",
  className,
  variant = "default",
  formatValue,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [parsedPreview, setParsedPreview] = React.useState<Date | null>(null)
  const [displayMonth, setDisplayMonth] = React.useState<Date | undefined>(undefined)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const valueBeforeOpen = React.useRef<string | null>(null)

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

  function parseInput(text: string): Date | null {
    if (!text.trim()) return null
    const results = chrono.parse(text, new Date(), { forwardDate: true })
    if (results.length > 0) {
      const d = results[0].start.date()
      return isValid(d) ? d : null
    }
    return null
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setInputValue(text)
    setParsedPreview(parseInput(text))
  }

  function commit(date: Date | null) {
    onChange(date ? toISODate(date) : null)
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
      commit(date)
    }
  }

  // The date to highlight on the calendar: parsed preview takes priority, then committed value
  const calendarHighlight = parsedPreview ?? selectedDate

  // Sync displayed month to the highlighted date when it changes (new selection, parsed preview),
  // but allow the user to navigate freely via the calendar arrows.
  React.useEffect(() => {
    if (calendarHighlight) setDisplayMonth(calendarHighlight)
  }, [calendarHighlight?.getTime()])

  const displayText = value
    ? (formatValue ? formatValue(value) : format(toLocalDate(value), "MMM d, yyyy"))
    : placeholder

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
                    {format(parsedPreview, "EEE, MMM d, yyyy")}
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
