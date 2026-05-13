import type { CaseDetail } from "@/types/case"
import { TrialLikelihood } from "@/pages/cases/components/trial-likelihood"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import { CaseNotesPanel } from "@/pages/cases/components/case-notes-panel"
import { CaseActivityFeed } from "@/pages/cases/components/case-activity-feed"
import { getAvatarStyleById } from "@/lib/badge-colors"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface UserInfo {
  id: number
  first_name: string
  last_name: string
  initials: string
}

interface CaseQuickViewProps {
  caseData: CaseDetail | null
  open: boolean
  onClose: () => void
  usersMap: Map<number, UserInfo>
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right truncate">{value}</span>
    </div>
  )
}

export function CaseQuickView({ caseData, open, onClose, usersMap }: CaseQuickViewProps) {
  // Get primary proceeding info
  const primaryProceeding = caseData?.proceedings?.find((p) => p.is_primary) ?? caseData?.proceedings?.[0]
  const caseNumber = primaryProceeding?.case_number
  const jurisdiction = primaryProceeding?.jurisdiction_name
  const judge = primaryProceeding?.judge_name

  const attorneys = (caseData?.attorney_ids ?? [])
    .map((id) => usersMap.get(id))
    .filter(Boolean) as UserInfo[]
  const paralegals = (caseData?.paralegal_ids ?? [])
    .map((id) => usersMap.get(id))
    .filter(Boolean) as UserInfo[]

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full flex flex-col p-0">
        {caseData ? (
          <>
            {/* Header */}
            <SheetHeader className="px-4 py-3 border-b space-y-1">
              <div className="flex items-center gap-2">
                {caseData.color && (
                  <span
                    className="inline-block size-2.5 shrink-0"
                    style={{ backgroundColor: caseData.color }}
                  />
                )}
                <SheetTitle className="text-base truncate">
                  {caseData.case_name}
                </SheetTitle>
              </div>
              <div className="flex items-center gap-2">
                {caseData.short_name && (
                  <span className="text-xs text-muted-foreground">{caseData.short_name}</span>
                )}
                <CaseStatusBadge status={caseData.status} />
              </div>
            </SheetHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Key Info */}
              <div className="px-4 py-3 space-y-1.5 border-b">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Case Info
                </span>
                {caseNumber && <InfoRow label="Case #" value={caseNumber} />}
                <InfoRow label="Date of Injury" value={formatDate(caseData.date_of_injury)} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Trial Date</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-right truncate">{formatDate(caseData.trial_date)}</span>
                    {caseData.trial_likelihood != null && (
                      <TrialLikelihood
                        caseId={caseData.id}
                        likelihood={caseData.trial_likelihood}
                        note={caseData.trial_likelihood_note}
                        compact
                      />
                    )}
                  </div>
                </div>
                <InfoRow label="Claim Deadline" value={formatDate(caseData.claim_deadline)} />
                <InfoRow label="Complaint Deadline" value={formatDate(caseData.complaint_deadline)} />
                {jurisdiction && <InfoRow label="Jurisdiction" value={jurisdiction} />}
                {judge && <InfoRow label="Judge" value={judge} />}
              </div>

              {/* Team */}
              {(attorneys.length > 0 || paralegals.length > 0) && (
                <div className="px-4 py-3 space-y-2 border-b">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Team
                  </span>
                  {attorneys.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">Attorneys</span>
                      <div className="flex flex-wrap gap-1.5">
                        {attorneys.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1.5 text-xs"
                          >
                            <span
                              className="inline-flex size-5 items-center justify-center text-[9px] font-medium shrink-0"
                              style={getAvatarStyleById(u.id)}
                            >
                              {u.initials}
                            </span>
                            {u.first_name} {u.last_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {paralegals.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">Paralegals</span>
                      <div className="flex flex-wrap gap-1.5">
                        {paralegals.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1.5 text-xs"
                          >
                            <span
                              className="inline-flex size-5 items-center justify-center text-[9px] font-medium shrink-0"
                              style={getAvatarStyleById(u.id)}
                            >
                              {u.initials}
                            </span>
                            {u.first_name} {u.last_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="border-b">
                <CaseNotesPanel caseId={caseData.id} notes={caseData.notes} />
              </div>

              {/* Activity Feed */}
              <div className="px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
                  Activity
                </span>
                <CaseActivityFeed caseId={caseData.id} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
