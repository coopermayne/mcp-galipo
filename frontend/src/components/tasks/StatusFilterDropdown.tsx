/**
 * StatusFilterDropdown - Multi-select dropdown for filtering tasks by status
 *
 * Shows checkboxes for each status. Default: Pending, Active, Blocked checked (Done hidden).
 * Shows count badge like "3 statuses" or "All".
 */
import { useState, useRef, useEffect } from 'react';
import { Filter, Check } from 'lucide-react';
import { STATUS_CONFIG } from './statusConfig';
import { ActiveStatusIcon } from './ActiveStatusIcon';
import type { TaskStatus } from '../../types';

interface StatusFilterDropdownProps {
  /** Currently selected statuses */
  selectedStatuses: TaskStatus[];
  /** Callback when selection changes */
  onChange: (statuses: TaskStatus[]) => void;
}

export function StatusFilterDropdown({
  selectedStatuses,
  onChange,
}: StatusFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const toggleStatus = (status: TaskStatus) => {
    if (selectedStatuses.includes(status)) {
      // Don't allow deselecting if it's the last one
      if (selectedStatuses.length > 1) {
        onChange(selectedStatuses.filter(s => s !== status));
      }
    } else {
      onChange([...selectedStatuses, status]);
    }
  };

  const selectAll = () => {
    onChange(STATUS_CONFIG.map(s => s.value));
  };

  // Display text for the button (shorter on mobile)
  const allSelected = selectedStatuses.length === STATUS_CONFIG.length;
  const buttonText = allSelected
    ? 'All'
    : `${selectedStatuses.length}`;

  // Check if we have a non-default selection (default is Pending, Active, Blocked)
  const hasNonDefault = selectedStatuses.includes('Done') ||
    !selectedStatuses.includes('Pending') ||
    !selectedStatuses.includes('Active') ||
    !selectedStatuses.includes('Blocked');

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
          isOpen || hasNonDefault
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>{buttonText}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Show statuses
          </div>

          {STATUS_CONFIG.map((config) => {
            const Icon = config.icon;
            const isChecked = selectedStatuses.includes(config.value);

            return (
              <button
                key={config.value}
                onClick={() => toggleStatus(config.value)}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  isChecked
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {isChecked && <Check className="w-3 h-3 text-white" />}
                </div>
                {config.value === 'Active' ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    <ActiveStatusIcon className="w-4 h-4" />
                  </span>
                ) : (
                  <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
                <span>{config.label}</span>
              </button>
            );
          })}

          <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
            <button
              onClick={selectAll}
              disabled={allSelected}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="ml-7">Show all</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
