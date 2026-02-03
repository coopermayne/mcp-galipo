/**
 * CasesFeed - List of cases with optional grouping
 */
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { CaseItem } from './CaseItem';
import type { Case } from '../../types';

type GroupMode = 'alpha' | 'status';

interface CaseGroup {
  key: string;
  label: string;
  cases: Case[];
}

interface CasesFeedProps {
  cases: Case[];
  isLoading?: boolean;
  groupBy?: GroupMode;
  emptyMessage?: string;
  onClick?: (caseData: Case) => void;
}

/**
 * Group cases alphabetically by first letter of short_name or case_name
 */
function groupCasesAlpha(cases: Case[]): CaseGroup[] {
  const groups: Map<string, CaseGroup> = new Map();

  const sorted = [...cases].sort((a, b) => {
    const nameA = (a.short_name || a.case_name).toLowerCase();
    const nameB = (b.short_name || b.case_name).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  for (const caseData of sorted) {
    const name = caseData.short_name || caseData.case_name;
    const letter = name.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';

    if (!groups.has(key)) {
      groups.set(key, { key, label: key, cases: [] });
    }
    groups.get(key)!.cases.push(caseData);
  }

  return Array.from(groups.values());
}

/**
 * Group cases by status
 */
function groupCasesByStatus(cases: Case[]): CaseGroup[] {
  const groups: Map<string, CaseGroup> = new Map();

  for (const caseData of cases) {
    const key = caseData.status;
    if (!groups.has(key)) {
      groups.set(key, { key, label: key, cases: [] });
    }
    groups.get(key)!.cases.push(caseData);
  }

  // Sort cases within each group alphabetically
  return Array.from(groups.values()).map((group) => ({
    ...group,
    cases: group.cases.sort((a, b) => {
      const nameA = (a.short_name || a.case_name).toLowerCase();
      const nameB = (b.short_name || b.case_name).toLowerCase();
      return nameA.localeCompare(nameB);
    }),
  }));
}

export function CasesFeed({
  cases,
  isLoading = false,
  groupBy = 'alpha',
  emptyMessage = 'No cases',
  onClick,
}: CasesFeedProps) {
  const groups = useMemo(() => {
    switch (groupBy) {
      case 'status':
        return groupCasesByStatus(cases);
      case 'alpha':
      default:
        return groupCasesAlpha(cases);
    }
  }, [cases, groupBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="py-8">
        <div className="text-center text-text-secondary py-8">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.key} className="mb-4">
          {/* Section header */}
          {group.label && (
            <>
              <div className="flex items-center justify-between py-2 px-2">
                <h3 className="text-sm font-semibold text-text">
                  {group.label}
                  <span className="ml-2 text-text-muted font-normal">
                    ({group.cases.length})
                  </span>
                </h3>
              </div>
              <div className="border-b border-border mx-2" />
            </>
          )}

          {/* Case list */}
          {group.cases.map((caseData) => (
            <CaseItem
              key={caseData.id}
              caseData={caseData}
              onClick={onClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
