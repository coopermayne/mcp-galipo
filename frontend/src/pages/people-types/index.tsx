import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { getRolesWithCounts, getRoleMembers, type Role } from "@/services/roles"
import { RoleDialog } from "@/pages/people-types/components/role-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, PencilEdit02Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"

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

function RoleMembersList({ roleId }: { roleId: number }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ["role-members", roleId],
    queryFn: () => getRoleMembers(roleId),
  })

  if (isLoading) {
    return (
      <div className="px-4 py-2 space-y-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-48" />
        ))}
      </div>
    )
  }

  const members = data?.members ?? []
  if (members.length === 0) {
    return (
      <div className="px-8 py-2 text-xs text-muted-foreground">
        No one assigned to this role.
      </div>
    )
  }

  const grouped = new Map<number, { name: string; cases: { id: number | null; name: string | null }[] }>()
  for (const m of members) {
    const existing = grouped.get(m.person_id)
    if (existing) {
      existing.cases.push({ id: m.case_id, name: m.case_name })
    } else {
      grouped.set(m.person_id, {
        name: m.person_name,
        cases: [{ id: m.case_id, name: m.case_name }],
      })
    }
  }

  return (
    <div className="px-8 py-1.5 space-y-1">
      {Array.from(grouped.entries()).map(([personId, { name, cases }]) => (
        <div key={personId} className="flex items-baseline gap-2 text-xs">
          <button
            className="font-medium hover:underline cursor-pointer text-left"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/contacts/${personId}`)
            }}
          >
            {name}
          </button>
          {cases.some((c) => c.id) && (
            <span className="text-muted-foreground">
              —{" "}
              {cases
                .filter((c) => c.id)
                .map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <button
                      className="hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/cases/${c.id}`)
                      }}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function PeopleTypesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>()
  const [expandedRole, setExpandedRole] = useState<number | null>(null)

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

  function openEdit(e: React.MouseEvent, role: Role) {
    e.stopPropagation()
    setEditing(role)
    setDefaultCategory(undefined)
    setDialogOpen(true)
  }

  function toggleExpand(roleId: number) {
    setExpandedRole((prev) => (prev === roleId ? null : roleId))
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
                    roles.map((role) => {
                      const isExpanded = expandedRole === role.id
                      const hasMembers = (role.usage_count ?? 0) > 0
                      return (
                        <div key={role.id} className="border-b last:border-b-0">
                          <div
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                            onClick={() => hasMembers && toggleExpand(role.id)}
                          >
                            {hasMembers ? (
                              <HugeiconsIcon
                                icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                                className="size-3.5 text-muted-foreground shrink-0"
                              />
                            ) : (
                              <span className="w-3.5 shrink-0" />
                            )}
                            <span className="text-sm font-medium flex-1">
                              {formatRoleName(role.name)}
                            </span>
                            {role.is_system && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                System
                              </Badge>
                            )}
                            {hasMembers && (
                              <span className="text-xs text-muted-foreground">
                                {role.usage_count} assigned
                              </span>
                            )}
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                              onClick={(e) => openEdit(e, role)}
                            >
                              <HugeiconsIcon
                                icon={PencilEdit02Icon}
                                className="size-3.5 text-muted-foreground"
                              />
                            </button>
                          </div>
                          {isExpanded && <RoleMembersList roleId={role.id} />}
                        </div>
                      )
                    })
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
