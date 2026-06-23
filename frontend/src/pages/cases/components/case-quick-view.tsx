import { useNavigate } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { CaseDetailHeader } from "@/pages/cases/components/case-detail-header"
import { CaseProceedingsCard } from "@/pages/cases/components/case-proceedings-card"
import { CaseKeyDates } from "@/pages/cases/components/case-key-dates"
import { CaseInfoPanel } from "@/pages/cases/components/case-info-panel"
import { useFeature } from "@/hooks/use-feature"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet"

interface CaseQuickViewProps {
  caseData: CaseDetail | null
  open: boolean
  onClose: () => void
}

export function CaseQuickView({ caseData, open, onClose }: CaseQuickViewProps) {
  const navigate = useNavigate()
  const canViewDetail = useFeature("case-detail")

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="data-[side=right]:w-full data-[side=right]:sm:max-w-[560px] flex flex-col p-0">
        {caseData ? (
          <TooltipProvider>
            {/* Header — name + short name, then status + assigned people */}
            <SheetHeader className="px-4 py-3 border-b">
              <CaseDetailHeader caseData={caseData} stacked />
            </SheetHeader>

            {/* Scrollable body — proceedings, key dates, summary */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <CaseProceedingsCard caseData={caseData} />
              <CaseKeyDates caseData={caseData} />
              <CaseInfoPanel caseData={caseData} />
              {canViewDetail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    navigate(`/cases/${caseData.id}`)
                    onClose()
                  }}
                >
                  Open full details
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                </Button>
              )}
            </div>
          </TooltipProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
