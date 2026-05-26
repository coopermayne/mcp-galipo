import { useState, useEffect, useMemo, useCallback } from "react"
import type { SortingState, VisibilityState, ColumnOrderState } from "@tanstack/react-table"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { getCases } from "@/services/cases"
import { getStaff } from "@/services/staff"
import { Button } from "@/components/ui/button"
import { CaseTable, type CaseGroupBy } from "@/pages/cases/components/case-table"
import type { CaseListItem } from "@/types/case"

// ─── Tab definitions ───────────────────────────────────────────────

type TabId =
  | "active"
  | "filing-deadlines"
  | "unassigned"
  | "closed"

interface TabDef {
  id: TabId
  label: string
  filter: (c: CaseListItem) => boolean
  defaultSort: SortingState
  visibleDateCols: string[]
  hideDetails?: boolean
  hideAttorneys?: boolean
  columnOrder?: ColumnOrderState
}

const TABS: TabDef[] = [
  {
    id: "active",
    label: "All Active",
    filter: (c) => c.status !== "Closed",
    defaultSort: [],
    visibleDateCols: ["trial_date"],
  },
  {
    id: "filing-deadlines",
    label: "Filing Deadlines",
    filter: (c) => c.status === "Pre-Claim" || c.status === "Pre-Filing",
    defaultSort: [{ id: "effective_deadline", desc: false }],
    visibleDateCols: ["date_of_injury", "claim_deadline", "complaint_deadline"],
    hideDetails: true,
    columnOrder: [
      "attorneys",
      "case_name",
      "details",
      "date_of_injury",
      "trial_date",
      "claim_deadline",
      "complaint_deadline",
      "effective_deadline",
      "status",
      "preview",
    ],
  },
  {
    id: "unassigned",
    label: "Unassigned",
    filter: (c) => (!c.attorney_ids || c.attorney_ids.length === 0) && c.status !== "Closed",
    defaultSort: [],
    visibleDateCols: [],
    hideDetails: true,
    hideAttorneys: true,
  },
  {
    id: "closed",
    label: "Closed",
    filter: (c) => c.status === "Closed",
    defaultSort: [],
    visibleDateCols: [],
  },
]

function getColumnVisibility(tab: TabDef, mobile: boolean): VisibilityState {
  return {
    details: !mobile && !tab.hideDetails,
    attorneys: !mobile && !tab.hideAttorneys,
    date_of_injury: !mobile && tab.visibleDateCols.includes("date_of_injury"),
    trial_date: !mobile && tab.visibleDateCols.includes("trial_date"),
    claim_deadline: !mobile && tab.visibleDateCols.includes("claim_deadline"),
    complaint_deadline: !mobile && tab.visibleDateCols.includes("complaint_deadline"),
    effective_deadline: false,
  }
}

// ─── Page ──────────────────────────────────────────────────────────

export default function AllCasesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get("tab") as TabId) || "active"
  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  const groupBy = (searchParams.get("group") as CaseGroupBy) || "none"
  const setGroupBy = useCallback(
    (g: CaseGroupBy) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (g === "none") {
          next.delete("group")
        } else {
          next.set("group", g)
        }
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches)
  const [sorting, setSorting] = useState<SortingState>(currentTab.defaultSort)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    getColumnVisibility(currentTab, isMobile)
  )

  const setActiveTab = useCallback(
    (tab: TabId) => {
      const tabDef = TABS.find((t) => t.id === tab) ?? TABS[0]
      setSearchParams(tab === "active" ? {} : { tab }, { replace: true })
      setSorting(tabDef.defaultSort)
      setColumnVisibility(getColumnVisibility(tabDef, isMobile))
    },
    [setSearchParams, isMobile]
  )

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      setColumnVisibility(getColumnVisibility(currentTab, e.matches))
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [currentTab])

  const { data: casesData, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCases({ limit: 2000 }),
  })

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })

  const allCases = casesData?.cases ?? []

  const tabCounts = useMemo(() => {
    const counts: Record<TabId, number> = {
      "active": 0,
      "filing-deadlines": 0,
      "unassigned": 0,
      "closed": 0,
    }
    for (const c of allCases) {
      for (const tab of TABS) {
        if (tab.filter(c)) counts[tab.id]++
      }
    }
    return counts
  }, [allCases])

  const filteredCases = useMemo(() => {
    return allCases.filter(currentTab.filter)
  }, [allCases, currentTab])

  const usersMap = useMemo(() => {
    const map = new Map<number, { id: number; first_name: string; last_name: string; initials: string }>()
    if (staffData?.data) {
      for (const u of staffData.data) {
        map.set(u.id, {
          id: u.id,
          first_name: u.firstName ?? "",
          last_name: u.lastName ?? "",
          initials: u.initials ?? "",
        })
      }
    }
    return map
  }, [staffData])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Cases</h1>
        <p className="text-muted-foreground text-sm">All cases across the firm.</p>
      </div>

      {/* Tab buttons */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const count = tabCounts[tab.id]
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} ({count})
            </Button>
          )
        })}
      </div>

      <CaseTable
        cases={filteredCases}
        usersMap={usersMap}
        isLoading={isLoading}
        isMobile={isMobile}
        sorting={sorting}
        onSortingChange={setSorting}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={currentTab.columnOrder}
        showFilters
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showDocxExport={false}
      />
    </div>
  )
}
