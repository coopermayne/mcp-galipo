/**
 * AssigneeFilterDropdown - Filter tasks by assignee
 *
 * Options:
 * - All tasks (default)
 * - My tasks
 * - Unassigned
 * - [Paralegal names] (for attorneys only)
 */
import { useState, useRef, useEffect } from 'react';
import { User, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserColorClass } from '../../utils';
import type { CaseStaffUser } from '../../types';

export type AssigneeFilterValue = 'all' | 'mine' | 'unassigned' | number;

interface AssigneeFilterDropdownProps {
  /** Current filter value */
  value: AssigneeFilterValue;
  /** Called when filter changes */
  onChange: (value: AssigneeFilterValue) => void;
  /** List of paralegals visible to current user (for attorneys) */
  paralegals?: CaseStaffUser[];
}

export function AssigneeFilterDropdown({
  value,
  onChange,
  paralegals = [],
}: AssigneeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();

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

  const handleSelect = (newValue: AssigneeFilterValue) => {
    onChange(newValue);
    setIsOpen(false);
  };

  // Get display text for current filter
  const getDisplayText = (): string => {
    if (value === 'all') return 'All';
    if (value === 'mine') return 'Mine';
    if (value === 'unassigned') return 'Unassigned';
    // Find paralegal name
    const paralegal = paralegals.find(p => p.id === value);
    if (paralegal) return paralegal.initials;
    return 'All';
  };

  // Check if not using default filter
  const hasNonDefault = value !== 'all';

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
        <User className="w-4 h-4" />
        <span>{getDisplayText()}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 animate-fadeSlideIn">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Show tasks
          </div>

          {/* All tasks */}
          <button
            onClick={() => handleSelect('all')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <div className="w-4 h-4" />
            <span className="flex-1">All tasks</span>
            {value === 'all' && (
              <Check className="w-4 h-4 text-primary-500" />
            )}
          </button>

          {/* My tasks */}
          <button
            onClick={() => handleSelect('mine')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {currentUser && (
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-medium ${getUserColorClass(currentUser.id)}`}
              >
                {currentUser.initials}
              </span>
            )}
            <span className="flex-1">My tasks</span>
            {value === 'mine' && (
              <Check className="w-4 h-4 text-primary-500" />
            )}
          </button>

          {/* Unassigned */}
          <button
            onClick={() => handleSelect('unassigned')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <User className="w-4 h-4 text-slate-400" />
            <span className="flex-1">Unassigned</span>
            {value === 'unassigned' && (
              <Check className="w-4 h-4 text-primary-500" />
            )}
          </button>

          {/* Paralegals (for attorneys) */}
          {paralegals.length > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Team
              </div>
              {paralegals.map((paralegal) => (
                <button
                  key={paralegal.id}
                  onClick={() => handleSelect(paralegal.id)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-medium ${getUserColorClass(paralegal.id)}`}
                  >
                    {paralegal.initials}
                  </span>
                  <span className="flex-1">{paralegal.first_name} {paralegal.last_name}</span>
                  {value === paralegal.id && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
