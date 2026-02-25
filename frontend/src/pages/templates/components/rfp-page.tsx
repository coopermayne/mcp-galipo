import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FileSearchIcon,
  Download04Icon,
  SparklesIcon,
  Loading03Icon,
  Tick02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  Settings02Icon,
  Upload04Icon,
  ArrowReloadHorizontalIcon,
  LinkSquare02Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"
import { useAuth } from "@/hooks/use-auth"
import {
  extractRFP,
  analyzeRFPRequests,
  generateRFPResponse,
  getObjections,
  getAttorneys,
} from "@/services/templates"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type {
  RFPCaseInfo,
  RFPRequestWithObjections,
  Objection,
  Attorney,
} from "@/types/template"

// --- Local FormField component ---

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  multiline?: boolean
  rows?: number
  placeholder?: string
  showValidation?: boolean
  autoExpand?: boolean
}

function FormField({
  label,
  value,
  onChange,
  required = false,
  multiline = false,
  rows = 1,
  placeholder,
  showValidation = false,
  autoExpand = false,
}: FormFieldProps) {
  const isEmpty = !value?.trim()
  const hasError = showValidation && required && isEmpty
  const isValid = showValidation && required && !isEmpty

  const getAutoExpandRows = () => {
    if (!autoExpand || !value) return 1
    return Math.max(1, Math.min(Math.ceil(value.length / 40), 3))
  }

  const useTextarea = multiline || autoExpand
  const effectiveRows = autoExpand ? getAutoExpandRows() : rows

  const fieldClasses = hasError
    ? "border-destructive focus-visible:ring-destructive/30"
    : isValid
      ? "border-green-500 focus-visible:ring-green-500/30"
      : ""

  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1 text-xs">
        {label}
        {required && (
          <span
            className={hasError ? "text-destructive" : "text-muted-foreground"}
          >
            *
          </span>
        )}
        {isValid && (
          <HugeiconsIcon
            icon={Tick02Icon}
            className="size-3 text-success"
            strokeWidth={2}
          />
        )}
      </Label>
      {useTextarea ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={effectiveRows}
          className={`resize-none ${fieldClasses}`}
          placeholder={placeholder}
        />
      ) : (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClasses}
          placeholder={placeholder}
        />
      )}
      {hasError && (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
          Required
        </p>
      )}
    </div>
  )
}

