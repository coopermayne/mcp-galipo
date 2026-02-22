import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Briefcase,
  FlaskConical,
  Shield,
  Handshake,
  Gavel,
  UserCircle,
  ArrowRight,
  Settings,
  Trash2,
  Merge,
  Search,
  Sparkles,
  Building2,
  Loader2,
} from 'lucide-react';
import { Header, PageContent } from '../../components/layout';
import { ManageRolesModal, MergeDuplicatesModal, CleanupPersonsModal } from '../../components/persons';
import { useEntityModal } from '../../components/modals';
import { getRoles, getPersons, searchJudges } from '../../api';
import { ROLE_CATEGORY_COLORS, getRoleCategoryColorClasses } from '../../config/colors';
import { formatCategoryName } from '../../utils';
import type { LucideIcon } from 'lucide-react';
import type { Person, Judge } from '../../types';

// ---------- Category cards config ----------

interface PersonCategory {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  colorKey: keyof typeof ROLE_CATEGORY_COLORS;
}

const PERSON_CATEGORIES: PersonCategory[] = [
  {
    name: 'Clients',
    href: '/persons/clients',
    icon: Users,
    description: 'Plaintiffs and claimants across all active cases. View case assignments, contact info, and client history.',
    colorKey: 'client',
  },
  {
    name: 'Counsel',
    href: '/persons/counsel',
    icon: Briefcase,
    description: 'Defense attorneys, co-counsel, and other legal representatives involved in your cases.',
    colorKey: 'counsel',
  },
  {
    name: 'Experts',
    href: '/persons/experts',
    icon: FlaskConical,
    description: 'Medical experts, economists, accident reconstructionists, and other expert witnesses.',
    colorKey: 'expert',
  },
  {
    name: 'Defendants',
    href: '/persons/defendants',
    icon: Shield,
    description: 'Named defendants and responsible parties across all cases.',
    colorKey: 'defendant',
  },
  {
    name: 'Mediators',
    href: '/persons/mediators',
    icon: Handshake,
    description: 'Mediators and arbitrators for alternative dispute resolution proceedings.',
    colorKey: 'mediator',
  },
  {
    name: 'Judges',
    href: '/persons/judges',
    icon: Gavel,
    description: 'Federal and state court judges assigned to your cases and proceedings.',
    colorKey: 'other',
  },
  {
    name: 'Other',
    href: '/persons/other',
    icon: UserCircle,
    description: 'Insurance adjusters, investigators, court reporters, and other contacts.',
    colorKey: 'other',
  },
];

// ---------- Unified search result type ----------

interface SearchResult {
  id: number;
  name: string;
  type: 'person' | 'judge';
  category?: string;         // role category for persons
  title?: string;            // judge title
  organization?: string;     // person org
  jurisdiction?: string;     // judge jurisdiction
  caseCount: number;
  fuzzyMatch?: boolean;
  score?: number;
}

function personToResult(p: Person): SearchResult {
  const category = p.roles?.[0]?.role?.category;
  // Count unique cases this person is assigned to
  const caseIds = new Set(p.roles?.filter(r => r.case_id).map(r => r.case_id));
  return {
    id: p.id,
    name: p.name,
    type: 'person',
    category,
    organization: p.organization || undefined,
    caseCount: caseIds.size,
  };
}

function judgeToResult(j: Judge): SearchResult {
  return {
    id: j.id,
    name: j.name,
    type: 'judge',
    title: j.title || undefined,
    jurisdiction: j.jurisdiction_name || undefined,
    caseCount: j.proceedings?.length || 0,
    fuzzyMatch: j.fuzzy_match,
    score: j.score,
  };
}

// ---------- OmniSearch component ----------

