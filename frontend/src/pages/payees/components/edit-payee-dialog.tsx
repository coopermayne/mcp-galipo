import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Attachment01Icon, Upload04Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import {
  type Payee,
  updatePayee,
  deletePayee,
  uploadW9,
  openW9File,
} from "@/services/payees"

interface EditPayeeDialogProps {
  payee: Payee | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditPayeeDialog({
  payee,
  onOpenChange,
  onSuccess,
}: EditPayeeDialogProps) {
  const [name, setName] = useState("")
  const [checkName, setCheckName] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [w9Year, setW9Year] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (payee) {
      setName(payee.name)
      setCheckName(payee.check_name ?? "")
      setAddress(payee.address ?? "")
      setNotes(payee.notes ?? "")
      setPendingFile(null)
      setW9Year("")
    }
  }, [payee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payee || !name.trim()) return

    setSaving(true)
    try {
      await updatePayee(payee.id, {
        name: name.trim(),
        check_name: checkName.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Payee updated")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to update payee")
    } finally {
      setSaving(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setW9Year(String(new Date().getFullYear()))
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleW9Upload() {
    if (!pendingFile || !payee || !w9Year) return
    const year = parseInt(w9Year, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      toast.error("Please enter a valid year")
      return
    }

    setUploading(true)
    try {
      await uploadW9(payee.id, pendingFile, year)
      toast.success("W-9 uploaded")
      setPendingFile(null)
      setW9Year("")
      onSuccess()
    } catch {
      toast.error("Failed to upload W-9")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!payee) return
    setDeleting(true)
    try {
      await deletePayee(payee.id)
      toast.success("Payee deleted")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to delete payee")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!payee} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="payee-name">DBA / Business Name</Label>
            <Input
              id="payee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="payee-check-name">Check Name</Label>
            <Input
              id="payee-check-name"
              value={checkName}
              onChange={(e) => setCheckName(e.target.value)}
              placeholder="Legal name for checks"
            />
          </div>
          <div>
            <Label htmlFor="payee-address">Address</Label>
            <Textarea
              id="payee-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Payment address"
            />
          </div>
          <div>
            <Label htmlFor="payee-notes">Notes</Label>
            <Textarea
              id="payee-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="border-t pt-4">
            <Label className="text-xs">W-9</Label>
            {payee?.w9_file_path && !pendingFile ? (
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <button
                  type="button"
                  onClick={() => openW9File(payee.id)}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline min-w-0"
                >
                  <HugeiconsIcon icon={Attachment01Icon} className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {payee.w9_year ? `W-9 (${payee.w9_year})` : (payee.w9_file_name ?? "View W-9")}
                  </span>
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Replace
                </button>
              </div>
            ) : pendingFile ? (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{pendingFile.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor="w9-year" className="text-xs">Year</Label>
                    <Input
                      id="w9-year"
                      type="number"
                      value={w9Year}
                      onChange={(e) => setW9Year(e.target.value)}
                      placeholder="e.g. 2026"
                      min={1900}
                      max={2100}
                    />
                  </div>
                  <div className="flex gap-1 pt-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleW9Upload}
                      disabled={uploading || !w9Year}
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingFile(null)}
                    >
                      Cancel
                    </Button>
                  </div>
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
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              <HugeiconsIcon icon={Delete02Icon} className="mr-1 size-3.5" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
