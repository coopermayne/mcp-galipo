export type ChecklistStatus =
  | "needed"
  | "in_progress"
  | "partial"
  | "complete"
  | "na"

export interface ChecklistItem {
  /** Catalog key (e.g. "medical_records") or "custom:<id>" for user-added. */
  key: string
  label: string
  status: ChecklistStatus
  notes: string | null
  /** Row id once materialized; null while the item is still a virtual default. */
  id: number | null
  comment_count: number
  custom: boolean
  updated_at: string | null
}

export interface ChecklistGroup {
  key: string
  label: string
  items: ChecklistItem[]
}

export interface Checklist {
  groups: ChecklistGroup[]
  custom_items: ChecklistItem[]
}

/** Display metadata per status, keyed for the segmented control and pills. */
export const CHECKLIST_STATUS_META: Record<
  ChecklistStatus,
  { label: string; tone: "muted" | "info" | "warning" | "success" }
> = {
  needed: { label: "To do", tone: "muted" },
  in_progress: { label: "In progress", tone: "info" },
  partial: { label: "Partial", tone: "warning" },
  complete: { label: "Complete", tone: "success" },
  na: { label: "N/A", tone: "muted" },
}

/** Order the segmented control presents statuses in. */
export const CHECKLIST_STATUS_ORDER: ChecklistStatus[] = [
  "needed",
  "in_progress",
  "partial",
  "complete",
  "na",
]