function OmniSearch() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openPersonModal, openJudgeModal } = useEntityModal();

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Search persons
  const { data: personsData, isLoading: personsLoading } = useQuery({
    queryKey: ['persons-omni', debouncedSearch],
    queryFn: () => getPersons({ name: debouncedSearch, include_roles: true, limit: 20 }),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000,
  });

  // Search judges (uses fuzzy backend)
  const { data: judgesData, isLoading: judgesLoading } = useQuery({
    queryKey: ['judges-omni', debouncedSearch],
    queryFn: () => searchJudges({ name: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000,
  });

  const isLoading = personsLoading || judgesLoading;

  // Merge and deduplicate results
  const results = useMemo(() => {
    if (debouncedSearch.length < 2) return [];

    const personResults = (personsData?.persons || []).map(personToResult);
    const judgeResults = (judgesData?.judges || []).map(judgeToResult);

    // Persons first (exact matches), then judges, then fuzzy
    const exact = [...personResults, ...judgeResults.filter(r => !r.fuzzyMatch)];
    const fuzzy = judgeResults.filter(r => r.fuzzyMatch);

    return [...exact, ...fuzzy].slice(0, 15);
  }, [personsData, judgesData, debouncedSearch]);

  // Has fuzzy section
  const fuzzyStartIndex = results.findIndex(r => r.fuzzyMatch);

  // Reset highlight on results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results.length, debouncedSearch]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type === 'person') {
      openPersonModal(result.id);
    } else {
      openJudgeModal(result.id);
    }
    setSearch('');
    setIsOpen(false);
  }, [openPersonModal, openJudgeModal]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown') setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightedIndex]) handleSelect(results[highlightedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, highlightedIndex, results, handleSelect]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative max-w-xl mx-auto mb-6">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (search.length >= 2) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search all people and judges..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
        />
        {isLoading && debouncedSearch.length >= 2 && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && search.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-bg-surface border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {isLoading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-text-muted">Searching...</div>
          )}

          {!isLoading && results.length === 0 && debouncedSearch.length >= 2 && (
            <div className="px-4 py-3 text-sm text-text-muted">No matches found</div>
          )}

          {results.map((result, index) => (
            <div key={`${result.type}-${result.id}`}>
              {/* Fuzzy section header */}
              {index === fuzzyStartIndex && (
                <div className="px-4 py-1.5 text-[10px] text-text-muted border-t border-border flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Fuzzy matches
                </div>
              )}
              <button
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
                  highlightedIndex === index
                    ? 'bg-primary-50 dark:bg-primary-900/30'
                    : 'hover:bg-bg-hover'
                }`}
              >
                {/* Icon */}
                <div className="shrink-0">
                  {result.type === 'judge' ? (
                    <Gavel className="w-4 h-4 text-text-muted" />
                  ) : (
                    <UserCircle className="w-4 h-4 text-text-muted" />
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate flex items-center gap-2">
                    {result.name}
                    {result.fuzzyMatch && result.score != null && (
                      <span className="text-[10px] font-normal text-primary-600 dark:text-primary-400">
                        {Math.round(result.score)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted truncate flex items-center gap-2">
                    {result.type === 'judge' && result.jurisdiction && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {result.jurisdiction}
                      </span>
                    )}
                    {result.type === 'judge' && result.title && (
                      <span>{result.title}</span>
                    )}
                    {result.type === 'person' && result.organization && (
                      <span>{result.organization}</span>
                    )}
                    {result.caseCount > 0 && (
                      <span>{result.caseCount} {result.caseCount === 1 ? 'case' : 'cases'}</span>
                    )}
                  </div>
                </div>

                {/* Type badge */}
                <div className="shrink-0">
                  {result.type === 'judge' ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      Judge
                    </span>
                  ) : result.category ? (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getRoleCategoryColorClasses(result.category)}`}>
                      {formatCategoryName(result.category)}
                    </span>
                  ) : null}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Main page ----------

export function PersonsIndex() {
  const [showManageRoles, setShowManageRoles] = useState(false);
  const [showMergeDuplicates, setShowMergeDuplicates] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="People"
        subtitle="Contacts and role management"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMergeDuplicates(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
              title="Find and merge duplicate persons"
            >
              <Merge className="w-4 h-4" />
              <span className="hidden sm:inline">Merge Duplicates</span>
            </button>
            <button
              onClick={() => setShowCleanup(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
              title="Delete persons not assigned to any case"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Cleanup</span>
            </button>
            <button
              onClick={() => setShowManageRoles(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
              title="Manage roles"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Roles</span>
            </button>
          </div>
        }
      />

      <PageContent variant="full" className="scrollbar-hide">
        {/* Omni search */}
        <OmniSearch />

        {/* Category cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PERSON_CATEGORIES.map((cat) => {
            const color = ROLE_CATEGORY_COLORS[cat.colorKey];
            return (
              <Link
                key={cat.name}
                to={cat.href}
                className="group bg-bg-surface rounded-lg border border-border p-5 transition-all duration-200 hover:border-primary-400 hover:shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${color.bg}`}>
                    <cat.icon className={`w-5 h-5 ${color.text}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary-500 transition-colors" />
                </div>
                <h3 className="text-sm font-semibold text-text mb-1">{cat.name}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{cat.description}</p>
              </Link>
            );
          })}
        </div>
      </PageContent>

      <ManageRolesModal
        isOpen={showManageRoles}
        onClose={() => setShowManageRoles(false)}
        roles={rolesData?.roles || []}
      />
      <MergeDuplicatesModal
        isOpen={showMergeDuplicates}
        onClose={() => setShowMergeDuplicates(false)}
      />
      <CleanupPersonsModal
        isOpen={showCleanup}
        onClose={() => setShowCleanup(false)}
      />
    </div>
  );
}
