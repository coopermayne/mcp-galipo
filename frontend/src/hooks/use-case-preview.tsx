import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCase } from "@/services/cases"
import { CaseQuickView } from "@/pages/cases/components/case-quick-view"

type CasePreviewContextValue = {
  /**
   * Open the case preview modal for the given case id. Optionally pass the
   * ordered list of case ids currently visible (in display order) to enable
   * j/k keyboard navigation between cases in that list.
   */
  openCasePreview: (caseId: number, caseIds?: number[]) => void
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
  // Ordered list of case ids in the current view, for j/k navigation.
  const listIdsRef = useRef<number[]>([])

  const openCasePreview = useCallback((caseId: number, caseIds?: number[]) => {
    listIdsRef.current = caseIds ?? []
    setPreviewCaseId(caseId)
  }, [])

  const closeCasePreview = useCallback(() => {
    setPreviewCaseId(null)
  }, [])

  // j/k to move to the next/previous case in the current list.
  useEffect(() => {
    if (previewCaseId == null) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "j" && e.key !== "k") return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Don't hijack keys while editing a field inside the modal.
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return
      }

      const ids = listIdsRef.current
      if (ids.length === 0) return
      const idx = ids.indexOf(previewCaseId!)
      if (idx === -1) return

      if (e.key === "j" && idx < ids.length - 1) {
        e.preventDefault()
        setPreviewCaseId(ids[idx + 1])
      } else if (e.key === "k" && idx > 0) {
        e.preventDefault()
        setPreviewCaseId(ids[idx - 1])
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [previewCaseId])

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
