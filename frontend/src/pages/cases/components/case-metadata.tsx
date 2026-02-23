import type { CaseDetail } from "@/types/case"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface CaseMetadataProps {
  caseData: CaseDetail
}

export function CaseMetadata({ caseData }: CaseMetadataProps) {
  const fields = [
    { label: "Date of Injury", value: formatDate(caseData.date_of_injury) },
    { label: "Short Name", value: caseData.short_name || "—" },
    { label: "Print Code", value: caseData.print_code || "—" },
    { label: "Result", value: caseData.result || "—" },
  ]

  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Case Details
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{f.label}</span>
            <span className="font-medium text-right">{f.value}</span>
          </div>
        ))}
      </div>
      {caseData.case_summary && (
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground mb-1">Case Summary</p>
          <p className="text-sm whitespace-pre-wrap">{caseData.case_summary}</p>
        </div>
      )}
    </div>
  )
}
