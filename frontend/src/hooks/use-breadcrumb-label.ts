import { createContext, useContext, useEffect, useState, useCallback } from "react"

type BreadcrumbLabelContextValue = {
  label: string | null
  setLabel: (label: string | null) => void
}

export const BreadcrumbLabelContext = createContext<BreadcrumbLabelContextValue>({
  label: null,
  setLabel: () => {},
})

export function useBreadcrumbLabelProvider() {
  const [label, setLabel] = useState<string | null>(null)
  const set = useCallback((v: string | null) => setLabel(v), [])
  return { label, setLabel: set }
}

/**
 * Call from detail pages to set the breadcrumb label for the current route.
 * Clears on unmount.
 */
export function useBreadcrumbLabel(label: string | null | undefined) {
  const { setLabel } = useContext(BreadcrumbLabelContext)
  useEffect(() => {
    if (label) setLabel(label)
    return () => setLabel(null)
  }, [label, setLabel])
}

/**
 * Read the current breadcrumb label (used by the header).
 */
export function useCurrentBreadcrumbLabel(): string | null {
  return useContext(BreadcrumbLabelContext).label
}
