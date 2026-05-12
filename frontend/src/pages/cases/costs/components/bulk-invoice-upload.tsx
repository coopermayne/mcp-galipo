import { useState, useEffect, useCallback, useRef } from "react"
import {
  uploadInvoiceFile,
  extractInvoice,
  createInvoice,
  type ExtractedInvoice,
} from "@/services/invoices"
import { searchPayees, type Payee } from "@/services/payees"
import { toast } from "sonner"
import { BulkInvoiceReviewDialog } from "./bulk-invoice-review-dialog"

export interface BulkInvoiceItem {
  id: string
  file: File
  fileName: string
  status:
    | "pending"
    | "uploading"
    | "extracting"
    | "ready"
    | "error"
    | "saving"
    | "saved"
  error?: string
  filePath?: string
  fileNameStored?: string
  contentType?: string
  extracted?: ExtractedInvoice
  vendor?: string
  payeeId: number | null
  payeeName: string | null
  payeeAddress: string | null
  amount: string
  date: string
  dueDate: string
  category: string
  description: string
  notes: string
}

type Phase = "idle" | "processing" | "reviewing"

interface Progress {
  uploaded: number
  extracted: number
  total: number
  errors: number
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress?: (completed: number) => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0
  let completed = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++
      results[index] = await tasks[index]()
      completed++
      onProgress?.(completed)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  )
  return results
}

function findPayeeMatch(vendor: string, payees: Payee[]): Payee | null {
  const normalized = vendor.trim().toLowerCase()
  if (!normalized) return null
  const exact = payees.find((p) => p.name.trim().toLowerCase() === normalized)
  if (exact) return exact
  const contains = payees.find((p) => {
    const pn = p.name.trim().toLowerCase()
    return normalized.includes(pn) || pn.includes(normalized)
  })
  return contains ?? null
}

interface BulkInvoiceUploadProps {
  caseId: number
  files: File[] | null
  onClose: () => void
  onSuccess: () => void
}

