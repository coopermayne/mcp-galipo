import { useState, useEffect, useMemo, useCallback } from "react"
import type { SortingState, VisibilityState } from "@tanstack/react-table"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { getCases } from "@/services/cases"
import { getUsers } from "@/services/users"
import { CaseTable, type CaseGroupBy } from "@/pages/cases/components/case-table"

export default function MyCasesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const [sorting, setSorting] = useState<SortingState>([])
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => ({
    details: !isMobile,
    attorneys: !isMobile,
    date_of_injury: false,
    trial_date: !isMobile,
    claim_deadline: false,
    complaint_deadline: false,
  }))

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      setColumnVisibility({
        details: !e.matches,
        attorneys: !e.matches,
        date_of_injury: false,
        trial_date: !e.matches,
        claim_deadline: false,
        complaint_deadline: false,
      })
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const isParalegal = user?.position === "paralegal"
  const attorneyIds = user && !isParalegal ? [user.id] : undefined
  const paralegalIds = user && isParalegal ? [user.id] : undefined

  const { data: casesData, isLoading } = useQuery({
    queryKey: ["cases", "mine", user?.id, isParalegal],
    queryFn: () =>
      getCases({
        attorney_ids: attorneyIds,
        paralegal_ids: paralegalIds,
        limit: 2000,
      }),
    enabled: !!user,
  })

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
    staleTime: 5 * 60 * 1000,
  })

  const myCases = useMemo(() => {
    return (casesData?.cases ?? []).filter((c) => c.status !== "Closed")
  }, [casesData])

  const usersMap = useMemo(() => {
    const map = new Map<number, { id: number; first_name: string; last_name: string; initials: string }>()
    if (usersData?.data) {
      for (const u of usersData.data) {
        map.set(u.id, {
          id: u.id,
          first_name: u.firstName ?? "",
          last_name: u.lastName ?? "",
          initials: u.initials ?? "",
        })
      }
    }
    return map
  }, [usersData])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Cases</h1>
        <p className="text-muted-foreground text-sm">Cases assigned to you.</p>
      </div>

      <CaseTable
        cases={myCases}
        usersMap={usersMap}
        isLoading={isLoading}
        isMobile={isMobile}
        sorting={sorting}
        onSortingChange={setSorting}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />
    </div>
  )
}
