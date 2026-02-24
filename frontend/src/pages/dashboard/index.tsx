import { useMemo } from "react"
import { Link } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { navGroups } from "@/components/layout/nav-data"
import { HugeiconsIcon } from "@hugeicons/react"

const descriptions: Record<string, string> = {
  Intakes: "Review and process new client inquiries",
  Cases: "Manage active personal injury cases",
  Tasks: "Track to-dos and assignments",
  Calendar: "Deadlines, hearings, and events",
  Contacts: "Clients, counsel, experts, and more",
  Templates: "Generate pleadings, RFPs, and documents",
  CourtListener: "Federal court filing alerts",
  Users: "Manage team accounts and permissions",
}

export default function DashboardPage() {
  const { user } = useAuth()

  const items = useMemo(() => {
    return navGroups.flatMap((group) => {
      if (group.label === "Admin" && !user?.isAdmin) return []
      return group.items.filter((item) => {
        if (item.featureKey === "dashboard") return false
        if (!item.featureKey) return group.label === "Admin" ? user?.isAdmin : true
        if (user?.visibleFeatures == null) return true
        return user.visibleFeatures.includes(item.featureKey)
      })
    })
  }, [user])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back{user ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          What would you like to work on?
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.title}
            to={item.url}
            className="group border bg-card p-5 flex items-start gap-4 hover:bg-accent/50 transition-colors"
          >
            <div className="mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
              <HugeiconsIcon icon={item.icon} strokeWidth={2} size={22} />
            </div>
            <div className="min-w-0">
              <div className="font-medium group-hover:text-foreground">
                {item.title}
              </div>
              {descriptions[item.title] && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {descriptions[item.title]}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
