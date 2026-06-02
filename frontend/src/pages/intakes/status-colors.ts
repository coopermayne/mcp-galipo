import type { CSSProperties } from "react"
import type { IntakeStatus } from "@/types/intake"

/**
 * Single source of truth for intake status colors.
 *
 * Every status gets a visually distinct color drawn from the shared badge
 * palette (`--palette-*` in index.css) or a semantic token (`--muted`).
 * The two terminal "done" states reuse their "needs" counterpart's color but
 * rendered faded (soft tint + colored text), so they read as a completed
 * version of the same step:
 *   - Needs Rejection Letter (solid red) → Rejection Letter Sent (faded red)
 *   - Needs Retainer (solid green)        → Retainer Signed (faded green)
 */
type StatusColor = {
  /** CSS var name for the color, e.g. "--palette-indigo" or "--muted". */
  color: string
  /** Render as a faded/soft variant (tinted bg + colored text + subtle border). */
  faded?: boolean
}

const INTAKE_STATUS_COLORS: Record<IntakeStatus, StatusColor> = {
  "New": { color: "--palette-sky" },
  "Dave Review": { color: "--palette-indigo" },
  "Needs Follow-Up": { color: "--palette-amber" },
  "Awaiting PC": { color: "--palette-orange" },
  "Atty Review": { color: "--palette-violet" },
  "Needs Rejection Letter": { color: "--palette-red" },
  "Rejection Letter Sent": { color: "--palette-red", faded: true },
  "No Response Needed": { color: "--palette-red", faded: true },
  "Needs Retainer": { color: "--palette-green" },
  "Retainer Sent": { color: "--palette-teal" },
  "Retainer Signed": { color: "--palette-green", faded: true },
  "Archived": { color: "--muted" },
}

/**
 * Inline style for a status badge or button.
 * Solid statuses get a filled background + contrasting foreground; faded
 * "done" statuses get a soft tint + colored text + subtle border.
 */
export function getIntakeStatusStyle(status: IntakeStatus): CSSProperties {
  const { color, faded } = INTAKE_STATUS_COLORS[status]
  const c = `var(${color})`
  if (faded) {
    return {
      backgroundColor: `color-mix(in oklab, ${c} 15%, transparent)`,
      color: c,
      borderColor: `color-mix(in oklab, ${c} 30%, transparent)`,
    }
  }
  return {
    backgroundColor: c,
    color: `var(${color}-foreground)`,
  }
}
