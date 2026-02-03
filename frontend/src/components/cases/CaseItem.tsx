/**
 * CaseItem - Single case row in the cases feed
 */
import { useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { StatusBadge } from '../common';
import type { CaseSummary } from '../../types';

interface CaseItemProps {
  caseData: CaseSummary;
  onClick?: (caseData: CaseSummary) => void;
}

export function CaseItem({ caseData, onClick }: CaseItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(caseData);
    } else {
      navigate(`/cases/${caseData.id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover cursor-pointer border-b border-border last:border-b-0 transition-colors"
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: caseData.color ? `${caseData.color}20` : undefined,
          color: caseData.color || undefined,
        }}
      >
        <Briefcase className="w-4 h-4" />
      </div>

      {/* Case info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text text-sm truncate">
          {caseData.short_name || caseData.case_name}
        </div>
        {caseData.short_name && (
          <div className="text-xs text-text-muted truncate">
            {caseData.case_name}
          </div>
        )}
      </div>

      {/* Status badge */}
      <StatusBadge status={caseData.status} />
    </div>
  );
}
