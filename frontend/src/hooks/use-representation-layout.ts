import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateRepresentationLayout } from "@/services/representation"
import type { CaseDetail, RepresentationLayout } from "@/types/case"

/**
 * Saves the representation layout for a case.
 *
 * The organizer component holds the layout as local state (that's the
 * optimistic UI), so this hook just persists and patches the cached case
 * detail on success — no refetch, which would otherwise reset an in-progress
 * edit. On failure it surfaces a toast; the component keeps its local state.
 */
export function useRepresentationLayoutMutation(caseId: string | number) {
  const queryClient = useQueryClient()
  const key = ["case", String(caseId)]

  return useMutation({
    mutationFn: (layout: RepresentationLayout) =>
      updateRepresentationLayout(Number(caseId), layout),
    onSuccess: (_data, layout) => {
      queryClient.setQueryData<CaseDetail>(key, (prev) =>
        prev ? { ...prev, representation_layout: layout } : prev
      )
    },
    onError: () => {
      toast.error("Couldn't save the representation layout")
    },
  })
}