function ObjectionChip({
  objection,
  selected,
  onToggle,
}: {
  objection: Objection
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium transition-all duration-150 ${
        selected
          ? "bg-primary/10 text-primary border-primary/30"
          : "text-muted-foreground border-border hover:border-primary/30"
      }`}
      title={objection.formal_language}
    >
      {objection.name}
    </button>
  )
}

// --- Main component ---

export function RFPPage() {
  const { user } = useAuth()

  const emptyCase: RFPCaseInfo = {
    court_name: null,
    case_no: null,
    header_plaintiffs: null,
    header_defendants: null,
    propounding_party: null,
    responding_party: null,
    set_number: null,
    document_title: null,
    response_document_title: null,
    multiple_plaintiffs: false,
    multiple_defendants: false,
  }

  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [caseInfo, setCaseInfo] = useState<RFPCaseInfo>(emptyCase)
  const [requests, setRequests] = useState<RFPRequestWithObjections[]>([])
  const [objections, setObjections] = useState<Objection[]>([])
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [filename, setFilename] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Attorney picker
  const [attorneys, setAttorneys] = useState<Attorney[]>([])
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<number | null>(
    null
  )

  useEffect(() => {
    async function init() {
      try {
        const [attData, objData] = await Promise.all([
          getAttorneys(),
          getObjections(),
        ])
        const filtered = attData.filter(
          (a) => !(a.firstName === "Dale" && a.lastName === "Galipo")
        )
        setAttorneys(filtered)
        setObjections(objData)

        if (user) {
          const match = filtered.find((a) => a.id === user.id)
          if (match) setSelectedAttorneyId(match.id)
        }
      } catch {
        // Silently fail
      }
    }
    init()
  }, [user])

  const selectedAttorney = useMemo(
    () => attorneys.find((a) => a.id === selectedAttorneyId) || null,
    [attorneys, selectedAttorneyId]
  )

  // File handling
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported")
      return
    }

    setUploadedFile(file)
    setError(null)
    setIsExtracting(true)
    setHasAnalyzed(false)
    setHasAttemptedSubmit(false)

    try {
      const response = await extractRFP(file)
      setCaseInfo(response.case_info)
      setRequests(
        response.requests.map((r) => ({
          ...r,
          objection_short_names: [],
          documents_produced: false,
          will_produce_later: false,
          documents_withheld: false,
          no_documents: false,
        }))
      )
      const set = response.case_info.set_number || "One"
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".")
      setFilename(`${today} RFP Responses Set ${set}.docx`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract RFP")
    } finally {
      setIsExtracting(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleClearFile = useCallback(() => {
    setUploadedFile(null)
    setCaseInfo(emptyCase)
    setRequests([])
    setHasAnalyzed(false)
    setHasAttemptedSubmit(false)
    setFilename("")
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const updateCaseInfo = useCallback(
    (field: keyof RFPCaseInfo, value: string | boolean) => {
      setCaseInfo((prev) => ({ ...prev, [field]: value || null }))
    },
    []
  )

  // Analyze requests
  const handleAnalyze = useCallback(async () => {
    if (requests.length === 0) {
      setError("No requests to analyze")
      return
    }
    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeRFPRequests(
        requests.map((r) => ({ number: r.number, text: r.text }))
      )
      setRequests((prev) =>
        prev.map((req) => {
          const analysis = result.analyses[String(req.number)]
          if (analysis) {
            return { ...req, objection_short_names: analysis.objections || [] }
          }
          return {
            ...req,
            objection_short_names: req.objection_short_names || [],
          }
        })
      )
      setHasAnalyzed(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to analyze requests"
      )
    } finally {
      setIsAnalyzing(false)
    }
  }, [requests])

  // Toggle objection on a request
  const toggleObjection = useCallback(
    (reqIndex: number, shortName: string) => {
      setRequests((prev) =>
        prev.map((req, i) => {
          if (i !== reqIndex) return req
          const names = new Set(req.objection_short_names ?? [])
          if (names.has(shortName)) names.delete(shortName)
          else names.add(shortName)
          return { ...req, objection_short_names: Array.from(names) }
        })
      )
    },
    []
  )

  // Toggle response option
  const toggleResponseField = useCallback(
    (
      reqIndex: number,
      field: "documents_produced" | "will_produce_later" | "documents_withheld" | "no_documents"
    ) => {
      setRequests((prev) =>
        prev.map((req, i) => {
          if (i !== reqIndex) return req
          return { ...req, [field]: !req[field] }
        })
      )
    },
    []
  )

  // Update request text
  const updateRequestText = useCallback(
    (reqIndex: number, text: string) => {
      setRequests((prev) =>
        prev.map((req, i) => (i === reqIndex ? { ...req, text } : req))
      )
    },
    []
  )

  const updateRequestNumber = useCallback(
    (reqIndex: number, num: number) => {
      setRequests((prev) =>
        prev.map((req, i) =>
          i === reqIndex ? { ...req, number: num } : req
        )
      )
    },
    []
  )

  // Generate document
  const handleGenerate = useCallback(async () => {
    setHasAttemptedSubmit(true)

    if (!caseInfo.case_no?.trim()) {
      setError("Case number is required")
      return
    }
    if (!selectedAttorney) {
      setError("Select a signing attorney")
      return
    }
    if (!filename.trim()) {
      setError("Enter a filename")
      return
    }
    if (requests.length === 0) {
      setError("No requests to respond to")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const signingAttorney = {
        name: `${selectedAttorney.firstName} ${selectedAttorney.lastName}`,
        bar_number: selectedAttorney.barNumber || null,
        email: selectedAttorney.email || "",
      }
      await generateRFPResponse(caseInfo, requests, signingAttorney, filename)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate document"
      )
    } finally {
      setIsGenerating(false)
    }
  }, [caseInfo, requests, selectedAttorney, filename])

  const fileUrl = useMemo(
    () => (uploadedFile ? URL.createObjectURL(uploadedFile) : null),
    [uploadedFile]
  )

  const hasExtracted = !isExtracting && uploadedFile && requests.length > 0

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RFP Responses</h1>
          <p className="text-muted-foreground text-sm">
            Request for Production response generator
          </p>
        </div>
        <Link
          to="/templates/rfp/objections"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <HugeiconsIcon
            icon={Settings02Icon}
            className="size-4"
            strokeWidth={2}
          />
          Objections
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border-destructive/20 flex items-center gap-2 border p-3">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="text-destructive size-4 shrink-0"
            strokeWidth={2}
          />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Upload zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
        className="hidden"
      />

      {isExtracting ? (
        <div className="border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-4 border-2 border-dashed py-24">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="text-primary size-8 animate-spin"
            strokeWidth={2}
          />
          <div className="text-center">
            <p className="text-sm font-medium">Extracting RFP...</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {uploadedFile?.name}
            </p>
          </div>
        </div>
      ) : hasExtracted ? (
        <div className="border-border bg-card flex items-center gap-3 border px-4 py-2.5">
          <HugeiconsIcon
            icon={FileSearchIcon}
            className="text-primary size-4 shrink-0"
            strokeWidth={2}
          />
          <span className="truncate text-sm font-medium">
            {uploadedFile.name}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {(uploadedFile.size / 1024).toFixed(1)} KB
          </span>
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex shrink-0 items-center gap-1 text-xs hover:underline"
            >
              <HugeiconsIcon
                icon={LinkSquare02Icon}
                className="size-3"
                strokeWidth={2}
              />
              Open
            </a>
          )}
          <div className="flex-1" />
          <button
            onClick={handleClearFile}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              className="size-3"
              strokeWidth={2}
            />
            Restart
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed py-24 transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-primary/30 bg-primary/5 hover:border-primary/50"
          }`}
        >
          <div className="bg-primary/10 flex size-14 items-center justify-center">
            <HugeiconsIcon
              icon={Upload04Icon}
              className="text-primary size-7"
              strokeWidth={2}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Drop an RFP PDF here</p>
            <p className="text-muted-foreground mt-1 text-xs">
              or click to browse — AI will extract case info & requests
            </p>
          </div>
        </div>
      )}

      {/* Two-column grid: Case Info | Output — only shown after extraction */}
      {hasExtracted && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {/* Case Info */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0 py-2.5">
              <HugeiconsIcon
                icon={FileSearchIcon}
                className="text-primary size-4"
                strokeWidth={2}
              />
              <CardTitle className="text-sm">Case Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <FormField
                label="Court"
                value={caseInfo.court_name || ""}
                onChange={(v) => updateCaseInfo("court_name", v)}
                multiline
                rows={2}
                placeholder={"SUPERIOR COURT OF CALIFORNIA\nCOUNTY OF LOS ANGELES"}
              />
              <FormField
                label="Case Number"
                value={caseInfo.case_no || ""}
                onChange={(v) => updateCaseInfo("case_no", v)}
                required
                placeholder="BC123456"
                showValidation={hasAttemptedSubmit}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Plaintiff(s)"
                  value={caseInfo.header_plaintiffs || ""}
                  onChange={(v) => updateCaseInfo("header_plaintiffs", v)}
                  placeholder="JOHN DOE"
                  autoExpand
                />
                <FormField
                  label="Defendant(s)"
                  value={caseInfo.header_defendants || ""}
                  onChange={(v) => updateCaseInfo("header_defendants", v)}
                  placeholder="CITY OF LOS ANGELES"
                  autoExpand
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Propounding Party"
                  value={caseInfo.propounding_party || ""}
                  onChange={(v) => updateCaseInfo("propounding_party", v)}
                  placeholder="Defendant CITY OF LOS ANGELES"
                  autoExpand
                />
                <FormField
                  label="Responding Party"
                  value={caseInfo.responding_party || ""}
                  onChange={(v) => updateCaseInfo("responding_party", v)}
                  placeholder="Plaintiff JOHN DOE"
                  autoExpand
                />
              </div>
              <FormField
                label="Set Number"
                value={caseInfo.set_number || ""}
                onChange={(v) => updateCaseInfo("set_number", v)}
                placeholder="One"
              />
            </CardContent>
          </Card>

          {/* Output Document */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0 py-2.5">
              <HugeiconsIcon
                icon={Download04Icon}
                className="text-primary size-4"
                strokeWidth={2}
              />
              <CardTitle className="text-sm">Output Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <FormField
                label="Document Title"
                value={caseInfo.response_document_title || ""}
                onChange={(v) =>
                  updateCaseInfo("response_document_title", v)
                }
                placeholder="PLAINTIFF'S RESPONSES TO DEFENDANT'S FIRST SET OF REQUESTS FOR PRODUCTION OF DOCUMENTS"
                autoExpand
              />
              <FormField
                label="Filename"
                value={filename}
                onChange={setFilename}
                required
                placeholder="2026.02.12 RFP Responses Set One.docx"
                showValidation={hasAttemptedSubmit}
              />

              <div className="flex flex-wrap items-center gap-3">
                {selectedAttorney ? (
                  <label className="group relative flex cursor-pointer items-center gap-2.5">
                    <select
                      value={selectedAttorneyId ?? ""}
                      onChange={(e) =>
                        setSelectedAttorneyId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {attorneys.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.firstName} {a.lastName}
                          {a.barNumber ? ` (SBN ${a.barNumber})` : ""}
                        </option>
                      ))}
                    </select>
                    <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white transition-colors group-hover:opacity-80">
                      {selectedAttorney.initials}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      {selectedAttorney.barNumber && (
                        <span>
                          Bar No.{" "}
                          <span className="font-mono">
                            {selectedAttorney.barNumber}
                          </span>
                        </span>
                      )}
                      {selectedAttorney.barNumber &&
                        selectedAttorney.email && <span>&middot;</span>}
                      {selectedAttorney.email && (
                        <span>{selectedAttorney.email}</span>
                      )}
                    </div>
                  </label>
                ) : attorneys.length > 0 ? (
                  <div className="relative">
                    <select
                      value=""
                      onChange={(e) =>
                        setSelectedAttorneyId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="border-border text-muted-foreground focus:ring-ring appearance-none border bg-transparent px-2.5 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2"
                    >
                      <option value="">Select attorney...</option>
                      {attorneys.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.firstName} {a.lastName}
                          {a.barNumber ? ` (SBN ${a.barNumber})` : ""}
                        </option>
                      ))}
                    </select>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2"
                      strokeWidth={2}
                    />
                  </div>
                ) : null}

                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      className="size-4 animate-spin"
                      strokeWidth={2}
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={Download04Icon}
                      className="size-4"
                      strokeWidth={2}
                    />
                  )}
                  Generate Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Requests Section */}
      {hasExtracted && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 py-2.5">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={FileSearchIcon}
                className="text-primary size-4"
                strokeWidth={2}
              />
              <CardTitle className="text-sm">Requests</CardTitle>
              <span className="text-muted-foreground text-xs">
                {requests.length} request
                {requests.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-3.5 animate-spin"
                  strokeWidth={2}
                />
              ) : (
                <HugeiconsIcon
                  icon={SparklesIcon}
                  className="size-3.5"
                  strokeWidth={2}
                />
              )}
              {hasAnalyzed ? "Re-analyze" : "Apply Objections"}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {requests.map((req, idx) => (
                <div key={idx} className="space-y-2 p-4">
                  {/* Request header */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        No.
                      </span>
                      <input
                        type="number"
                        value={req.number}
                        onChange={(e) =>
                          updateRequestNumber(
                            idx,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="border-border bg-background w-12 border px-1.5 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <textarea
                      value={req.text}
                      onChange={(e) => updateRequestText(idx, e.target.value)}
                      rows={Math.max(
                        2,
                        Math.min(Math.ceil(req.text.length / 80), 6)
                      )}
                      className="border-border bg-background flex-1 resize-none border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Objection chips */}
                  {objections.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-16">
                      {objections.map((obj) => (
                        <ObjectionChip
                          key={obj.short_name}
                          objection={obj}
                          selected={(req.objection_short_names ?? []).includes(
                            obj.short_name
                          )}
                          onToggle={() =>
                            toggleObjection(idx, obj.short_name)
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Response options */}
                  <div className="flex flex-wrap items-center gap-4 pl-16">
                    {([
                      ["documents_produced", "Documents produced"],
                      ["will_produce_later", "Will produce later"],
                      ["documents_withheld", "Documents withheld"],
                      ["no_documents", "Reasonable search, no documents"],
                    ] as const).map(([field, label]) => (
                      <label key={field} className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          checked={req[field]}
                          onCheckedChange={() => toggleResponseField(idx, field)}
                        />
                        <span className="text-muted-foreground text-xs">
                          {label}
                        </span>
                      </label>
                    ))}
                    {req.documents_withheld && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <HugeiconsIcon
                          icon={Alert02Icon}
                          className="size-3"
                          strokeWidth={2}
                        />
                        Privilege log may be required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
