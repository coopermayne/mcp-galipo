/**
 * CasesComponent - Self-contained cases list component
 *
 * Fetches and manages case data. Handles:
 * - Data fetching
 * - Filtering by status and search
 * - Grouping by alpha or status
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CasesFeed } from './CasesFeed';
import { getCases } from '../../api';
import type { CaseSummary } from '../../types';

type GroupMode = 'alpha' | 'status';

interface CasesComponentProps {
  /** How to group cases */
  groupBy?: GroupMode;
  /** Callback when group by changes */
  onGroupByChange?: (groupBy: GroupMode) => void;
  /** Show closed/archived cases */
  showClosed?: boolean;
  /** Callback when showClosed changes */
  onShowClosedChange?: (showClosed: boolean) => void;
  /** Search query */
  searchQuery?: string;
  /** Callback when a case is clicked */
  onCaseClick?: (caseData: CaseSummary) => void;
}

export function CasesComponent({
  groupBy = 'alpha',
  showClosed = false,
  searchQuery = '',
  onCaseClick,
}: CasesComponentProps) {
  // Fetch cases
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', { includeClosed: showClosed }],
    queryFn: () => getCases({ status: showClosed ? undefined : undefined }),
  });

  const allCases = casesData?.cases || [];

  // Filter cases
  const cases = useMemo(() => {
    let filtered = allCases;

    // Filter by closed status
    if (!showClosed) {
      filtered = filtered.filter((c) => c.status !== 'Closed');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.case_name.toLowerCase().includes(query) ||
          (c.short_name && c.short_name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [allCases, showClosed, searchQuery]);

  return (
    <CasesFeed
      cases={cases}
      isLoading={isLoading}
      groupBy={groupBy}
      emptyMessage={searchQuery ? 'No cases match your search' : 'No cases'}
      onClick={onCaseClick}
    />
  );
}
