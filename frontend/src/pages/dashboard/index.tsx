import { useMemo, useState } from "react"
import { Link } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { navGroups } from "@/components/layout/nav-data"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import { SettingsDialog } from "@/components/common/settings-dialog"

const descriptions: Record<string, string> = {
  Intakes: "Review and process new client inquiries",
  "My Cases": "Your assigned personal injury cases",
  "All Cases": "Browse every case in the firm",
  Tasks: "Track to-dos and assignments",
  Calendar: "Deadlines, hearings, and events",
  Financials: "Case costs, liens, and settlements",
  Invoices: "Manage invoices and payees",
  Contacts: "Clients, counsel, experts, and more",
  Templates: "Generate pleadings, RFPs, and documents",
  CourtListener: "Federal court filing alerts",
  SMS: "Client text message dashboard",
  Users: "Manage team accounts and permissions",
  Activity: "Recent system activity log",
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const groups = useMemo(() => {
    return navGroups
      .map((group) => {
        if (group.label === "Admin" && !user?.isAdmin) return null
        const items = group.items.filter((item) => {
          if (!item.featureKey) return group.label === "Admin" ? user?.isAdmin : true
          if (user?.visibleFeatures == null) return true
          return user.visibleFeatures.includes(item.featureKey)
        })
        return items.length > 0 ? { label: group.label, items } : null
      })
      .filter(Boolean) as typeof navGroups
  }, [user])

  return (
    <div className="flex flex-col gap-6 p-6">
      {user?.mustChangePassword && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-3 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-left hover:bg-warning/15 transition-colors"
        >
          <HugeiconsIcon icon={Alert01Icon} size={18} className="shrink-0 text-warning" />
          <span>
            <span className="font-medium">You're using a default password.</span>{" "}
            <span className="text-muted-foreground">Click here to change it.</span>
          </span>
        </button>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          What would you like to work on?
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {group.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((item) => (
              <Link
                key={item.title}
                to={item.url}
                className="group border bg-card p-4 flex items-start gap-3 hover:bg-accent/50 transition-colors"
              >
                <div className="mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium group-hover:text-foreground">
                    {item.title}
                  </div>
                  {descriptions[item.title] && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {descriptions[item.title]}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
