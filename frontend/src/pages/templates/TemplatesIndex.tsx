import { Link } from 'react-router-dom';
import { FileText, FileSearch, List, FileSignature, Receipt, ArrowRight } from 'lucide-react';
import { Header, PageContent } from '../../components/layout';

const TEMPLATE_TOOLS = [
  {
    name: 'Pleadings',
    href: '/templates/pleadings',
    icon: FileText,
    description: 'Generate formatted pleading documents — motions, declarations, stipulations. Upload a PDF to auto-extract case info, then pick your document type and sections.',
    ready: true,
  },
  {
    name: 'RFP Responses',
    href: '/templates/rfp',
    icon: FileSearch,
    description: 'Build responses to Requests for Production. Upload the RFP, manage responsive documents, and generate formatted response sets with objections.',
    ready: false,
  },
  {
    name: 'Case List',
    href: '/templates/case-list',
    icon: List,
    description: 'Generate formatted case lists for court filings, mediation briefs, and demand letters. Pull from your case data or enter manually.',
    ready: false,
  },
  {
    name: 'Retainer',
    href: '/templates/retainer',
    icon: FileSignature,
    description: 'Create retainer agreements with pre-filled client and case information. Supports multiple fee structures and engagement terms.',
    ready: false,
  },
  {
    name: 'Disbursement',
    href: '/templates/disbursement',
    icon: Receipt,
    description: 'Generate disbursement sheets for settled cases. Calculate attorney fees, costs, liens, and net client recovery.',
    ready: false,
  },
];

export function TemplatesIndex() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="Templates" subtitle="Document generation tools" />

      <PageContent variant="full" className="scrollbar-hide">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_TOOLS.map((tool) => (
            <Link
              key={tool.name}
              to={tool.href}
              className={`
                group bg-bg-surface rounded-lg border border-border p-5
                transition-all duration-200
                ${tool.ready
                  ? 'hover:border-primary-400 hover:shadow-sm cursor-pointer'
                  : 'opacity-60 cursor-default pointer-events-none'
                }
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                  <tool.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                {tool.ready ? (
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary-500 transition-colors" />
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-bg-hover px-2 py-0.5 rounded-full">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-text mb-1">{tool.name}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{tool.description}</p>
            </Link>
          ))}
        </div>
      </PageContent>
    </div>
  );
}
