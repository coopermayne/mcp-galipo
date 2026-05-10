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
  getW9Url,
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
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (payee) {
      setName(payee.name)
      setAddress(payee.address ?? "")
      setNotes(payee.notes ?? "")
    }
  }, [payee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payee || !name.trim()) return

    setSaving(true)
    try {
      await updatePayee(payee.id, {
        name: name.trim(),
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

  async function handleW9Upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !payee) return

    setUploading(true)
    try {
      await uploadW9(payee.id, file)
      toast.success("W9 uploaded")
      onSuccess()
    } catch {
      toast.error("Failed to upload W9")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="payee-name">Name</Label>
            <Input
              id="payee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
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
            {payee?.w9_file_path ? (
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={getW9Url(payee.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <HugeiconsIcon icon={Attachment01Icon} className="size-3.5" />
                  {payee.w9_file_name ?? "View W9"}
                </a>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Replace
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <HugeiconsIcon icon={Upload04Icon} className="size-3.5" />
                {uploading ? "Uploading..." : "Upload W9"}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleW9Upload}
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
