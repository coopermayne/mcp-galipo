/**
 * JudgeItem - Single judge row in the judges feed
 */
import { Gavel, Phone, Mail, Building2, BookOpen } from 'lucide-react';
import { useEntityModalContext } from '../../context/EntityModalContext';
import { CaseChip } from '../common/CaseChip';
import type { Judge } from '../../types';

function getPrimaryPhone(judge: Judge): string | null {
  const primary = judge.phones?.find((p) => p.primary);
  return primary?.value || judge.phones?.[0]?.value || null;
}

function getPrimaryEmail(judge: Judge): string | null {
  const primary = judge.emails?.find((e) => e.primary);
  return primary?.value || judge.emails?.[0]?.value || null;
}

interface JudgeItemProps {
  judge: Judge;
  onClick?: (judge: Judge) => void;
}

export function JudgeItem({ judge, onClick }: JudgeItemProps) {
  const { openModal } = useEntityModalContext();
  const phone = getPrimaryPhone(judge);
  const email = getPrimaryEmail(judge);
  const proceedings = judge.proceedings || [];

  const handleClick = () => {
    if (onClick) {
      onClick(judge);
    } else {
      openModal({ type: 'judge', id: judge.id });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover cursor-pointer border-b border-border last:border-b-0 transition-colors"
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${judge.title === 'Magistrate' ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-bg-hover'}`}>
        {judge.title === 'Magistrate' ? (
          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Gavel className="w-4 h-4 text-text-muted" />
        )}
      </div>

      {/* Name and jurisdiction */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text text-sm truncate">
            {judge.name}
          </span>
          {judge.title && (
            <span className="text-xs text-text-muted">{judge.title}</span>
          )}
          {judge.status && judge.status !== 'Active' && (
            <span className="text-xs text-text-muted">({judge.status})</span>
          )}
        </div>
        {judge.jurisdiction_name && (
          <div className="flex items-center gap-1 text-xs text-text-secondary truncate">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            {judge.jurisdiction_name}
          </div>
        )}
      </div>

      {/* Contact info - hidden on small screens */}
      <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary">
        {phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span className="hidden md:inline">{phone}</span>
          </span>
        )}
        {email && (
          <span className="flex items-center gap-1 max-w-[140px] truncate">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="hidden lg:inline truncate">{email}</span>
          </span>
        )}
      </div>

      {/* Case chip(s) from proceedings */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {proceedings.slice(0, 2).map((p) => (
          <CaseChip
            key={p.proceeding_id}
            caseId={p.case_id}
            caseName={p.case_name}
            shortName={p.case_name?.split(' ')[0]}
          />
        ))}
        {proceedings.length > 2 && (
          <span className="text-xs text-text-muted">+{proceedings.length - 2}</span>
        )}
      </div>
    </div>
  );
}
