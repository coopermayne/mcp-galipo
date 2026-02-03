/**
 * CaseItem - Single case row in the cases feed
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Check, Loader2, ChevronDown, Plus } from 'lucide-react';
import { updateCase } from '../../api';
import { getStatusColorClasses } from '../../config/colors';
import { getUserColorClass } from '../../utils';
import { TeamDropdown } from './TeamDropdown';
import type { CaseSummary, CaseStatus } from '../../types';
import type { StaffRef } from '../../api/users';

const CASE_STATUSES: CaseStatus[] = [
  'Signing Up',
  'Prospective',
  'Pre-Filing',
  'Pleadings',
  'Discovery',
  'Expert Discovery',
  'Pre-trial',
  'Trial',
  'Post-Trial',
  'Appeal',
  'Settl. Pend.',
  'Stayed',
  'Closed',
];

interface CaseItemProps {
  caseData: CaseSummary;
  onClick?: (caseData: CaseSummary) => void;
  staffMap?: Map<number, StaffRef>;
}

export function CaseItem({ caseData, onClick, staffMap }: CaseItemProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const updateMutation = useMutation({
    mutationFn: (status: CaseStatus) => updateCase(caseData.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['case', caseData.id] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = () => {
    if (onClick) {
      onClick(caseData);
    } else {
      navigate(`/cases/${caseData.id}`);
    }
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsStatusOpen(!isStatusOpen);
  };

  const handleStatusSelect = (status: CaseStatus) => {
    if (status !== caseData.status) {
      updateMutation.mutate(status);
    }
    setIsStatusOpen(false);
  };

  const colorClasses = getStatusColorClasses(caseData.status);

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover cursor-pointer border-b border-border last:border-b-0 transition-colors"
    >
      {/* Attorney avatars - fixed width so case titles always align */}
      <div
        className="relative flex-shrink-0 w-10 flex items-center justify-center cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setIsTeamOpen(!isTeamOpen);
        }}
      >
        {(() => {
          const attorneyIds = caseData.attorney_ids || [];
          const attorneys = staffMap ? attorneyIds.map(id => staffMap.get(id)).filter(Boolean) : [];

          if (attorneys.length === 0) {
            return (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-dashed border-border/60 text-text-muted/60 hover:border-border hover:text-text-muted transition-colors"
                title="Assign team"
              >
                <Plus className="w-3 h-3" />
              </div>
            );
          }

          if (attorneys.length === 1) {
            const s = attorneys[0]!;
            return (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-700 transition-all ${getUserColorClass(s.id)}`}
                title={`${s.firstName} ${s.lastName}`}
              >
                {s.initials}
              </div>
            );
          }

          // 2+ attorneys: show first two stacked
          const shown = attorneys.slice(0, 2);
          return (
            <div className="flex -space-x-2" title={attorneys.map(s => `${s!.firstName} ${s!.lastName}`).join(', ')}>
              {shown.map(s => (
                <div
                  key={s!.id}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold ring-2 ring-bg-surface ${getUserColorClass(s!.id)}`}
                >
                  {s!.initials}
                </div>
              ))}
            </div>
          );
        })()}

        {isTeamOpen && staffMap && (
          <TeamDropdown
            caseId={caseData.id}
            attorneyIds={caseData.attorney_ids || []}
            paralegalIds={caseData.paralegal_ids || []}
            staffMap={staffMap}
            onClose={() => setIsTeamOpen(false)}
          />
        )}
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

      {/* Status dropdown - padded area prevents misclicks */}
      <div
        ref={statusRef}
        className="relative -my-2 -mr-2 py-2 pr-2 pl-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleStatusClick}
          disabled={updateMutation.isPending}
          className={`
            inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-medium rounded-full
            ${colorClasses}
            hover:ring-2 hover:ring-offset-1 hover:ring-primary-300 dark:hover:ring-primary-700
            transition-all cursor-pointer
          `}
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              {caseData.status}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {isStatusOpen && (
          <div
            className="
              absolute right-0 top-full mt-1 z-50
              min-w-[160px] max-h-[280px] overflow-auto
              bg-bg-surface border border-border rounded-lg shadow-lg py-1
            "
          >
            {CASE_STATUSES.map((status) => {
              const statusColors = getStatusColorClasses(status);
              return (
                <button
                  key={status}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusSelect(status);
                  }}
                  className={`
                    flex items-center justify-between w-full px-3 py-1.5 text-sm text-left
                    hover:bg-bg-hover transition-colors
                    ${status === caseData.status ? 'bg-bg-hover' : ''}
                  `}
                >
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${statusColors}`}>
                    {status}
                  </span>
                  {status === caseData.status && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
