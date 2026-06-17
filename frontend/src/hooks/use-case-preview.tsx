import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCase } from "@/services/cases"
import { getStaff } from "@/services/staff"
import { CaseQuickView } from "@/pages/cases/components/case-quick-view"

type CasePreviewContextValue = {
  /** Open the case preview modal for the given case id. */
  openCasePreview: (caseId: number) => void
  /** Close the case preview modal. */
  closeCasePreview: () => void
}

const CasePreviewContext = createContext<CasePreviewContextValue | null>(null)

/**
 * App-level provider that renders a single CaseQuickView modal and lets any
 * component open it via `useCasePreview().openCasePreview(caseId)`. Clicking a
 * case anywhere in the app opens this preview instead of navigating to the
 * full detail page.
 */
export function CasePreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewCaseId, setPreviewCaseId] = useState<number | null>(null)

  const openCasePreview = useCallback((caseId: number) => {
    setPreviewCaseId(caseId)
  }, [])

  const closeCasePreview = useCallback(() => {
    setPreviewCaseId(null)
  }, [])

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })

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

  const { data: selectedCase } = useQuery({
    queryKey: ["case", previewCaseId],
    queryFn: () => getCase(previewCaseId!),
    enabled: previewCaseId != null,
  })

  const value = useMemo(
    () => ({ openCasePreview, closeCasePreview }),
    [openCasePreview, closeCasePreview]
  )

  return (
    <CasePreviewContext.Provider value={value}>
      {children}
      <CaseQuickView
        caseData={selectedCase ?? null}
        open={previewCaseId != null}
        onClose={closeCasePreview}
        usersMap={usersMap}
      />
    </CasePreviewContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCasePreview() {
  const context = useContext(CasePreviewContext)
  if (!context) {
    throw new Error("useCasePreview must be used within a CasePreviewProvider")
  }
  return context
}
