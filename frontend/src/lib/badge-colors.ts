/**
 * Shared badge / avatar color palette.
 *
 * All 16 colors are defined as CSS custom properties (--palette-*)
 * in index.css, alongside the semantic tokens (--info, --warning, etc.).
 * This file reads those vars at runtime so everything uses one source
 * of truth and dark mode overrides work automatically.
 *
 * The backend case color rotation (db/cases.py CASE_COLORS) references
 * these same names.
 */

/** The 16 palette color names, order matches backend CASE_COLORS. */
export const BADGE_COLOR_NAMES = [
  "red", "orange", "amber", "yellow",
  "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink",
] as const

/**
 * Get inline style for a badge or avatar (solid bg, contrasting text).
 * Reads from --palette-{name} and --palette-{name}-foreground CSS vars.
 */
export function getBadgeStyle(colorName: string | null | undefined): React.CSSProperties | undefined {
  if (!colorName) return undefined
  if (!(BADGE_COLOR_NAMES as readonly string[]).includes(colorName)) return undefined
  return {
    backgroundColor: `var(--palette-${colorName})`,
    color: `var(--palette-${colorName}-foreground)`,
  }
}

/**
 * Get inline style for an avatar. Same colors as badges — one unified system.
 */
export function getAvatarStyle(colorName: string | null | undefined): React.CSSProperties | undefined {
  return getBadgeStyle(colorName)
}

/** Deterministic badge style from a numeric ID. */
export function getBadgeStyleById(id: number): React.CSSProperties {
  return getBadgeStyle(BADGE_COLOR_NAMES[id % BADGE_COLOR_NAMES.length])!
}

/** Deterministic avatar style from a numeric ID. */
export function getAvatarStyleById(id: number): React.CSSProperties {
  return getBadgeStyle(BADGE_COLOR_NAMES[id % BADGE_COLOR_NAMES.length])!
}
