import { Navigate } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import type { FeatureKey } from "@/types/user"

interface FeatureGateProps {
  feature: FeatureKey
  redirectTo?: string
  children: React.ReactNode
}

export function FeatureGate({ feature, redirectTo = "/", children }: FeatureGateProps) {
  const { user } = useAuth()

  // null visibleFeatures = full access
  if (user?.visibleFeatures === null || user?.visibleFeatures === undefined) {
    return <>{children}</>
  }

  // Admin always has access
  if (user?.isAdmin) {
    return <>{children}</>
  }

  if (!user?.visibleFeatures.includes(feature)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
