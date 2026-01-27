import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { getJurisdictions } from '../../api';
import type { Jurisdiction } from '../../types';

interface JurisdictionAutocompleteProps {
  excludeIds?: number[];
  onSelectJurisdiction: (jurisdiction: Jurisdiction) => void;
  onCreateNew: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function JurisdictionAutocomplete({
  excludeIds = [],
  onSelectJurisdiction,
  onCreateNew,
  placeholder = 'Search courts...',
  autoFocus = false,
}: JurisdictionAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Query all jurisdictions (they're typically a small list)
  const { data, isLoading } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: getJurisdictions,
    staleTime: 60000, // Cache for 1 minute
  });

  // Filter results by search term and exclude already used
  const results = (data?.jurisdictions || []).filter(jurisdiction => {
    if (excludeIds.includes(jurisdiction.id)) return false;
    if (!search.trim()) return true;
    return jurisdiction.name.toLowerCase().includes(search.toLowerCase());
  });

  // Total items includes results + "create new" option
  const showCreateOption = search.trim().length > 0 && !results.some(
    j => j.name.toLowerCase() === search.trim().toLowerCase()
  );
  const totalItems = results.length + (showCreateOption ? 1 : 0);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results.length, search]);

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
          onSelectJurisdiction(results[highlightedIndex]);
          setSearch('');
          setIsOpen(false);
        } else if (showCreateOption) {
          onCreateNew(search.trim());
          setSearch('');
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, highlightedIndex, results, totalItems, showCreateOption, search, onSelectJurisdiction, onCreateNew]);

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
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
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
          className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-3 py-2 text-xs text-slate-400">Loading...</div>
          )}

          {!isLoading && results.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-xs text-slate-400">No courts found</div>
          )}

          {/* Results */}
          {results.map((jurisdiction, index) => (
            <button
              key={jurisdiction.id}
              type="button"
              onClick={() => {
                onSelectJurisdiction(jurisdiction);
                setSearch('');
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-3 py-2 text-left text-sm ${
                highlightedIndex === index
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {jurisdiction.name}
              </div>
              {jurisdiction.notes && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {jurisdiction.notes}
                </div>
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
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 ${
                highlightedIndex === results.length
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
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
