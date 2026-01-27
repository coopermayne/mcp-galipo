import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getCases } from '../../api/cases';
import { quickCreateTask, quickCreateEvent } from '../../api/quickCreate';
import type { CaseSummary } from '../../types/case';

type Mode = 'search' | 'task' | 'event';

// Detect if running on Mac
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Modifier key symbol for hints
const modKey = isMac ? '^' : 'Alt+';

interface QuickCaseSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

export function QuickCaseSearch({ isOpen, onClose }: QuickCaseSearchProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('search');
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: casesData } = useQuery({
    queryKey: ['cases'],
    queryFn: () => getCases(),
    enabled: isOpen,
  });

  const cases = casesData?.cases || [];

  // Filter cases based on search term (only in search mode)
  const filteredCases = mode === 'search'
    ? cases.filter((c: CaseSummary) => {
        const search = searchTerm.toLowerCase();
        return (
          c.case_name.toLowerCase().includes(search) ||
          (c.short_name?.toLowerCase().includes(search) ?? false)
        );
      })
    : [];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setMode('search');
      setSelectedCase(null);
      setIsSubmitting(false);
      setFeedback(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (mode === 'search' && selectedIndex >= filteredCases.length) {
      setSelectedIndex(Math.max(0, filteredCases.length - 1));
    }
  }, [filteredCases.length, selectedIndex, mode]);

  // Clear feedback after a delay
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Switch to create mode
  const enterCreateMode = (createMode: 'task' | 'event') => {
    const targetCase = filteredCases[selectedIndex];
    if (targetCase) {
      setSelectedCase(targetCase);
      setMode(createMode);
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // Go back to search mode
  const exitCreateMode = () => {
    setMode('search');
    setSelectedCase(null);
    setSearchTerm('');
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Handle submission
  const handleSubmit = async () => {
    if (!selectedCase || !searchTerm.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (mode === 'task') {
        const response = await quickCreateTask(selectedCase.id, searchTerm.trim());
        if (response.success && response.task) {
          setFeedback({ type: 'success', message: 'Task created!' });
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['case', selectedCase.id] });
          // Reset for another creation
          setSearchTerm('');
        } else {
          const errorMsg = response.error?.message || 'Failed to create task';
          setFeedback({ type: 'error', message: errorMsg });
        }
      } else if (mode === 'event') {
        const response = await quickCreateEvent(selectedCase.id, searchTerm.trim());
        if (response.success && response.event) {
          setFeedback({ type: 'success', message: 'Event created!' });
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['case', selectedCase.id] });
          queryClient.invalidateQueries({ queryKey: ['calendar'] });
          // Reset for another creation
          setSearchTerm('');
        } else {
          const errorMsg = response.error?.message || 'Failed to create event';
          setFeedback({ type: 'error', message: errorMsg });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape - always available
      if (e.key === 'Escape') {
        if (mode !== 'search') {
          e.preventDefault();
          exitCreateMode();
        } else {
          onClose();
        }
        return;
      }

      // In search mode
      if (mode === 'search') {
        switch (e.key) {
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
      }

      // In task/event mode
      if (mode === 'task' || mode === 'event') {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCases, selectedIndex, navigate, onClose, mode, searchTerm]);

  // Handle Ctrl+T/E (Mac) or Alt+T/E (Windows) for entering create mode
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode === 'search' && filteredCases[selectedIndex]) {
      // Check for our modifier key (Control on Mac, Alt on Windows)
      const hasModifier = isMac ? e.ctrlKey : e.altKey;
      if (!hasModifier) return;

      const key = e.key.toLowerCase();

      // Ctrl+T (Mac) / Alt+T (Windows) for task
      if (key === 't') {
        e.preventDefault();
        enterCreateMode('task');
        return;
      }
      // Ctrl+E (Mac) / Alt+E (Windows) for event
      if (key === 'e') {
        e.preventDefault();
        enterCreateMode('event');
        return;
      }
    }
  };

  if (!isOpen) return null;

  // Get placeholder text based on mode
  const getPlaceholder = () => {
    if (mode === 'task' && selectedCase) {
      return `Create task for ${selectedCase.short_name || selectedCase.case_name}...`;
    }
    if (mode === 'event' && selectedCase) {
      return `Create event for ${selectedCase.short_name || selectedCase.case_name}...`;
    }
    return 'Search cases...';
  };

  // Get icon based on mode
  const getIcon = () => {
    if (isSubmitting) {
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    return <Search className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Mode indicator and case badge */}
        {mode !== 'search' && selectedCase && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              mode === 'task'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
            }`}>
              {mode === 'task' ? 'New Task' : 'New Event'}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
              {selectedCase.short_name || selectedCase.case_name}
            </span>
            <button
              onClick={exitCreateMode}
              className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title="Back to search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Feedback message */}
        {feedback && (
          <div className={`px-4 py-2 flex items-center gap-2 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.message}
          </div>
        )}

        {/* Search/Create input */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
          {getIcon()}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (mode === 'search') {
                setSelectedIndex(0);
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={getPlaceholder()}
            disabled={isSubmitting}
            className="flex-1 px-3 py-4 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none disabled:opacity-50"
          />
          {mode === 'search' && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Results (only in search mode) */}
        {mode === 'search' && (
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
        )}

        {/* Help text for create mode */}
        {mode !== 'search' && (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">
            {mode === 'task' ? (
              <p>Type a task like "file motion to compel next friday" or "call client tomorrow"</p>
            ) : (
              <p>Type an event like "deposition of smith tomorrow at 2pm" or "hearing next monday 9am dept 5"</p>
            )}
          </div>
        )}

        {/* Footer with hints */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
          {mode === 'search' ? (
            <>
              <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↑↓</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↵</kbd> open</span>
              {filteredCases.length > 0 && (
                <>
                  <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{modKey}T</kbd> task</span>
                  <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{modKey}E</kbd> event</span>
                </>
              )}
              <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">esc</kbd> close</span>
            </>
          ) : (
            <>
              <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↵</kbd> create</span>
              <span><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">esc</kbd> back</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
