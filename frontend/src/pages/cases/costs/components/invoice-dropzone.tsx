import { useState, useCallback, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import {
  uploadInvoiceFile,
  extractInvoice,
  createInvoice,
  type ExtractedInvoice,
} from "@/services/invoices"
import { InvoiceConfirmDialog } from "./invoice-confirm-dialog"

interface InvoiceDropzoneProps {
  caseId: number
  onSuccess: () => void
  onBulkUpload: (files: File[]) => void
}

export function InvoiceDropzone({ caseId, onSuccess, onBulkUpload }: InvoiceDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingLabel, setProcessingLabel] = useState("")
  const [confirmData, setConfirmData] = useState<{
    extracted: ExtractedInvoice
    filePath: string
    fileName: string
    contentType: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      const allowed = ["pdf", "png", "jpg", "jpeg"]
      if (!ext || !allowed.includes(ext)) {
        toast.error("Only PDF, PNG, and JPG files are supported")
        return
      }

      setIsProcessing(true)
      try {
        setProcessingLabel("Uploading...")
        const upload = await uploadInvoiceFile(caseId, file)

        setProcessingLabel("Analyzing invoice...")
        const { extracted } = await extractInvoice(
          upload.file_path,
          upload.content_type
        )

        setConfirmData({
          extracted,
          filePath: upload.file_path,
          fileName: upload.file_name,
          contentType: upload.content_type,
        })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to process invoice"
        )
      } finally {
        setIsProcessing(false)
        setProcessingLabel("")
      }
    },
    [caseId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = e.dataTransfer.files
      if (files.length > 1) {
        onBulkUpload(Array.from(files))
      } else if (files.length === 1) {
        processFile(files[0])
      }
    },
    [processFile, onBulkUpload]
  )

  const handleConfirm = useCallback(
    async (data: Record<string, unknown>) => {
      await createInvoice({
        case_id: caseId,
        amount: data.amount as number,
        date: (data.date as string) || undefined,
        due_date: (data.due_date as string) || undefined,
        description: (data.description as string) || undefined,
        category: (data.category as string) || undefined,
        check_number: (data.check_number as string) || undefined,
        notes: (data.notes as string) || undefined,
        payee_id: (data.payee_id as number) || undefined,
        file_path: confirmData?.filePath,
        file_name: confirmData?.fileName,
        content_type: confirmData?.contentType,
      })
      toast.success("Invoice added")
      setConfirmData(null)
      onSuccess()
    },
    [caseId, confirmData, onSuccess]
  )

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
            />
            <span className="text-sm">{processingLabel}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <HugeiconsIcon icon={Upload04Icon} className="size-5" />
            <span className="text-sm">
              Drop invoices here to auto-extract info
            </span>
            <span className="text-xs">PDF, PNG, or JPG</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 1) {
              onBulkUpload(Array.from(files))
            } else if (files && files.length === 1) {
              processFile(files[0])
            }
            e.target.value = ""
          }}
        />
      </div>

      <InvoiceConfirmDialog
        open={!!confirmData}
        onOpenChange={(open) => !open && setConfirmData(null)}
        extracted={confirmData?.extracted ?? null}
        fileName={confirmData?.fileName ?? ""}
        onConfirm={handleConfirm}
      />
    </>
  )
}