export function BulkInvoiceUpload({
  caseId,
  files,
  onClose,
  onSuccess,
}: BulkInvoiceUploadProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [items, setItems] = useState<BulkInvoiceItem[]>([])
  const [progress, setProgress] = useState<Progress>({
    uploaded: 0,
    extracted: 0,
    total: 0,
    errors: 0,
  })
  const [saving, setSaving] = useState(false)
  const startedRef = useRef(false)

  const updateItem = useCallback(
    (id: string, updates: Partial<BulkInvoiceItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      )
    },
    []
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const applyPayeeToVendor = useCallback(
    (vendor: string, payeeId: number, payeeName: string, payeeAddress: string | null) => {
      const normalized = vendor.trim().toLowerCase()
      setItems((prev) =>
        prev.map((item) => {
          if (
            item.vendor?.trim().toLowerCase() === normalized &&
            !item.payeeId &&
            item.status !== "saved"
          ) {
            return { ...item, payeeId, payeeName, payeeAddress }
          }
          return item
        })
      )
    },
    []
  )

  const startBulk = useCallback(
    async (fileList: File[]) => {
      const allowed = ["pdf", "png", "jpg", "jpeg"]
      const validFiles: File[] = []
      const rejected: string[] = []

      for (const file of fileList) {
        const ext = file.name.split(".").pop()?.toLowerCase()
        if (ext && allowed.includes(ext)) {
          validFiles.push(file)
        } else {
          rejected.push(file.name)
        }
      }

      if (rejected.length > 0) {
        toast.error(
          `${rejected.length} file(s) skipped (unsupported type): ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "..." : ""}`
        )
      }

      if (validFiles.length === 0) return

      const newItems: BulkInvoiceItem[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        status: "pending" as const,
        payeeId: null,
        payeeName: null,
        payeeAddress: null,
        amount: "",
        date: "",
        dueDate: "",
        category: "",
        description: "",
        notes: "",
      }))

      setItems(newItems)
      setProgress({
        uploaded: 0,
        extracted: 0,
        total: validFiles.length,
        errors: 0,
      })
      setPhase("processing")

      let errorCount = 0
      const uploadResults = new Map<string, { filePath: string; fileNameStored: string; contentType: string }>()

      // Upload phase
      const uploadTasks = newItems.map((item) => async () => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "uploading" } : i
          )
        )
        try {
          const result = await uploadInvoiceFile(caseId, item.file)
          uploadResults.set(item.id, {
            filePath: result.file_path,
            fileNameStored: result.file_name,
            contentType: result.content_type,
          })
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    filePath: result.file_path,
                    fileNameStored: result.file_name,
                    contentType: result.content_type,
                  }
                : i
            )
          )
        } catch (err) {
          errorCount++
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "error",
                    error:
                      err instanceof Error
                        ? err.message
                        : "Upload failed",
                  }
                : i
            )
          )
        }
      })

      await runWithConcurrency(uploadTasks, 3, (completed) => {
        setProgress((prev) => ({ ...prev, uploaded: completed }))
      })

      // Extract phase — use uploadResults map directly instead of reading React state
      const extractTasks = newItems
        .filter((item) => uploadResults.has(item.id))
        .map((item) => async () => {
          const upload = uploadResults.get(item.id)!

          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: "extracting" } : i
            )
          )

          try {
            const { extracted } = await extractInvoice(
              upload.filePath,
              upload.contentType
            )
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "ready",
                      extracted,
                      vendor: extracted.vendor || extracted.payable_to || "",
                      amount:
                        extracted.amount != null
                          ? String(extracted.amount)
                          : "",
                      date: extracted.date ?? "",
                      dueDate: extracted.due_date ?? "",
                      category: extracted.category ?? "",
                      description: extracted.description ?? "",
                      notes: extracted.notes ?? "",
                    }
                  : i
              )
            )
          } catch (err) {
            errorCount++
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "error",
                      error:
                        err instanceof Error
                          ? err.message
                          : "Extraction failed",
                    }
                  : i
              )
            )
          }
        })

      await runWithConcurrency(extractTasks, 3, (completed) => {
        setProgress((prev) => ({
          ...prev,
          extracted: completed,
          errors: errorCount,
        }))
      })

      // Auto-match payees
      try {
        const allPayees = await searchPayees("", 500)
        setItems((prev) =>
          prev.map((item) => {
            if (item.status !== "ready" || !item.vendor) return item
            const match = findPayeeMatch(item.vendor, allPayees)
            if (match) {
              return {
                ...item,
                payeeId: match.id,
                payeeName: match.name,
                payeeAddress: match.address,
              }
            }
            return item
          })
        )
      } catch {
        // Non-fatal — user can still assign payees manually
      }

      setPhase("reviewing")
    },
    [caseId]
  )

  // Start processing when files are provided
  useEffect(() => {
    if (files && files.length > 0 && phase === "idle" && !startedRef.current) {
      startedRef.current = true
      startBulk(files)
    }
  }, [files, phase, startBulk])

  // Reset started ref when files become null
  useEffect(() => {
    if (!files) {
      startedRef.current = false
    }
  }, [files])

  const saveValid = useCallback(async () => {
    setSaving(true)
    const validItems = items.filter(
      (item) =>
        item.status === "ready" &&
        item.payeeId &&
        item.amount &&
        item.date &&
        item.category
    )

    if (validItems.length === 0) return

    // Mark as saving
    setItems((prev) =>
      prev.map((item) =>
        validItems.some((v) => v.id === item.id)
          ? { ...item, status: "saving" as const }
          : item
      )
    )

    const saveTasks = validItems.map((item) => async () => {
      try {
        await createInvoice({
          case_id: caseId,
          amount: parseFloat(item.amount),
          date: item.date || undefined,
          due_date: item.dueDate || undefined,
          description: item.description.trim() || undefined,
          category: item.category || undefined,
          notes: item.notes.trim() || undefined,
          payee_id: item.payeeId ?? undefined,
          file_path: item.filePath,
          file_name: item.fileNameStored,
          content_type: item.contentType,
        })
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "saved" as const } : i
          )
        )
      } catch {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "ready" as const, error: "Save failed" }
              : i
          )
        )
      }
    })

    await runWithConcurrency(saveTasks, 3)
    setSaving(false)

    // Check if all are saved
    setItems((prev) => {
      const remaining = prev.filter((i) => i.status !== "saved")
      if (remaining.length === 0) {
        toast.success(`${validItems.length} invoices added`)
        onSuccess()
        setTimeout(() => {
          handleClose()
        }, 0)
      } else {
        const savedCount = prev.filter((i) => i.status === "saved").length
        toast.success(`${savedCount} invoices saved, ${remaining.length} remaining`)
        onSuccess()
      }
      return prev
    })
  }, [items, caseId, onSuccess])

  function handleClose() {
    setPhase("idle")
    setItems([])
    setProgress({ uploaded: 0, extracted: 0, total: 0, errors: 0 })
    setSaving(false)
    onClose()
  }

  const open = phase !== "idle"

  return (
    <BulkInvoiceReviewDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
      items={items}
      progress={progress}
      phase={phase === "idle" ? "processing" : phase}
      saving={saving}
      onUpdateItem={updateItem}
      onApplyPayeeToVendor={applyPayeeToVendor}
      onRemoveItem={removeItem}
      onSaveValid={saveValid}
      onCancel={handleClose}
    />
  )
}
