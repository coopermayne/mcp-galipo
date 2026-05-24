import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRolesWithCounts, type Role } from "@/services/roles"
import { RoleDialog } from "@/pages/people-types/components/role-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons"

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  client: { label: "Client", description: "Roles for clients and their representatives" },
  counsel: { label: "Counsel", description: "Attorney and legal counsel roles" },
  defendant: { label: "Defendant", description: "Defendant and opposing party roles" },
  expert: { label: "Expert", description: "Expert witness roles" },
  mediator: { label: "Mediator", description: "Mediation and ADR roles" },
  other: { label: "Other", description: "Miscellaneous roles" },
}

const CATEGORY_ORDER = ["client", "counsel", "defendant", "expert", "mediator", "other"]

function formatRoleName(name: string) {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default function PeopleTypesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ["roles", "with-counts"],
    queryFn: getRolesWithCounts,
  })

  const grouped = useMemo(() => {
    const roles = data?.roles ?? []
    const groups: Record<string, Role[]> = {}
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = []
    }
    for (const role of roles) {
      if (!groups[role.category]) groups[role.category] = []
      groups[role.category].push(role)
    }
    return groups
  }, [data])

  function openCreate(category?: string) {
    setEditing(null)
    setDefaultCategory(category)
    setDialogOpen(true)
  }

  function openEdit(role: Role) {
    setEditing(role)
    setDefaultCategory(undefined)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People Types</h1>
          <p className="text-muted-foreground text-sm">
            Manage role types that can be assigned to people on cases.
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
          Add Role
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <div className="border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const roles = grouped[cat] ?? []
            const meta = CATEGORY_META[cat] ?? { label: cat, description: "" }
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-semibold">{meta.label}</h2>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => openCreate(cat)}
                  >
                    <HugeiconsIcon icon={Add01Icon} className="mr-1 size-3.5" />
                    Add
                  </Button>
                </div>
                <div className="border">
                  {roles.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No roles in this category.
                    </div>
                  ) : (
                    roles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => openEdit(role)}
                      >
                        <span className="text-sm font-medium flex-1">
                          {formatRoleName(role.name)}
                        </span>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            System
                          </Badge>
                        )}
                        {(role.usage_count ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {role.usage_count} assigned
                          </span>
                        )}
                        <HugeiconsIcon
                          icon={PencilEdit02Icon}
                          className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editing}
        defaultCategory={defaultCategory}
      />
    </div>
  )
}
