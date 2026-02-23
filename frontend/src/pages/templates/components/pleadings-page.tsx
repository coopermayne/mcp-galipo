import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LegalDocument01Icon,
  Download04Icon,
  SparklesIcon,
  Loading03Icon,
  Cancel01Icon,
  Tick02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import { useAuth } from "@/hooks/use-auth"
import {
  extractCaseInfo,
  improveDocumentName,
  generateFilename,
  generateDocument,
  getAttorneys,
} from "@/services/templates"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CaseInfo, Attorney } from "@/types/template"

// Primary document types — user picks one
const DOCUMENT_TYPES = [
  { key: "memo", label: "Memorandum", description: "Points and Authorities" },
  {
    key: "generic",
    label: "Generic Pleading",
    description: "General pleading body",
  },
  {
    key: "declaration",
    label: "Declaration",
    description: "Declaration in support",
  },
  {
    key: "joint_stip",
    label: "Joint Stipulation",
    description: "Joint stipulation",
  },
] as const

type DocumentType = (typeof DOCUMENT_TYPES)[number]["key"]

// Sub-options that only apply to memo/generic
const SUB_OPTIONS = [
  {
    key: "notice",
    label: "Notice of Motion",
    description: "Required for motions",
  },
  {
    key: "meet_confer",
    label: "Meet & Confer",
    description: "L.R. 7-3 compliance",
  },
  { key: "toc", label: "Table of Contents", description: "Auto-generated TOC" },
  {
    key: "toa",
    label: "Table of Authorities",
    description: "Case citations index",
  },
  {
    key: "cert_compliance",
    label: "Certificate of Compliance",
    description: "Word count certification",
  },
] as const

type SubOptionKey = (typeof SUB_OPTIONS)[number]["key"]

const SUB_OPTIONS_FOR_TYPE: Record<DocumentType, SubOptionKey[]> = {
  memo: ["notice", "meet_confer", "toc", "toa", "cert_compliance"],
  generic: ["toc", "toa"],
  declaration: [],
  joint_stip: [],
}

const DEFAULT_SUB_OPTIONS: Record<DocumentType, SubOptionKey[]> = {
  memo: ["toc", "toa", "cert_compliance"],
  generic: ["cert_compliance"],
  declaration: [],
  joint_stip: [],
}

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
  rightElement?: React.ReactNode
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
  rightElement,
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

  const fieldClasses = `${
    hasError
      ? "border-destructive focus-visible:ring-destructive/30"
      : isValid
        ? "border-green-500 focus-visible:ring-green-500/30"
        : ""
  } ${rightElement ? "pr-10" : ""}`

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
            className="size-3 text-green-500"
            strokeWidth={2}
          />
        )}
      </Label>
      <div className="relative">
        {useTextarea ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={effectiveRows}
            className={`resize-none ${fieldClasses}`}
            placeholder={placeholder}
            title={value || undefined}
          />
        ) : (
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={fieldClasses}
            placeholder={placeholder}
            title={value || undefined}
          />
        )}
        {rightElement && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {hasError && (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
          Required
        </p>
      )}
    </div>
  )
}

// --- Main component ---

