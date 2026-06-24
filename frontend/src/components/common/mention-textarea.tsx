import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface MentionOption {
  id: string | number
  /** Primary label — shown in the dropdown and inserted by default. */
  label: string
  /** Optional secondary line in the dropdown (also matched while filtering). */
  sublabel?: string
  /** Text inserted when chosen; defaults to `label`. */
  insertText?: string
}

export interface MentionTrigger {
  /** Character(s) that open this picker, e.g. "@" or "@@". */
  trigger: string
  /** Candidate items to pick from once the trigger is typed. */
  options: MentionOption[]
  /** Optional heading shown above the results (e.g. "All cases"). */
  label?: string
}

interface MentionTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
  /** One or more triggers, each with its own option list. Longer triggers win
   * when they overlap (so "@@" beats "@"). */
  triggers: MentionTrigger[]
  /** Max results shown at once. Default 8. */
  maxItems?: number
}

interface ActiveMention {
  query: string
  /** Index of the trigger's first char in `value`. */
  start: number
  /** The matched trigger config (its options + length drive the menu). */
  trigger: MentionTrigger
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * A textarea with inline "@-mention" autocomplete. Typing a trigger char opens
 * a filtered dropdown of that trigger's `options`; type to filter, ↑/↓ to move,
 * Enter/Tab/click to pick. The chosen option's text replaces the trigger token.
 * Generic on purpose — pass any triggers/options (cases, people, tags, …).
 */
export function MentionTextarea({
  value,
  onChange,
  triggers,
  maxItems = 8,
  className,
  onKeyDown,
  onBlur,
  onClick,
  ...props
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<ActiveMention | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Try longer triggers first so "@@" matches before "@".
  const ordered = useMemo(
    () => [...triggers].sort((a, b) => b.trigger.length - a.trigger.length),
    [triggers]
  )

  const matches = useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return mention.trigger.options
      .filter(
        (o) =>
          !q ||
          o.label.toLowerCase().includes(q) ||
          (o.sublabel?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, maxItems)
  }, [mention, maxItems])

  const open = mention != null && matches.length > 0

  // Reset the highlight whenever the active query changes.
  useEffect(() => {
    setActiveIndex(0)
  }, [mention?.query])

  /** Detect an active mention token immediately left of the caret. The trigger
   * must sit at the start or just after whitespace; the query has no spaces. */
  function detectMention(el: HTMLTextAreaElement) {
    const pos = el.selectionStart ?? el.value.length
    const before = el.value.slice(0, pos)
    for (const t of ordered) {
      const m = before.match(new RegExp(`(?:^|\\s)${escapeRe(t.trigger)}(\\S*)$`))
      if (m) {
        setMention({ query: m[1], start: pos - m[1].length - t.trigger.length, trigger: t })
        return
      }
    }
    setMention(null)
  }

  function choose(opt: MentionOption) {
    if (!mention) return
    const insert = (opt.insertText ?? opt.label) + " "
    const cursor = mention.start + mention.trigger.trigger.length + mention.query.length
    const next = value.slice(0, mention.start) + insert + value.slice(cursor)
    onChange(next)
    setMention(null)
    const caret = mention.start + insert.length
    requestAnimationFrame(() => {
      const el = ref.current
      if (el) {
        el.focus()
        el.setSelectionRange(caret, caret)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % matches.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        choose(matches[activeIndex])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setMention(null)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          detectMention(e.target)
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          detectMention(e.currentTarget)
          onClick?.(e)
        }}
        onBlur={(e) => {
          setMention(null)
          onBlur?.(e)
        }}
        className={className}
        {...props}
      />
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-72 overflow-auto border bg-popover py-1 shadow-md">
          {mention?.trigger.label && (
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {mention.trigger.label}
            </div>
          )}
          {matches.map((o, i) => (
            <button
              key={o.id}
              type="button"
              // onMouseDown + preventDefault keeps textarea focus so its onBlur
              // doesn't close the menu before this click registers.
              onMouseDown={(e) => {
                e.preventDefault()
                choose(o)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full flex-col items-start px-2.5 py-1.5 text-left",
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/40"
              )}
            >
              <span className="text-xs font-medium">{o.label}</span>
              {o.sublabel && o.sublabel !== o.label && (
                <span className="text-[10px] text-muted-foreground">{o.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
