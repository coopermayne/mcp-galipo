import { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { useCasePreview } from "@/hooks/use-case-preview"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { groupCasesByStatus } from "@/pages/cases/group-cases"
import type { CaseListItem } from "@/types/case"

interface UserInfo {
  id: number
  first_name: string
  last_name: string
  initials: string
}

interface CaseGroupedViewProps {
  cases: CaseListItem[]
  isLoading?: boolean
  usersMap: Map<number, UserInfo>
}

export function CaseGroupedView({
  cases,
  isLoading,
  usersMap,
}: CaseGroupedViewProps) {
  const { openCasePreview } = useCasePreview()
  const groups = useMemo(() => groupCasesByStatus(cases), [cases])

  return (
    <div className="border border-border">
      {isLoading ? (
        <div className="divide-y divide-border/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : groups.length ? (
        groups.map((group) => (
          <Collapsible key={group.key} defaultOpen>
            <div className="flex w-full items-center bg-muted/50 border-b border-border/50">
              <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2 hover:bg-muted transition-colors cursor-pointer">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-3.5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90"
                />
                <CaseStatusBadge status={group.label as import("@/types/case").CaseStatus} />
                <span className="text-xs text-muted-foreground">
                  {group.cases.length}
                </span>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="divide-y divide-border/50">
                {group.cases.map((c) => (
                  <CaseRow
                    key={c.id}
                    caseItem={c}
                    usersMap={usersMap}
                    onClick={() => openCasePreview(c.id)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))
      ) : (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
          No cases found.
        </div>
      )}
    </div>
  )
}

function CaseRow({
  caseItem,
  usersMap,
  onClick,
}: {
  caseItem: CaseListItem
  usersMap: Map<number, UserInfo>
  onClick: () => void
}) {
  const { case_name, case_number, jurisdiction_name, judge, attorney_ids } =
    caseItem

  const detailParts: string[] = []
  if (jurisdiction_name) detailParts.push(jurisdiction_name)
  if (judge) detailParts.push(`Judge ${judge}`)

  const users = (attorney_ids ?? [])
    .map((id) => usersMap.get(id))
    .filter(Boolean) as UserInfo[]

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{case_name}</span>
        {(case_number || detailParts.length > 0) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {case_number && <span className="font-mono">{case_number}</span>}
            {detailParts.length > 0 && (
              <span>({detailParts.join(", ")})</span>
            )}
          </div>
        )}
      </div>
      {users.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {users.map((u) => (
            <span
              key={u.id}
              className="inline-flex size-5 items-center justify-center text-[9px] font-medium shrink-0"
              style={getAvatarStyleById(u.id)}
              title={`${u.first_name} ${u.last_name}`}
            >
              {u.initials}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