export function PleadingsPage() {
  const { user } = useAuth()

  const emptyCaseInfo: CaseInfo = {
    court: null,
    case_number: null,
    plaintiffs: null,
    defendants: null,
    judge: null,
    magistrate_judge: null,
    motion_title: null,
    hearing_date: null,
    hearing_time: null,
    courtroom: null,
  }

  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [caseInfo, setCaseInfo] = useState<CaseInfo>(emptyCaseInfo)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [documentName, setDocumentName] = useState("")
  const [filename, setFilename] = useState("")
  const [isImprovingName, setIsImprovingName] = useState(false)
  const [isGeneratingFilename, setIsGeneratingFilename] = useState(false)
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false)
  const [documentType, setDocumentType] = useState<DocumentType>("memo")
  const [selectedSubOptions, setSelectedSubOptions] = useState<
    Set<SubOptionKey>
  >(() => new Set(DEFAULT_SUB_OPTIONS.memo))
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Attorney selection
  const [attorneys, setAttorneys] = useState<Attorney[]>([])
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<number | null>(
    null
  )

  useEffect(() => {
    async function fetchAttorneys() {
      try {
        const data = await getAttorneys()
        const filtered = data.filter(
          (a) => !(a.firstName === "Dale" && a.lastName === "Galipo")
        )
        setAttorneys(filtered)

        if (user) {
          const match = filtered.find((a) => a.id === user.id)
          if (match) setSelectedAttorneyId(match.id)
        }
      } catch {
        // Silently fail — user can still type manually
      }
    }
    fetchAttorneys()
  }, [user])

  const selectedAttorney = useMemo(
    () => attorneys.find((a) => a.id === selectedAttorneyId) || null,
    [attorneys, selectedAttorneyId]
  )

  const validationState = useMemo(() => {
    const missingFields = [
      !caseInfo.court?.trim() && "Court",
      !caseInfo.case_number?.trim() && "Case Number",
      !caseInfo.plaintiffs?.trim() && "Plaintiff(s)",
      !caseInfo.defendants?.trim() && "Defendant(s)",
    ].filter(Boolean) as string[]

    return { isValid: missingFields.length === 0, missingFields }
  }, [caseInfo])

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported")
      return
    }

    setUploadedFile(file)
    setError(null)
    setIsExtracting(true)
    setHasAttemptedSubmit(false)

    try {
      const response = await extractCaseInfo(file)
      setCaseInfo(response.case_info)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to extract case information"
      )
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleClearFile = useCallback(() => {
    setUploadedFile(null)
    setCaseInfo(emptyCaseInfo)
    setDocumentName("")
    setFilename("")
    setHasAttemptedSubmit(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const updateCaseInfo = useCallback(
    (field: keyof CaseInfo, value: string) => {
      setCaseInfo((prev) => ({ ...prev, [field]: value || null }))
    },
    []
  )

  const handleDocumentTypeChange = useCallback((type: DocumentType) => {
    setDocumentType(type)
    setSelectedSubOptions(new Set(DEFAULT_SUB_OPTIONS[type]))
  }, [])

  const toggleSubOption = useCallback((key: SubOptionKey) => {
    setSelectedSubOptions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleImproveDocumentName = useCallback(async () => {
    setIsImprovingName(true)
    try {
      const result = await improveDocumentName(
        documentName,
        caseInfo.motion_title || ""
      )
      setDocumentName(result.document_name)
      const sections = result.sections as string[]
      const primaryTypes: DocumentType[] = [
        "memo",
        "generic",
        "declaration",
        "joint_stip",
      ]
      const detectedType =
        primaryTypes.find((t) => sections.includes(t)) || "memo"
      setDocumentType(detectedType)
      const availableSubs = SUB_OPTIONS_FOR_TYPE[detectedType]
      setSelectedSubOptions(
        new Set(
          sections.filter((s): s is SubOptionKey =>
            availableSubs.includes(s as SubOptionKey)
          )
        )
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to improve document name"
      )
    } finally {
      setIsImprovingName(false)
    }
  }, [caseInfo, documentName])

  const handleGenerateFilename = useCallback(async () => {
    if (!documentName.trim()) {
      setError("Enter a document name first")
      return
    }
    setIsGeneratingFilename(true)
    try {
      const generated = await generateFilename(documentName)
      setFilename(generated)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate filename"
      )
    } finally {
      setIsGeneratingFilename(false)
    }
  }, [documentName])

  const handleGenerateDocument = useCallback(async () => {
    setHasAttemptedSubmit(true)

    if (!validationState.isValid) {
      setError(
        `Missing required fields: ${validationState.missingFields.join(", ")}`
      )
      return
    }
    if (!documentName.trim()) {
      setError("Enter a document name")
      return
    }
    if (!filename.trim()) {
      setError("Enter a filename")
      return
    }
    if (!selectedAttorney) {
      setError("Select a signing attorney")
      return
    }

    setIsGeneratingDocument(true)
    setError(null)
    try {
      const signingAttorney = {
        name: `${selectedAttorney.firstName} ${selectedAttorney.lastName}`,
        bar_number: selectedAttorney.barNumber || null,
        email: selectedAttorney.email || "",
      }
      const sections = [documentType, ...Array.from(selectedSubOptions)]
      await generateDocument(
        caseInfo,
        signingAttorney,
        documentName,
        filename,
        sections
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate document"
      )
    } finally {
      setIsGeneratingDocument(false)
    }
  }, [
    caseInfo,
    selectedAttorney,
    documentName,
    filename,
    documentType,
    selectedSubOptions,
    validationState,
  ])

  const sparkleButton = (
    onClick: () => void,
    loading: boolean,
    disabled?: boolean
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="text-primary hover:bg-primary/10 cursor-pointer rounded p-1 disabled:cursor-not-allowed disabled:opacity-50"
      title="AI suggest"
    >
      {loading ? (
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-4 animate-spin"
          strokeWidth={2}
        />
      ) : (
        <HugeiconsIcon icon={SparklesIcon} className="size-4" strokeWidth={2} />
      )}
    </button>
  )

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pleadings</h1>
        <p className="text-muted-foreground text-sm">
          Generate pleading documents
        </p>
      </div>

      {/* Error Display */}
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

      {/* Two-column grid: Case Info | Output Document */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {/* Case Information */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0 py-2.5">
            <HugeiconsIcon
              icon={LegalDocument01Icon}
              className="text-primary size-4"
              strokeWidth={2}
            />
            <CardTitle className="text-sm">Case Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* AI Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border border-dashed p-2.5 transition-all duration-200 ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-primary/30 bg-primary/5 hover:border-primary/50"
              } ${isExtracting ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {isExtracting ? (
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="text-primary size-4 shrink-0 animate-spin"
                    strokeWidth={2}
                  />
                  <p className="text-muted-foreground text-xs">
                    Extracting case info from {uploadedFile?.name}...
                  </p>
                </div>
              ) : uploadedFile ? (
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={LegalDocument01Icon}
                    className="text-primary size-4 shrink-0"
                    strokeWidth={2}
                  />
                  <a
                    href={URL.createObjectURL(uploadedFile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary truncate text-xs font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {uploadedFile.name}
                  </a>
                  <span className="text-muted-foreground text-xs">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearFile()
                    }}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1 transition-colors"
                    title="Clear file"
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      className="size-3.5"
                      strokeWidth={2}
                    />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    className="text-primary size-4 shrink-0"
                    strokeWidth={2}
                  />
                  <p className="text-muted-foreground text-xs">
                    <span className="text-primary font-medium">
                      Drop a PDF
                    </span>{" "}
                    to auto-fill these fields with AI
                  </p>
                </div>
              )}
            </div>

            <FormField
              label="Court"
              value={caseInfo.court || ""}
              onChange={(v) => updateCaseInfo("court", v)}
              required
              multiline
              rows={2}
              placeholder={"UNITED STATES DISTRICT COURT\nCENTRAL DISTRICT OF CALIFORNIA"}
              showValidation={hasAttemptedSubmit}
            />
            <FormField
              label="Case Number"
              value={caseInfo.case_number || ""}
              onChange={(v) => updateCaseInfo("case_number", v)}
              required
              placeholder="2:24-cv-01234-ABC-XYZ"
              showValidation={hasAttemptedSubmit}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Plaintiff(s)"
                value={caseInfo.plaintiffs || ""}
                onChange={(v) => updateCaseInfo("plaintiffs", v)}
                required
                placeholder="JOHN DOE"
                showValidation={hasAttemptedSubmit}
                autoExpand
              />
              <FormField
                label="Defendant(s)"
                value={caseInfo.defendants || ""}
                onChange={(v) => updateCaseInfo("defendants", v)}
                required
                placeholder="ACME CORPORATION"
                showValidation={hasAttemptedSubmit}
                autoExpand
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Judge"
                value={caseInfo.judge || ""}
                onChange={(v) => updateCaseInfo("judge", v)}
                placeholder="Hon. John Smith"
              />
              <FormField
                label="Magistrate Judge"
                value={caseInfo.magistrate_judge || ""}
                onChange={(v) => updateCaseInfo("magistrate_judge", v)}
                placeholder="Magistrate Judge Jane Doe"
              />
            </div>

            {/* Hearing subsection */}
            <div className="space-y-3 border-t pt-2">
              <span className="text-muted-foreground text-xs font-medium">
                Hearing (optional)
              </span>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  label="Date"
                  value={caseInfo.hearing_date || ""}
                  onChange={(v) => updateCaseInfo("hearing_date", v)}
                  placeholder="January 15, 2025"
                />
                <FormField
                  label="Time"
                  value={caseInfo.hearing_time || ""}
                  onChange={(v) => updateCaseInfo("hearing_time", v)}
                  placeholder="10:00 a.m."
                />
                <FormField
                  label="Courtroom"
                  value={caseInfo.courtroom || ""}
                  onChange={(v) => updateCaseInfo("courtroom", v)}
                  placeholder="Courtroom 10A"
                />
              </div>
            </div>
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
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                label="Document Name"
                value={documentName}
                onChange={setDocumentName}
                required
                placeholder="Opposition to Motion for Summary Judgment"
                showValidation={hasAttemptedSubmit}
                rightElement={sparkleButton(
                  handleImproveDocumentName,
                  isImprovingName
                )}
                autoExpand
              />
              <FormField
                label="Filename"
                value={filename}
                onChange={setFilename}
                required
                placeholder="2026.02.05 Opp MSJ.docx"
                showValidation={hasAttemptedSubmit}
                rightElement={sparkleButton(
                  handleGenerateFilename,
                  isGeneratingFilename,
                  !documentName.trim()
                )}
                autoExpand
              />
            </div>

            {/* Document Type */}
            <div>
              <Label className="mb-2 block text-xs">Document Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {DOCUMENT_TYPES.map((type) => {
                  const isSelected = documentType === type.key
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => handleDocumentTypeChange(type.key)}
                      className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                        isSelected
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "text-muted-foreground border-border hover:border-primary/30"
                      }`}
                      title={type.description}
                    >
                      <span
                        className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? "border-primary" : "border-current"
                        }`}
                      >
                        {isSelected && (
                          <span className="bg-primary size-1.5 rounded-full" />
                        )}
                      </span>
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sub-options */}
            {SUB_OPTIONS_FOR_TYPE[documentType].length > 0 && (
              <div>
                <Label className="mb-2 block text-xs">Include Sections</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SUB_OPTIONS.filter((opt) =>
                    SUB_OPTIONS_FOR_TYPE[documentType].includes(opt.key)
                  ).map((option) => {
                    const isSelected = selectedSubOptions.has(option.key)
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleSubOption(option.key)}
                        className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                          isSelected
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-muted-foreground border-border hover:border-primary/30"
                        }`}
                        title={option.description}
                      >
                        <span
                          className={`flex size-3.5 shrink-0 items-center justify-center border ${
                            isSelected
                              ? "bg-primary border-primary text-white"
                              : "border-current"
                          }`}
                        >
                          {isSelected && (
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              className="size-2.5"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Attorney + Generate */}
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

              <Button
                onClick={handleGenerateDocument}
                disabled={isGeneratingDocument}
              >
                {isGeneratingDocument ? (
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
    </div>
  )
}
