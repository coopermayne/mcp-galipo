export interface EventTypeConfig {
  value: string
  label: string
  color: string
}

export const EVENT_TYPES: EventTypeConfig[] = [
  { value: "vacation", label: "Vacation", color: "var(--palette-sky)" },
  { value: "holiday", label: "Holiday", color: "var(--palette-emerald)" },
  { value: "trial", label: "Trial (External)", color: "var(--palette-red)" },
  { value: "oral_argument", label: "Oral Argument", color: "var(--palette-orange)" },
  { value: "hearing", label: "Hearing", color: "var(--palette-amber)" },
  { value: "mediation", label: "Mediation", color: "var(--palette-purple)" },
  { value: "deposition", label: "Deposition", color: "var(--palette-teal)" },
  { value: "conference", label: "Conference", color: "var(--palette-indigo)" },
  { value: "other", label: "Other", color: "var(--palette-pink)" },
]

export const EVENT_TYPE_MAP = new Map(EVENT_TYPES.map((t) => [t.value, t]))

/**
 * Types offered in the manual add/edit event pickers — kept short to avoid
 * confusion. The full EVENT_TYPES list above is still used to render/label any
 * pre-existing events that use other types.
 */
export const EVENT_TYPE_OPTIONS: EventTypeConfig[] = EVENT_TYPES.filter((t) =>
  ["vacation", "holiday", "conference", "other"].includes(t.value),
)

export function getEventTypeColor(eventType: string): string {
  return EVENT_TYPE_MAP.get(eventType)?.color ?? "var(--palette-pink)"
}

export function getEventTypeLabel(eventType: string): string {
  return EVENT_TYPE_MAP.get(eventType)?.label ?? eventType
}
