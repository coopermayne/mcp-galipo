/**
 * CasesComponent - Self-contained cases list component
 *
 * Fetches and manages case data. Handles:
 * - Data fetching
 * - Filtering by status and search
 * - Grouping by alpha or status
 * - Attorney filtering
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CasesFeed } from './CasesFeed';
import { getCases } from '../../api';
import { getStaff } from '../../api/users';
import type { StaffRef } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import type { CaseSummary } from '../../types';
import type { CaseAttorneyFilter } from '../../types/panel-layout';

type GroupMode = 'alpha' | 'status' | 'none';

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
  /** Attorney filter */
  attorneyFilter?: CaseAttorneyFilter;
  /** Callback when a case is clicked */
  onCaseClick?: (caseData: CaseSummary) => void;
}

export function CasesComponent({
  groupBy = 'none',
  showClosed = false,
  searchQuery = '',
  attorneyFilter = 'all',
  onCaseClick,
}: CasesComponentProps) {
  const { user: currentUser } = useAuth();

  // Fetch staff for displaying initials on case items
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: getStaff,
  });

  const staffMap = useMemo(() => {
    const map = new Map<number, StaffRef>();
    for (const s of staff) {
      map.set(s.id, s);
    }
    return map;
  }, [staff]);

  // Convert attorney filter to API params
  const apiParams = useMemo(() => {
    const params: { attorney_ids?: number[]; unassigned?: boolean } = {};
    if (attorneyFilter === 'mine' && currentUser) {
      params.attorney_ids = [currentUser.id];
    } else if (attorneyFilter === 'unassigned') {
      params.unassigned = true;
    } else if (Array.isArray(attorneyFilter) && attorneyFilter.length > 0) {
      params.attorney_ids = attorneyFilter;
    }
    return params;
  }, [attorneyFilter, currentUser]);

  // Fetch cases
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', { includeClosed: showClosed, ...apiParams }],
    queryFn: () => getCases({ status: showClosed ? undefined : undefined, ...apiParams }),
  });

  const allCases = casesData?.cases || [];

  // Filter cases
  const cases = useMemo(() => {
    let filtered = allCases;

    // Filter by closed status
    if (showClosed) {
      // Show ONLY closed cases
      filtered = filtered.filter((c) => c.status === 'Closed');
    } else {
      // Show only active (non-closed) cases
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
      staffMap={staffMap}
    />
  );
}
