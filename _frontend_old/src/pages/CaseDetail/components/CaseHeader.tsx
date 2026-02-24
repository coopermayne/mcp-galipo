import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Header } from '../../../components/layout';
import { EditableText } from '../../../components/common';
import { getCases } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import type { Case } from '../../../types';
import type { CaseStatus } from '../../../types/common';
import type { CaseAttorneyFilter, CasesGroupMode } from '../../../types/panel-layout';

interface CaseHeaderProps {
  caseData: Case;
  onUpdateField: (field: string, value: string | number | null) => Promise<void>;
}

export function CaseHeader({ caseData, onUpdateField }: CaseHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Read nav context from router state
  const navFilter: CaseAttorneyFilter = location.state?.navFilter ?? 'mine';
  const navSort: CasesGroupMode = location.state?.navSort ?? 'none';

  // Build query params based on nav filter
  const navParams = useMemo(() => {
    const params: { limit: number; attorney_ids?: number[]; unassigned?: boolean } = { limit: 500 };
    if (navFilter === 'mine' && currentUser) {
      params.attorney_ids = [currentUser.id];
    } else if (navFilter === 'unassigned') {
      params.unassigned = true;
    }
    // 'all' or number[] = no filter (fetch all)
    if (Array.isArray(navFilter) && navFilter.length > 0) {
      params.attorney_ids = navFilter;
    }
    return params;
  }, [navFilter, currentUser]);

  // Fetch filtered cases for navigation
  const { data: casesData } = useQuery({
    queryKey: ['cases-nav', navFilter],
    queryFn: () => getCases(navParams),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Sort cases to match the order shown on the Cases page
  const cases = useMemo(() => {
    const raw = casesData?.cases || [];
    if (navSort !== 'status') return raw; // API returns alphabetical, matches 'none' and 'alpha'
    // Status sort: group by workflow order, alphabetical within each group
    const STATUS_ORDER: CaseStatus[] = [
      'Signing Up', 'Prospective', 'Pre-Filing', 'Pleadings', 'Discovery',
      'Expert Discovery', 'Pre-trial', 'Trial', 'Post-Trial', 'Appeal',
      'Settl. Pend.', 'Stayed', 'Closed',
    ];
    return [...raw].sort((a, b) => {
      const idxA = STATUS_ORDER.indexOf(a.status as CaseStatus);
      const idxB = STATUS_ORDER.indexOf(b.status as CaseStatus);
      const statusCmp = (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      if (statusCmp !== 0) return statusCmp;
      const nameA = (a.short_name || a.case_name).toLowerCase();
      const nameB = (b.short_name || b.case_name).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [casesData?.cases, navSort]);

  // Find current case index and determine prev/next
  const currentIndex = useMemo(() => {
    return cases.findIndex((c) => c.id === caseData.id);
  }, [cases, caseData.id]);

  const prevCase = currentIndex > 0 ? cases[currentIndex - 1] : null;
  const nextCase = currentIndex < cases.length - 1 ? cases[currentIndex + 1] : null;

  // Filter cases for search
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases.slice(0, 10);
    const query = searchQuery.toLowerCase();
    return cases
      .filter(
        (c) =>
          c.case_name.toLowerCase().includes(query) ||
          (c.short_name && c.short_name.toLowerCase().includes(query))
      )
      .slice(0, 10);
  }, [cases, searchQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Close search on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearch(false);
        setSearchQuery('');
      }
    }
    if (showSearch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSearch]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Escape closes search
      if (event.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        return;
      }

      // Don't trigger when modifier keys are held
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Don't trigger shortcuts when typing in an input
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      // J = next case, K = previous case
      if (event.key === 'j' && nextCase) {
        navigate(`/cases/${nextCase.id}`, { state: { navFilter, navSort } });
      } else if (event.key === 'k' && prevCase) {
        navigate(`/cases/${prevCase.id}`, { state: { navFilter, navSort } });
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, nextCase, prevCase, navigate, navFilter, navSort]);

  const handleNavigate = (caseId: number) => {
    navigate(`/cases/${caseId}`, { state: { navFilter, navSort } });
    setShowSearch(false);
    setSearchQuery('');
  };

  // Simple title: Case name (consistent with other page headers)
  const title = (
    <>
      {/* Mobile: show short name or truncated case name */}
      <span className="md:hidden">
        {caseData.short_name || caseData.case_name}
      </span>
      {/* Desktop: full editable case name */}
      <span className="hidden md:inline">
        <EditableText
          value={caseData.case_name}
          onSave={(value) => onUpdateField('case_name', value)}
          className="text-xl font-semibold text-text"
        />
      </span>
    </>
  );

  // Editable short name as subtitle (desktop only)
  const subtitle = (
    <span className="hidden md:inline">
      <EditableText
        value={caseData.short_name || ''}
        onSave={(value) => onUpdateField('short_name', value || null)}
        placeholder="short name"
        maxLength={10}
        className="text-sm text-text-muted"
      />
    </span>
  );

  // Case navigation actions
  const actions = (
    <>
      {/* Prev button */}
      <button
        onClick={() => prevCase && handleNavigate(prevCase.id)}
        disabled={!prevCase}
        className={`p-2 rounded-lg transition-colors ${
          prevCase
            ? 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            : 'text-text-muted cursor-not-allowed'
        }`}
        title={prevCase ? `Previous: ${prevCase.short_name || prevCase.case_name} (K)` : 'No previous case'}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Next button */}
      <button
        onClick={() => nextCase && handleNavigate(nextCase.id)}
        disabled={!nextCase}
        className={`p-2 rounded-lg transition-colors ${
          nextCase
            ? 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            : 'text-text-muted cursor-not-allowed'
        }`}
        title={nextCase ? `Next: ${nextCase.short_name || nextCase.case_name} (J)` : 'No next case'}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Search/jump button */}
      <div className="relative" ref={searchContainerRef}>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          title="Jump to case (search)"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Search dropdown */}
        {showSearch && (
          <div className="absolute top-full right-0 mt-1 w-80 bg-bg-surface border border-border rounded-lg shadow-lg z-50">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-bg-surface text-text placeholder-text-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredCases.length === 0 ? (
                <div className="p-4 text-center text-sm text-text-muted">No cases found</div>
              ) : (
                filteredCases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleNavigate(c.id)}
                    className={`w-full px-4 py-2 text-left hover:bg-bg-hover transition-colors ${
                      c.id === caseData.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {c.short_name && (
                        <span className="text-xs font-medium text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">
                          {c.short_name}
                        </span>
                      )}
                      <span className="text-sm text-text truncate">
                        {c.case_name}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return <Header title={title} subtitle={subtitle} actions={actions} />;
}
