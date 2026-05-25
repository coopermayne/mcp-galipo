import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LegalDocument01Icon,
  FileSearchIcon,
  NoteIcon,
  UserAdd01Icon,
  Mail01Icon,
  Invoice01Icon,
  ArrowRight01Icon,
  TextNumberSignIcon,
} from "@hugeicons/core-free-icons"

const TEMPLATE_TOOLS = [
  {
    name: "Pleadings",
    href: "/templates/pleadings",
    icon: LegalDocument01Icon,
    description:
      "Generate formatted pleading documents — motions, declarations, stipulations. Upload a PDF to auto-extract case info, then pick your document type and sections.",
    ready: true,
  },
  {
    name: "TOA Generator",
    href: "/templates/toa",
    icon: TextNumberSignIcon,
    description:
      "Generate a Table of Authorities from a legal brief. Upload a PDF, extract all citations with AI, review the results, and download a formatted TOA.",
    ready: true,
  },
  {
    name: "RFP Responses",
    href: "/templates/rfp",
    icon: FileSearchIcon,
    description:
      "Build responses to Requests for Production. Upload the RFP, manage responsive documents, and generate formatted response sets with objections.",
    ready: true,
  },
  {
    name: "Case List",
    href: "/templates/case-list",
    icon: NoteIcon,
    description:
      "Generate formatted case lists for court filings, mediation briefs, and demand letters. Pull from your case data or enter manually.",
    ready: false,
  },
  {
    name: "Intake Documents",
    href: "/templates/intake-documents",
    icon: UserAdd01Icon,
    description:
      "Generate the full new-case sign-up packet — retainer & fee-share agreements, guardian ad litem paperwork, medical release and HIPAA forms, and other routine intake documents. Pre-fills from case data and requires the key details up front (client info, co-counsel, fee/cost splits), so the system always captures them.",
    ready: false,
  },
  {
    name: "Document Requests",
    href: "/templates/document-requests",
    icon: Mail01Icon,
    description:
      "Generate and track the routine records requests sent during a case — medical records, billing, employment, and similar. Pre-fill provider and case info, produce formatted request letters, and keep a record of what's been requested.",
    ready: false,
  },
  {
    name: "Disbursement",
    href: "/templates/disbursement",
    icon: Invoice01Icon,
    description:
      "Generate disbursement sheets for settled cases. Calculate attorney fees, costs, liens, and net client recovery.",
    ready: false,
  },
]

export function TemplatesHub() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground text-sm">
          Document generation tools
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_TOOLS.map((tool) => (
          <Link
            key={tool.name}
            to={tool.href}
            className={`group border bg-card p-5 transition-all duration-200 ${
              tool.ready
                ? "hover:border-primary hover:shadow-sm cursor-pointer"
                : "opacity-60 cursor-default pointer-events-none"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="bg-primary/10 p-2">
                <HugeiconsIcon
                  icon={tool.icon}
                  className="text-primary size-5"
                  strokeWidth={2}
                />
              </div>
              {tool.ready ? (
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="text-muted-foreground group-hover:text-primary size-4 transition-colors"
                  strokeWidth={2}
                />
              ) : (
                <span className="text-muted-foreground bg-muted text-[10px] font-medium uppercase tracking-wider px-2 py-0.5">
                  Coming soon
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold mb-1">{tool.name}</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
