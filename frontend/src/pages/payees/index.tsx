import { useState, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { listPayees, createPayee, uploadW9, type Payee } from "@/services/payees"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Attachment01Icon,
  Search01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { openW9File } from "@/services/payees"
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
              <th className="text-left px-4 py-2 font-medium">DBA Name</th>
              <th className="text-left px-4 py-2 font-medium">Check Name</th>
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
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[120px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[160px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[60px]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-[100px]" /></td>
                </tr>
              ))
            ) : payees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.check_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                    {p.address?.split("\n")[0] || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.w9_file_path ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openW9File(p.id) }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <HugeiconsIcon icon={Attachment01Icon} className="size-3.5" />
                        {p.w9_year ? `W-9 (${p.w9_year})` : (p.w9_file_name ?? "View")}
                      </button>
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
  const [checkName, setCheckName] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [w9Year, setW9Year] = useState("")
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setW9Year(String(new Date().getFullYear()))
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (pendingFile && !w9Year) return

    setSaving(true)
    try {
      const result = await createPayee({
        name: name.trim(),
        check_name: checkName.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      if (pendingFile && w9Year) {
        const year = parseInt(w9Year, 10)
        await uploadW9(result.payee.id, pendingFile, year)
      }

      toast.success("Payee created")
      setName("")
      setCheckName("")
      setAddress("")
      setNotes("")
      setPendingFile(null)
      setW9Year("")
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Payee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="new-name">DBA / Business Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="new-check-name">Check Name</Label>
            <Input
              id="new-check-name"
              value={checkName}
              onChange={(e) => setCheckName(e.target.value)}
              placeholder="Legal name for checks"
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
          <div className="border-t pt-4">
            <Label className="text-xs">W-9</Label>
            {pendingFile ? (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{pendingFile.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor="new-w9-year" className="text-xs">Year</Label>
                    <Input
                      id="new-w9-year"
                      type="number"
                      value={w9Year}
                      onChange={(e) => setW9Year(e.target.value)}
                      placeholder="e.g. 2026"
                      min={1900}
                      max={2100}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={() => setPendingFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <HugeiconsIcon icon={Upload04Icon} className="size-3.5" />
                Upload W-9
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileSelect}
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
            <Button type="submit" disabled={saving || !name.trim() || (!!pendingFile && !w9Year)}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
