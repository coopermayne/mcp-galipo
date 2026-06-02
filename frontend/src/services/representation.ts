import type { CaseDetail, RepresentationLayout } from "@/types/case"
import { apiFetch } from "@/lib/api"

/**
 * Replace a case's representation organizer layout. The layout is purely
 * presentational — see pages/cases/components/representation-organizer.tsx.
 */
export async function updateRepresentationLayout(
  caseId: number,
  layout: RepresentationLayout
): Promise<{ success: boolean; case: CaseDetail }> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/representation-layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  })
  if (!res.ok) throw new Error("Failed to save representation layout")
  return res.json()
}
