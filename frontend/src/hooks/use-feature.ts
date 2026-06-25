import { useAuth } from "@/hooks/use-auth"
import { OPT_IN_FEATURES, type FeatureKey } from "@/types/user"

/**
 * Pure gating decision, shared by the hook, `FeatureGate`, and (conceptually)
 * the sidebar:
 * - Opt-in features (`OPT_IN_FEATURES`) must be explicitly listed for the user —
 *   even admins and users with full access (`visibleFeatures == null`). This is
 *   what makes a feature "disabled by default".
 * - Otherwise: admins and `visibleFeatures == null` get full access; everyone
 *   else needs the feature in their list.
 */
export function isFeatureEnabled(
  visibleFeatures: readonly string[] | null | undefined,
  isAdmin: boolean | null | undefined,
  feature: FeatureKey
): boolean {
  if ((OPT_IN_FEATURES as readonly string[]).includes(feature)) {
    return Boolean(visibleFeatures?.includes(feature))
  }
  if (isAdmin) return true
  if (visibleFeatures === null || visibleFeatures === undefined) return true
  return visibleFeatures.includes(feature)
}

/** Returns whether the current user can see a given feature. */
export function useFeature(feature: FeatureKey): boolean {
  const { user } = useAuth()
  return isFeatureEnabled(user?.visibleFeatures, user?.isAdmin, feature)
}
