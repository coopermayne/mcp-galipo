import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Building2, Phone } from 'lucide-react';
import { getPersons } from '../../api';
import type { Person, PersonType } from '../../types';

interface PersonAutocompleteProps {
  personTypes?: PersonType[];           // Filter by these types (if undefined, show all)
  excludePersonIds?: number[];          // Already assigned to case
  onSelectPerson: (person: Person) => void;
  onCreateNew: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PersonAutocomplete({
  personTypes,
  excludePersonIds = [],
  onSelectPerson,
  onCreateNew,
  placeholder = 'Search or create...',
  autoFocus = false,
}: PersonAutocompleteProps) {
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

  // Query persons when we have a search term
  const { data, isLoading } = useQuery({
    queryKey: ['persons-autocomplete', debouncedSearch, personTypes],
    queryFn: () => getPersons({
      name: debouncedSearch || undefined,
      type: personTypes?.length === 1 ? personTypes[0] : undefined,
      limit: 10,
    }),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30000,
  });

  // Filter results by personTypes (if multiple) and exclude already assigned
  const results = (data?.persons || []).filter(person => {
    // Exclude already assigned persons
    if (excludePersonIds.includes(person.id)) return false;
    // Filter by person types if specified and more than one type
    if (personTypes && personTypes.length > 1) {
      return personTypes.includes(person.person_type);
    }
    return true;
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
          onSelectPerson(results[highlightedIndex]);
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
  }, [isOpen, highlightedIndex, results, totalItems, showCreateOption, search, onSelectPerson, onCreateNew]);

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

  // Get primary phone for display
  const getPrimaryPhone = (person: Person) => {
    const primary = person.phones?.find(p => p.primary);
    return primary?.value || person.phones?.[0]?.value;
  };

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
          className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (search.length > 0 || results.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-3 py-2 text-xs text-slate-400">Searching...</div>
          )}

          {!isLoading && results.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-xs text-slate-400">Type to search...</div>
          )}

          {!isLoading && results.length === 0 && showCreateOption && search.length > 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">No matches found</div>
          )}

          {/* Results */}
          {results.map((person, index) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                onSelectPerson(person);
                setSearch('');
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2 ${
                highlightedIndex === index
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {person.name}
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  {person.organization && (
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{person.organization}</span>
                    </span>
                  )}
                  {getPrimaryPhone(person) && (
                    <span className="flex items-center gap-1 shrink-0">
                      <Phone className="w-3 h-3" />
                      {getPrimaryPhone(person)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded shrink-0">
                {person.person_type}
              </span>
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
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 ${
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
