import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getJurisdictions, type Jurisdiction } from "@/services/jurisdictions"
import { JurisdictionDialog } from "@/pages/jurisdictions/components/jurisdiction-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Search01Icon, Link04Icon } from "@hugeicons/core-free-icons"

export default function JurisdictionsPage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Jurisdiction | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["jurisdictions"],
    queryFn: getJurisdictions,
  })

  const jurisdictions = useMemo(() => {
    const all = data?.jurisdictions ?? []
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.aliases?.some((a) => a.toLowerCase().includes(q)) ||
        j.notes?.toLowerCase().includes(q)
    )
  }, [data, search])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(j: Jurisdiction) {
    setEditing(j)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jurisdictions</h1>
          <p className="text-muted-foreground text-sm">
            {jurisdictions.length} jurisdiction{jurisdictions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
          Add Jurisdiction
        </Button>
      </div>

      <div className="relative max-w-sm">
        <HugeiconsIcon
          icon={Search01Icon}
          className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jurisdictions..."
          className="pl-9"
        />
      </div>

      <div className="border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Aliases</th>
              <th className="text-left px-4 py-2 font-medium">Judges</th>
              <th className="text-left px-4 py-2 font-medium">Proceedings</th>
              <th className="text-left px-4 py-2 font-medium">Local Rules</th>
              <th className="text-left px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[180px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[100px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[30px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[30px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[60px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[100px]" /></td>
                </tr>
              ))
            ) : jurisdictions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? "No jurisdictions match your search." : "No jurisdictions yet."}
                </td>
              </tr>
            ) : (
              jurisdictions.map((j) => (
                <tr
                  key={j.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => openEdit(j)}
                >
                  <td className="px-4 py-3 font-medium">{j.name}</td>
                  <td className="px-4 py-3">
                    {j.aliases?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {j.aliases.map((a) => (
                          <Badge key={a} variant="secondary" className="text-xs">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{j.judge_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.proceeding_count}</td>
                  <td className="px-4 py-3">
                    {j.local_rules_link ? (
                      <a
                        href={j.local_rules_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HugeiconsIcon icon={Link04Icon} className="size-3.5" />
                        Link
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {j.notes || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <JurisdictionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jurisdiction={editing}
      />
    </div>
  )
}
