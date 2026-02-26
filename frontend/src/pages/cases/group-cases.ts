import type { CaseListItem, CaseStatus } from "@/types/case"

export interface CaseGroup {
  key: string
  label: string
  cases: CaseListItem[]
  sortOrder: number
}

interface Pipeline {
  key: string
  statuses: CaseStatus[]
  sortOrder: number
}

const PIPELINES: Pipeline[] = [
  {
    key: "pre-lit",
    statuses: ["Signing Up", "Prospective", "Pre-Filing"],
    sortOrder: 0,
  },
  {
    key: "litigation",
    statuses: ["Pleadings", "Discovery", "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal"],
    sortOrder: 1,
  },
  {
    key: "resolution",
    statuses: ["Settl. Pend.", "Stayed"],
    sortOrder: 2,
  },
]

// Map each status to its pipeline and position within it
const STATUS_ORDER = new Map<string, { pipeline: Pipeline; index: number }>()
for (const pipeline of PIPELINES) {
  for (let i = 0; i < pipeline.statuses.length; i++) {
    STATUS_ORDER.set(pipeline.statuses[i], { pipeline, index: i })
  }
}

/**
 * Group cases by their status, organized into pipeline groups.
 * Each individual status becomes its own collapsible group,
 * visually nested under pipeline headers.
 */
export function groupCasesByStatus(cases: CaseListItem[]): CaseGroup[] {
  const byStatus = new Map<string, CaseListItem[]>()

  for (const c of cases) {
    const list = byStatus.get(c.status) ?? []
    list.push(c)
    byStatus.set(c.status, list)
  }

  const groups: CaseGroup[] = []

  for (const pipeline of PIPELINES) {
    for (let i = 0; i < pipeline.statuses.length; i++) {
      const status = pipeline.statuses[i]
      const statusCases = byStatus.get(status)
      if (!statusCases || statusCases.length === 0) continue

      groups.push({
        key: status,
        label: status,
        cases: statusCases,
        sortOrder: pipeline.sortOrder * 100 + i,
      })
    }
  }

  groups.sort((a, b) => a.sortOrder - b.sortOrder)
  return groups
}
