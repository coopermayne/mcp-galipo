import { useState, useCallback, useRef, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextNumberSignIcon,
  Download04Icon,
  Loading03Icon,
  Cancel01Icon,
  AlertCircleIcon,
  AlertDiamondIcon,
  Delete02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import {
  extractTOAAuthorities,
  generateTOA,
} from "@/services/templates"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { TOAAuthority } from "@/types/template"

const CATEGORY_LABELS: Record<string, string> = {
  case: "Cases",
  constitutional_provision: "Constitutional Provisions",
  statute: "Statutes",
  rule: "Rules",
  other: "Other Authorities",
}

const CATEGORY_ORDER = [
  "case",
  "constitutional_provision",
  "statute",
  "rule",
  "other",
]

function getSummary(authorities: TOAAuthority[]): string {
  const counts: Record<string, number> = {}
  for (const a of authorities) {
    counts[a.category] = (counts[a.category] || 0) + 1
  }
  const parts: string[] = []
  for (const cat of CATEGORY_ORDER) {
    const n = counts[cat]
    if (!n) continue
    const label = CATEGORY_LABELS[cat].toLowerCase()
    parts.push(`${n} ${n === 1 ? label.replace(/s$/, "") : label}`)
  }
  return `Found ${parts.join(", ")}`
}

export function TOAPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [authorities, setAuthorities] = useState<TOAAuthority[]>([])
  const [pageCount, setPageCount] = useState(0)
  const [pageOffset, setPageOffset] = useState(0)
  const [hasExtracted, setHasExtracted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Collect all flagged issues
  const flaggedAuthorities = useMemo(
    () => authorities.filter((a) => a.flags && a.flags.length > 0),
    [authorities]
  )

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Only .docx files are supported")
      return
    }

    setUploadedFile(file)
    setError(null)
    setIsExtracting(true)
    setHasExtracted(false)
    setAuthorities([])
    setPageCount(0)
    setPageOffset(0)

    try {
      const response = await extractTOAAuthorities(file)
      setAuthorities(response.authorities)
      setPageCount(response.page_count)
      setHasExtracted(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to extract authorities"
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
    setAuthorities([])
    setPageCount(0)
    setPageOffset(0)
    setHasExtracted(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleDeleteAuthority = useCallback((index: number) => {
    setAuthorities((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (authorities.length === 0) {
      setError("No authorities to generate")
      return
    }

    setIsGenerating(true)
    setError(null)
    try {
      await generateTOA(authorities, pageOffset, "table_of_authorities.docx")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate TOA"
      )
    } finally {
      setIsGenerating(false)
    }
  }, [authorities, pageOffset])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">TOA Generator</h1>
        <p className="text-muted-foreground text-sm">
          Generate a Table of Authorities from a legal brief
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

      {/* Upload Zone */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0 py-2.5">
          <HugeiconsIcon
            icon={TextNumberSignIcon}
            className="text-primary size-4"
            strokeWidth={2}
          />
          <CardTitle className="text-sm">Upload Brief</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border border-dashed p-4 transition-all duration-200 ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-primary/30 bg-primary/5 hover:border-primary/50"
            } ${isExtracting ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {isExtracting ? (
              <div className="flex items-center gap-3">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="text-primary size-5 shrink-0 animate-spin"
                  strokeWidth={2}
                />
                <div>
                  <p className="text-sm font-medium">
                    Analyzing brief...
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Extracting citations from {uploadedFile?.name}. This may
                    take a minute for longer briefs.
                  </p>
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="flex items-center gap-3">
                <HugeiconsIcon
                  icon={TextNumberSignIcon}
                  className="text-primary size-4 shrink-0"
                  strokeWidth={2}
                />
                <span className="truncate text-sm font-medium">
                  {uploadedFile.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                  {pageCount > 0 && ` \u00b7 ${pageCount} pages`}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearFile()
                  }}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted ml-auto p-1 transition-colors"
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
                className="flex flex-col items-center gap-2 py-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <HugeiconsIcon
                  icon={SparklesIcon}
                  className="text-primary size-6"
                  strokeWidth={2}
                />
                <p className="text-sm">
                  <span className="text-primary font-medium">
                    Drop a .docx brief
                  </span>{" "}
                  <span className="text-muted-foreground">
                    or click to select
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  AI will extract all legal citations and page references
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Warning Panel — flagged issues */}
      {hasExtracted && flaggedAuthorities.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex-row items-center gap-2 space-y-0 py-2.5">
            <HugeiconsIcon
              icon={AlertDiamondIcon}
              className="text-warning size-4"
              strokeWidth={2}
            />
            <CardTitle className="text-warning text-sm">
              {flaggedAuthorities.length} issue
              {flaggedAuthorities.length !== 1 && "s"} found
            </CardTitle>
            <span className="text-muted-foreground ml-auto text-xs">
              Review recommended before generating
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1.5">
              {flaggedAuthorities.map((a, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">
                    {a.category === "case" ? a.name : a.text || a.title}
                  </span>
                  {a.flag_messages && a.flag_messages.length > 0 ? (
                    <ul className="text-muted-foreground ml-4 mt-0.5 list-disc text-xs">
                      {a.flag_messages.map((msg, j) => (
                        <li key={j}>{msg}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground text-xs ml-2">
                      {a.flags.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Extraction summary */}
      {hasExtracted && authorities.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {getSummary(authorities)}
        </p>
      )}

      {/* Authority Review Table */}
      {hasExtracted && authorities.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0 py-2.5">
            <CardTitle className="text-sm">Extracted Authorities</CardTitle>
            <span className="text-muted-foreground ml-auto text-xs">
              {authorities.length} total
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {CATEGORY_ORDER.map((cat) => {
                const entries = authorities
                  .map((a, i) => ({ ...a, _index: i }))
                  .filter((a) => a.category === cat)
                if (entries.length === 0) return null

                return (
                  <div key={cat} className="py-3 first:pt-0 last:pb-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                    <div className="space-y-1">
                      {entries.map((entry) => (
                        <div
                          key={entry._index}
                          className="group flex items-start gap-2 py-1"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug">
                              {entry.category === "case" ? (
                                <>
                                  <span className="italic">{entry.name}</span>
                                  {entry.cite && (
                                    <span className="text-muted-foreground">
                                      , {entry.cite}
                                    </span>
                                  )}
                                </>
                              ) : entry.category === "other" ? (
                                <>
                                  <span>{entry.author}</span>
                                  <span className="italic">{entry.title}</span>
                                  <span className="text-muted-foreground">
                                    {entry.rest}
                                  </span>
                                </>
                              ) : (
                                <span>{entry.text}</span>
                              )}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              pp.{" "}
                              {entry.pages.length >= 6
                                ? "passim"
                                : entry.pages.join(", ")}
                              {entry.flags.length > 0 && (
                                <span className="text-warning ml-2">
                                  {entry.flags
                                    .map((f) =>
                                      f.replaceAll("_", " ")
                                    )
                                    .join(", ")}
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              handleDeleteAuthority(entry._index)
                            }
                            className="text-muted-foreground hover:text-destructive shrink-0 p-1 opacity-0 transition-all group-hover:opacity-100"
                            title="Remove authority"
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              className="size-3.5"
                              strokeWidth={2}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No citations found */}
      {hasExtracted && authorities.length === 0 && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          No legal citations were found in this document.
        </div>
      )}

      {/* Page Offset + Generate */}
      {hasExtracted && authorities.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="page-offset" className="text-xs">
                Page offset
              </Label>
              <Input
                id="page-offset"
                type="number"
                value={pageOffset}
                onChange={(e) =>
                  setPageOffset(parseInt(e.target.value, 10) || 0)
                }
                className="w-24"
              />
              <p className="text-muted-foreground text-[11px]">
                Added to every page number (if inserting the TOA shifts
                pagination)
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || authorities.length === 0}
              className="ml-auto"
            >
              {isGenerating ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="mr-2 size-4 animate-spin"
                  strokeWidth={2}
                />
              ) : (
                <HugeiconsIcon
                  icon={Download04Icon}
                  className="mr-2 size-4"
                  strokeWidth={2}
                />
              )}
              Download TOA (.docx)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
