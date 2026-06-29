import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { QuickCreateDialog } from "@/components/common/quick-create-dialog"
import type { QuickKind } from "@/services/quick-create"

type QuickCreateConfig = { kind: QuickKind; caseId: number; caseName: string }

type QuickCreateContextValue = {
  /**
   * Open the AI quick-create dialog for a known case. `kind` chooses task vs
   * event; the case is the one highlighted in quick search (so no @-mentions).
   */
  openQuickCreate: (kind: QuickKind, caseId: number, caseName: string) => void
}

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null)

/**
 * App-level provider that renders a single QuickCreateDialog and lets any
 * component open it via `useQuickCreate().openQuickCreate(...)`.
 */
export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Retained while closing so the dialog can animate out before unmounting.
  const [config, setConfig] = useState<QuickCreateConfig | null>(null)

  const openQuickCreate = useCallback(
    (kind: QuickKind, caseId: number, caseName: string) => {
      setConfig({ kind, caseId, caseName })
      setOpen(true)
    },
    []
  )

  const value = useMemo(() => ({ openQuickCreate }), [openQuickCreate])

  return (
    <QuickCreateContext.Provider value={value}>
      {children}
      {config && (
        <QuickCreateDialog
          open={open}
          onOpenChange={setOpen}
          kind={config.kind}
          caseId={config.caseId}
          caseName={config.caseName}
        />
      )}
    </QuickCreateContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useQuickCreate() {
  const context = useContext(QuickCreateContext)
  if (!context) {
    throw new Error("useQuickCreate must be used within a QuickCreateProvider")
  }
  return context
}
