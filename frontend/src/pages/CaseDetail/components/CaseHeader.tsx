import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, X, Sun, Moon, LogOut } from 'lucide-react';
import { EditableText, EditableSelect, StatusBadge } from '../../../components/common';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { getCases } from '../../../api';
import type { Case } from '../../../types';

interface CaseHeaderProps {
  caseData: Case;
  statusOptions: { value: string; label: string }[];
  onUpdateField: (field: string, value: string | number | null) => Promise<void>;
}

export function CaseHeader({ caseData, statusOptions, onUpdateField }: CaseHeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch all cases for navigation
  const { data: casesData } = useQuery({
    queryKey: ['cases-nav'],
    queryFn: () => getCases({ limit: 500 }),
    staleTime: 30000, // Cache for 30 seconds
  });

  const cases = casesData?.cases || [];

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

      // Don't trigger shortcuts when typing in an input
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      // J = next case, K = previous case
      if (event.key === 'j' && nextCase) {
        navigate(`/cases/${nextCase.id}`);
      } else if (event.key === 'k' && prevCase) {
        navigate(`/cases/${prevCase.id}`);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, nextCase, prevCase, navigate]);

  const handleNavigate = (caseId: number) => {
    navigate(`/cases/${caseId}`);
    setShowSearch(false);
    setSearchQuery('');
  };

  return (
    <header className="h-16 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between transition-colors">
      {/* Left side: Case info - matches Header title/subtitle style */}
      <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
        {/* Status */}
        <div className="shrink-0">
          <EditableSelect
            value={caseData.status}
            options={statusOptions}
            onSave={(value) => onUpdateField('status', value)}
            renderValue={(value) => <StatusBadge status={value} />}
          />
        </div>

        {/* Case name - styled like Header title */}
        <span className="truncate">
          <EditableText
            value={caseData.case_name}
            onSave={(value) => onUpdateField('case_name', value)}
            className="text-xl font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap"
          />
        </span>

        {/* Short name - styled like Header subtitle */}
        <span className="shrink-0">
          <EditableText
            value={caseData.short_name || ''}
            onSave={(value) => onUpdateField('short_name', value || null)}
            placeholder="short name"
            maxLength={10}
            className="text-sm text-slate-500 dark:text-slate-400"
          />
        </span>
      </div>

      {/* Right side: Nav controls + theme + logout */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Prev button */}
        <button
          onClick={() => prevCase && handleNavigate(prevCase.id)}
          disabled={!prevCase}
          className={`p-2 rounded-lg transition-colors ${
            prevCase
              ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
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
              ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title={nextCase ? `Next: ${nextCase.short_name || nextCase.case_name} (J)` : 'No next case'}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Search/jump button */}
        <div className="relative" ref={searchContainerRef}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Jump to case (search)"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Search dropdown */}
          {showSearch && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
              <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cases..."
                    className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredCases.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">No cases found</div>
                ) : (
                  filteredCases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate(c.id)}
                      className={`w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                        c.id === caseData.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {c.short_name && (
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                            {c.short_name}
                          </span>
                        )}
                        <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
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

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={logout}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
