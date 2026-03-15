import { Fragment } from "react"
import { Link, useLocation } from "react-router"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { navGroups } from "@/components/layout/nav-data"
import { useCurrentBreadcrumbLabel } from "@/hooks/use-breadcrumb-label"

// Build lookup maps from nav data
const segmentLabels: Record<string, string> = {}
const subItemLabels: Record<string, Record<string, string>> = {}

for (const group of navGroups) {
  for (const item of group.items) {
    const segment = item.url.replace(/^\//, "")
    segmentLabels[segment] = item.title
    if (item.items) {
      subItemLabels[segment] = {}
      for (const sub of item.items) {
        const subSegment = sub.url.split("/").pop()!
        subItemLabels[segment][subSegment] = sub.title
      }
    }
  }
}

function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

type Crumb = { label: string; href?: string }

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const contextLabel = useCurrentBreadcrumbLabel()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return [{ label: "Dashboard" }]
  }

  const crumbs: Crumb[] = []
  const first = segments[0]
  const firstLabel = segmentLabels[first] || formatSegment(first)

  if (segments.length === 1) {
    crumbs.push({ label: firstLabel })
    return crumbs
  }

  crumbs.push({ label: firstLabel, href: `/${first}` })

  const second = segments[1]
  const subLabels = subItemLabels[first]

  if (subLabels?.[second]) {
    crumbs.push({ label: subLabels[second] })
  } else if (contextLabel) {
    crumbs.push({ label: contextLabel })
  } else if (/^\d+$/.test(second)) {
    crumbs.push({ label: `#${second}` })
  } else {
    crumbs.push({ label: formatSegment(second) })
  }

  return crumbs
}

export function Header() {
  const crumbs = useBreadcrumbs()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap overflow-hidden">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.label}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
