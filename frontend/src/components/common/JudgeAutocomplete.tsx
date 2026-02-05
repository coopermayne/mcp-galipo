import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Building2, X } from 'lucide-react';
import { searchJudges } from '../../api';
import type { Judge } from '../../types';

interface JudgeAutocompleteProps {
  excludeJudgeIds?: number[];            // Already assigned to proceeding
  onSelectJudge: (judge: Judge) => void;
  onCreateNew: (name: string) => void;
  onCancel?: () => void;                 // Called when user cancels (Escape or X button)
  placeholder?: string;
  autoFocus?: boolean;
}

export function JudgeAutocomplete({
  excludeJudgeIds = [],
  onSelectJudge,
  onCreateNew,
  onCancel,
  placeholder = 'Search judges...',
  autoFocus = false,
}: JudgeAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Query judges when we have a search term
  const { data, isLoading } = useQuery({
    queryKey: ['judges-autocomplete', debouncedSearch],
    queryFn: () => searchJudges({ name: debouncedSearch || undefined }),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30000,
  });

  // Filter results to exclude already assigned judges
  const results = (data?.judges || []).filter(judge => {
    return !excludeJudgeIds.includes(judge.id);
  });

  // Total items includes results + "create new" option
  const showCreateOption = search.trim().length > 0;
  const totalItems = results.length + (showCreateOption ? 1 : 0);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results.length, debouncedSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex < results.length) {
          onSelectJudge(results[highlightedIndex]);
          setSearch('');
          setIsOpen(false);
        } else if (showCreateOption) {
          onCreateNew(search.trim());
          setSearch('');
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (onCancel) {
          onCancel();
        } else {
          setIsOpen(false);
        }
        break;
    }
  }, [isOpen, highlightedIndex, results, totalItems, showCreateOption, search, onSelectJudge, onCreateNew, onCancel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-7 pr-7 py-1 text-xs rounded border border-border bg-bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-secondary"
            title="Cancel"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (search.length > 0 || results.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-bg-surface border border-border rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-3 py-2 text-xs text-text-muted">Searching...</div>
          )}

          {!isLoading && results.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-xs text-text-muted">Type to search...</div>
          )}

          {!isLoading && results.length === 0 && showCreateOption && search.length > 0 && (
            <div className="px-3 py-2 text-xs text-text-muted">No matches found</div>
          )}

          {/* Results */}
          {results.map((judge, index) => (
            <button
              key={judge.id}
              type="button"
              onClick={() => {
                onSelectJudge(judge);
                setSearch('');
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2 ${
                highlightedIndex === index
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text truncate">
                  {judge.name}
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  {judge.jurisdiction_name && (
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{judge.jurisdiction_name}</span>
                    </span>
                  )}
                  {judge.chambers && (
                    <span className="truncate">{judge.chambers}</span>
                  )}
                </div>
              </div>
              {judge.status && (
                <span className="text-[10px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded shrink-0">
                  {judge.status}
                </span>
              )}
            </button>
          ))}

          {/* Create new option */}
          {showCreateOption && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(search.trim());
                setSearch('');
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(results.length)}
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 border-t border-border ${
                highlightedIndex === results.length
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <Plus className="w-3 h-3 text-primary-600" />
              <span className="text-primary-600 dark:text-primary-400">
                Create "{search.trim()}"
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
