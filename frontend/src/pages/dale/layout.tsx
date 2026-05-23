import { NavLink, Outlet } from "react-router"
import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Briefcase01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { usePageTracking } from "@/hooks/use-page-tracking"

export default function DaleLayout() {
  usePageTracking()
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem("token"))

  // If the global auth context clears the token (e.g. on a 401), bounce to a
  // helpful empty state instead of leaving Dale on a broken page.
  useEffect(() => {
    const check = () => setHasToken(!!localStorage.getItem("token"))
    window.addEventListener("storage", check)
    window.addEventListener("auth:logout", check)
    return () => {
      window.removeEventListener("storage", check)
      window.removeEventListener("auth:logout", check)
    }
  }, [])

  if (!hasToken) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-2xl font-semibold">Session ended</p>
          <p className="mt-3 text-base text-muted-foreground">
            Open the app from your home screen icon to sign back in. If that
            doesn't work, ask the admin for a new link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-base">
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-background">
        <DaleNavItem to="/dale" label="Cases" icon={Briefcase01Icon} end />
        <DaleNavItem to="/dale/calendar" label="Calendar" icon={Calendar03Icon} />
      </nav>
    </div>
  )
}

function DaleNavItem({
  to,
  label,
  icon,
  end = false,
}: {
  to: string
  label: string
  icon: typeof Briefcase01Icon
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex h-16 flex-col items-center justify-center gap-1 text-sm font-medium",
          isActive ? "text-foreground" : "text-muted-foreground",
        )
      }
    >
      <HugeiconsIcon icon={icon} size={26} strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  )
}
