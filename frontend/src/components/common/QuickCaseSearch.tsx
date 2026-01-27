import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { getCases } from '../../api/cases';
import type { CaseSummary } from '../../types/case';

interface QuickCaseSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickCaseSearch({ isOpen, onClose }: QuickCaseSearchProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: casesData } = useQuery({
    queryKey: ['cases'],
    queryFn: () => getCases(),
    enabled: isOpen,
  });

  const cases = casesData?.cases || [];

  // Filter cases based on search term
  const filteredCases = cases.filter((c: CaseSummary) => {
    const search = searchTerm.toLowerCase();
    return (
      c.case_name.toLowerCase().includes(search) ||
      (c.short_name?.toLowerCase().includes(search) ?? false)
    );
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCases.length) {
      setSelectedIndex(Math.max(0, filteredCases.length - 1));
    }
  }, [filteredCases.length, selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCases.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCases[selectedIndex]) {
            navigate(`/cases/${filteredCases[selectedIndex].id}`);
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCases, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search cases..."
            className="flex-1 px-3 py-4 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filteredCases.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              {searchTerm ? 'No cases found' : 'Start typing to search...'}
            </div>
          ) : (
            <ul>
              {filteredCases.map((c: CaseSummary, index: number) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      navigate(`/cases/${c.id}`);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 ${
                      index === selectedIndex
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {c.short_name || c.case_name}
                      </div>
                      {c.short_name && (
                        <div className="text-sm text-slate-500 truncate">
                          {c.case_name}
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      c.status === 'Closed'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        : c.status === 'Signing Up' || c.status === 'Prospective'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {c.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer with hint */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex gap-4">
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↵</kbd> open</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
