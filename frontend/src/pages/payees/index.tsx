import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { listPayees, createPayee, type Payee } from "@/services/payees"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Attachment01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { getW9Url } from "@/services/payees"
import { EditPayeeDialog } from "@/pages/payees/components/edit-payee-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function PayeesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["payees", search],
    queryFn: () => listPayees({ search: search || undefined, limit: 200 }),
  })

  const payees = data?.payees ?? []
  const total = data?.total ?? 0

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["payees"] })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payees</h1>
          <p className="text-muted-foreground text-sm">
            {total} payee{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
          Add Payee
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
          placeholder="Search payees..."
          className="pl-9"
        />
      </div>

      <div className="border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-left px-4 py-2 font-medium">W-9</th>
              <th className="text-left px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[120px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[160px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[60px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[100px]" /></td>
                </tr>
              ))
            ) : payees.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? "No payees match your search." : "No payees yet."}
                </td>
              </tr>
            ) : (
              payees.map((p) => (
                <tr
                  key={p.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setEditingPayee(p)}
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                    {p.address?.split("\n")[0] || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.w9_file_path ? (
                      <a
                        href={getW9Url(p.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <HugeiconsIcon icon={Attachment01Icon} className="size-3.5" />
                        {p.w9_file_name ?? "View"}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {p.notes || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EditPayeeDialog
        payee={editingPayee}
        onOpenChange={(open) => !open && setEditingPayee(null)}
        onSuccess={invalidate}
      />

      <CreatePayeeDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={invalidate}
      />
    </div>
  )
}

function CreatePayeeDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      await createPayee({
        name: name.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Payee created")
      setName("")
      setAddress("")
      setNotes("")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to create payee")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="new-address">Address</Label>
            <Textarea
              id="new-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Payment address"
            />
          </div>
          <div>
            <Label htmlFor="new-notes">Notes</Label>
            <Textarea
              id="new-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
