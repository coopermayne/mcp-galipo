import { Navigate } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { isFeatureEnabled } from "@/hooks/use-feature"
import type { FeatureKey } from "@/types/user"

interface FeatureGateProps {
  feature: FeatureKey
  redirectTo?: string
  children: React.ReactNode
}

export function FeatureGate({ feature, redirectTo = "/", children }: FeatureGateProps) {
  const { user } = useAuth()

  if (!isFeatureEnabled(user?.visibleFeatures, user?.isAdmin, feature)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
