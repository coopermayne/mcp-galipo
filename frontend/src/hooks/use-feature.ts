import { useAuth } from "@/hooks/use-auth"
import type { FeatureKey } from "@/types/user"

/**
 * Returns whether the current user can see a given feature.
 *
 * Mirrors the gating logic in `components/common/feature-gate.tsx`:
 * - `visibleFeatures == null` (or undefined) => full access
 * - admins always have access
 * - otherwise the feature must be in the user's `visibleFeatures` list
 */
export function useFeature(feature: FeatureKey): boolean {
  const { user } = useAuth()

  if (user?.visibleFeatures === null || user?.visibleFeatures === undefined) {
    return true
  }
  if (user.isAdmin) {
    return true
  }
  return user.visibleFeatures.includes(feature)
}
